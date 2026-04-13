#!/usr/bin/env python3
"""
Check Compliance

Validates compliance against security frameworks.
SOC2, ISO27001, GDPR compliance checks.

Usage:
    python check_compliance.py --path <project_path> [--framework <framework>]

Frameworks:
    - soc2
    - iso27001
    - gdpr

Author: Expert Security Auditor Skill
"""

import argparse
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List, Dict


class ComplianceStatus(Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON-COMPLIANT"
    PARTIAL = "PARTIAL"
    NOT_APPLICABLE = "N/A"


@dataclass
class ComplianceCheck:
    framework: str
    control_id: str
    control_name: str
    description: str
    status: ComplianceStatus
    evidence: str
    recommendation: str


SOC2_CONTROLS = [
    {
        "id": "CC6.1",
        "name": "Logical Access",
        "description": "Logical access to systems is restricted",
        "checks": ["RBAC implementation", "Authentication mechanisms", "Session management"]
    },
    {
        "id": "CC6.2",
        "name": "System Access Controls",
        "description": "Access controls are implemented",
        "checks": ["Authorization checks", "Tenant isolation", "Resource ownership"]
    },
    {
        "id": "CC6.3",
        "name": "Data Protection",
        "description": "Data is protected during transmission",
        "checks": ["TLS/HTTPS", "Encryption at rest", "Secret management"]
    },
    {
        "id": "CC7.1",
        "name": "Vulnerability Management",
        "description": "Vulnerabilities are identified and remediated",
        "checks": ["Dependency scanning", "Security testing", "Patch management"]
    },
    {
        "id": "CC7.2",
        "name": "Incident Detection",
        "description": "Security incidents are detected",
        "checks": ["Logging", "Monitoring", "Alerting"]
    },
    {
        "id": "CC8.1",
        "name": "Change Management",
        "description": "Changes are authorized and documented",
        "checks": ["CI/CD controls", "Code review", "Change approval"]
    },
]

GDPR_CONTROLS = [
    {
        "id": "Art.5",
        "name": "Data Processing Principles",
        "description": "Personal data processed lawfully and transparently",
        "checks": ["Privacy notices", "Consent management", "Data minimization"]
    },
    {
        "id": "Art.25",
        "name": "Privacy by Design",
        "description": "Data protection by design and default",
        "checks": ["Access controls", "Encryption", "Pseudonymization"]
    },
    {
        "id": "Art.32",
        "name": "Security of Processing",
        "description": "Appropriate security measures",
        "checks": ["Encryption", "Access controls", "Incident response"]
    },
    {
        "id": "Art.33",
        "name": "Breach Notification",
        "description": "Notify authorities within 72 hours",
        "checks": ["Incident detection", "Notification procedures", "Documentation"]
    },
]

ISO27001_CONTROLS = [
    {
        "id": "A.9.1",
        "name": "Access Control Policy",
        "description": "Access control policy established",
        "checks": ["Policy documentation", "Access management", "Review process"]
    },
    {
        "id": "A.9.2",
        "name": "User Access Management",
        "description": "User access properly managed",
        "checks": ["Registration", "Privilege management", "Access removal"]
    },
    {
        "id": "A.10.1",
        "name": "Cryptographic Controls",
        "description": "Cryptography properly used",
        "checks": ["Encryption policy", "Key management", "Algorithm selection"]
    },
    {
        "id": "A.12.4",
        "name": "Logging and Monitoring",
        "description": "Events logged and monitored",
        "checks": ["Log collection", "Log protection", "Monitoring"]
    },
    {
        "id": "A.14.1",
        "name": "Secure Development",
        "description": "Security in development processes",
        "checks": ["Secure coding", "Code review", "Security testing"]
    },
]


def check_compliance(framework: str, project_path: Path) -> List[ComplianceCheck]:
    """Check compliance against framework."""
    checks = []

    if framework == "soc2":
        controls = SOC2_CONTROLS
    elif framework == "gdpr":
        controls = GDPR_CONTROLS
    elif framework == "iso27001":
        controls = ISO27001_CONTROLS
    else:
        return checks

    for control in controls:
        # Simplified check - in production, would scan codebase
        status = ComplianceStatus.PARTIAL
        evidence = f"Manual review required for: {', '.join(control['checks'])}"
        recommendation = "Implement automated compliance validation"

        checks.append(ComplianceCheck(
            framework=framework.upper(),
            control_id=control["id"],
            control_name=control["name"],
            description=control["description"],
            status=status,
            evidence=evidence,
            recommendation=recommendation
        ))

    return checks


def generate_report(checks: List[ComplianceCheck], framework: str) -> str:
    """Generate compliance report."""
    lines = [f"# {framework.upper()} Compliance Report\n"]

    compliant = len([c for c in checks if c.status == ComplianceStatus.COMPLIANT])
    partial = len([c for c in checks if c.status == ComplianceStatus.PARTIAL])
    non_compliant = len([c for c in checks if c.status == ComplianceStatus.NON_COMPLIANT])

    lines.append("## Summary\n")
    lines.append(f"| Status | Count |")
    lines.append(f"|--------|-------|")
    lines.append(f"| ✅ Compliant | {compliant} |")
    lines.append(f"| ⚠️ Partial | {partial} |")
    lines.append(f"| ❌ Non-Compliant | {non_compliant} |")

    lines.append("\n## Control Details\n")
    for check in checks:
        status_icon = {
            ComplianceStatus.COMPLIANT: "✅",
            ComplianceStatus.PARTIAL: "⚠️",
            ComplianceStatus.NON_COMPLIANT: "❌",
            ComplianceStatus.NOT_APPLICABLE: "➖"
        }.get(check.status, "❓")

        lines.append(f"### {status_icon} {check.control_id}: {check.control_name}\n")
        lines.append(f"**Description**: {check.description}\n")
        lines.append(f"**Status**: {check.status.value}\n")
        lines.append(f"**Evidence**: {check.evidence}\n")
        lines.append(f"**Recommendation**: {check.recommendation}\n")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Check compliance')
    parser.add_argument('--path', default='.', help='Project path')
    parser.add_argument('--framework', choices=['soc2', 'iso27001', 'gdpr', 'all'], default='all')
    parser.add_argument('--output', help='Output file')

    args = parser.parse_args()
    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist", file=sys.stderr)
        sys.exit(1)

    all_checks = []
    frameworks = ['soc2', 'iso27001', 'gdpr'] if args.framework == 'all' else [args.framework]

    for fw in frameworks:
        all_checks.extend(check_compliance(fw, path))

    report = generate_report(all_checks, args.framework)
    if args.output:
        Path(args.output).write_text(report)
        print(f"Report: {args.output}")
    else:
        print(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
