#!/usr/bin/env python3
"""
Error Handling Validator
========================
Scans Go code for error handling violations:
- Ignored errors using _
- Type assertions without ok check
- JSON marshal/unmarshal errors ignored
- Resource lock release errors ignored
- Bare error returns without wrapping
- Parse/strconv errors ignored

This addresses ~40% of critical issues found in code reviews.

Usage:
    python validate_error_handling.py <path>
    python validate_error_handling.py features/workflow
    python validate_error_handling.py features/workflow --strict
"""

import argparse
import re
import sys
import io
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict
from collections import defaultdict

# Fix for Windows console encoding issues
if sys.platform == 'win32' and hasattr(sys.stdout, 'buffer'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass


@dataclass
class ErrorHandlingViolation:
    """Represents an error handling violation."""
    severity: str  # CRITICAL, ERROR, WARNING
    file: str
    line: int
    column: int
    message: str
    rule: str
    code_snippet: str = ""
    fix_suggestion: str = ""
    category: str = ""


@dataclass
class ValidationResult:
    """Holds validation results."""
    files_scanned: int = 0
    violations: List[ErrorHandlingViolation] = field(default_factory=list)


class ErrorHandlingValidator:
    """Validator for error handling standards."""
    
    def __init__(self, strict: bool = False):
        self.result = ValidationResult()
        self.strict = strict
        
        # Category definitions with patterns
        self.categories = {
            'json': {
                'name': 'JSON Marshaling',
                'patterns': [
                    (r'\w+,\s*_\s*:?=\s*json\.Marshal\([^)]+\)', 'ERROR', 
                     'json.Marshal error ignored', 
                     'Handle error: if err != nil { return fmt.Errorf("failed to marshal: %w", err) }'),
                    (r'\w+,\s*_\s*:?=\s*json\.Unmarshal\([^)]+\)', 'ERROR', 
                     'json.Unmarshal error ignored',
                     'Handle error: if err != nil { return fmt.Errorf("failed to unmarshal: %w", err) }'),
                    (r'_\s*=\s*json\.Unmarshal\([^)]+\)', 'ERROR', 
                     'json.Unmarshal error completely ignored',
                     'Handle error: if err := json.Unmarshal(...); err != nil { ... }'),
                ]
            },
            'type_assertion': {
                'name': 'Type Assertions',
                'patterns': [
                    (r'(\w+),\s*_\s*:?=\s*\w+\.Get\([^)]+\)\.\([^)]+\)', 'ERROR',
                     'Type assertion ok check ignored - may cause silent failures',
                     'Use: val, ok := ctx.Get("key").(Type); if !ok { handle error }'),
                    (r'(\w+),\s*_\s*:?=\s*ctx\.Value\([^)]+\)\.\([^)]+\)', 'ERROR',
                     'Context value type assertion ok check ignored',
                     'Check ok: val, ok := ctx.Value(key).(Type); if !ok { ... }'),
                ]
            },
            'strconv': {
                'name': 'String Conversion',
                'patterns': [
                    (r'\w+,\s*_\s*:?=\s*strconv\.Atoi\([^)]+\)', 'ERROR',
                     'strconv.Atoi error ignored - may produce incorrect values',
                     'Handle: if val, err := strconv.Atoi(s); err != nil { return defaultVal }'),
                    (r'\w+,\s*_\s*:?=\s*strconv\.ParseFloat\([^)]+\)', 'ERROR',
                     'strconv.ParseFloat error ignored',
                     'Handle: if val, err := strconv.ParseFloat(s, 64); err != nil { ... }'),
                    (r'\w+,\s*_\s*:?=\s*strconv\.ParseInt\([^)]+\)', 'ERROR',
                     'strconv.ParseInt error ignored',
                     'Handle the parse error or use a default value'),
                    (r'\w+,\s*_\s*:?=\s*strconv\.ParseBool\([^)]+\)', 'ERROR',
                     'strconv.ParseBool error ignored',
                     'Handle the parse error or use a default value'),
                ]
            },
            'url': {
                'name': 'URL Parsing',
                'patterns': [
                    (r'\w+,\s*_\s*:?=\s*url\.Parse\([^)]+\)', 'ERROR',
                     'url.Parse error ignored',
                     'Handle: if u, err := url.Parse(s); err != nil { return err }'),
                    (r'\w+,\s*_\s*:?=\s*url\.ParseQuery\([^)]+\)', 'ERROR',
                     'url.ParseQuery error ignored',
                     'Handle the parse error'),
                    (r'\w+,\s*_\s*:?=\s*url\.QueryUnescape\([^)]+\)', 'WARNING',
                     'url.QueryUnescape error ignored',
                     'Consider handling the unescape error'),
                ]
            },
            'resource_lock': {
                'name': 'Resource Lock',
                'patterns': [
                    (r'_,?\s*_\s*=\s*\w+\.ReleaseLock\([^)]+\)', 'ERROR',
                     'Lock release error ignored - may cause deadlocks',
                     'Log the error: if err := ReleaseLock(...); err != nil { logger.Warn(...) }'),
                    (r'_\s*=\s*\w+\.Unlock\([^)]*\)', 'WARNING',
                     'Unlock error ignored',
                     'Consider logging unlock failures'),
                ]
            },
            'db_operation': {
                'name': 'Database Operation',
                'patterns': [
                    (r'\w+,\s*_\s*:?=\s*\w+\.(Find|FindOne|FindByID)\([^)]+\)', 'ERROR',
                     'Database Find error ignored',
                     'Handle: result, err := repo.Find(...); if err != nil { ... }'),
                    (r'_\s*=\s*\w+\.(Insert|Update|Delete|Save)\([^)]+\)', 'CRITICAL',
                     'Database mutation error completely ignored',
                     'MUST handle: if err := repo.Save(...); err != nil { return err }'),
                    (r'\w+,\s*_\s*:?=\s*collection\.CountDocuments\([^)]+\)', 'ERROR',
                     'MongoDB CountDocuments error ignored',
                     'Handle the count error'),
                ]
            },
            'file_operation': {
                'name': 'File Operation',
                'patterns': [
                    (r'\w+,\s*_\s*:?=\s*os\.Stat\([^)]+\)', 'ERROR',
                     'os.Stat error ignored',
                     'Handle: if info, err := os.Stat(path); err != nil { ... }'),
                    (r'\w+,\s*_\s*:?=\s*\w+\.Stat\(\)', 'ERROR',
                     'file.Stat error ignored',
                     'Handle the stat error'),
                    (r'_\s*=\s*os\.(Remove|MkdirAll|Chmod)\([^)]+\)', 'WARNING',
                     'File system operation error ignored',
                     'Consider logging file operation failures'),
                ]
            },
            'bare_error': {
                'name': 'Error Wrapping',
                'patterns': [
                    (r'^\s*return\s+err\s*$', 'WARNING',
                     'Bare "return err" without wrapping loses context',
                     'Wrap: return fmt.Errorf("operation failed: %w", err)'),
                    (r'^\s*return\s+nil,\s*err\s*$', 'WARNING',
                     'Bare "return nil, err" without wrapping',
                     'Wrap: return nil, fmt.Errorf("failed to X: %w", err)'),
                ]
            },
        }
    
    def _has_intentional_comment(self, line: str, lines: List[str], line_num: int) -> bool:
        """Check if line has an intentional usage comment."""
        if '// intentionally' in line.lower():
            return True
        if '//nolint:errcheck' in line:
            return True
        if line_num > 1:
            prev_line = lines[line_num - 2]
            if '// intentionally' in prev_line.lower():
                return True
            if '//nolint' in prev_line:
                return True
        return False
    
    def validate_file(self, filepath: Path) -> None:
        """Validate a single Go file."""
        if not filepath.suffix == '.go':
            return
        if filepath.name.endswith('_test.go'):
            return
        
        self.result.files_scanned += 1
        
        try:
            content = filepath.read_text(encoding='utf-8')
            lines = content.split('\n')
        except Exception as e:
            self.result.violations.append(ErrorHandlingViolation(
                severity='ERROR',
                file=str(filepath),
                line=0,
                column=0,
                message=f'Failed to read file: {e}',
                rule='file-read',
                category='system'
            ))
            return
        
        # Check each category
        for cat_key, category in self.categories.items():
            # Skip bare_error unless strict mode
            if cat_key == 'bare_error' and not self.strict:
                continue
                
            for line_num, line in enumerate(lines, 1):
                # Skip if intentionally ignored
                if self._has_intentional_comment(line, lines, line_num):
                    continue
                
                for pattern, severity, message, fix in category['patterns']:
                    match = re.search(pattern, line)
                    if match:
                        self.result.violations.append(ErrorHandlingViolation(
                            severity=severity,
                            file=str(filepath),
                            line=line_num,
                            column=match.start() + 1,
                            message=message,
                            rule=f'{cat_key}-error',
                            code_snippet=line.strip(),
                            fix_suggestion=fix,
                            category=category['name']
                        ))
    
    def validate_directory(self, dirpath: Path) -> None:
        """Recursively validate all Go files in a directory."""
        for filepath in dirpath.rglob('*.go'):
            self.validate_file(filepath)
    
    def print_report(self) -> int:
        """Print the validation report. Returns exit code."""
        print("=" * 70)
        print("ERROR HANDLING VALIDATION REPORT")
        print("=" * 70)
        print(f"Files scanned: {self.result.files_scanned}")
        print()
        
        if not self.result.violations:
            print("✅ ALL CHECKS PASSED! Error handling is correct.")
            return 0
        
        # Group by category
        by_category: Dict[str, List[ErrorHandlingViolation]] = defaultdict(list)
        for v in self.result.violations:
            by_category[v.category].append(v)
        
        # Group by severity for summary
        by_severity = defaultdict(list)
        for v in self.result.violations:
            by_severity[v.severity].append(v)
        
        # Print by category
        for category, violations in sorted(by_category.items()):
            if not violations:
                continue
            
            critical_count = len([v for v in violations if v.severity == 'CRITICAL'])
            error_count = len([v for v in violations if v.severity == 'ERROR'])
            
            severity_indicator = '🚨' if critical_count > 0 else ('❌' if error_count > 0 else '⚠️')
            
            print(f"\n{severity_indicator} {category} ({len(violations)} issues)")
            print("-" * 50)
            
            for v in violations:
                color = {'CRITICAL': '\033[91m', 'ERROR': '\033[93m', 'WARNING': '\033[33m'}.get(v.severity, '')
                color_end = '\033[0m'
                
                print(f"\n  [{color}{v.severity}{color_end}] {v.file}:{v.line}")
                print(f"  {v.message}")
                if v.code_snippet:
                    print(f"  Code: {v.code_snippet}")
                if v.fix_suggestion:
                    print(f"  Fix:  {v.fix_suggestion}")
        
        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY BY SEVERITY")
        print(f"  🚨 Critical: {len(by_severity.get('CRITICAL', []))}")
        print(f"  ❌ Errors:   {len(by_severity.get('ERROR', []))}")
        print(f"  ⚠️  Warnings: {len(by_severity.get('WARNING', []))}")
        print("=" * 70)
        
        print("\nSUMMARY BY CATEGORY")
        for category, violations in sorted(by_category.items()):
            print(f"  {category}: {len(violations)}")
        print("=" * 70)
        
        # Determine exit code
        if by_severity.get('CRITICAL'):
            print("\n❌ VALIDATION FAILED: Critical error handling violations found.")
            return 2
        elif by_severity.get('ERROR'):
            print("\n❌ VALIDATION FAILED: Error handling violations found.")
            return 1
        else:
            print("\n⚠️  Validation passed with warnings.")
            return 0


def main():
    parser = argparse.ArgumentParser(
        description="Validate Go code for error handling standards"
    )
    parser.add_argument("path", help="Path to Go file or directory to validate")
    parser.add_argument("--strict", action="store_true",
                        help="Enable strict mode (includes bare error returns)")
    parser.add_argument("--json", action="store_true",
                        help="Output in JSON format")
    parser.add_argument("--category", type=str, default=None,
                        help="Filter by category (json, type_assertion, strconv, etc.)")
    
    args = parser.parse_args()
    target = Path(args.path)
    
    if not target.exists():
        print(f"Error: Path does not exist: {target}")
        sys.exit(1)
    
    validator = ErrorHandlingValidator(strict=args.strict)
    
    if target.is_file():
        validator.validate_file(target)
    else:
        validator.validate_directory(target)
    
    if args.json:
        import json
        output = {
            'files_scanned': validator.result.files_scanned,
            'violations': [
                {
                    'severity': v.severity,
                    'category': v.category,
                    'file': v.file,
                    'line': v.line,
                    'column': v.column,
                    'message': v.message,
                    'rule': v.rule,
                    'code_snippet': v.code_snippet,
                    'fix_suggestion': v.fix_suggestion
                }
                for v in validator.result.violations
                if not args.category or v.category.lower() == args.category.lower()
            ],
            'passed': len([v for v in validator.result.violations if v.severity == 'CRITICAL']) == 0
        }
        print(json.dumps(output, indent=2))
        sys.exit(0 if output['passed'] else 1)
    else:
        exit_code = validator.print_report()
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
