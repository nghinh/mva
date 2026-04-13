#!/usr/bin/env python3
"""
Production-Ready Code Validator
================================
Scans Go code for violations of production-ready standards:
- TODOs, FIXMEs, placeholders
- Ignored errors (using _)
- Empty function bodies
- Missing error handling
- Stub implementations

Usage:
    python validate_production_ready.py <path>
    python validate_production_ready.py features/notifications
    python validate_production_ready.py features/notifications --strict
"""

import argparse
import re
import sys
import io

# Fix for Windows console encoding issues
if sys.platform == 'win32' and hasattr(sys.stdout, 'buffer'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple
from collections import defaultdict


@dataclass
class Violation:
    """Represents a code violation."""
    severity: str  # CRITICAL, ERROR, WARNING
    file: str
    line: int
    column: int
    message: str
    rule: str
    code_snippet: str = ""


@dataclass
class ValidationResult:
    """Holds validation results."""
    files_scanned: int = 0
    violations: List[Violation] = field(default_factory=list)


class ProductionReadyValidator:
    """Validator for production-ready code standards."""

    def __init__(self, strict: bool = False):
        self.result = ValidationResult()
        self.strict = strict
        
        # Patterns that are NEVER acceptable
        self.forbidden_patterns = [
            # TODOs and placeholders
            (r'//\s*TODO', 'CRITICAL', 'no-todo', 'TODO comment found - must be implemented'),
            (r'//\s*FIXME', 'CRITICAL', 'no-fixme', 'FIXME comment found - must be fixed'),
            (r'//\s*XXX', 'CRITICAL', 'no-xxx', 'XXX comment found - must be addressed'),
            (r'//\s*HACK', 'CRITICAL', 'no-hack', 'HACK comment found - must be properly implemented'),
            (r'//\s*placeholder', 'CRITICAL', 'no-placeholder', 'Placeholder comment found'),
            (r'//\s*stub', 'CRITICAL', 'no-stub', 'Stub comment found'),
            (r'//\s*implement later', 'CRITICAL', 'no-defer', 'Deferred implementation found'),
            (r'//\s*skip.*for now', 'CRITICAL', 'no-skip', 'Skipped logic found'),
            (r'//\s*will implement', 'CRITICAL', 'no-defer', 'Deferred implementation found'),
            
            # Ignored errors - general pattern
            (r',\s*_\s*:?=\s*\w+\.\w+\([^)]*\)', 'ERROR', 'ignored-error', 
             'Potential ignored error return value'),
            
            # Panic in regular code (outside of init/main)
            (r'\bpanic\s*\(', 'WARNING', 'no-panic', 
             'panic() found - prefer returning errors'),
        ]
        
        # === NEW PATTERNS FROM CODE REVIEW REPORTS ===
        
        # Context propagation violations (35% of critical issues)
        self.context_patterns = [
            # context.Background() in controllers (most common issue)
            (r'context\.Background\(\)', 'CRITICAL', 'context-background',
             'context.Background() found - use parent context instead in request handlers'),
            
            # context.TODO() should be temporary
            (r'context\.TODO\(\)', 'WARNING', 'context-todo',
             'context.TODO() found - replace with proper context propagation'),
        ]
        
        # Type assertion violations
        self.type_assertion_patterns = [
            # Ignoring type assertion ok value
            (r'(\w+),\s*_\s*:?=\s*\w+\.Get\([^)]+\)\.\([^)]+\)', 'ERROR', 'type-assertion-ignored',
             'Type assertion ok check ignored - may cause silent failures'),
             
            # Type assertion without ok check (panic risk)
            (r'(\w+)\s*:?=\s*\w+\.Get\([^)]+\)\.\([^)]+\)(?!\s*,\s*\w+)', 'WARNING', 'type-assertion-panic',
             'Type assertion without ok check - may panic'),
        ]
        
        # JSON marshaling violations
        self.json_patterns = [
            # Ignoring json.Marshal error
            (r'\w+,\s*_\s*:?=\s*json\.Marshal\([^)]+\)', 'ERROR', 'json-marshal-ignored',
             'json.Marshal error ignored - may cause data corruption'),
            
            # Ignoring json.Unmarshal error  
            (r'_\s*=\s*json\.Unmarshal\([^)]+\)', 'ERROR', 'json-unmarshal-ignored',
             'json.Unmarshal error ignored - may cause data corruption'),
             
            # json.Unmarshal without error check
            (r'json\.Unmarshal\([^)]+\)\s*$', 'ERROR', 'json-unmarshal-unchecked',
             'json.Unmarshal called without error check'),
        ]
        
        # Resource lock violations
        self.lock_patterns = [
            # Ignoring lock release errors
            (r'_,?\s*_\s*=\s*\w+\.ReleaseLock\([^)]+\)', 'ERROR', 'lock-release-ignored',
             'Lock release error ignored - may cause deadlocks'),
             
            (r'_\s*=\s*\w+\.Unlock\([^)]*\)', 'WARNING', 'unlock-ignored',
             'Unlock error ignored'),
        ]
        
        # Parse/conversion error violations
        self.parse_patterns = [
            # strconv.Atoi without error check
            (r'\w+,\s*_\s*:?=\s*strconv\.Atoi\([^)]+\)', 'ERROR', 'strconv-atoi-ignored',
             'strconv.Atoi error ignored - may cause incorrect values'),
            
            # strconv.ParseFloat without error check
            (r'\w+,\s*_\s*:?=\s*strconv\.ParseFloat\([^)]+\)', 'ERROR', 'strconv-parse-ignored',
             'strconv.ParseFloat error ignored'),
             
            # strconv.ParseInt without error check
            (r'\w+,\s*_\s*:?=\s*strconv\.ParseInt\([^)]+\)', 'ERROR', 'strconv-parse-ignored',
             'strconv.ParseInt error ignored'),
             
            # url.Parse without error check
            (r'\w+,\s*_\s*:?=\s*url\.Parse\([^)]+\)', 'ERROR', 'url-parse-ignored',
             'url.Parse error ignored'),
        ]
        
        # Bare error return patterns (missing context)
        self.bare_error_patterns = [
            # return err without wrapping
            (r'^\s*return\s+err\s*$', 'WARNING', 'bare-error-return',
             'Bare "return err" without wrapping - consider fmt.Errorf("%w", err)'),
             
            # return nil, err without wrapping
            (r'^\s*return\s+nil,\s*err\s*$', 'WARNING', 'bare-error-return',
             'Bare "return nil, err" without wrapping - consider fmt.Errorf("%w", err)'),
        ]
        
        # Patterns for empty/stub function bodies
        self.stub_patterns = [
            # Empty return in non-void function
            (r'func\s+.*\)\s*\([^)]*error[^)]*\)\s*{\s*return\s+nil\s*}', 
             'CRITICAL', 'empty-func', 'Function returns nil without any logic'),
            
            # Just return in function with multiple returns
            (r'func\s+.*\)\s*\([^)]+,\s*error\)\s*{\s*return\s+\w+{},\s*nil\s*}',
             'CRITICAL', 'stub-func', 'Function returns empty struct without logic'),
        ]
        
        # Error handling patterns
        self.error_patterns = [
            # Bind without error check
            (r'ctx\.Bind\s*\([^)]+\)\s*[^;{]*$', 'ERROR', 'unchecked-bind',
             'ctx.Bind() called without error check'),
             
            # Common methods without error check on same line
            (r'(?<!if err := )(?<!if err = )(?<!, err := )(?<!, err = )'
             r'\b(Save|Insert|Update|Delete|FindByID|Find|Set|Get)\s*\([^)]*\)\s*$',
             'WARNING', 'unchecked-call', 'Potential unchecked error from database/cache operation'),
        ]
        
        # Files/paths to exclude from context.Background() checks
        self.context_excluded_patterns = [
            r'_test\.go$',           # Test files can use context.Background()
            r'main\.go$',            # main() can use context.Background()
            r'cmd[/\\].*\.go$',      # Command entry points
        ]

    def validate_file(self, filepath: Path) -> None:
        """Validate a single Go file."""
        if not filepath.suffix == '.go':
            return
        if filepath.name.endswith('_test.go'):
            return

        self.result.files_scanned += 1
        
        # Check for architectural integrity (file location)
        self._check_file_location(filepath)
        
        # Check if file should be excluded from context checks
        is_context_excluded = any(
            re.search(pattern, str(filepath))
            for pattern in self.context_excluded_patterns
        )

        try:
            content = filepath.read_text(encoding='utf-8')
            lines = content.split('\n')
        except Exception as e:
            self.result.violations.append(Violation(
                severity='ERROR',
                file=str(filepath),
                line=0,
                column=0,
                message=f'Failed to read file: {e}',
                rule='file-read'
            ))
            return

        # Check forbidden patterns
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, rule, message in self.forbidden_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    self.result.violations.append(Violation(
                        severity=severity,
                        file=str(filepath),
                        line=line_num,
                        column=match.start() + 1,
                        message=message,
                        rule=rule,
                        code_snippet=line.strip()
                    ))
        
        # === NEW CHECKS FROM CODE REVIEW REPORTS ===
        
        # Check context.Background() patterns (only for non-excluded files)
        if not is_context_excluded:
            for line_num, line in enumerate(lines, 1):
                # Skip if line has intentional comment
                if '// intentionally' in line.lower() or '// note:' in line.lower():
                    continue
                for pattern, severity, rule, message in self.context_patterns:
                    match = re.search(pattern, line)
                    if match:
                        self.result.violations.append(Violation(
                            severity=severity,
                            file=str(filepath),
                            line=line_num,
                            column=match.start() + 1,
                            message=message,
                            rule=rule,
                            code_snippet=line.strip()
                        ))
        
        # Check type assertion patterns
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, rule, message in self.type_assertion_patterns:
                match = re.search(pattern, line)
                if match:
                    self.result.violations.append(Violation(
                        severity=severity,
                        file=str(filepath),
                        line=line_num,
                        column=match.start() + 1,
                        message=message,
                        rule=rule,
                        code_snippet=line.strip()
                    ))
        
        # Check JSON marshaling patterns
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, rule, message in self.json_patterns:
                match = re.search(pattern, line)
                if match:
                    self.result.violations.append(Violation(
                        severity=severity,
                        file=str(filepath),
                        line=line_num,
                        column=match.start() + 1,
                        message=message,
                        rule=rule,
                        code_snippet=line.strip()
                    ))
        
        # Check resource lock patterns
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, rule, message in self.lock_patterns:
                match = re.search(pattern, line)
                if match:
                    self.result.violations.append(Violation(
                        severity=severity,
                        file=str(filepath),
                        line=line_num,
                        column=match.start() + 1,
                        message=message,
                        rule=rule,
                        code_snippet=line.strip()
                    ))
        
        # Check parse/strconv patterns
        for line_num, line in enumerate(lines, 1):
            # Skip if there's an intentional comment
            if '// intentionally' in line.lower():
                continue
            for pattern, severity, rule, message in self.parse_patterns:
                match = re.search(pattern, line)
                if match:
                    self.result.violations.append(Violation(
                        severity=severity,
                        file=str(filepath),
                        line=line_num,
                        column=match.start() + 1,
                        message=message,
                        rule=rule,
                        code_snippet=line.strip()
                    ))
        
        # Check bare error return patterns (in strict mode)
        if self.strict:
            for line_num, line in enumerate(lines, 1):
                for pattern, severity, rule, message in self.bare_error_patterns:
                    match = re.search(pattern, line)
                    if match:
                        self.result.violations.append(Violation(
                            severity=severity,
                            file=str(filepath),
                            line=line_num,
                            column=match.start() + 1,
                            message=message,
                            rule=rule,
                            code_snippet=line.strip()
                        ))

        # Check for stub patterns in full content
        for pattern, severity, rule, message in self.stub_patterns:
            for match in re.finditer(pattern, content, re.MULTILINE | re.DOTALL):
                # Find line number
                line_num = content[:match.start()].count('\n') + 1
                self.result.violations.append(Violation(
                    severity=severity,
                    file=str(filepath),
                    line=line_num,
                    column=1,
                    message=message,
                    rule=rule,
                    code_snippet=match.group(0)[:100] + '...' if len(match.group(0)) > 100 else match.group(0)
                ))

        # Check for error handling patterns
        if self.strict:
            for line_num, line in enumerate(lines, 1):
                for pattern, severity, rule, message in self.error_patterns:
                    match = re.search(pattern, line)
                    if match:
                        self.result.violations.append(Violation(
                            severity=severity,
                            file=str(filepath),
                            line=line_num,
                            column=match.start() + 1,
                            message=message,
                            rule=rule,
                            code_snippet=line.strip()
                        ))

        # Check for empty function bodies
        self._check_empty_functions(filepath, content, lines)

    def _check_empty_functions(self, filepath: Path, content: str, lines: List[str]) -> None:
        """Check for functions with minimal/empty bodies."""
        # Pattern for function with very short body
        func_pattern = r'func\s+(?:\([^)]+\)\s+)?(\w+)\s*\([^)]*\)[^{]*{'
        
        for match in re.finditer(func_pattern, content):
            func_name = match.group(1)
            start_pos = match.end()
            
            # Find matching closing brace
            brace_count = 1
            end_pos = start_pos
            for i in range(start_pos, len(content)):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i
                        break
            
            func_body = content[start_pos:end_pos].strip()
            line_num = content[:match.start()].count('\n') + 1
            
            # Check for empty or near-empty bodies
            if len(func_body) < 15:  # Very short body
                # Skip if it's a one-liner that actually does something
                if 'return' not in func_body or func_body == 'return nil':
                    self.result.violations.append(Violation(
                        severity='WARNING',
                        file=str(filepath),
                        line=line_num,
                        column=1,
                        message=f'Function {func_name} has a very short body - may be incomplete',
                        rule='short-func',
                        code_snippet=f'func {func_name}(...) {{ {func_body} }}'
                    ))

    def validate_directory(self, dirpath: Path) -> None:
        """Recursively validate all Go files in a directory."""
        # Perform directory structure check
        self._check_directory_structure(dirpath)
        
        for filepath in dirpath.rglob('*.go'):
            self.validate_file(filepath)

    def _check_directory_structure(self, dirpath: Path) -> None:
        """Check if feature directory follows the architectural skeleton."""
        path_str = str(dirpath).replace('\\', '/')
        match = re.search(r'features/([^/]+)', path_str)
        if match:
            feature_name = match.group(1)
            # Traverse up to find the feature root
            current = dirpath.absolute()
            feature_root = None
            while current.name != 'features' and current.parent != current:
                if current.parent.name == 'features':
                    feature_root = current
                    break
                current = current.parent
            
            if feature_root and feature_root.is_dir():
                required_folders = ['models', 'services', 'repositories', 'controllers']
                
                # Check for mandatory folders
                for folder in required_folders:
                    folder_path = feature_root / folder
                    if not folder_path.exists() or not folder_path.is_dir():
                        # Only report once
                        issue_exists = any(v.file == str(feature_root) and folder in v.message for v in self.result.violations)
                        if not issue_exists:
                            self.result.violations.append(Violation(
                                severity='CRITICAL',
                                file=str(feature_root),
                                line=0,
                                column=0,
                                message=f'ARCHITECTURAL BREACH: Mandatory folder "{folder}" is missing from feature root. Deleting skeleton folders is strictly forbidden.',
                                rule='architecture-integrity'
                            ))

    def _check_file_location(self, filepath: Path) -> None:
        """Check if the file is placed in a correct layer folder."""
        path_parts = list(filepath.parts)
        if 'features' in path_parts:
            f_idx = path_parts.index('features')
            # features/<name>/<file.go> -> length is f_idx + 3
            if len(path_parts) == f_idx + 3:
                # Exclude internal Go files or module files if any
                if filepath.suffix == '.go' and not filepath.name.endswith('_test.go'):
                    self.result.violations.append(Violation(
                        severity='CRITICAL',
                        file=str(filepath),
                        line=0,
                        column=0,
                        message=f'ARCHITECTURAL BREACH: File {filepath.name} is in feature root instead of a layer folder. Moving files to flatten structure is strictly forbidden.',
                        rule='architecture-integrity'
                    ))

    def print_report(self) -> int:
        """Print the validation report. Returns exit code."""
        print("=" * 70)
        print("PRODUCTION-READY CODE VALIDATION REPORT")
        print("=" * 70)
        print(f"Files scanned: {self.result.files_scanned}")
        print()

        if not self.result.violations:
            print("✅ ALL CHECKS PASSED! Code is production-ready.")
            return 0

        # Group by severity
        by_severity = defaultdict(list)
        for v in self.result.violations:
            by_severity[v.severity].append(v)

        # Print in order of severity
        for severity in ['CRITICAL', 'ERROR', 'WARNING']:
            violations = by_severity.get(severity, [])
            if not violations:
                continue

            icon = {'CRITICAL': '🚨', 'ERROR': '❌', 'WARNING': '⚠️'}[severity]
            color_start = {'CRITICAL': '\033[91m', 'ERROR': '\033[93m', 'WARNING': '\033[33m'}[severity]
            color_end = '\033[0m'

            print(f"\n{icon} {color_start}{severity}{color_end} ({len(violations)} issues)")
            print("-" * 50)

            for v in violations:
                print(f"\n  [{v.rule}] {v.file}:{v.line}:{v.column}")
                print(f"  {v.message}")
                if v.code_snippet:
                    print(f"  Code: {v.code_snippet}")

        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print(f"  🚨 Critical: {len(by_severity.get('CRITICAL', []))}")
        print(f"  ❌ Errors:   {len(by_severity.get('ERROR', []))}")
        print(f"  ⚠️  Warnings: {len(by_severity.get('WARNING', []))}")
        print("=" * 70)

        # Determine exit code
        if by_severity.get('CRITICAL'):
            print("\n❌ VALIDATION FAILED: Critical violations found. Code is NOT production-ready.")
            return 2
        elif by_severity.get('ERROR'):
            print("\n❌ VALIDATION FAILED: Errors found. Please fix before proceeding.")
            return 1
        else:
            print("\n⚠️  Validation passed with warnings. Review recommended.")
            return 0


def main():
    parser = argparse.ArgumentParser(
        description="Validate Go code for production-ready standards"
    )
    parser.add_argument("path", help="Path to Go file or directory to validate")
    parser.add_argument("--strict", action="store_true", 
                        help="Enable strict mode with additional checks")
    parser.add_argument("--json", action="store_true", 
                        help="Output in JSON format")

    args = parser.parse_args()
    target = Path(args.path)

    if not target.exists():
        print(f"Error: Path does not exist: {target}")
        sys.exit(1)

    validator = ProductionReadyValidator(strict=args.strict)

    if target.is_file():
        validator.validate_file(target)
    else:
        validator.validate_directory(target)

    # Standardized Output Path
    report_name = target.absolute().name
    if not report_name or report_name == ".":
        report_name = "root"
    
    output_dir = Path("project-documentation/quality-reports") / report_name
    default_json_output = output_dir / "PRODUCTION_READY_VALIDATION.json"

    if args.json:
        import json
        output = {
            'files_scanned': validator.result.files_scanned,
            'violations': [
                {
                    'severity': v.severity,
                    'file': v.file,
                    'line': v.line,
                    'column': v.column,
                    'message': v.message,
                    'rule': v.rule,
                    'code_snippet': v.code_snippet
                }
                for v in validator.result.violations
            ],
            'passed': len([v for v in validator.result.violations if v.severity == 'CRITICAL']) == 0
        }
        print(json.dumps(output, indent=2))
        sys.exit(0 if output['passed'] else 1)
    else:
        # Always save JSON report in addition to printing to stdout
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output = {
            'files_scanned': validator.result.files_scanned,
            'violations': [v.__dict__ for v in validator.result.violations],
            'passed': len([v for v in validator.result.violations if v.severity == 'CRITICAL']) == 0
        }
        
        with open(default_json_output, "w", encoding="utf-8") as f:
            import json
            json.dump(output, f, indent=2)
        
        print(f"\n✅ JSON report saved to: {default_json_output}")
        
        exit_code = validator.print_report()
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
