#!/usr/bin/env python3
"""
Context TODO Validator
======================
Scans Go code for context.TODO() in production code.
context.TODO() is a DEPLOYMENT BLOCKER - it indicates incomplete refactoring.

This addresses the critical issues found in code reviews where context.TODO()
was left in business logic instead of proper context propagation.

Usage:
    python validate_context_todo.py <path>
    python validate_context_todo.py features/workflow
    python validate_context_todo.py features/workflow --json
"""

import argparse
import re
import sys
import io
from pathlib import Path
from dataclasses import dataclass, field
from typing import List
from collections import defaultdict
import json

# Fix for Windows console encoding issues
if sys.platform == 'win32' and hasattr(sys.stdout, 'buffer'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass


@dataclass
class ContextTodoViolation:
    """Represents a context.TODO() violation."""
    severity: str  # CRITICAL (always for production code)
    file: str
    line: int
    column: int
    message: str
    code_snippet: str = ""
    suggestion: str = ""
    function_name: str = ""


@dataclass 
class ValidationResult:
    """Holds validation results."""
    files_scanned: int = 0
    test_files_skipped: int = 0
    violations: List[ContextTodoViolation] = field(default_factory=list)


class ContextTodoValidator:
    """Validator for context.TODO() usage in production code."""
    
    def __init__(self):
        self.result = ValidationResult()
        
    def _is_test_file(self, filepath: Path) -> bool:
        """Check if file is a test file."""
        return filepath.name.endswith('_test.go')
    
    def _find_function_name(self, lines: List[str], line_num: int) -> str:
        """Find the function name containing the given line."""
        for i in range(line_num - 1, max(0, line_num - 100), -1):
            line = lines[i]
            # Match function declarations
            match = re.search(r'func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(', line)
            if match:
                return match.group(1)
        return "unknown"
    
    def _get_context_around_line(self, lines: List[str], line_num: int, context: int = 2) -> str:
        """Get lines around the violation for context."""
        start = max(0, line_num - context - 1)
        end = min(len(lines), line_num + context)
        
        result = []
        for i in range(start, end):
            prefix = ">>> " if i == line_num - 1 else "    "
            result.append(f"{prefix}{i+1}: {lines[i]}")
        return "\n".join(result)
    
    def validate_file(self, filepath: Path) -> None:
        """Validate a single Go file."""
        if not filepath.suffix == '.go':
            return
            
        # Skip test files (context.TODO() is acceptable in tests)
        if self._is_test_file(filepath):
            self.result.test_files_skipped += 1
            return
            
        self.result.files_scanned += 1
        
        try:
            content = filepath.read_text(encoding='utf-8')
            lines = content.split('\n')
        except Exception as e:
            self.result.violations.append(ContextTodoViolation(
                severity='ERROR',
                file=str(filepath),
                line=0,
                column=0,
                message=f'Failed to read file: {e}'
            ))
            return
        
        for line_num, line in enumerate(lines, 1):
            # Check for context.TODO()
            match = re.search(r'context\.TODO\(\)', line)
            if match:
                function_name = self._find_function_name(lines, line_num)
                
                self.result.violations.append(ContextTodoViolation(
                    severity='CRITICAL',
                    file=str(filepath),
                    line=line_num,
                    column=match.start() + 1,
                    message='context.TODO() in production code - DEPLOYMENT BLOCKER',
                    code_snippet=line.strip(),
                    suggestion='Replace with proper context propagation from caller',
                    function_name=function_name
                ))
    
    def validate_directory(self, dirpath: Path) -> None:
        """Recursively validate all Go files in a directory."""
        for filepath in dirpath.rglob('*.go'):
            self.validate_file(filepath)
    
    def print_report(self) -> int:
        """Print the validation report. Returns exit code."""
        print("=" * 70)
        print("CONTEXT.TODO() VALIDATION REPORT (DEPLOYMENT BLOCKER CHECK)")
        print("=" * 70)
        print(f"Production files scanned: {self.result.files_scanned}")
        print(f"Test files skipped: {self.result.test_files_skipped}")
        print()
        
        if not self.result.violations:
            print("✅ ALL CHECKS PASSED! No context.TODO() in production code.")
            print()
            print("This codebase is READY FOR DEPLOYMENT from context.TODO() perspective.")
            return 0
        
        critical_count = len([v for v in self.result.violations if v.severity == 'CRITICAL'])
        
        print(f"\n🚨 CRITICAL: {critical_count} context.TODO() violations found!")
        print("=" * 70)
        print("⛔ DEPLOYMENT BLOCKED - context.TODO() must be replaced before merge")
        print("=" * 70)
        
        # Group by file
        by_file = defaultdict(list)
        for v in self.result.violations:
            by_file[v.file].append(v)
        
        for filepath, violations in by_file.items():
            print(f"\n📁 {filepath} ({len(violations)} violations)")
            print("-" * 50)
            
            for v in violations:
                print(f"\n  Line {v.line} in function `{v.function_name}`:")
                print(f"  ├─ {v.code_snippet}")
                print(f"  └─ Fix: {v.suggestion}")
        
        # Summary and fix guide
        print("\n" + "=" * 70)
        print("HOW TO FIX:")
        print("=" * 70)
        print("""
context.TODO() means "I'll add proper context later" - but later never comes.

COMMON FIXES:

1. Function doesn't accept context - ADD IT:
   BEFORE:
     func (s *Service) ProcessData(input Input) error {
         ctx := context.TODO()
         return s.repo.Save(ctx, input)
     }
   
   AFTER:
     func (s *Service) ProcessData(ctx context.Context, input Input) error {
         return s.repo.Save(ctx, input)
     }

2. In Controllers - Use request context:
   BEFORE:
     ctx := context.TODO()
     result, err := c.service.Do(ctx, input)
   
   AFTER:
     reqCtx := ctx.Request().Context()
     result, err := c.service.Do(reqCtx, input)

3. In background workers - Use background with timeout:
   BEFORE:
     ctx := context.TODO()
   
   AFTER:
     // Note: Background worker with dedicated lifecycle
     ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
     defer cancel()

4. Already has context - JUST USE IT:
   BEFORE:
     func (s *Service) Handle(parentCtx context.Context) {
         ctx := context.TODO()  // Why??
         s.doWork(ctx)
     }
   
   AFTER:
     func (s *Service) Handle(parentCtx context.Context) {
         s.doWork(parentCtx)  // Use what you have!
     }
""")
        
        print("\n" + "=" * 70)
        print(f"❌ VALIDATION FAILED: {critical_count} DEPLOYMENT BLOCKER(s)")
        print("   You MUST fix these before the code can be merged/deployed.")
        print("=" * 70)
        
        return 2  # Critical exit code
    
    def to_json(self) -> dict:
        """Export results as JSON."""
        return {
            'files_scanned': self.result.files_scanned,
            'test_files_skipped': self.result.test_files_skipped,
            'violations': [
                {
                    'severity': v.severity,
                    'file': v.file,
                    'line': v.line,
                    'column': v.column,
                    'message': v.message,
                    'code_snippet': v.code_snippet,
                    'suggestion': v.suggestion,
                    'function_name': v.function_name
                }
                for v in self.result.violations
            ],
            'passed': len(self.result.violations) == 0,
            'deployment_blocked': len(self.result.violations) > 0,
            'blocker_count': len(self.result.violations)
        }


def main():
    parser = argparse.ArgumentParser(
        description="Validate Go code for context.TODO() - DEPLOYMENT BLOCKER check"
    )
    parser.add_argument("path", help="Path to Go file or directory to validate")
    parser.add_argument("--json", action="store_true",
                        help="Output in JSON format")
    
    args = parser.parse_args()
    target = Path(args.path)
    
    if not target.exists():
        print(f"Error: Path does not exist: {target}")
        sys.exit(1)
    
    validator = ContextTodoValidator()
    
    if target.is_file():
        validator.validate_file(target)
    else:
        validator.validate_directory(target)
    
    if args.json:
        output = validator.to_json()
        print(json.dumps(output, indent=2))
        sys.exit(0 if output['passed'] else 2)
    else:
        exit_code = validator.print_report()
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
