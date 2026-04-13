#!/usr/bin/env python3
"""
Go Cyclomatic Complexity Analyzer
==================================
Measure cyclomatic complexity of Go functions to identify code that needs refactoring.

Usage:
    python analyze_cyclomatic_complexity.py features/workflow
    python analyze_cyclomatic_complexity.py features/workflow --threshold 10
    python analyze_cyclomatic_complexity.py features/workflow --json
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Tuple


@dataclass
class FunctionComplexity:
    name: str
    file: str
    line: int
    complexity: int
    lines: int


class ComplexityAnalyzer:
    # Patterns that increase cyclomatic complexity
    COMPLEXITY_PATTERNS = [
        r'\bif\b', r'\belse\s+if\b', r'\bfor\b', r'\bcase\b',
        r'\b&&\b', r'\b\|\|\b', r'\bselect\b', r'\bgo\s+func',
    ]

    def __init__(self, threshold: int = 10, strict: bool = False):
        self.threshold = threshold
        self.strict = strict
        self.functions: List[FunctionComplexity] = []
        self.files_analyzed = 0

    def analyze_directory(self, dirpath: Path) -> None:
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata')]
            for f in files:
                if f.endswith('.go') and (self.strict or not f.endswith('_test.go')):
                    self._analyze_file(Path(root) / f)

    def _analyze_file(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        
        self.files_analyzed += 1
        
        # Find all function definitions
        func_pattern = r'func\s+(?:\([^)]+\)\s+)?(\w+)\s*\([^)]*\)[^{]*\{'
        
        for match in re.finditer(func_pattern, content):
            func_name = match.group(1)
            func_start = match.end()
            line_num = content[:match.start()].count('\n') + 1
            
            # Extract function body
            body, end_pos = self._extract_body(content, func_start)
            if not body:
                continue
            
            # Calculate complexity
            complexity = self._calculate_complexity(body)
            lines = body.count('\n') + 1
            
            self.functions.append(FunctionComplexity(
                name=func_name, file=str(filepath),
                line=line_num, complexity=complexity, lines=lines
            ))

    def _extract_body(self, content: str, start: int) -> Tuple[str, int]:
        brace_count = 1
        i = start
        while i < len(content) and brace_count > 0:
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
            i += 1
        if brace_count == 0:
            return (content[start:i-1], i)
        return ("", 0)

    def _calculate_complexity(self, body: str) -> int:
        # Base complexity is 1
        complexity = 1
        
        # Remove string literals and comments to avoid false positives
        clean = re.sub(r'"[^"]*"', '', body)
        clean = re.sub(r'`[^`]*`', '', clean)
        clean = re.sub(r'//.*', '', clean)
        clean = re.sub(r'/\*.*?\*/', '', clean, flags=re.DOTALL)
        
        for pattern in self.COMPLEXITY_PATTERNS:
            complexity += len(re.findall(pattern, clean))
        
        return complexity

    def get_violations(self) -> List[FunctionComplexity]:
        return [f for f in self.functions if f.complexity > self.threshold]

    def get_critical(self) -> List[FunctionComplexity]:
        return [f for f in self.functions if f.complexity > self.threshold * 1.5]

    def print_report(self) -> None:
        print(f"\n{'='*60}")
        print("CYCLOMATIC COMPLEXITY REPORT")
        print(f"{'='*60}")
        print(f"Files Analyzed: {self.files_analyzed}")
        print(f"Functions Analyzed: {len(self.functions)}")
        print(f"Threshold: {self.threshold}")
        print()
        
        violations = self.get_violations()
        critical = self.get_critical()
        
        if not violations:
            print("All functions are within complexity threshold!")
            return
        
        print(f"{'-'*60}")
        print(f"Functions Exceeding Threshold: {len(violations)}")
        print(f"Critical (>{self.threshold * 1.5}): {len(critical)}")
        print(f"{'-'*60}")
        
        # Sort by complexity descending
        for f in sorted(violations, key=lambda x: -x.complexity):
            status = "[CRITICAL]" if f.complexity > self.threshold * 1.5 else "[WARNING]"
            print(f"\n{status} {f.name} (complexity: {f.complexity}, lines: {f.lines})")
            print(f"   File: {f.file}:{f.line}")
            
            # Suggest refactoring
            if f.complexity > 15:
                print(f"   Tip: Consider breaking into {f.complexity // 5} smaller functions")
            elif f.complexity > 10:
                print(f"   Tip: Consider extracting complex conditionals into helper functions")
        
        print(f"\n{'='*60}")
        
        # Summary statistics
        if self.functions:
            avg = sum(f.complexity for f in self.functions) / len(self.functions)
            max_c = max(f.complexity for f in self.functions)
            print(f"Average Complexity: {avg:.1f}")
            print(f"Max Complexity: {max_c}")
        
        print(f"{'='*60}\n")

    def to_json(self) -> Dict:
        violations = self.get_violations()
        return {
            "summary": {
                "files_analyzed": self.files_analyzed,
                "functions_analyzed": len(self.functions),
                "threshold": self.threshold,
                "violations": len(violations),
                "critical": len(self.get_critical()),
                "average_complexity": sum(f.complexity for f in self.functions) / len(self.functions) if self.functions else 0,
                "max_complexity": max((f.complexity for f in self.functions), default=0)
            },
            "violations": [
                {"name": f.name, "file": f.file, "line": f.line, 
                 "complexity": f.complexity, "lines": f.lines}
                for f in sorted(violations, key=lambda x: -x.complexity)
            ]
        }


def main():
    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Analyze cyclomatic complexity of Go code")
    parser.add_argument("path", help="Path to Go file or directory")
    parser.add_argument("-t", "--threshold", type=int, default=10, help="Complexity threshold (default: 10)")
    parser.add_argument("--strict", action="store_true", help="Include test files")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("-o", "--output", help="Save report to file")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    analyzer = ComplexityAnalyzer(threshold=args.threshold, strict=args.strict)
    
    if target.is_file():
        analyzer._analyze_file(target)
    else:
        analyzer.analyze_directory(target)

    if args.json:
        output = json.dumps(analyzer.to_json(), indent=2)
        print(output)
        if args.output:
            Path(args.output).write_text(output)
    else:
        analyzer.print_report()
        if args.output:
            Path(args.output).write_text(json.dumps(analyzer.to_json(), indent=2))

    # Exit code based on violations
    sys.exit(2 if analyzer.get_critical() else 1 if analyzer.get_violations() else 0)


if __name__ == "__main__":
    main()
