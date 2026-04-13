#!/usr/bin/env python3
"""
Validate Input Sanitization

Scans code for input validation and sanitization issues.
Detects potential injection vulnerabilities.

Usage:
    python validate_input_sanitization.py --path <project_path>

Author: Expert Security Auditor Skill
"""

import argparse
import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List


class Severity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class ValidationFinding:
    file_path: str
    line_number: int
    title: str
    description: str
    severity: Severity
    recommendation: str


VALIDATION_PATTERNS = [
    {
        "pattern": r"(?:ctx\.Bind|c\.Bind|json\.Unmarshal).*\n(?!.*(?:Validate|validate|validator))",
        "title": "Missing input validation",
        "description": "Input binding without validation",
        "severity": Severity.HIGH,
        "recommendation": "Add struct tags or explicit validation after binding"
    },
    {
        "pattern": r"(?:fmt\.Sprintf|fmt\.Sprint|f\"|f').*%[vs].*SELECT",
        "title": "SQL injection risk",
        "description": "String formatting in SQL query",
        "severity": Severity.CRITICAL,
        "recommendation": "Use parameterized queries with $1, $2 or ?"
    },
    {
        "pattern": r"(?:bson\.M|bson\.D)\s*\{[^}]*\+",
        "title": "NoSQL injection risk",
        "description": "Dynamic MongoDB query construction",
        "severity": Severity.HIGH,
        "recommendation": "Use bson.D with validated values"
    },
    {
        "pattern": r"(?:exec\.Command|os\.Exec)\s*\([^)]*\+",
        "title": "Command injection risk",
        "description": "Shell command with concatenated input",
        "severity": Severity.CRITICAL,
        "recommendation": "Use exec.Command with separate args"
    },
    {
        "pattern": r"filepath\.Join\s*\([^)]*(?:req\.|c\.Query|params\.)",
        "title": "Path traversal risk",
        "description": "File path with user input",
        "severity": Severity.HIGH,
        "recommendation": "Validate and sanitize file paths"
    },
    {
        "pattern": r"(?:http\.Get|http\.Post|client\.Do)\s*\([^)]*(?:req\.|c\.Query)",
        "title": "SSRF risk",
        "description": "HTTP request with user-controlled URL",
        "severity": Severity.HIGH,
        "recommendation": "Validate and whitelist URLs"
    },
    {
        "pattern": r"(?:template\.HTML|dangerouslySetInnerHTML)",
        "title": "XSS risk",
        "description": "Unescaped HTML rendering",
        "severity": Severity.HIGH,
        "recommendation": "Use text/template or React default escaping"
    },
]


def scan_file(file_path: Path) -> List[ValidationFinding]:
    """Scan file for validation issues."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return findings

    for pattern_def in VALIDATION_PATTERNS:
        pattern = pattern_def["pattern"]
        for match in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
            line_num = content[:match.start()].count('\n') + 1
            findings.append(ValidationFinding(
                file_path=str(file_path),
                line_number=line_num,
                title=pattern_def["title"],
                description=pattern_def["description"],
                severity=pattern_def["severity"],
                recommendation=pattern_def["recommendation"]
            ))

    return findings


def scan_directory(directory: Path) -> List[ValidationFinding]:
    """Scan directory for validation issues."""
    findings = []

    for ext in ['*.go', '*.ts', '*.tsx']:
        for file_path in directory.rglob(ext):
            if 'vendor/' in str(file_path) or 'node_modules/' in str(file_path):
                continue
            if '_test.' in str(file_path):
                continue
            findings.extend(scan_file(file_path))

    return findings


def generate_report(findings: List[ValidationFinding]) -> str:
    """Generate validation report."""
    lines = ["# Input Sanitization Validation Report\n"]

    if not findings:
        lines.append("✅ No input validation issues detected!")
        return '\n'.join(lines)

    critical = len([f for f in findings if f.severity == Severity.CRITICAL])
    high = len([f for f in findings if f.severity == Severity.HIGH])

    lines.append(f"**Total Issues**: {len(findings)}\n")
    lines.append(f"**Critical**: {critical}\n")
    lines.append(f"**High**: {high}\n")

    lines.append("\n## Findings\n")
    for f in findings:
        icon = "🔴" if f.severity == Severity.CRITICAL else "🟠"
        lines.append(f"### {icon} {f.title}\n")
        lines.append(f"- **File**: `{f.file_path}:{f.line_number}`\n")
        lines.append(f"- **Severity**: {f.severity.value}\n")
        lines.append(f"- **Description**: {f.description}\n")
        lines.append(f"- **Recommendation**: {f.recommendation}\n")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Validate input sanitization')
    parser.add_argument('--path', default='.', help='Project path')
    parser.add_argument('--output', help='Output file')

    args = parser.parse_args()
    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist", file=sys.stderr)
        sys.exit(1)

    findings = scan_directory(path)
    report = generate_report(findings)

    if args.output:
        Path(args.output).write_text(report)
        print(f"Report: {args.output}")
    else:
        print(report)

    critical = len([f for f in findings if f.severity == Severity.CRITICAL])
    if critical > 0:
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
