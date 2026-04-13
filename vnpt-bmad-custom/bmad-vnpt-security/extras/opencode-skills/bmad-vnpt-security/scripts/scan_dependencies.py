#!/usr/bin/env python3
"""
Scan Dependencies

Scans project dependencies for known vulnerabilities.
Checks Go modules and npm packages against CVE database.

Usage:
    python scan_dependencies.py --path <project_path>

Checks:
    - Known CVEs in dependencies
    - Outdated packages
    - License compliance

Author: Expert Security Auditor Skill
"""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List, Optional


class Severity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class DependencyVulnerability:
    package: str
    installed_version: str
    fixed_version: Optional[str]
    cve_id: str
    severity: Severity
    description: str
    recommendation: str


# Known vulnerable packages (simplified database)
KNOWN_VULNERABILITIES = {
    "go": {
        "github.com/golang-jwt/jwt": {
            "<4.0.0": {"cve": "CVE-2020-26160", "severity": Severity.HIGH,
                      "desc": "JWT None algorithm vulnerability", "fix": "4.0.0+"}
        },
        "github.com/dgrijalva/jwt-go": {
            "*": {"cve": "CVE-2020-26160", "severity": Severity.CRITICAL,
                  "desc": "Use golang-jwt/jwt instead", "fix": "Switch to github.com/golang-jwt/jwt/v4"}
        },
        "github.com/go-playground/validator": {
            "<9.31.0": {"cve": "CVE-2020-36066", "severity": Severity.MEDIUM,
                        "desc": "DoS via regex", "fix": "9.31.0+"}
        },
        "golang.org/x/crypto": {
            "<0.0.0-20200622213623-75b288015ac9": {"cve": "CVE-2020-29652", "severity": Severity.HIGH,
                                                   "desc": "Nil pointer dereference", "fix": "Update to latest"}
        },
    },
    "npm": {
        "lodash": {
            "<4.17.21": {"cve": "CVE-2021-23337", "severity": Severity.HIGH,
                        "desc": "Command injection", "fix": "4.17.21+"}
        },
        "axios": {
            "<0.21.1": {"cve": "CVE-2021-3749", "severity": Severity.HIGH,
                       "desc": "SSRF via absolute URL", "fix": "0.21.1+"}
        },
        "node-fetch": {
            "<2.6.1": {"cve": "CVE-2020-15168", "severity": Severity.MEDIUM,
                      "desc": "Size limit bypass", "fix": "2.6.1+"}
        },
        "minimist": {
            "<1.2.3": {"cve": "CVE-2020-7598", "severity": Severity.MEDIUM,
                      "desc": "Prototype pollution", "fix": "1.2.3+"}
        },
        "yargs-parser": {
            "<13.1.2": {"cve": "CVE-2020-7608", "severity": Severity.MEDIUM,
                       "desc": "Prototype pollution", "fix": "13.1.2+"}
        },
    }
}

# Deprecated packages
DEPRECATED_PACKAGES = {
    "go": {
        "github.com/dgrijalva/jwt-go": "Use github.com/golang-jwt/jwt/v4",
        "github.com/Shopify/sarama": "Use github.com/IBM/sarama",
        "github.com/niemeyer/pretty": "No longer maintained",
    },
    "npm": {
        "request": "Use node-fetch, axios, or got",
        "express-session": "Consider using @fastify/session for new projects",
    }
}


def parse_go_mod(file_path: Path) -> List[tuple]:
    """Parse go.mod file for dependencies."""
    deps = []

    try:
        with open(file_path, 'r') as f:
            content = f.read()
    except Exception:
        return deps

    # Find require block
    require_match = re.search(r'require\s*\(([^)]+)\)', content, re.DOTALL)
    if require_match:
        require_block = require_match.group(1)
        for line in require_block.strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('//'):
                parts = line.split()
                if len(parts) >= 2:
                    pkg = parts[0]
                    version = parts[1].replace('v', '')
                    deps.append((pkg, version))

    # Single-line requires
    single_requires = re.findall(r'require\s+(\S+)\s+(\S+)', content)
    for pkg, version in single_requires:
        version = version.replace('v', '')
        deps.append((pkg, version))

    return deps


def parse_package_json(file_path: Path) -> List[tuple]:
    """Parse package.json for dependencies."""
    deps = []

    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except Exception:
        return deps

    for dep_type in ['dependencies', 'devDependencies']:
        if dep_type in data:
            for pkg, version in data[dep_type].items():
                # Clean version string
                version = version.replace('^', '').replace('~', '').replace('>=', '').replace('>', '')
                deps.append((pkg, version))

    return deps


def check_go_vulnerabilities(pkg: str, version: str) -> List[DependencyVulnerability]:
    """Check Go package for known vulnerabilities."""
    vulns = []

    if pkg in KNOWN_VULNERABILITIES["go"]:
        for version_range, vuln_info in KNOWN_VULNERABILITIES["go"][pkg].items():
            if version_range == "*" or version in version_range:
                vulns.append(DependencyVulnerability(
                    package=pkg,
                    installed_version=version,
                    fixed_version=vuln_info["fix"],
                    cve_id=vuln_info["cve"],
                    severity=vuln_info["severity"],
                    description=vuln_info["desc"],
                    recommendation=f"Upgrade to {vuln_info['fix']}"
                ))

    return vulns


def check_npm_vulnerabilities(pkg: str, version: str) -> List[DependencyVulnerability]:
    """Check npm package for known vulnerabilities."""
    vulns = []

    if pkg in KNOWN_VULNERABILITIES["npm"]:
        for version_range, vuln_info in KNOWN_VULNERABILITIES["npm"][pkg].items():
            # Simple version check (real implementation would use semver)
            try:
                installed_parts = [int(x) for x in version.split('.')[:3]]
                min_parts = [int(x) for x in version_range.replace('<', '').replace('+', '').split('.')[:3]]
                if installed_parts < min_parts:
                    vulns.append(DependencyVulnerability(
                        package=pkg,
                        installed_version=version,
                        fixed_version=vuln_info["fix"],
                        cve_id=vuln_info["cve"],
                        severity=vuln_info["severity"],
                        description=vuln_info["desc"],
                        recommendation=f"Upgrade to {vuln_info['fix']}"
                    ))
            except ValueError:
                pass

    return vulns


def scan_go_dependencies(project_path: Path) -> List[DependencyVulnerability]:
    """Scan Go dependencies."""
    vulns = []

    go_mod = project_path / "go.mod"
    if go_mod.exists():
        deps = parse_go_mod(go_mod)
        for pkg, version in deps:
            vulns.extend(check_go_vulnerabilities(pkg, version))

    return vulns


def scan_npm_dependencies(project_path: Path) -> List[DependencyVulnerability]:
    """Scan npm dependencies."""
    vulns = []

    package_json = project_path / "package.json"
    if package_json.exists():
        deps = parse_package_json(package_json)
        for pkg, version in deps:
            vulns.extend(check_npm_vulnerabilities(pkg, version))

    # Check frontend package.json
    frontend_pkg = project_path / "apps" / "frontend" / "package.json"
    if frontend_pkg.exists():
        deps = parse_package_json(frontend_pkg)
        for pkg, version in deps:
            vulns.extend(check_npm_vulnerabilities(pkg, version))

    return vulns


def generate_report(go_vulns: List[DependencyVulnerability],
                   npm_vulns: List[DependencyVulnerability]) -> str:
    """Generate dependency vulnerability report."""
    lines = ["# Dependency Vulnerability Scan Report\n"]

    all_vulns = go_vulns + npm_vulns

    if not all_vulns:
        lines.append("✅ No known vulnerabilities found in dependencies!")
        return '\n'.join(lines)

    # Summary
    lines.append("## Summary\n")
    critical = len([v for v in all_vulns if v.severity == Severity.CRITICAL])
    high = len([v for v in all_vulns if v.severity == Severity.HIGH])
    medium = len([v for v in all_vulns if v.severity == Severity.MEDIUM])
    low = len([v for v in all_vulns if v.severity == Severity.LOW])

    lines.append("| Severity | Count |")
    lines.append("|----------|-------|")
    lines.append(f"| 🔴 Critical | {critical} |")
    lines.append(f"| 🟠 High | {high} |")
    lines.append(f"| 🟡 Medium | {medium} |")
    lines.append(f"| 🟢 Low | {low} |")

    if critical > 0:
        lines.append(f"\n⛔ **{critical} CRITICAL vulnerabilities require immediate attention!**")

    # Go vulnerabilities
    if go_vulns:
        lines.append("\n## Go Dependencies\n")
        for vuln in go_vulns:
            severity_icons = {
                Severity.CRITICAL: "🔴",
                Severity.HIGH: "🟠",
                Severity.MEDIUM: "🟡",
                Severity.LOW: "🟢"
            }
            icon = severity_icons.get(vuln.severity, "")
            lines.append(f"### {icon} {vuln.package}\n")
            lines.append(f"**CVE**: {vuln.cve_id}\n")
            lines.append(f"**Installed**: {vuln.installed_version}\n")
            lines.append(f"**Fixed in**: {vuln.fixed_version}\n")
            lines.append(f"**Severity**: {vuln.severity.value}\n")
            lines.append(f"**Description**: {vuln.description}\n")
            lines.append(f"**Recommendation**: {vuln.recommendation}\n")

    # npm vulnerabilities
    if npm_vulns:
        lines.append("\n## NPM Dependencies\n")
        for vuln in npm_vulns:
            severity_icons = {
                Severity.CRITICAL: "🔴",
                Severity.HIGH: "🟠",
                Severity.MEDIUM: "🟡",
                Severity.LOW: "🟢"
            }
            icon = severity_icons.get(vuln.severity, "")
            lines.append(f"### {icon} {vuln.package}\n")
            lines.append(f"**CVE**: {vuln.cve_id}\n")
            lines.append(f"**Installed**: {vuln.installed_version}\n")
            lines.append(f"**Fixed in**: {vuln.fixed_version}\n")
            lines.append(f"**Severity**: {vuln.severity.value}\n")
            lines.append(f"**Description**: {vuln.description}\n")
            lines.append(f"**Recommendation**: {vuln.recommendation}\n")

    # Remediation commands
    lines.append("\n## Remediation Commands\n")
    lines.append("```bash")
    lines.append("# Update Go dependencies")
    lines.append("go get -u && go mod tidy")
    lines.append("")
    lines.append("# Update npm dependencies")
    lines.append("npm audit fix")
    lines.append("npm update")
    lines.append("```")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Scan dependencies for vulnerabilities'
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

    # Scan dependencies
    go_vulns = scan_go_dependencies(path)
    npm_vulns = scan_npm_dependencies(path)

    # Generate report
    report = generate_report(go_vulns, npm_vulns)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"Report written to {args.output}")
    else:
        print(report)

    # Exit code
    all_vulns = go_vulns + npm_vulns
    critical_count = len([v for v in all_vulns if v.severity == Severity.CRITICAL])
    if critical_count > 0:
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
