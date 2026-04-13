#!/usr/bin/env python3
"""
Go Quality Report Generator
============================
Run ALL validation scripts and generate comprehensive quality report.

Usage:
    python generate_quality_report.py features/workflow
    python generate_quality_report.py features/workflow --full
    python generate_quality_report.py features/workflow --html report.html
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple
from datetime import datetime


@dataclass
class CheckResult:
    name: str
    passed: bool
    score: int  # 0-100
    issues: int
    critical: int
    warnings: int
    message: str
    details: List[str] = field(default_factory=list)


@dataclass
class QualityReport:
    target: str
    timestamp: str
    overall_score: int = 0
    checks: List[CheckResult] = field(default_factory=list)
    files_analyzed: int = 0
    total_lines: int = 0
    
    def calculate_score(self) -> int:
        if not self.checks:
            return 0
        weights = {"Security": 25, "Context": 20, "Errors": 20, "Size": 15, "Production": 20}
        total_weight = sum(weights.get(c.name, 10) for c in self.checks)
        weighted_sum = sum(c.score * weights.get(c.name, 10) for c in self.checks)
        return int(weighted_sum / total_weight) if total_weight else 0


class QualityReportGenerator:
    SCRIPTS_DIR = Path(__file__).parent
    
    VALIDATORS = [
        ("validate_production_ready.py", "Production", "TODOs, placeholders, ignored errors"),
        ("validate_context_propagation.py", "Context", "Context.Background() misuse"),
        ("validate_error_handling.py", "Errors", "Error handling patterns"),
        ("validate_function_size.py", "Size", "Function/file size limits"),
        ("validate_security.py", "Security", "Security vulnerabilities"),
        ("validate_context_todo.py", "TODO", "context.TODO() usage"),
    ]

    def __init__(self, target: Path, verbose: bool = False):
        self.target = target
        self.verbose = verbose
        self.report = QualityReport(
            target=str(target),
            timestamp=datetime.now().isoformat()
        )

    def run_all_checks(self) -> None:
        self._count_files()
        for script, name, desc in self.VALIDATORS:
            script_path = self.SCRIPTS_DIR / script
            if script_path.exists():
                result = self._run_validator(script_path, name, desc)
                self.report.checks.append(result)
            elif self.verbose:
                print(f"⚠️  Skipping {name}: {script} not found")
        self.report.overall_score = self.report.calculate_score()

    def _count_files(self) -> None:
        for root, _, files in os.walk(self.target):
            for f in files:
                if f.endswith('.go') and not f.endswith('_test.go'):
                    self.report.files_analyzed += 1
                    try:
                        self.report.total_lines += len(Path(root, f).read_text().splitlines())
                    except:
                        pass

    def _run_validator(self, script: Path, name: str, desc: str) -> CheckResult:
        if self.verbose:
            print(f"🔍 Running {name}...")
        
        try:
            result = subprocess.run(
                [sys.executable, str(script), str(self.target), "--json"],
                capture_output=True, text=True, timeout=120
            )
            
            passed = result.returncode == 0
            issues, critical, warnings = 0, 0, 0
            details = []
            
            if result.stdout.strip():
                try:
                    data = json.loads(result.stdout)
                    if "summary" in data:
                        s = data["summary"]
                        issues = s.get("total_issues", 0)
                        critical = s.get("by_severity", {}).get("CRITICAL", 0)
                        warnings = s.get("by_severity", {}).get("WARNING", 0)
                    elif "issues" in data:
                        issues = len(data.get("issues", []))
                except json.JSONDecodeError:
                    pass
            
            # Calculate score
            if passed and issues == 0:
                score = 100
            elif critical > 0:
                score = max(0, 50 - critical * 10)
            elif issues > 0:
                score = max(50, 100 - issues * 5)
            else:
                score = 90 if passed else 60
            
            return CheckResult(
                name=name, passed=passed, score=score,
                issues=issues, critical=critical, warnings=warnings,
                message=f"{desc}: {'PASS' if passed else 'FAIL'}",
                details=details
            )
            
        except subprocess.TimeoutExpired:
            return CheckResult(name=name, passed=False, score=0,
                             issues=0, critical=0, warnings=0,
                             message=f"{desc}: TIMEOUT")
        except Exception as e:
            return CheckResult(name=name, passed=False, score=0,
                             issues=0, critical=0, warnings=0,
                             message=f"{desc}: ERROR - {e}")

    def print_report(self) -> None:
        r = self.report
        print(f"\n{'='*60}")
        print("📊 GO CODE QUALITY REPORT")
        print(f"{'='*60}")
        print(f"📁 Target: {r.target}")
        print(f"📅 Generated: {r.timestamp}")
        print(f"📄 Files: {r.files_analyzed} | Lines: {r.total_lines:,}")
        print()
        
        # Overall score with color
        score = r.overall_score
        if score >= 80:
            grade = "A" if score >= 90 else "B"
            icon = "🟢"
        elif score >= 60:
            grade = "C"
            icon = "🟡"
        else:
            grade = "D" if score >= 40 else "F"
            icon = "🔴"
        
        print(f"{icon} Overall Quality Score: {score}/100 (Grade: {grade})")
        print()
        
        # Check results
        print("📋 Check Results:")
        print(f"{'─'*60}")
        
        for c in r.checks:
            status = "✅" if c.passed else "❌"
            bar = "█" * (c.score // 10) + "░" * (10 - c.score // 10)
            print(f"{status} {c.name:12} [{bar}] {c.score:3}%  Issues: {c.issues}")
        
        print(f"{'─'*60}")
        
        # Summary
        passed = sum(1 for c in r.checks if c.passed)
        total = len(r.checks)
        print(f"\n✅ Passed: {passed}/{total}")
        
        total_critical = sum(c.critical for c in r.checks)
        if total_critical > 0:
            print(f"🔴 Critical Issues: {total_critical} - MUST FIX BEFORE DEPLOYMENT")
        
        print(f"\n{'='*60}")
        
        # Recommendations
        failed = [c for c in r.checks if not c.passed]
        if failed:
            print("\n💡 Recommendations:")
            for c in failed:
                print(f"   • Fix {c.name}: {c.issues} issues found")
        else:
            print("\n✅ All checks passed! Code is production-ready.")
        
        print()

    def to_json(self) -> Dict[str, Any]:
        return {
            "target": self.report.target,
            "timestamp": self.report.timestamp,
            "overall_score": self.report.overall_score,
            "files_analyzed": self.report.files_analyzed,
            "total_lines": self.report.total_lines,
            "checks": [
                {
                    "name": c.name, "passed": c.passed, "score": c.score,
                    "issues": c.issues, "critical": c.critical,
                    "warnings": c.warnings, "message": c.message
                }
                for c in self.report.checks
            ]
        }

    def to_html(self) -> str:
        r = self.report
        score = r.overall_score
        color = "#22c55e" if score >= 80 else "#eab308" if score >= 60 else "#ef4444"
        
        checks_html = ""
        for c in r.checks:
            status = "✅" if c.passed else "❌"
            bar_color = "#22c55e" if c.score >= 80 else "#eab308" if c.score >= 60 else "#ef4444"
            checks_html += f"""
            <tr>
                <td>{status} {c.name}</td>
                <td><div style="background:#e5e7eb;border-radius:4px;overflow:hidden;width:100px">
                    <div style="background:{bar_color};width:{c.score}%;height:20px"></div>
                </div></td>
                <td>{c.score}%</td>
                <td>{c.issues}</td>
            </tr>"""
        
        return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Quality Report</title>
<style>body{{font-family:system-ui;max-width:800px;margin:0 auto;padding:20px}}
table{{width:100%;border-collapse:collapse}}th,td{{padding:8px;text-align:left;border-bottom:1px solid #e5e7eb}}
.score{{font-size:48px;font-weight:bold;color:{color}}}</style></head>
<body>
<h1>📊 Go Code Quality Report</h1>
<p><strong>Target:</strong> {r.target}<br><strong>Generated:</strong> {r.timestamp}</p>
<p><strong>Files:</strong> {r.files_analyzed} | <strong>Lines:</strong> {r.total_lines:,}</p>
<div class="score">{score}/100</div>
<h2>Check Results</h2>
<table><tr><th>Check</th><th>Score</th><th>%</th><th>Issues</th></tr>{checks_html}</table>
</body></html>"""


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Generate comprehensive Go quality report")
    parser.add_argument("path", help="Path to Go feature directory")
    parser.add_argument("-o", "--output", help="Save JSON report to file")
    parser.add_argument("--html", help="Save HTML report to file")
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    # Standardized Output Paths
    report_name = target.absolute().name
    if not report_name or report_name == ".":
        report_name = "root"
    
    output_dir = Path("project-documentation/quality-reports") / report_name
    
    json_output = args.output
    html_output = args.html
    
    # In orchestrated mode or if user didn't specify, use standardized path
    if not json_output and not args.json:
        json_output = str(output_dir / "QUALITY_REPORT.json")
    
    if not html_output and not args.json:
        html_output = str(output_dir / "QUALITY_REPORT.html")

    gen = QualityReportGenerator(target, verbose=args.verbose)
    gen.run_all_checks()

    if args.json:
        print(json.dumps(gen.to_json(), indent=2))
    else:
        gen.print_report()

    if json_output:
        out_p = Path(json_output)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(gen.to_json(), indent=2), encoding="utf-8")
        print(f"✅ JSON report saved: {json_output}")
    
    if html_output:
        out_p = Path(html_output)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(gen.to_html(), encoding="utf-8")
        print(f"✅ HTML report saved: {html_output}")

    # Exit code based on score
    sys.exit(0 if gen.report.overall_score >= 60 else 1)


if __name__ == "__main__":
    main()
