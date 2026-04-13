#!/usr/bin/env python3
"""
Audit Authorization

Audits authorization and access control mechanisms.
Checks RBAC implementation, privilege escalation risks.

Usage:
    python audit_authorization.py --path <project_path>

Checks:
    - RBAC implementation
    - Permission checks
    - Tenant isolation
    - Privilege escalation risks

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
class AuthzFinding:
    category: str
    file_path: str
    line_number: int
    title: str
    description: str
    severity: Severity
    recommendation: str


AUTHZ_PATTERNS = {
    "rbac_missing": [
        {
            "pattern": r"(?:func|def)\s+(?:create|update|delete|get|list)",
            "negative_pattern": r"(?:permission|role|authorize|can_)",
            "title": "Missing authorization check",
            "description": "CRUD operation without permission check",
            "severity": Severity.HIGH,
            "recommendation": "Add role/permission check before operation"
        },
    ],
    "tenant_isolation": [
        {
            "pattern": r"Find(?:One|Many|All|ByID)",
            "negative_pattern": r"tenant",
            "title": "Missing tenant filter",
            "description": "Database query without tenant isolation",
            "severity": Severity.CRITICAL,
            "recommendation": "Add tenant filter to all queries"
        },
    ],
    "privilege_escalation": [
        {
            "pattern": r"(?:role|permission|admin).*[=:]\s*(?:req\.|params\.|body\.)",
            "title": "User-controlled privilege assignment",
            "description": "Role/permission from user input",
            "severity": Severity.CRITICAL,
            "recommendation": "Validate role changes server-side"
        },
    ],
    "resource_ownership": [
        {
            "pattern": r"(?:resource|data|record).*[Ii]d\s*[=:]\s*(?:req\.|c\.Query|params\.)",
            "negative_pattern": r"(?:owner|user|tenant)",
            "title": "Missing ownership check",
            "description": "Resource access without ownership verification",
            "severity": Severity.HIGH,
            "recommendation": "Verify user owns the resource"
        },
    ],
}


def scan_file(file_path: Path) -> List[AuthzFinding]:
    """Scan file for authorization issues."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return findings

    for category, patterns in AUTHZ_PATTERNS.items():
        for pattern_def in patterns:
            pattern = pattern_def["pattern"]
            negative = pattern_def.get("negative_pattern")

            for match in re.finditer(pattern, content, re.IGNORECASE):
                line_num = content[:match.start()].count('\n') + 1

                if negative:
                    # Check if negative pattern exists nearby
                    start = max(0, match.start() - 500)
                    end = min(len(content), match.end() + 500)
                    context = content[start:end]

                    if not re.search(negative, context, re.IGNORECASE):
                        findings.append(AuthzFinding(
                            category=category,
                            file_path=str(file_path),
                            line_number=line_num,
                            title=pattern_def["title"],
                            description=pattern_def["description"],
                            severity=pattern_def["severity"],
                            recommendation=pattern_def["recommendation"]
                        ))
                else:
                    findings.append(AuthzFinding(
                        category=category,
                        file_path=str(file_path),
                        line_number=line_num,
                        title=pattern_def["title"],
                        description=pattern_def["description"],
                        severity=pattern_def["severity"],
                        recommendation=pattern_def["recommendation"]
                    ))

    return findings


def scan_directory(directory: Path) -> List[AuthzFinding]:
    """Scan directory for authorization issues."""
    findings = []

    for ext in ['*.go', '*.ts', '*.tsx']:
        for file_path in directory.rglob(ext):
            if 'vendor/' in str(file_path) or 'node_modules/' in str(file_path):
                continue
            if '_test.' in str(file_path):
                continue
            findings.extend(scan_file(file_path))

    return findings


def generate_report(findings: List[AuthzFinding]) -> str:
    """Generate authorization audit report."""
    lines = ["# Authorization Audit Report\n"]

    if not findings:
        lines.append("✅ No authorization issues detected!")
        return '\n'.join(lines)

    # Summary
    critical = len([f for f in findings if f.severity == Severity.CRITICAL])
    high = len([f for f in findings if f.severity == Severity.HIGH])

    lines.append(f"**Total Findings**: {len(findings)}\n")
    lines.append(f"**Critical**: {critical}\n")
    lines.append(f"**High**: {high}\n")

    if critical > 0:
        lines.append("\n⛔ **CRITICAL issues require immediate attention!**\n")

    # Findings
    lines.append("## Findings\n")
    for f in findings:
        icon = "🔴" if f.severity == Severity.CRITICAL else "🟠"
        lines.append(f"### {icon} {f.title}\n")
        lines.append(f"- **File**: `{f.file_path}:{f.line_number}`\n")
        lines.append(f"- **Severity**: {f.severity.value}\n")
        lines.append(f"- **Description**: {f.description}\n")
        lines.append(f"- **Recommendation**: {f.recommendation}\n")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Audit authorization')
    parser.add_argument('--path', default='.', help='Project path')
    parser.add_argument('--output', help='Output file')

    args = parser.parse_args()
    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist: {path}", file=sys.stderr)
        sys.exit(1)

    findings = scan_directory(path)
    report = generate_report(findings)

    if args.output:
        Path(args.output).write_text(report)
        print(f"Report: {args.output}")
    else:
        print(report)

    if len([f for f in findings if f.severity == Severity.CRITICAL]) > 0:
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
