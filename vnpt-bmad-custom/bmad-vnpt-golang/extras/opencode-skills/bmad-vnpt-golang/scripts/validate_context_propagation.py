#!/usr/bin/env python3
"""
Context Propagation Validator
==============================
Scans Go code for context propagation violations:
- context.Background() in request handlers
- context.TODO() that should be proper context
- Missing context in async operations

This addresses the #1 issue found in code reviews (~35% of critical issues).

Usage:
    python validate_context_propagation.py <path>
    python validate_context_propagation.py features/workflow/controllers
    python validate_context_propagation.py features/workflow --report
"""

import argparse
import re
import sys
import io
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Set, Tuple
from collections import defaultdict

# Fix for Windows console encoding issues
if sys.platform == 'win32' and hasattr(sys.stdout, 'buffer'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass


@dataclass
class ContextViolation:
    """Represents a context propagation violation."""
    severity: str  # CRITICAL, WARNING, INFO
    file: str
    line: int
    column: int
    message: str
    rule: str
    code_snippet: str = ""
    suggestion: str = ""


@dataclass 
class ValidationResult:
    """Holds validation results."""
    files_scanned: int = 0
    violations: List[ContextViolation] = field(default_factory=list)


class ContextPropagationValidator:
    """Validator for context propagation standards."""
    
    # Files that are allowed to use context.Background()
    ALLOWED_FILES = {
        'main.go',
        'cmd',  # Command entry points
    }
    
    # Patterns in file paths that are allowed
    ALLOWED_PATH_PATTERNS = [
        r'_test\.go$',           # Test files
        r'main\.go$',            # main() entry point
        r'/cmd/',                # Command packages
        r'\\cmd\\',              # Windows path
    ]
    
    # Functions where context.Background() is acceptable
    ALLOWED_FUNCTIONS = [
        'main',
        'init',
        'TestMain',
        'SetUp',
        'TearDown',
    ]
    
    def __init__(self):
        self.result = ValidationResult()
        
    def _is_allowed_file(self, filepath: Path) -> bool:
        """Check if file is allowed to use context.Background()."""
        path_str = str(filepath)
        return any(
            re.search(pattern, path_str)
            for pattern in self.ALLOWED_PATH_PATTERNS
        )
    
    def _is_in_allowed_function(self, lines: List[str], line_num: int) -> bool:
        """Check if the line is inside an allowed function."""
        # Look backward for function declaration
        for i in range(line_num - 1, max(0, line_num - 50), -1):
            line = lines[i]
            for func_name in self.ALLOWED_FUNCTIONS:
                if f'func {func_name}(' in line or f'func {func_name} (' in line:
                    return True
            # If we hit another function, stop
            if re.match(r'\s*func\s+', line):
                return False
        return False
    
    def _has_intentional_comment(self, line: str, lines: List[str], line_num: int) -> bool:
        """Check if line has an intentional usage comment."""
        # Check current line
        if '// intentionally' in line.lower() or '// note:' in line.lower():
            return True
        # Check previous line for comment
        if line_num > 1:
            prev_line = lines[line_num - 2]
            if '// intentionally' in prev_line.lower() or '// note:' in prev_line.lower():
                return True
            if '// background context' in prev_line.lower():
                return True
        return False
    
    def validate_file(self, filepath: Path) -> None:
        """Validate a single Go file."""
        if not filepath.suffix == '.go':
            return
        if filepath.name.endswith('_test.go'):
            return
            
        self.result.files_scanned += 1
        
        is_allowed = self._is_allowed_file(filepath)
        
        try:
            content = filepath.read_text(encoding='utf-8')
            lines = content.split('\n')
        except Exception as e:
            self.result.violations.append(ContextViolation(
                severity='ERROR',
                file=str(filepath),
                line=0,
                column=0,
                message=f'Failed to read file: {e}',
                rule='file-read'
            ))
            return
        
        # Determine if this is a controller/handler file
        is_controller = 'controller' in str(filepath).lower() or 'handler' in str(filepath).lower()
        
        for line_num, line in enumerate(lines, 1):
            # Check for context.Background()
            match = re.search(r'context\.Background\(\)', line)
            if match:
                # Skip if in allowed file
                if is_allowed:
                    continue
                    
                # Skip if in allowed function
                if self._is_in_allowed_function(lines, line_num):
                    continue
                    
                # Skip if intentionally documented
                if self._has_intentional_comment(line, lines, line_num):
                    continue
                
                # Higher severity for controllers
                severity = 'CRITICAL' if is_controller else 'WARNING'
                
                self.result.violations.append(ContextViolation(
                    severity=severity,
                    file=str(filepath),
                    line=line_num,
                    column=match.start() + 1,
                    message='context.Background() in request scope - use parent context instead',
                    rule='context-background',
                    code_snippet=line.strip(),
                    suggestion='Use ctx.Request().Context() or pass context from caller'
                ))
            
            # Check for context.TODO()
            match = re.search(r'context\.TODO\(\)', line)
            if match:
                self.result.violations.append(ContextViolation(
                    severity='WARNING',
                    file=str(filepath),
                    line=line_num,
                    column=match.start() + 1,
                    message='context.TODO() found - replace with proper context propagation',
                    rule='context-todo',
                    code_snippet=line.strip(),
                    suggestion='Replace with parent context or document why TODO is needed'
                ))
            
            # Check for goroutines without context
            if 'go func()' in line and 'context' not in line:
                # Check if context is captured in the closure
                closure_start = line_num
                closure_end = min(line_num + 10, len(lines))
                closure_content = '\n'.join(lines[closure_start:closure_end])
                
                if 'context.' not in closure_content and 'ctx' not in closure_content:
                    self.result.violations.append(ContextViolation(
                        severity='WARNING',
                        file=str(filepath),
                        line=line_num,
                        column=line.find('go func'),
                        message='Goroutine started without context - may miss cancellation signals',
                        rule='goroutine-no-context',
                        code_snippet=line.strip(),
                        suggestion='Pass context to goroutine for proper lifecycle management'
                    ))
    
    def validate_directory(self, dirpath: Path) -> None:
        """Recursively validate all Go files in a directory."""
        for filepath in dirpath.rglob('*.go'):
            self.validate_file(filepath)
    
    def print_report(self) -> int:
        """Print the validation report. Returns exit code."""
        print("=" * 70)
        print("CONTEXT PROPAGATION VALIDATION REPORT")
        print("=" * 70)
        print(f"Files scanned: {self.result.files_scanned}")
        print()
        
        if not self.result.violations:
            print("✅ ALL CHECKS PASSED! Context propagation is correct.")
            return 0
        
        # Group by severity
        by_severity = defaultdict(list)
        for v in self.result.violations:
            by_severity[v.severity].append(v)
        
        # Print in order of severity
        for severity in ['CRITICAL', 'WARNING', 'INFO']:
            violations = by_severity.get(severity, [])
            if not violations:
                continue
            
            icon = {'CRITICAL': '🚨', 'WARNING': '⚠️', 'INFO': 'ℹ️'}[severity]
            color_start = {'CRITICAL': '\033[91m', 'WARNING': '\033[93m', 'INFO': '\033[94m'}[severity]
            color_end = '\033[0m'
            
            print(f"\n{icon} {color_start}{severity}{color_end} ({len(violations)} issues)")
            print("-" * 50)
            
            for v in violations:
                print(f"\n  [{v.rule}] {v.file}:{v.line}:{v.column}")
                print(f"  {v.message}")
                if v.code_snippet:
                    print(f"  Code: {v.code_snippet}")
                if v.suggestion:
                    print(f"  Fix:  {v.suggestion}")
        
        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print(f"  🚨 Critical: {len(by_severity.get('CRITICAL', []))}")
        print(f"  ⚠️  Warnings: {len(by_severity.get('WARNING', []))}")
        print(f"  ℹ️  Info:     {len(by_severity.get('INFO', []))}")
        print("=" * 70)
        
        # Common fix patterns
        if by_severity.get('CRITICAL'):
            print("\n" + "=" * 70)
            print("COMMON FIXES:")
            print("=" * 70)
            print("""
1. In Controllers (Echo):
   BEFORE: result, err := c.service.Do(context.Background(), input)
   AFTER:  result, err := c.service.Do(ctx.Request().Context(), input)

2. In Services with timeout:
   BEFORE: ctx := context.Background()
   AFTER:  ctx, cancel := context.WithTimeout(parentCtx, 30*time.Second)
           defer cancel()

3. In Goroutines:
   BEFORE: go func() { doWork(context.Background()) }()
   AFTER:  go func(ctx context.Context) { doWork(ctx) }(parentCtx)

4. For scheduled/background tasks:
   // Note: Using context.Background() because this is a scheduled job
   // with its own lifecycle independent of HTTP requests.
   ctx := context.Background()
""")
        
        # Determine exit code
        if by_severity.get('CRITICAL'):
            print("\n❌ VALIDATION FAILED: Critical context violations found.")
            return 2
        elif by_severity.get('WARNING'):
            print("\n⚠️  Validation passed with warnings. Review recommended.")
            return 0
        else:
            return 0


def main():
    parser = argparse.ArgumentParser(
        description="Validate Go code for context propagation standards"
    )
    parser.add_argument("path", help="Path to Go file or directory to validate")
    parser.add_argument("--json", action="store_true",
                        help="Output in JSON format")
    parser.add_argument("--report", action="store_true",
                        help="Generate detailed report with fix suggestions")
    
    args = parser.parse_args()
    target = Path(args.path)
    
    if not target.exists():
        print(f"Error: Path does not exist: {target}")
        sys.exit(1)
    
    validator = ContextPropagationValidator()
    
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
                    'file': v.file,
                    'line': v.line,
                    'column': v.column,
                    'message': v.message,
                    'rule': v.rule,
                    'code_snippet': v.code_snippet,
                    'suggestion': v.suggestion
                }
                for v in validator.result.violations
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
