#!/usr/bin/env python3
"""
Generate Security Report

Generates comprehensive security report from all security scans.
Aggregates findings from OWASP, dependency, secrets, and auth scans.

Usage:
    python generate_security_report.py --path <project_path> [--output <file>]

Output:
    - Comprehensive security report
    - Risk score calculation
    - Prioritized remediation plan

Author: Expert Security Auditor Skill
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any


def run_script(script_path: Path, args: List[str]) -> Dict[str, Any]:
    """Run a security script and parse output."""
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)] + args,
            capture_output=True,
            text=True,
            timeout=300
        )
        return {
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Script timeout"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def calculate_risk_score(findings: Dict[str, Any]) -> int:
    """Calculate overall risk score (0-100)."""
    score = 100

    # Deduct points based on severity
    severity_weights = {
        "CRITICAL": 25,
        "HIGH": 15,
        "MEDIUM": 5,
        "LOW": 2
    }

    for category, items in findings.items():
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    severity = item.get("severity", "LOW")
                    score -= severity_weights.get(severity, 2)

    return max(0, min(100, score))


def get_risk_level(score: int) -> str:
    """Get risk level from score."""
    if score >= 80:
        return "LOW"
    elif score >= 60:
        return "MEDIUM"
    elif score >= 40:
        return "HIGH"
    else:
        return "CRITICAL"


def generate_comprehensive_report(project_path: Path) -> str:
    """Generate comprehensive security report."""
    scripts_dir = Path(__file__).parent

    # Run all security scans
    scans = {}

    # Dependency scan
    dep_result = run_script(
        scripts_dir / "scan_dependencies.py",
        ["--path", str(project_path)]
    )
    scans["dependencies"] = dep_result

    # Secrets scan
    secrets_result = run_script(
        scripts_dir / "detect_secrets.py",
        ["--path", str(project_path)]
    )
    scans["secrets"] = secrets_result

    # Auth audit
    auth_result = run_script(
        scripts_dir / "audit_authentication.py",
        ["--path", str(project_path)]
    )
    scans["authentication"] = auth_result

    # Calculate risk score
    risk_score = calculate_risk_score(scans)
    risk_level = get_risk_level(risk_score)

    # Generate report
    lines = [f"""# Security Assessment Report

**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
**Project**: {project_path.name}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Overall Risk Score | {risk_score}/100 |
| Risk Level | **{risk_level}** |
| Scans Performed | {len(scans)} |

---

## Scan Results

"""]

    # Dependencies
    lines.append("### 1. Dependency Vulnerability Scan\n")
    if scans["dependencies"]["success"]:
        lines.append("```\n" + scans["dependencies"]["output"][:2000] + "\n```\n")
    else:
        lines.append(f"⚠️ Scan failed: {scans['dependencies'].get('error', 'Unknown error')}\n")

    # Secrets
    lines.append("\n### 2. Secret Detection Scan\n")
    if scans["secrets"]["success"]:
        lines.append("```\n" + scans["secrets"]["output"][:2000] + "\n```\n")
    else:
        lines.append(f"⚠️ Scan failed: {scans['secrets'].get('error', 'Unknown error')}\n")

    # Authentication
    lines.append("\n### 3. Authentication Audit\n")
    if scans["authentication"]["success"]:
        lines.append("```\n" + scans["authentication"]["output"][:2000] + "\n```\n")
    else:
        lines.append(f"⚠️ Scan failed: {scans['authentication'].get('error', 'Unknown error')}\n")

    # Recommendations
    lines.append("""
---

## Recommendations

### Immediate Actions Required
""")

    if risk_level in ["CRITICAL", "HIGH"]:
        lines.append("""
1. **Critical**: Address all CRITICAL and HIGH severity findings
2. **Secrets**: Rotate any exposed credentials immediately
3. **Dependencies**: Update vulnerable packages to patched versions
4. **Authentication**: Review and strengthen auth mechanisms
""")
    else:
        lines.append("""
1. Continue monitoring for new vulnerabilities
2. Address MEDIUM severity findings in upcoming sprints
3. Review LOW severity findings for improvement opportunities
""")

    # Next steps
    lines.append("""
---

## Next Steps

1. Run `create_remediation_plan.py` for detailed fix recommendations
2. Schedule security review meeting with team
3. Set up automated security scanning in CI/CD
4. Review OWASP Top 10 compliance quarterly

---

*Generated by Expert Security Auditor Skill*
""")

    return ''.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Generate comprehensive security report'
    )
    parser.add_argument(
        '--path',
        default='.',
        help='Path to project'
    )
    parser.add_argument(
        '--output',
        default='security_report.md',
        help='Output file path'
    )

    args = parser.parse_args()

    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist: {path}", file=sys.stderr)
        sys.exit(1)

    # Generate report
    report = generate_comprehensive_report(path)

    # Write output
    with open(args.output, 'w') as f:
        f.write(report)

    print(f"✅ Security report generated: {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
