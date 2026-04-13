#!/usr/bin/env python3
"""
Function Size & File Size Validator
====================================
Scans Go code for functions exceeding 50 lines and files exceeding 500 lines.
Large functions/files cause ~34% of code review warnings and lead to:
- Hard to understand and maintain code
- Difficult testing
- Poor separation of concerns
- High cyclomatic complexity

Usage:
    python validate_function_size.py <path>
    python validate_function_size.py features/workflow
    python validate_function_size.py features/workflow --json
    python validate_function_size.py features/workflow --max-func 60 --max-file 600
"""

import argparse
import re
import sys
import io
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from collections import defaultdict
import json

# Fix for Windows console encoding issues
if sys.platform == 'win32' and hasattr(sys.stdout, 'buffer'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass


# Default thresholds
DEFAULT_MAX_FUNCTION_LINES = 50
DEFAULT_MAX_FILE_LINES = 500
WARN_FUNCTION_LINES = 70  # Above this is CRITICAL
WARN_FILE_LINES = 700     # Above this is CRITICAL


@dataclass
class SizeViolation:
    """Represents a size violation."""
    severity: str  # WARNING, CRITICAL
    violation_type: str  # 'function' or 'file'
    file: str
    line: int
    name: str  # function name or filename
    actual_size: int
    max_size: int
    message: str
    suggestion: str = ""


@dataclass
class FunctionInfo:
    """Information about a function."""
    name: str
    start_line: int
    end_line: int
    line_count: int
    is_method: bool
    receiver: str = ""


@dataclass 
class ValidationResult:
    """Holds validation results."""
    files_scanned: int = 0
    functions_analyzed: int = 0
    violations: List[SizeViolation] = field(default_factory=list)


class FunctionSizeValidator:
    """Validator for function and file size standards."""
    
    def __init__(self, max_function_lines: int = DEFAULT_MAX_FUNCTION_LINES,
                 max_file_lines: int = DEFAULT_MAX_FILE_LINES):
        self.max_function_lines = max_function_lines
        self.max_file_lines = max_file_lines
        self.result = ValidationResult()
    
    def _count_code_lines(self, lines: List[str]) -> int:
        """Count non-empty, non-comment lines."""
        count = 0
        in_block_comment = False
        
        for line in lines:
            stripped = line.strip()
            
            # Handle block comments
            if '/*' in stripped:
                in_block_comment = True
            if '*/' in stripped:
                in_block_comment = False
                continue
            
            if in_block_comment:
                continue
            
            # Skip empty lines and single-line comments
            if stripped and not stripped.startswith('//'):
                count += 1
        
        return count
    
    def _find_functions(self, content: str, lines: List[str]) -> List[FunctionInfo]:
        """Find all function definitions and their boundaries."""
        functions = []
        
        # Pattern to match function declarations
        func_pattern = re.compile(
            r'^func\s+'
            r'(?:\(([^)]+)\)\s+)?'  # Optional receiver
            r'(\w+)\s*\(',          # Function name
            re.MULTILINE
        )
        
        for match in func_pattern.finditer(content):
            receiver = match.group(1) or ""
            func_name = match.group(2)
            start_pos = match.start()
            
            # Calculate line number
            start_line = content[:start_pos].count('\n') + 1
            
            # Find the end of the function by counting braces
            brace_count = 0
            found_opening = False
            end_line = start_line
            
            for i in range(start_line - 1, len(lines)):
                line = lines[i]
                for char in line:
                    if char == '{':
                        brace_count += 1
                        found_opening = True
                    elif char == '}':
                        brace_count -= 1
                
                if found_opening and brace_count == 0:
                    end_line = i + 1
                    break
            
            # Count lines (excluding empty and comment-only lines)
            func_lines = lines[start_line - 1:end_line]
            line_count = self._count_code_lines(func_lines)
            
            functions.append(FunctionInfo(
                name=func_name,
                start_line=start_line,
                end_line=end_line,
                line_count=line_count,
                is_method=bool(receiver),
                receiver=receiver
            ))
        
        return functions
    
    def validate_file(self, filepath: Path) -> None:
        """Validate a single Go file."""
        if not filepath.suffix == '.go':
            return
        
        # Skip test files for function size (they often have large test functions)
        is_test_file = filepath.name.endswith('_test.go')
        
        self.result.files_scanned += 1
        
        try:
            content = filepath.read_text(encoding='utf-8')
            lines = content.split('\n')
        except Exception as e:
            self.result.violations.append(SizeViolation(
                severity='ERROR',
                violation_type='file',
                file=str(filepath),
                line=0,
                name=filepath.name,
                actual_size=0,
                max_size=0,
                message=f'Failed to read file: {e}'
            ))
            return
        
        # Check file size
        total_lines = len(lines)
        code_lines = self._count_code_lines(lines)
        
        if code_lines > self.max_file_lines:
            severity = 'CRITICAL' if code_lines > WARN_FILE_LINES else 'WARNING'
            self.result.violations.append(SizeViolation(
                severity=severity,
                violation_type='file',
                file=str(filepath),
                line=1,
                name=filepath.name,
                actual_size=code_lines,
                max_size=self.max_file_lines,
                message=f'File has {code_lines} code lines (max: {self.max_file_lines})',
                suggestion='Split into multiple files by concern (e.g., *_internal.go, *_helpers.go)'
            ))
        
        # Skip function analysis for test files
        if is_test_file:
            return
        
        # Find and analyze functions
        functions = self._find_functions(content, lines)
        self.result.functions_analyzed += len(functions)
        
        for func in functions:
            if func.line_count > self.max_function_lines:
                severity = 'CRITICAL' if func.line_count > WARN_FUNCTION_LINES else 'WARNING'
                
                display_name = func.name
                if func.is_method:
                    display_name = f"({func.receiver}).{func.name}"
                
                self.result.violations.append(SizeViolation(
                    severity=severity,
                    violation_type='function',
                    file=str(filepath),
                    line=func.start_line,
                    name=display_name,
                    actual_size=func.line_count,
                    max_size=self.max_function_lines,
                    message=f'Function `{display_name}` has {func.line_count} lines (max: {self.max_function_lines})',
                    suggestion='Decompose into smaller helper functions with single responsibilities'
                ))
    
    def validate_directory(self, dirpath: Path) -> None:
        """Recursively validate all Go files in a directory."""
        for filepath in dirpath.rglob('*.go'):
            self.validate_file(filepath)
    
    def print_report(self) -> int:
        """Print the validation report. Returns exit code."""
        print("=" * 70)
        print("FUNCTION & FILE SIZE VALIDATION REPORT")
        print("=" * 70)
        print(f"Files scanned: {self.result.files_scanned}")
        print(f"Functions analyzed: {self.result.functions_analyzed}")
        print(f"Thresholds: {self.max_function_lines} lines/function, {self.max_file_lines} lines/file")
        print()
        
        if not self.result.violations:
            print("✅ ALL CHECKS PASSED! All functions and files within size limits.")
            return 0
        
        # Group by severity and type
        critical_funcs = [v for v in self.result.violations if v.severity == 'CRITICAL' and v.violation_type == 'function']
        critical_files = [v for v in self.result.violations if v.severity == 'CRITICAL' and v.violation_type == 'file']
        warning_funcs = [v for v in self.result.violations if v.severity == 'WARNING' and v.violation_type == 'function']
        warning_files = [v for v in self.result.violations if v.severity == 'WARNING' and v.violation_type == 'file']
        
        has_critical = bool(critical_funcs or critical_files)
        
        # Print file size issues first
        if critical_files or warning_files:
            print("\n📁 FILE SIZE ISSUES")
            print("-" * 50)
            
            for v in critical_files + warning_files:
                icon = "🔴" if v.severity == 'CRITICAL' else "🔶"
                print(f"\n{icon} {v.file}")
                print(f"   {v.actual_size} lines (max: {v.max_size})")
                print(f"   Suggestion: {v.suggestion}")
        
        # Print function size issues
        if critical_funcs or warning_funcs:
            print("\n⚙️ FUNCTION SIZE ISSUES")
            print("-" * 50)
            
            # Group by file
            by_file = defaultdict(list)
            for v in critical_funcs + warning_funcs:
                by_file[v.file].append(v)
            
            for filepath, violations in by_file.items():
                print(f"\n📄 {filepath}")
                for v in sorted(violations, key=lambda x: x.actual_size, reverse=True):
                    icon = "🔴" if v.severity == 'CRITICAL' else "🔶"
                    print(f"   {icon} Line {v.line}: `{v.name}` - {v.actual_size} lines")
        
        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print(f"  🔴 Critical Functions (>{WARN_FUNCTION_LINES} lines): {len(critical_funcs)}")
        print(f"  🔶 Warning Functions (>{self.max_function_lines} lines):  {len(warning_funcs)}")
        print(f"  🔴 Critical Files (>{WARN_FILE_LINES} lines):     {len(critical_files)}")
        print(f"  🔶 Warning Files (>{self.max_file_lines} lines):      {len(warning_files)}")
        print("=" * 70)
        
        # Decomposition guide
        if critical_funcs or warning_funcs:
            print("\n" + "=" * 70)
            print("HOW TO DECOMPOSE LARGE FUNCTIONS:")
            print("=" * 70)
            print("""
1. IDENTIFY LOGICAL SECTIONS:
   Look for comments like "// Step 1:", "// Validate:", "// Process:"
   Each section should become its own helper function.

2. EXTRACT VALIDATION LOGIC:
   func processOrder(ctx context.Context, order Order) error {
       if err := s.validateOrder(order); err != nil {  // Extracted!
           return fmt.Errorf("validation: %w", err)
       }
       return s.executeOrder(ctx, order)  // Extracted!
   }

3. NAMING CONVENTIONS FOR HELPERS:
   - validateXXX() - Validation logic
   - prepareXXX()  - Data preparation
   - buildXXX()    - Object construction
   - processXXX()  - Main processing
   - handleXXX()   - Error/result handling

4. USE *_internal.go FILES:
   - workflow_service.go        (Public API, orchestration)
   - workflow_service_internal.go (Private helpers, implementation)
""")
        
        if critical_files or warning_files:
            print("\n" + "=" * 70)
            print("HOW TO SPLIT LARGE FILES:")
            print("=" * 70)
            print("""
Split by concern, keeping the same package:

features/workflow/services/
├── workflow_service.go           (Main service, orchestration)
├── workflow_execution.go         (Execution-related methods)
├── workflow_validation.go        (Validation helpers)
├── workflow_persistence.go       (CRUD operations)
└── workflow_service_internal.go  (Private implementation details)

ALL files should have: package workflow
""")
        
        # Exit code
        if has_critical:
            print(f"\n❌ VALIDATION FAILED: {len(critical_funcs) + len(critical_files)} critical violations")
            print("   Functions >70 lines and files >700 lines MUST be refactored.")
            return 2
        else:
            print(f"\n⚠️ Validation passed with {len(warning_funcs) + len(warning_files)} warnings.")
            print("   Consider refactoring for better maintainability.")
            return 0
    
    def to_json(self) -> dict:
        """Export results as JSON."""
        return {
            'files_scanned': self.result.files_scanned,
            'functions_analyzed': self.result.functions_analyzed,
            'max_function_lines': self.max_function_lines,
            'max_file_lines': self.max_file_lines,
            'violations': [
                {
                    'severity': v.severity,
                    'type': v.violation_type,
                    'file': v.file,
                    'line': v.line,
                    'name': v.name,
                    'actual_size': v.actual_size,
                    'max_size': v.max_size,
                    'message': v.message,
                    'suggestion': v.suggestion
                }
                for v in self.result.violations
            ],
            'passed': len([v for v in self.result.violations if v.severity == 'CRITICAL']) == 0,
            'critical_count': len([v for v in self.result.violations if v.severity == 'CRITICAL']),
            'warning_count': len([v for v in self.result.violations if v.severity == 'WARNING'])
        }


def main():
    parser = argparse.ArgumentParser(
        description="Validate Go code for function and file size limits"
    )
    parser.add_argument("path", help="Path to Go file or directory to validate")
    parser.add_argument("--json", action="store_true",
                        help="Output in JSON format")
    parser.add_argument("--max-func", type=int, default=DEFAULT_MAX_FUNCTION_LINES,
                        help=f"Maximum lines per function (default: {DEFAULT_MAX_FUNCTION_LINES})")
    parser.add_argument("--max-file", type=int, default=DEFAULT_MAX_FILE_LINES,
                        help=f"Maximum lines per file (default: {DEFAULT_MAX_FILE_LINES})")
    
    args = parser.parse_args()
    target = Path(args.path)
    
    if not target.exists():
        print(f"Error: Path does not exist: {target}")
        sys.exit(1)
    
    validator = FunctionSizeValidator(
        max_function_lines=args.max_func,
        max_file_lines=args.max_file
    )
    
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
