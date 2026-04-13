#!/usr/bin/env python3
"""
Validate Security Headers

Validates HTTP security headers for web applications.
Checks for presence and proper configuration of security headers.

Usage:
    python validate_security_headers.py --url <url>

Checks:
    - Strict-Transport-Security (HSTS)
    - Content-Security-Policy (CSP)
    - X-Frame-Options
    - X-Content-Type-Options
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy

Author: Expert Security Auditor Skill
"""

import argparse
import re
import sys
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional
import urllib.request
import urllib.error
import ssl


class Severity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


@dataclass
class HeaderFinding:
    header_name: str
    status: str  # "missing", "present", "misconfigured"
    severity: Severity
    description: str
    recommendation: str
    current_value: Optional[str] = None


# Security headers configuration
SECURITY_HEADERS = {
    "Strict-Transport-Security": {
        "required": True,
        "severity_missing": Severity.CRITICAL,
        "check": lambda v: (
            Severity.LOW if "max-age" not in v.lower()
            else Severity.INFO if "max-age" in v.lower() and int(re.search(r"max-age=(\d+)", v, re.I).group(1) if re.search(r"max-age=(\d+)", v, re.I) else 0) < 31536000
            else Severity.INFO if "includeSubDomains" not in v.lower()
            else None
        ),
        "recommendation": "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
        "description": "Enforces HTTPS connections"
    },
    "Content-Security-Policy": {
        "required": True,
        "severity_missing": Severity.HIGH,
        "check": lambda v: (
            Severity.HIGH if "unsafe-inline" in v.lower() or "unsafe-eval" in v.lower()
            else Severity.MEDIUM if "*" in v
            else None
        ),
        "recommendation": "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        "description": "Prevents XSS and content injection attacks"
    },
    "X-Frame-Options": {
        "required": True,
        "severity_missing": Severity.HIGH,
        "check": lambda v: (
            Severity.LOW if v.lower() not in ["deny", "sameorigin"]
            else None
        ),
        "recommendation": "X-Frame-Options: DENY or SAMEORIGIN",
        "description": "Prevents clickjacking attacks"
    },
    "X-Content-Type-Options": {
        "required": True,
        "severity_missing": Severity.HIGH,
        "check": lambda v: (
            Severity.LOW if v.lower() != "nosniff"
            else None
        ),
        "recommendation": "X-Content-Type-Options: nosniff",
        "description": "Prevents MIME type sniffing"
    },
    "X-XSS-Protection": {
        "required": False,
        "severity_missing": Severity.LOW,
        "check": lambda v: (
            Severity.INFO if "1; mode=block" not in v.lower()
            else None
        ),
        "recommendation": "X-XSS-Protection: 1; mode=block (or remove for modern browsers)",
        "description": "Legacy XSS filter (deprecated but still useful)"
    },
    "Referrer-Policy": {
        "required": True,
        "severity_missing": Severity.MEDIUM,
        "check": lambda v: (
            Severity.LOW if v.lower() not in ["no-referrer", "strict-origin", "strict-origin-when-cross-origin"]
            else None
        ),
        "recommendation": "Referrer-Policy: strict-origin-when-cross-origin",
        "description": "Controls referrer information"
    },
    "Permissions-Policy": {
        "required": False,
        "severity_missing": Severity.LOW,
        "check": lambda v: None,
        "recommendation": "Permissions-Policy: geolocation=(), microphone=(), camera=()",
        "description": "Controls browser features"
    },
    "Cache-Control": {
        "required": True,
        "severity_missing": Severity.MEDIUM,
        "check": lambda v: (
            Severity.MEDIUM if "no-store" not in v.lower() and "private" not in v.lower()
            else None
        ),
        "recommendation": "Cache-Control: no-store, no-cache, must-revalidate (for sensitive pages)",
        "description": "Controls caching behavior"
    },
}

# Headers that should NOT be present
DANGEROUS_HEADERS = {
    "X-Powered-By": {
        "severity": Severity.LOW,
        "description": "Reveals technology stack",
        "recommendation": "Remove this header from server configuration"
    },
    "Server": {
        "severity": Severity.LOW,
        "description": "Reveals server version",
        "recommendation": "Hide or minimize server version information"
    },
    "X-AspNet-Version": {
        "severity": Severity.LOW,
        "description": "Reveals ASP.NET version",
        "recommendation": "Remove this header"
    },
}


def fetch_headers(url: str) -> Dict[str, str]:
    """Fetch HTTP headers from URL."""
    headers = {}

    try:
        # Create SSL context that doesn't verify (for testing)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        request = urllib.request.Request(url, method='HEAD')
        request.add_header('User-Agent', 'SecurityScanner/1.0')

        with urllib.request.urlopen(request, timeout=10, context=ctx) as response:
            for key, value in response.headers.items():
                headers[key.lower()] = value
    except urllib.error.HTTPError as e:
        # Still get headers from error response
        for key, value in e.headers.items():
            headers[key.lower()] = value
    except Exception as e:
        print(f"Error fetching headers: {e}", file=sys.stderr)

    return headers


def validate_headers(headers: Dict[str, str]) -> List[HeaderFinding]:
    """Validate security headers."""
    findings = []

    # Check for required security headers
    for header_name, config in SECURITY_HEADERS.items():
        header_lower = header_name.lower()

        if header_lower not in headers:
            findings.append(HeaderFinding(
                header_name=header_name,
                status="missing",
                severity=config["severity_missing"],
                description=config["description"],
                recommendation=config["recommendation"]
            ))
        else:
            value = headers[header_lower]
            issue_severity = config["check"](value) if config["check"] else None

            if issue_severity:
                findings.append(HeaderFinding(
                    header_name=header_name,
                    status="misconfigured",
                    severity=issue_severity,
                    description=f"{config['description']} - misconfigured",
                    recommendation=config["recommendation"],
                    current_value=value
                ))
            else:
                findings.append(HeaderFinding(
                    header_name=header_name,
                    status="present",
                    severity=Severity.INFO,
                    description=config["description"],
                    recommendation="OK",
                    current_value=value
                ))

    # Check for dangerous headers
    for header_name, config in DANGEROUS_HEADERS.items():
        header_lower = header_name.lower()

        if header_lower in headers:
            findings.append(HeaderFinding(
                header_name=header_name,
                status="present",
                severity=config["severity"],
                description=config["description"],
                recommendation=config["recommendation"],
                current_value=headers[header_lower]
            ))

    return findings


def generate_report(findings: List[HeaderFinding], url: str) -> str:
    """Generate security headers report."""
    lines = [f"# Security Headers Report\n"]
    lines.append(f"**URL**: {url}\n")

    # Summary
    lines.append("## Summary\n")
    missing = len([f for f in findings if f.status == "missing" and SECURITY_HEADERS.get(f.header_name, {}).get("required")])
    misconfigured = len([f for f in findings if f.status == "misconfigured"])
    present = len([f for f in findings if f.status == "present" and f.severity == Severity.INFO])

    lines.append("| Status | Count |")
    lines.append("|--------|-------|")
    lines.append(f"| ❌ Missing (Required) | {missing} |")
    lines.append(f"| ⚠️ Misconfigured | {misconfigured} |")
    lines.append(f"| ✅ Properly Configured | {present} |")

    # Detailed findings
    lines.append("\n## Header Details\n")
    lines.append("| Header | Status | Severity | Value | Recommendation |")
    lines.append("|--------|--------|----------|-------|----------------|")

    for f in findings:
        status_icons = {
            "missing": "❌",
            "misconfigured": "⚠️",
            "present": "✅" if f.severity == Severity.INFO else "⚠️"
        }
        severity_icons = {
            Severity.CRITICAL: "🔴",
            Severity.HIGH: "🟠",
            Severity.MEDIUM: "🟡",
            Severity.LOW: "🔵",
            Severity.INFO: "🟢"
        }
        icon = status_icons.get(f.status, "")
        sev_icon = severity_icons.get(f.severity, "")
        value = f.current_value[:30] + "..." if f.current_value and len(f.current_value) > 30 else (f.current_value or "-")
        lines.append(f"| {icon} {f.header_name} | {f.status} | {sev_icon} {f.severity.value} | `{value}` | {f.recommendation} |")

    # Recommendations
    lines.append("\n## Recommended Configuration\n")
    lines.append("```")
    lines.append("# Nginx configuration")
    lines.append("add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains; preload' always;")
    lines.append("add_header X-Frame-Options 'SAMEORIGIN' always;")
    lines.append("add_header X-Content-Type-Options 'nosniff' always;")
    lines.append("add_header X-XSS-Protection '1; mode=block' always;")
    lines.append("add_header Referrer-Policy 'strict-origin-when-cross-origin' always;")
    lines.append("add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';\" always;")
    lines.append("```")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Validate HTTP security headers'
    )
    parser.add_argument(
        '--url',
        required=True,
        help='URL to validate'
    )
    parser.add_argument(
        '--output',
        help='Output file for report (default: stdout)'
    )

    args = parser.parse_args()

    # Ensure URL has scheme
    url = args.url
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    # Fetch headers
    headers = fetch_headers(url)

    if not headers:
        print("Error: Could not fetch headers from URL", file=sys.stderr)
        sys.exit(1)

    # Validate
    findings = validate_headers(headers)

    # Generate report
    report = generate_report(findings, url)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"Report written to {args.output}")
    else:
        print(report)

    # Exit code
    critical_count = len([f for f in findings if f.severity == Severity.CRITICAL])
    high_count = len([f for f in findings if f.severity == Severity.HIGH])
    if critical_count > 0 or high_count > 2:
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
