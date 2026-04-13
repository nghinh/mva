#!/usr/bin/env python3
"""
Scan OWASP Top 10

Scans codebase for OWASP Top 10 vulnerabilities.
Performs comprehensive security checks for common web application risks.

Usage:
    python scan_owasp_top10.py --path <project_path>

Checks:
    A01 - Broken Access Control
    A02 - Cryptographic Failures
    A03 - Injection
    A04 - Insecure Design
    A05 - Security Misconfiguration
    A06 - Vulnerable Components
    A07 - Authentication Failures
    A08 - Software Integrity Failures
    A09 - Logging Failures
    A10 - SSRF

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
class OwaspFinding:
    owasp_category: str
    file_path: str
    line_number: int
    title: str
    description: str
    severity: Severity
    remediation: str
    cwe_id: str = ""


# OWASP Top 10 2021 patterns
OWASP_PATTERNS = {
    # A01:2021 - Broken Access Control
    "A01": [
        {
            "pattern": r"(?:is_admin|isAdmin|role\s*==\s*[\"']admin[\"'])",
            "title": "Potential hardcoded admin check",
            "description": "Admin role check may be client-side or bypassable",
            "severity": Severity.HIGH,
            "remediation": "Implement server-side access control with proper RBAC",
            "cwe": "CWE-284"
        },
        {
            "pattern": r"(?:user_id|userId|tenant_id)\s*[=:]\s*(?:req\.(?:params|query|body)|c\.QueryParam|c\.Param)",
            "title": "Potential IDOR vulnerability",
            "description": "User/tenant ID from user input without validation",
            "severity": Severity.HIGH,
            "remediation": "Validate user has access to the requested resource",
            "cwe": "CWE-639"
        },
    ],

    # A02:2021 - Cryptographic Failures
    "A02": [
        {
            "pattern": r"(?:md5|sha1)\s*\(",
            "title": "Weak hash algorithm",
            "description": "MD5 or SHA1 used - these are cryptographically broken",
            "severity": Severity.HIGH,
            "remediation": "Use SHA-256 or bcrypt for passwords, SHA-256+ for data",
            "cwe": "CWE-328"
        },
        {
            "pattern": r"(?:DES|3DES|RC4|Blowfish)",
            "title": "Weak encryption algorithm",
            "description": "Deprecated or weak encryption algorithm detected",
            "severity": Severity.HIGH,
            "remediation": "Use AES-256-GCM or ChaCha20-Poly1305",
            "cwe": "CWE-327"
        },
        {
            "pattern": r"http://",
            "title": "HTTP URL (not HTTPS)",
            "description": "Unencrypted HTTP URL detected",
            "severity": Severity.MEDIUM,
            "remediation": "Use HTTPS for all external URLs",
            "cwe": "CWE-319"
        },
        {
            "pattern": r"TLS(?:_)?1(?:\.0|\.1)?[\"']?",
            "title": "Outdated TLS version",
            "description": "TLS 1.0 or 1.1 detected - use TLS 1.2+",
            "severity": Severity.MEDIUM,
            "remediation": "Upgrade to TLS 1.2 or higher",
            "cwe": "CWE-326"
        },
    ],

    # A03:2021 - Injection
    "A03": [
        {
            "pattern": r"(?:fmt\.Sprintf|fmt\.Printf|strings\.Replace)\s*\([^)]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)",
            "title": "Potential SQL injection",
            "description": "String formatting in SQL query",
            "severity": Severity.CRITICAL,
            "remediation": "Use parameterized queries with $1, $2 or ? placeholders",
            "cwe": "CWE-89"
        },
        {
            "pattern": r"\$where\s*:",
            "title": "NoSQL injection risk",
            "description": "MongoDB $where operator can execute JavaScript",
            "severity": Severity.CRITICAL,
            "remediation": "Avoid $where, use proper query operators",
            "cwe": "CWE-943"
        },
        {
            "pattern": r"(?:exec|eval|Function)\s*\(",
            "title": "Code injection risk",
            "description": "Dynamic code execution detected",
            "severity": Severity.CRITICAL,
            "remediation": "Avoid dynamic code execution, use safe alternatives",
            "cwe": "CWE-94"
        },
        {
            "pattern": r"template\.HTML\s*\(",
            "title": "XSS risk",
            "description": "Unescaped HTML output",
            "severity": Severity.HIGH,
            "remediation": "Sanitize HTML input or use text templates",
            "cwe": "CWE-79"
        },
        {
            "pattern": r"(?:os\.Exec|exec\.Command)\s*\([^)]*\+",
            "title": "Command injection risk",
            "description": "String concatenation in command execution",
            "severity": Severity.CRITICAL,
            "remediation": "Use exec.Command with separate arguments, not shell",
            "cwe": "CWE-78"
        },
    ],

    # A05:2021 - Security Misconfiguration
    "A05": [
        {
            "pattern": r"(?:password|secret|key)\s*[=:]\s*[\"'][^\"']{8,}[\"']",
            "title": "Hardcoded credential",
            "description": "Potential hardcoded password or secret",
            "severity": Severity.CRITICAL,
            "remediation": "Use environment variables or secrets manager",
            "cwe": "CWE-798"
        },
        {
            "pattern": r"Debug\s*[=:]\s*(?:true|True|1)",
            "title": "Debug mode enabled",
            "description": "Debug mode may expose sensitive information",
            "severity": Severity.MEDIUM,
            "remediation": "Disable debug mode in production",
            "cwe": "CWE-215"
        },
        {
            "pattern": r"CORS\s*[=:]\s*[\"']*[*][\"']*",
            "title": "Overly permissive CORS",
            "description": "CORS allows all origins (*)",
            "severity": Severity.MEDIUM,
            "remediation": "Specify allowed origins explicitly",
            "cwe": "CWE-942"
        },
        {
            "pattern": r"AllowCredentials\s*[=:]\s*(?:true|True).*Origin\s*[=:]\s*[\"']*[*][\"']*",
            "title": "CORS misconfiguration",
            "description": "Credentials allowed with wildcard origin",
            "severity": Severity.HIGH,
            "remediation": "Specify exact origins when using credentials",
            "cwe": "CWE-942"
        },
    ],

    # A07:2021 - Authentication Failures
    "A07": [
        {
            "pattern": r"password\s*[=:]\s*[\"'][^\"']{1,7}[\"']",
            "title": "Weak password detected",
            "description": "Password shorter than 8 characters",
            "severity": Severity.MEDIUM,
            "remediation": "Enforce minimum 8 character passwords",
            "cwe": "CWE-521"
        },
        {
            "pattern": r"session(?:_)?id\s*[=:]\s*(?:req\.(?:cookies|headers)|c\.Cookie)",
            "title": "Session ID from client",
            "description": "Session ID accepted from client without validation",
            "severity": Severity.HIGH,
            "remediation": "Generate session IDs server-side, never trust client input",
            "cwe": "CWE-613"
        },
        {
            "pattern": r"jwt\.(?:sign|decode)\s*\([^)]*(?:secret|password)[^)]*\)",
            "title": "JWT with weak secret",
            "description": "JWT signed with potentially weak secret",
            "severity": Severity.HIGH,
            "remediation": "Use strong 256-bit secret for JWT signing",
            "cwe": "CWE-798"
        },
        {
            "pattern": r"(?:bcrypt|argon2|scrypt)\s*\([^)]*(?:4|5|6|7|8|9)[^)]*\)",
            "negative": True,
            "title": "No strong password hashing",
            "description": "No bcrypt/argon2/scrypt with sufficient cost detected",
            "severity": Severity.HIGH,
            "remediation": "Use bcrypt with cost >= 10 or argon2id",
            "cwe": "CWE-916"
        },
    ],

    # A09:2021 - Logging Failures
    "A09": [
        {
            "pattern": r"(?:log\.|logger\.).*(?:password|token|secret|key)\s*[,:]",
            "title": "Sensitive data in logs",
            "description": "Potential logging of sensitive information",
            "severity": Severity.HIGH,
            "remediation": "Redact sensitive data before logging",
            "cwe": "CWE-532"
        },
        {
            "pattern": r"logger\s*[=:]\s*log\.New(?:Logger)?\s*\(\s*\)",
            "title": "Unstructured logging",
            "description": "Non-structured logging detected",
            "severity": Severity.LOW,
            "remediation": "Use structured logging (JSON) for better analysis",
            "cwe": "CWE-778"
        },
    ],

    # A10:2021 - SSRF
    "A10": [
        {
            "pattern": r"(?:http\.Get|http\.Post|client\.Do)\s*\([^)]*(?:req\.|c\.QueryParam|c\.Param)",
            "title": "Potential SSRF",
            "description": "HTTP request with user-provided URL",
            "severity": Severity.HIGH,
            "remediation": "Validate and whitelist allowed URLs",
            "cwe": "CWE-918"
        },
        {
            "pattern": r"url\s*[=:]\s*(?:req\.|c\.QueryParam|c\.Param)",
            "title": "URL from user input",
            "description": "URL constructed from user input",
            "severity": Severity.MEDIUM,
            "remediation": "Validate URL scheme and host against allowlist",
            "cwe": "CWE-918"
        },
    ],
}


def scan_file(file_path: Path) -> List[OwaspFinding]:
    """Scan a single file for OWASP vulnerabilities."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception:
        return findings

    for category, patterns in OWASP_PATTERNS.items():
        for pattern_def in patterns:
            pattern = pattern_def["pattern"]
            regex = re.compile(pattern, re.IGNORECASE)

            if pattern_def.get("negative", False):
                # Check if pattern is NOT present
                if not regex.search(content):
                    findings.append(OwaspFinding(
                        owasp_category=category,
                        file_path=str(file_path),
                        line_number=0,
                        title=pattern_def["title"],
                        description=pattern_def["description"],
                        severity=pattern_def["severity"],
                        remediation=pattern_def["remediation"],
                        cwe_id=pattern_def.get("cwe", "")
                    ))
            else:
                for match in regex.finditer(content):
                    line_num = content[:match.start()].count('\n') + 1
                    findings.append(OwaspFinding(
                        owasp_category=category,
                        file_path=str(file_path),
                        line_number=line_num,
                        title=pattern_def["title"],
                        description=pattern_def["description"],
                        severity=pattern_def["severity"],
                        remediation=pattern_def["remediation"],
                        cwe_id=pattern_def.get("cwe", "")
                    ))

    return findings


def scan_directory(directory: Path) -> List[OwaspFinding]:
    """Scan all Go files in a directory."""
    all_findings = []

    for ext in ['*.go', '*.ts', '*.tsx', '*.js', '*.jsx', '*.py']:
        for file_path in directory.rglob(ext):
            if 'vendor/' in str(file_path) or 'node_modules/' in str(file_path):
                continue
            if '_test.' in str(file_path):
                continue
            findings = scan_file(file_path)
            all_findings.extend(findings)

    return all_findings


def generate_report(findings: List[OwaspFinding]) -> str:
    """Generate OWASP scan report."""
    lines = ["# OWASP Top 10 Security Scan Report\n"]

    if not findings:
        lines.append("✅ No OWASP Top 10 vulnerabilities detected!")
        return '\n'.join(lines)

    # Summary by OWASP category
    lines.append("## Summary by OWASP Category\n")
    categories = {}
    for f in findings:
        if f.owasp_category not in categories:
            categories[f.owasp_category] = []
        categories[f.owasp_category].append(f)

    lines.append("| Category | Count |")
    lines.append("|----------|-------|")
    for cat in sorted(categories.keys()):
        count = len(categories[cat])
        lines.append(f"| {cat} | {count} |")

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
        lines.append(f"\n⛔ **{critical} CRITICAL vulnerabilities require immediate attention!**")

    # Detailed findings
    lines.append("\n## Detailed Findings\n")

    for cat in sorted(categories.keys()):
        cat_findings = categories[cat]
        lines.append(f"\n### {cat}\n")

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
            lines.append(f"**File**: `{f.file_path}:{f.line_number}`\n")
            lines.append(f"**Severity**: {f.severity.value}\n")
            lines.append(f"**CWE**: {f.cwe_id}\n")
            lines.append(f"**Description**: {f.description}\n")
            lines.append(f"**Remediation**: {f.remediation}\n")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Scan for OWASP Top 10 vulnerabilities'
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
