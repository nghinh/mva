#!/usr/bin/env python3
"""
Audit Authentication

Audits authentication mechanisms for security best practices.
Checks password policies, session management, JWT implementation.

Usage:
    python audit_authentication.py --path <project_path>

Checks:
    - Password hashing algorithms
    - Password strength validation
    - Session management
    - JWT implementation
    - MFA support

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
    INFO = "INFO"


@dataclass
class AuthFinding:
    category: str
    file_path: str
    line_number: int
    title: str
    description: str
    severity: Severity
    recommendation: str


AUTH_PATTERNS = {
    # Password Hashing
    "password_hashing": [
        {
            "pattern": r"(?:md5|sha1)\s*\([^)]*password",
            "title": "Weak password hashing",
            "description": "MD5 or SHA1 used for password hashing - cryptographically broken",
            "severity": Severity.CRITICAL,
            "recommendation": "Use bcrypt with cost >= 10 or argon2id"
        },
        {
            "pattern": r"bcrypt\.(?:GenerateFromPassword|HashPassword)",
            "negative": True,
            "title": "No bcrypt detected",
            "description": "No strong password hashing detected",
            "severity": Severity.HIGH,
            "recommendation": "Implement bcrypt or argon2id for password hashing"
        },
        {
            "pattern": r"bcrypt\.GenerateFromPassword\s*\([^,]+,\s*(?:4|5|6|7|8|9)\s*\)",
            "title": "Low bcrypt cost",
            "description": "bcrypt cost factor too low (< 10)",
            "severity": Severity.MEDIUM,
            "recommendation": "Increase bcrypt cost to at least 10"
        },
    ],

    # Password Validation
    "password_validation": [
        {
            "pattern": r"(?:min|minimum).*(?:password|len|length)\s*[=:]\s*[1-7]\b",
            "title": "Weak password length requirement",
            "description": "Password minimum length less than 8 characters",
            "severity": Severity.MEDIUM,
            "recommendation": "Require minimum 12 characters for passwords"
        },
        {
            "pattern": r"(?:validate|check).*(?:password)",
            "negative": True,
            "title": "No password validation",
            "description": "No password strength validation detected",
            "severity": Severity.MEDIUM,
            "recommendation": "Implement password strength validation (length, complexity)"
        },
    ],

    # Session Management
    "session_management": [
        {
            "pattern": r"session(?:_)?id\s*[=:]\s*(?:req\.|c\.|request)",
            "title": "Session ID from client",
            "description": "Session ID accepted from client input",
            "severity": Severity.HIGH,
            "recommendation": "Generate session IDs server-side only"
        },
        {
            "pattern": r"(?:MaxAge|Expires)\s*[=:]\s*(?:0|-1)",
            "title": "Session never expires",
            "description": "Session cookie set to never expire",
            "severity": Severity.MEDIUM,
            "recommendation": "Set reasonable session timeout (e.g., 30 minutes)"
        },
        {
            "pattern": r"HttpOnly\s*[=:]\s*(?:false|False)",
            "title": "Cookie without HttpOnly",
            "description": "Session cookie accessible via JavaScript",
            "severity": Severity.HIGH,
            "recommendation": "Set HttpOnly: true for session cookies"
        },
        {
            "pattern": r"Secure\s*[=:]\s*(?:false|False)",
            "title": "Cookie without Secure flag",
            "description": "Cookie transmitted over HTTP",
            "severity": Severity.HIGH,
            "recommendation": "Set Secure: true for all cookies"
        },
    ],

    # JWT Implementation
    "jwt": [
        {
            "pattern": r"jwt\.(?:Sign|NewWithClaims)\s*\([^,]+,\s*[\"'][^\"']{1,31}[\"']",
            "title": "Weak JWT secret",
            "description": "JWT secret appears to be short or hardcoded",
            "severity": Severity.CRITICAL,
            "recommendation": "Use 256-bit secret from environment variable"
        },
        {
            "pattern": r"jwt\.(?:Sign|NewWithClaims)\s*\([^)]*none",
            "title": "JWT none algorithm",
            "description": "None algorithm allowed for JWT",
            "severity": Severity.CRITICAL,
            "recommendation": "Explicitly reject 'none' algorithm"
        },
        {
            "pattern": r"(?:ExpiresAt|exp)\s*[=:]\s*0",
            "title": "JWT never expires",
            "description": "JWT token has no expiration",
            "severity": Severity.HIGH,
            "recommendation": "Set token expiration (e.g., 1 hour for access tokens)"
        },
        {
            "pattern": r"jwt\.ParseWithClaims",
            "negative": True,
            "title": "No JWT validation",
            "description": "No proper JWT validation detected",
            "severity": Severity.HIGH,
            "recommendation": "Validate JWT signature, expiration, and issuer"
        },
    ],

    # Authentication Rate Limiting
    "rate_limiting": [
        {
            "pattern": r"(?:login|auth).*(?:rate|limit|throttle)",
            "negative": True,
            "title": "No auth rate limiting",
            "description": "No rate limiting detected on authentication endpoints",
            "severity": Severity.HIGH,
            "recommendation": "Implement rate limiting on login/auth endpoints"
        },
    ],

    # MFA
    "mfa": [
        {
            "pattern": r"(?:mfa|totp|otp|2fa|two.factor)",
            "negative": True,
            "title": "No MFA support",
            "description": "No multi-factor authentication detected",
            "severity": Severity.MEDIUM,
            "recommendation": "Implement MFA for enhanced security"
        },
    ],
}


def scan_file(file_path: Path) -> List[AuthFinding]:
    """Scan a single file for authentication issues."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return findings

    for category, patterns in AUTH_PATTERNS.items():
        for pattern_def in patterns:
            pattern = pattern_def["pattern"]
            regex = re.compile(pattern, re.IGNORECASE)

            if pattern_def.get("negative", False):
                # Check if pattern is NOT present
                if not regex.search(content):
                    findings.append(AuthFinding(
                        category=category,
                        file_path=str(file_path),
                        line_number=0,
                        title=pattern_def["title"],
                        description=pattern_def["description"],
                        severity=pattern_def["severity"],
                        recommendation=pattern_def["recommendation"]
                    ))
            else:
                for match in regex.finditer(content):
                    line_num = content[:match.start()].count('\n') + 1
                    findings.append(AuthFinding(
                        category=category,
                        file_path=str(file_path),
                        line_number=line_num,
                        title=pattern_def["title"],
                        description=pattern_def["description"],
                        severity=pattern_def["severity"],
                        recommendation=pattern_def["recommendation"]
                    ))

    return findings


def scan_directory(directory: Path) -> List[AuthFinding]:
    """Scan directory for authentication issues."""
    all_findings = []

    # Focus on auth-related directories
    auth_dirs = ['ssc', 'auth', 'security', 'users']
    scan_paths = []

    for auth_dir in auth_dirs:
        path = directory / 'features' / auth_dir
        if path.exists():
            scan_paths.append(path)

    # Also scan root if no auth features found
    if not scan_paths:
        scan_paths = [directory]

    for scan_path in scan_paths:
        for ext in ['*.go', '*.ts', '*.tsx', '*.py']:
            for file_path in scan_path.rglob(ext):
                if 'vendor/' in str(file_path) or 'node_modules/' in str(file_path):
                    continue
                if '_test.' in str(file_path):
                    continue
                findings = scan_file(file_path)
                all_findings.extend(findings)

    return all_findings


def generate_report(findings: List[AuthFinding]) -> str:
    """Generate authentication audit report."""
    lines = ["# Authentication Security Audit Report\n"]

    if not findings:
        lines.append("✅ No authentication issues detected!")
        return '\n'.join(lines)

    # Summary by category
    lines.append("## Summary by Category\n")
    categories = {}
    for f in findings:
        if f.category not in categories:
            categories[f.category] = []
        categories[f.category].append(f)

    lines.append("| Category | Count |")
    lines.append("|----------|-------|")
    for cat, cat_findings in sorted(categories.items(), key=lambda x: -len(x[1])):
        lines.append(f"| {cat} | {len(cat_findings)} |")

    # Summary by severity
    lines.append("\n## Summary by Severity\n")
    critical = len([f for f in findings if f.severity == Severity.CRITICAL])
    high = len([f for f in findings if f.severity == Severity.HIGH])
    medium = len([f for f in findings if f.severity == Severity.MEDIUM])
    low = len([f for f in findings if f.severity == Severity.LOW])

    lines.append("| Severity | Count |")
    lines.append("|----------|-------|")
    lines.append(f"| 🔴 Critical | {critical} |")
    lines.append(f"| 🟠 High | {high} |")
    lines.append(f"| 🟡 Medium | {medium} |")
    lines.append(f"| 🟢 Low | {low} |")

    if critical > 0:
        lines.append(f"\n⛔ **{critical} CRITICAL authentication issues require immediate attention!**")

    # Detailed findings by category
    lines.append("\n## Detailed Findings\n")

    for cat, cat_findings in sorted(categories.items()):
        lines.append(f"\n### {cat.title()}\n")
        for f in sorted(cat_findings, key=lambda x: -list(Severity).index(x.severity)):
            severity_icons = {
                Severity.CRITICAL: "🔴",
                Severity.HIGH: "🟠",
                Severity.MEDIUM: "🟡",
                Severity.LOW: "🟢",
                Severity.INFO: "🔵"
            }
            icon = severity_icons.get(f.severity, "")
            lines.append(f"#### {icon} {f.title}\n")
            if f.line_number > 0:
                lines.append(f"**File**: `{f.file_path}:{f.line_number}`\n")
            lines.append(f"**Severity**: {f.severity.value}\n")
            lines.append(f"**Description**: {f.description}\n")
            lines.append(f"**Recommendation**: {f.recommendation}\n")

    # Best practices checklist
    lines.append("## Authentication Best Practices Checklist\n")
    lines.append("- [ ] Passwords hashed with bcrypt (cost >= 10) or argon2id")
    lines.append("- [ ] Password minimum length >= 12 characters")
    lines.append("- [ ] Session IDs generated server-side")
    lines.append("- [ ] Session cookies have HttpOnly and Secure flags")
    lines.append("- [ ] JWT tokens have expiration")
    lines.append("- [ ] JWT signed with strong 256-bit secret")
    lines.append("- [ ] Rate limiting on authentication endpoints")
    lines.append("- [ ] MFA available for users")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Audit authentication mechanisms'
    )
    parser.add_argument(
        '--path',
        default='.',
        help='Path to project'
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
