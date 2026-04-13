#!/usr/bin/env python3
"""
Go Code Analyzer
================
Analyze Go source code for architecture compliance, code quality, and potential issues.

Usage:
    python analyze_code.py <path_to_go_file_or_directory>
    python analyze_code.py features/notifications
"""

import os
import sys
import re
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set
from collections import defaultdict


@dataclass
class Issue:
    """Represents a code issue."""
    severity: str  # ERROR, WARNING, INFO
    file: str
    line: int
    message: str
    rule: str


@dataclass
class AnalysisResult:
    """Holds analysis results."""
    files_analyzed: int = 0
    issues: List[Issue] = field(default_factory=list)
    metrics: Dict[str, int] = field(default_factory=dict)


class GoCodeAnalyzer:
    """Analyzer for Go code following Senior Backend Developer guidelines."""

    def __init__(self):
        self.result = AnalysisResult()
        self.forbidden_patterns = [
            # Global state anti-patterns
            (r'var\s+\w+\s*=\s*&?\w+{', 'Avoid global state initialization'),
            # Direct driver imports in service files
            (r'import\s*\(\s*[^)]*"go\.mongodb\.org/mongo-driver', 'Service should not import MongoDB driver directly'),
            (r'import\s*\(\s*[^)]*"github\.com/go-redis/redis', 'Service should not import Redis driver directly'),
            # Context.Background in request handlers
            (r'context\.Background\(\)', 'Avoid context.Background() in request scope; use parent context'),
            # Bare error returns
            (r'return\s+err\s*$', 'Consider wrapping errors with context using fmt.Errorf("%w", err)'),
            # Log sensitive data patterns
            (r'log\.\w+\([^)]*[Pp]assword', 'Never log passwords'),
            (r'log\.\w+\([^)]*[Tt]oken', 'Never log tokens'),
            (r'log\.\w+\([^)]*[Ss]ecret', 'Never log secrets'),
        ]

        self.required_patterns = {
            'services': [
                (r'interface\s+\w+Service', 'Service files should define an interface'),
                (r'func\s+New\w+Service', 'Service should have a constructor function'),
            ],
            'repositories': [
                (r'interface\s+\w+Repository', 'Repository files should define an interface'),
                (r'context\.Context', 'Repository methods should accept context.Context'),
            ],
            'controllers': [
                (r'ctx\.Request\(\)\.Context\(\)', 'Controller should pass request context to service'),
            ],
        }

    def analyze_file(self, filepath: Path) -> None:
        """Analyze a single Go file."""
        if not filepath.suffix == '.go':
            return
        if filepath.name.endswith('_test.go'):
            return  # Skip test files

        self.result.files_analyzed += 1
        
        # Check file location within architecture
        self._check_file_location(filepath)

        try:
            content = filepath.read_text(encoding='utf-8')
            lines = content.split('\n')
        except Exception as e:
            self.result.issues.append(Issue(
                severity='ERROR',
                file=str(filepath),
                line=0,
                message=f'Failed to read file: {e}',
                rule='file-read'
            ))
            return

        # Determine file type based on path
        file_type = self._determine_file_type(filepath)

        # Check forbidden patterns
        for line_num, line in enumerate(lines, 1):
            for pattern, message in self.forbidden_patterns:
                if re.search(pattern, line):
                    # Filter: some patterns only apply to certain file types
                    if 'Service should not import' in message and file_type not in ['services']:
                        continue
                    if 'context.Background()' in message and file_type in ['main', 'test']:
                        continue

                    self.result.issues.append(Issue(
                        severity='WARNING',
                        file=str(filepath),
                        line=line_num,
                        message=message,
                        rule='forbidden-pattern'
                    ))

        # Check required patterns for specific file types
        if file_type in self.required_patterns:
            for pattern, message in self.required_patterns[file_type]:
                if not re.search(pattern, content):
                    self.result.issues.append(Issue(
                        severity='INFO',
                        file=str(filepath),
                        line=0,
                        message=message,
                        rule='required-pattern'
                    ))

        # Analyze function complexity (simple heuristic)
        self._analyze_function_complexity(filepath, content)

        # Check error handling
        self._check_error_handling(filepath, lines)

    def _determine_file_type(self, filepath: Path) -> str:
        """Determine the type of Go file based on its path."""
        path_str = str(filepath).lower()
        if 'controllers' in path_str:
            return 'controllers'
        elif 'services' in path_str:
            return 'services'
        elif 'repositories' in path_str:
            return 'repositories'
        elif 'adapters' in path_str:
            return 'adapters'
        elif 'models' in path_str:
            return 'models'
        elif 'routers' in path_str:
            return 'routers'
        elif filepath.name == 'main.go':
            return 'main'
        return 'unknown'

    def _analyze_function_complexity(self, filepath: Path, content: str) -> None:
        """Check for overly complex functions."""
        # Simple heuristic: count lines in functions
        func_pattern = r'func\s+(?:\([^)]+\)\s+)?(\w+)\s*\([^)]*\)[^{]*{'
        matches = list(re.finditer(func_pattern, content))

        for i, match in enumerate(matches):
            func_name = match.group(1)
            start_pos = match.end()

            # Find the end of the function (matching braces)
            brace_count = 1
            end_pos = start_pos
            for j in range(start_pos, len(content)):
                if content[j] == '{':
                    brace_count += 1
                elif content[j] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = j
                        break

            func_body = content[start_pos:end_pos]
            line_count = func_body.count('\n')

            if line_count > 50:
                line_num = content[:match.start()].count('\n') + 1
                self.result.issues.append(Issue(
                    severity='WARNING',
                    file=str(filepath),
                    line=line_num,
                    message=f'Function {func_name} has {line_count} lines. Consider breaking it down.',
                    rule='function-complexity'
                ))

    def _check_error_handling(self, filepath: Path, lines: List[str]) -> None:
        """Check for proper error handling."""
        for line_num, line in enumerate(lines, 1):
            # Check for ignored errors
            if re.search(r',\s*_\s*:?=\s*\w+\(', line) and 'err' not in line:
                # Heuristic: if there's a comma with underscore, might be ignoring error
                pass  # Too many false positives, skip for now

            # Check for panic in regular code (not init)
            if 'panic(' in line and 'recover' not in line:
                self.result.issues.append(Issue(
                    severity='WARNING',
                    file=str(filepath),
                    line=line_num,
                    message='Avoid panic() in regular code; return errors instead',
                    rule='no-panic'
                ))

    def analyze_directory(self, dirpath: Path) -> None:
        """Recursively analyze all Go files in a directory."""
        # perform structure check first
        self._check_directory_structure(dirpath)
        
        for filepath in dirpath.rglob('*.go'):
            self.analyze_file(filepath)

    def _check_directory_structure(self, dirpath: Path) -> None:
        """Check if feature directory follows the architectural skeleton."""
        # Find if we are targetting a feature directory or a parent of features
        path_str = str(dirpath).replace('\\', '/')
        
        # If the path is features/xxx or a subdirectory of features/xxx
        match = re.search(r'features/([^/]+)', path_str)
        if match:
            feature_name = match.group(1)
            # Find the actual feature root in the filesystem
            current = dirpath
            feature_root = None
            while current.name != 'features' and current.parent != current:
                if current.parent.name == 'features':
                    feature_root = current
                    break
                current = current.parent
            
            if feature_root and feature_root.is_dir():
                # Sub-folders that MUST exist in every feature per skeleton
                required_folders = ['models', 'services', 'repositories', 'controllers']
                
                for folder in required_folders:
                    folder_path = feature_root / folder
                    if not folder_path.exists() or not folder_path.is_dir():
                        # Only report once for each directory analyzed
                        issue_exists = any(i.file == str(feature_root) and folder in i.message for i in self.result.issues)
                        if not issue_exists:
                            self.result.issues.append(Issue(
                                severity='ERROR',
                                file=str(feature_root),
                                line=0,
                                message=f'Critical violation: Missing mandatory architectural folder "{folder}". Flattening or deleting skeleton folders is forbidden.',
                                rule='architecture-integrity'
                            ))

    def _check_file_location(self, filepath: Path) -> None:
        """Check if the file is placed in a correct layer folder."""
        # Files should not be directly under features/<name>/
        path_parts = list(filepath.parts)
        if 'features' in path_parts:
            f_idx = path_parts.index('features')
            # features/<name>/<file.go> -> length is f_idx + 3
            if len(path_parts) == f_idx + 3:
                # Allow some exceptions if needed, but generally these should be in layers
                if filepath.suffix == '.go' and not filepath.name.endswith('_test.go'):
                    self.result.issues.append(Issue(
                        severity='ERROR',
                        file=str(filepath),
                        line=0,
                        message=f'Architectural violation: File {filepath.name} is in feature root. It MUST stay in its designated layer folder (models, services, etc.).',
                        rule='architecture-integrity'
                    ))

    def print_report(self) -> None:
        """Print the analysis report."""
        print("=" * 60)
        print("GO CODE ANALYSIS REPORT")
        print("=" * 60)
        print(f"Files analyzed: {self.result.files_analyzed}")
        print()

        if not self.result.issues:
            print("✅ No issues found! Code follows guidelines.")
            return

        # Group by severity
        by_severity = defaultdict(list)
        for issue in self.result.issues:
            by_severity[issue.severity].append(issue)

        for severity in ['ERROR', 'WARNING', 'INFO']:
            issues = by_severity.get(severity, [])
            if not issues:
                continue

            icon = {'ERROR': '❌', 'WARNING': '⚠️', 'INFO': 'ℹ️'}[severity]
            print(f"\n{icon} {severity} ({len(issues)} issues)")
            print("-" * 40)

            for issue in issues:
                location = f"{issue.file}"
                if issue.line > 0:
                    location += f":{issue.line}"
                print(f"  [{issue.rule}] {location}")
                print(f"    {issue.message}")
                print()

        # Summary
        print("=" * 60)
        print("SUMMARY")
        print(f"  Errors:   {len(by_severity.get('ERROR', []))}")
        print(f"  Warnings: {len(by_severity.get('WARNING', []))}")
        print(f"  Info:     {len(by_severity.get('INFO', []))}")
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze Go code for architecture compliance and code quality"
    )
    parser.add_argument("path", help="Path to Go file or directory to analyze")
    parser.add_argument("--json", action="store_true", help="Output in JSON format")

    args = parser.parse_args()
    target = Path(args.path)

    if not target.exists():
        print(f"Error: Path does not exist: {target}")
        sys.exit(1)

    analyzer = GoCodeAnalyzer()

    if target.is_file():
        analyzer.analyze_file(target)
    else:
        analyzer.analyze_directory(target)

    if args.json:
        import json
        output = {
            'files_analyzed': analyzer.result.files_analyzed,
            'issues': [
                {
                    'severity': i.severity,
                    'file': i.file,
                    'line': i.line,
                    'message': i.message,
                    'rule': i.rule
                }
                for i in analyzer.result.issues
            ]
        }
        print(json.dumps(output, indent=2))
    else:
        analyzer.print_report()

    # Exit with error code if there are errors
    errors = [i for i in analyzer.result.issues if i.severity == 'ERROR']
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
