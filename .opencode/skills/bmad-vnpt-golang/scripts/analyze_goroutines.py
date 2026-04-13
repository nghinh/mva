#!/usr/bin/env python3
"""
Go Goroutine Leak Detector
===========================
Static analysis to detect potential goroutine leaks and concurrency issues.

Usage:
    python analyze_goroutines.py features/workflow
    python analyze_goroutines.py features/workflow --strict
    python analyze_goroutines.py features/workflow --json
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict
from enum import Enum


class Severity(Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class GoroutineIssue:
    severity: Severity
    category: str
    file: str
    line: int
    message: str
    code_snippet: str
    recommendation: str


class GoroutineAnalyzer:
    PATTERNS = [
        # Goroutine without context
        (r'go\s+func\s*\([^)]*\)\s*\{(?![^}]*ctx)', Severity.CRITICAL,
         "orphan_goroutine", "Goroutine started without context parameter",
         "Pass context.Context to enable cancellation"),
        
        # Context.Background in goroutine
        (r'go\s+func.*context\.Background\(\)', Severity.CRITICAL,
         "background_in_goroutine", "context.Background() used in goroutine",
         "Derive context from parent with context.WithCancel/WithTimeout"),
        
        # Unbounded goroutine loop
        (r'for\s*\{[^}]*go\s+func', Severity.CRITICAL,
         "unbounded_spawn", "Unbounded goroutine spawning in loop",
         "Use worker pools or rate limiting to bound goroutine creation"),
        
        # Channel without select/timeout
        (r'<-\s*\w+(?!\s*:\s*|\s*,)', Severity.WARNING,
         "blocking_receive", "Blocking channel receive without select",
         "Use select with ctx.Done() or default case to prevent blocking"),
        
        # Send without select
        (r'\w+\s*<-\s*\w+(?!.*select)', Severity.WARNING,
         "blocking_send", "Channel send without select - may block forever",
         "Use select with ctx.Done() for cancellation support"),
        
        # Missing errgroup
        (r'for.*\{\s*go\s+func', Severity.WARNING,
         "missing_errgroup", "Multiple goroutines without errgroup",
         "Consider using golang.org/x/sync/errgroup for error propagation"),
        
        # Time.Sleep in goroutine loop
        (r'go\s+func.*for\s*\{.*time\.Sleep', Severity.WARNING,
         "polling_loop", "Polling loop with time.Sleep",
         "Use time.Ticker with ctx.Done() for cancellable polling"),
    ]

    def __init__(self, strict: bool = False):
        self.strict = strict
        self.issues: List[GoroutineIssue] = []
        self.files_analyzed = 0
        self.goroutines_found = 0

    def analyze_directory(self, dirpath: Path) -> None:
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata')]
            for f in files:
                if f.endswith('.go') and not f.endswith('_test.go'):
                    self._analyze_file(Path(root) / f)

    def _analyze_file(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        
        self.files_analyzed += 1
        lines = content.split('\n')
        
        # Count goroutines
        self.goroutines_found += len(re.findall(r'\bgo\s+func\b|\bgo\s+\w+\s*\(', content))
        
        # Check patterns
        for pattern, severity, category, message, recommendation in self.PATTERNS:
            for match in re.finditer(pattern, content, re.DOTALL | re.MULTILINE):
                line_num = content[:match.start()].count('\n') + 1
                snippet = lines[line_num - 1].strip()[:80] if line_num <= len(lines) else ""
                
                self.issues.append(GoroutineIssue(
                    severity=severity, category=category,
                    file=str(filepath), line=line_num,
                    message=message, code_snippet=snippet,
                    recommendation=recommendation
                ))
        
        # Additional checks
        self._check_defer_in_goroutine(filepath, content, lines)
        self._check_ctx_done(filepath, content, lines)

    def _check_defer_in_goroutine(self, filepath: Path, content: str, lines: List[str]) -> None:
        """Check for missing defer in goroutines."""
        for match in re.finditer(r'go\s+func\s*\([^)]*\)\s*\{([^}]{50,})\}', content, re.DOTALL):
            body = match.group(1)
            if 'defer' not in body and ('cancel' in body.lower() or 'close' in body.lower()):
                line_num = content[:match.start()].count('\n') + 1
                self.issues.append(GoroutineIssue(
                    severity=Severity.WARNING, category="missing_defer",
                    file=str(filepath), line=line_num,
                    message="Goroutine may be missing defer for cleanup",
                    code_snippet=lines[line_num - 1].strip()[:80] if line_num <= len(lines) else "",
                    recommendation="Add defer for cancel()/close() to ensure cleanup"
                ))

    def _check_ctx_done(self, filepath: Path, content: str, lines: List[str]) -> None:
        """Check for goroutines with long operations but no ctx.Done() check."""
        for match in re.finditer(r'go\s+func\s*\([^)]*ctx[^)]*\)\s*\{([^}]{100,})\}', content, re.DOTALL):
            body = match.group(1)
            if 'ctx.Done()' not in body and 'select' not in body:
                line_num = content[:match.start()].count('\n') + 1
                if self.strict:
                    self.issues.append(GoroutineIssue(
                        severity=Severity.INFO, category="no_ctx_check",
                        file=str(filepath), line=line_num,
                        message="Goroutine with context but no ctx.Done() check",
                        code_snippet="",
                        recommendation="Add select { case <-ctx.Done(): ... } for cancellation"
                    ))

    def get_critical(self) -> List[GoroutineIssue]:
        return [i for i in self.issues if i.severity == Severity.CRITICAL]

    def print_report(self) -> None:
        print(f"\n{'='*60}")
        print("🔄 GOROUTINE LEAK ANALYSIS REPORT")
        print(f"{'='*60}")
        print(f"📁 Files Analyzed: {self.files_analyzed}")
        print(f"🔄 Goroutines Found: {self.goroutines_found}")
        print(f"⚠️ Issues Found: {len(self.issues)}")
        print()
        
        if not self.issues:
            print("✅ No goroutine issues detected!")
            return
        
        critical = self.get_critical()
        if critical:
            print(f"🔴 CRITICAL ISSUES: {len(critical)}")
            print(f"{'─'*60}")
            for issue in critical:
                print(f"\n❌ {issue.message}")
                print(f"   📍 {issue.file}:{issue.line}")
                if issue.code_snippet:
                    print(f"   💻 {issue.code_snippet}")
                print(f"   💡 {issue.recommendation}")
        
        warnings = [i for i in self.issues if i.severity == Severity.WARNING]
        if warnings:
            print(f"\n{'─'*60}")
            print(f"⚠️ WARNINGS: {len(warnings)}")
            for issue in warnings[:10]:  # Show first 10
                print(f"\n⚠️ {issue.message}")
                print(f"   📍 {issue.file}:{issue.line}")
                print(f"   💡 {issue.recommendation}")
        
        print(f"\n{'='*60}")
        print("💡 Best Practices for Goroutine Management:")
        print("   • Always pass context.Context to goroutines")
        print("   • Use select with ctx.Done() for cancellation")
        print("   • Use errgroup for scatter-gather patterns")
        print("   • Bound goroutine creation with worker pools")
        print(f"{'='*60}\n")

    def to_json(self) -> Dict:
        return {
            "summary": {
                "files_analyzed": self.files_analyzed,
                "goroutines_found": self.goroutines_found,
                "total_issues": len(self.issues),
                "critical": len(self.get_critical()),
                "warnings": len([i for i in self.issues if i.severity == Severity.WARNING])
            },
            "issues": [
                {
                    "severity": i.severity.value, "category": i.category,
                    "file": i.file, "line": i.line, "message": i.message,
                    "recommendation": i.recommendation
                }
                for i in self.issues
            ]
        }


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Detect goroutine leaks in Go code")
    parser.add_argument("path", help="Path to Go directory")
    parser.add_argument("--strict", action="store_true", help="Enable strict checks")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("-o", "--output", help="Save report to file")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    analyzer = GoroutineAnalyzer(strict=args.strict)
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

    sys.exit(2 if analyzer.get_critical() else 1 if analyzer.issues else 0)


if __name__ == "__main__":
    main()
