#!/usr/bin/env python3
"""
Detect Secrets

Scans codebase for exposed secrets and credentials.
Detects API keys, tokens, passwords, and private keys.

Usage:
    python detect_secrets.py --path <project_path>

Checks:
    - API keys (AWS, GitHub, Google, etc.)
    - Database credentials
    - JWT secrets
    - Private keys
    - Generic secrets

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
class SecretFinding:
    file_path: str
    line_number: int
    secret_type: str
    description: str
    severity: Severity
    matched_pattern: str
    remediation: str


# Secret patterns - ordered by specificity
SECRET_PATTERNS = [
    # Cloud Provider Keys
    {
        "pattern": r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
        "type": "AWS Access Key",
        "severity": Severity.CRITICAL,
        "description": "AWS Access Key ID detected",
        "remediation": "Rotate key immediately and use IAM roles"
    },
    {
        "pattern": r"(?:aws_access_key_id|aws_secret_access_key)\s*[=:]\s*['\"][^'\"]+['\"]",
        "type": "AWS Credentials",
        "severity": Severity.CRITICAL,
        "description": "AWS credentials in configuration",
        "remediation": "Use IAM roles or AWS credentials file"
    },
    {
        "pattern": r"AIza[A-Za-z0-9_-]{35}",
        "type": "Google API Key",
        "severity": Severity.HIGH,
        "description": "Google API key detected",
        "remediation": "Restrict API key and use environment variables"
    },
    {
        "pattern": r"ghp_[A-Za-z0-9]{36}",
        "type": "GitHub Personal Access Token",
        "severity": Severity.CRITICAL,
        "description": "GitHub PAT detected",
        "remediation": "Revoke token and use GitHub App"
    },
    {
        "pattern": r"github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}",
        "type": "GitHub Fine-grained Token",
        "severity": Severity.CRITICAL,
        "description": "GitHub fine-grained token detected",
        "remediation": "Revoke token and use environment variable"
    },

    # Database Credentials
    {
        "pattern": r"(?:mongodb|postgres|mysql|redis)://[^\s]+:[^\s]+@[^\s]+",
        "type": "Database Connection String",
        "severity": Severity.CRITICAL,
        "description": "Connection string with credentials",
        "remediation": "Use environment variables for connection strings"
    },
    {
        "pattern": r"(?:DB_|DATABASE_)(?:PASSWORD|PASS|PWD|CREDENTIAL)\s*[=:]\s*['\"][^'\"]+['\"]",
        "type": "Database Password",
        "severity": Severity.CRITICAL,
        "description": "Database password in code/config",
        "remediation": "Use secrets manager or environment variables"
    },

    # JWT and Auth Tokens
    {
        "pattern": r"(?:JWT_SECRET|jwt_secret|JwtSecret)\s*[=:]\s*['\"][^'\"]+['\"]",
        "type": "JWT Secret",
        "severity": Severity.CRITICAL,
        "description": "JWT signing secret exposed",
        "remediation": "Rotate secret and use environment variable"
    },
    {
        "pattern": r"eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*",
        "type": "JWT Token",
        "severity": Severity.HIGH,
        "description": "JWT token detected",
        "remediation": "Remove token and rotate if active"
    },

    # Private Keys
    {
        "pattern": r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
        "type": "Private Key",
        "severity": Severity.CRITICAL,
        "description": "Private key detected",
        "remediation": "Store in secrets manager, never in code"
    },
    {
        "pattern": r"-----BEGIN PGP PRIVATE KEY BLOCK-----",
        "type": "PGP Private Key",
        "severity": Severity.CRITICAL,
        "description": "PGP private key detected",
        "remediation": "Store in secrets manager"
    },

    # Generic Secrets
    {
        "pattern": r"(?:password|passwd|pwd)\s*[=:]\s*['\"][^'\"]{8,}['\"]",
        "type": "Hardcoded Password",
        "severity": Severity.CRITICAL,
        "description": "Hardcoded password detected",
        "remediation": "Use environment variable or secrets manager"
    },
    {
        "pattern": r"(?:api_key|apikey|api_secret|secret_key)\s*[=:]\s*['\"][^'\"]+['\"]",
        "type": "API Key/Secret",
        "severity": Severity.HIGH,
        "description": "API key or secret detected",
        "remediation": "Use environment variable or secrets manager"
    },
    {
        "pattern": r"(?:token|auth_token|access_token|bearer)\s*[=:]\s*['\"][^'\"]{16,}['\"]",
        "type": "Access Token",
        "severity": Severity.HIGH,
        "description": "Access token detected",
        "remediation": "Store in secrets manager"
    },

    # Slack/Stripe/etc
    {
        "pattern": r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}",
        "type": "Slack Token",
        "severity": Severity.HIGH,
        "description": "Slack token detected",
        "remediation": "Revoke token and use environment variable"
    },
    {
        "pattern": r"sk_live_[A-Za-z0-9]{24,}",
        "type": "Stripe Secret Key",
        "severity": Severity.CRITICAL,
        "description": "Stripe live secret key detected",
        "remediation": "Rotate key immediately"
    },
    {
        "pattern": r"rk_live_[A-Za-z0-9]{24,}",
        "type": "Stripe Restricted Key",
        "severity": Severity.CRITICAL,
        "description": "Stripe live restricted key detected",
        "remiation": "Rotate key immediately"
    },
]

# Files to skip
SKIP_PATTERNS = [
    r"\.git/",
    r"node_modules/",
    r"vendor/",
    r"__pycache__/",
    r"\.pyc$",
    r"package-lock\.json$",
    r"yarn\.lock$",
    r"pnpm-lock\.yaml$",
    r"go\.sum$",
    r"\.env\.example$",
    r"secrets\.template$",
]


def should_skip_file(file_path: Path) -> bool:
    """Check if file should be skipped."""
    file_str = str(file_path)
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, file_str):
            return True
    return False


def scan_file(file_path: Path) -> List[SecretFinding]:
    """Scan a single file for secrets."""
    findings = []

    if should_skip_file(file_path):
        return findings

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception:
        return findings

    for pattern_def in SECRET_PATTERNS:
        pattern = pattern_def["pattern"]
        regex = re.compile(pattern, re.IGNORECASE)

        for match in regex.finditer(content):
            line_num = content[:match.start()].count('\n') + 1

            # Check for false positives in comments
            line = lines[line_num - 1] if line_num <= len(lines) else ""
            stripped = line.strip()
            if stripped.startswith(('#', '//', '/*', '*', '--')):
                continue

            # Check for placeholder values
            matched = match.group()
            if any(p in matched.lower() for p in ['changeme', 'your_', 'xxx', 'placeholder', 'example']):
                continue

            findings.append(SecretFinding(
                file_path=str(file_path),
                line_number=line_num,
                secret_type=pattern_def["type"],
                description=pattern_def["description"],
                severity=pattern_def["severity"],
                matched_pattern=matched[:50] + "..." if len(matched) > 50 else matched,
                remediation=pattern_def["remediation"]
            ))

    return findings


def scan_directory(directory: Path) -> List[SecretFinding]:
    """Scan directory for secrets."""
    all_findings = []

    for file_path in directory.rglob('*'):
        if file_path.is_file():
            findings = scan_file(file_path)
            all_findings.extend(findings)

    return all_findings


def generate_report(findings: List[SecretFinding]) -> str:
    """Generate secrets detection report."""
    lines = ["# Secret Detection Report\n"]

    if not findings:
        lines.append("✅ No secrets detected in the codebase!")
        return '\n'.join(lines)

    # Summary by type
    lines.append("## Summary by Type\n")
    types = {}
    for f in findings:
        if f.secret_type not in types:
            types[f.secret_type] = []
        types[f.secret_type].append(f)

    lines.append("| Secret Type | Count |")
    lines.append("|-------------|-------|")
    for secret_type, type_findings in sorted(types.items(), key=lambda x: -len(x[1])):
        lines.append(f"| {secret_type} | {len(type_findings)} |")

    # Summary by severity
    lines.append("\n## Summary by Severity\n")
    critical = len([f for f in findings if f.severity == Severity.CRITICAL])
    high = len([f for f in findings if f.severity == Severity.HIGH])
    medium = len([f for f in findings if f.severity == Severity.MEDIUM])

    lines.append("| Severity | Count |")
    lines.append("|----------|-------|")
    lines.append(f"| 🔴 Critical | {critical} |")
    lines.append(f"| 🟠 High | {high} |")
    lines.append(f"| 🟡 Medium | {medium} |")

    if critical > 0:
        lines.append(f"\n⛔ **{critical} CRITICAL secrets detected - immediate rotation required!**")

    # Detailed findings
    lines.append("\n## Detailed Findings\n")

    for f in sorted(findings, key=lambda x: -list(Severity).index(x.severity)):
        severity_icons = {
            Severity.CRITICAL: "🔴",
            Severity.HIGH: "🟠",
            Severity.MEDIUM: "🟡",
            Severity.LOW: "🟢"
        }
        icon = severity_icons.get(f.severity, "")
        lines.append(f"### {icon} {f.secret_type}\n")
        lines.append(f"**File**: `{f.file_path}:{f.line_number}`\n")
        lines.append(f"**Match**: `{f.matched_pattern}`\n")
        lines.append(f"**Remediation**: {f.remediation}\n")

    # Remediation steps
    lines.append("## Immediate Actions\n")
    lines.append("1. **Rotate all exposed credentials immediately**")
    lines.append("2. **Review git history** - secrets may be in commit history")
    lines.append("3. **Remove secrets** from code and use environment variables")
    lines.append("4. **Add .gitignore** entries for sensitive files")
    lines.append("5. **Consider using git-secrets** or similar pre-commit hooks")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Detect secrets in codebase'
    )
    parser.add_argument(
        '--path',
        default='.',
        help='Path to scan'
    )
    parser.add_argument(
        '--output',
        help='Output file for report (default: stdout)'
    )

    args = parser.parse_args()

    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist: {path}", file=sys.stderr)
        sys.exit(1)

    # Scan
    if path.is_file():
        findings = scan_file(path)
    else:
        findings = scan_directory(path)

    # Generate report
    report = generate_report(findings)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"Report written to {args.output}")
    else:
        print(report)

    # Exit code
    critical_count = len([f for f in findings if f.severity == Severity.CRITICAL])
    if critical_count > 0:
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
