#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent

INTERNAL_TASKS = {
    "owasp": "scan_owasp_top10.py",
    "dependencies": "scan_dependencies.py",
    "secrets": "detect_secrets.py",
    "auth": "audit_authentication.py",
    "authorization": "audit_authorization.py",
    "input": "validate_input_sanitization.py",
    "compliance": "check_compliance.py",
    "report": "generate_security_report.py",
    "remediation": "create_remediation_plan.py",
}

EXTERNAL_TOOLS = {
    "semgrep": ["semgrep", "scan", "--config", "auto"],
    "gitleaks": ["gitleaks", "dir"],
    "trivy": ["trivy", "fs", "--scanners", "vuln,misconfig,secret"],
}


def run(cmd: list[str], cwd: Path | None = None) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, text=True, capture_output=True)
    return proc.returncode, proc.stdout, proc.stderr


def run_internal(task: str, target: Path, output_dir: Path, framework: str = "all") -> dict:
    script = BASE / INTERNAL_TASKS[task]
    if not script.exists():
        return {"task": task, "status": "missing-script", "script": str(script)}
    out_file = output_dir / f"{task}.json"
    cmd = [sys.executable, str(script), "--path", str(target), "--output", str(out_file)]
    if task == "compliance":
        cmd.extend(["--framework", framework])
    code, stdout, stderr = run(cmd)
    return {
        "task": task,
        "kind": "internal",
        "command": cmd,
        "status": "ok" if code == 0 else "failed",
        "returncode": code,
        "stdout": stdout[-4000:],
        "stderr": stderr[-4000:],
        "output": str(out_file),
    }


def run_external(name: str, target: Path, output_dir: Path) -> dict:
    if not shutil.which(name):
        return {"task": name, "kind": "external", "status": "not-installed"}
    cmd = EXTERNAL_TOOLS[name] + [str(target)]
    code, stdout, stderr = run(cmd)
    out_file = output_dir / f"{name}.log"
    content = (stdout or "") + (("\n[stderr]\n" + stderr) if stderr else "")
    out_file.write_text(content, encoding="utf-8")
    return {
        "task": name,
        "kind": "external",
        "status": "ok" if code == 0 else "failed",
        "returncode": code,
        "command": cmd,
        "output": str(out_file),
    }


def render_summary(results: list[dict], summary_path: Path) -> None:
    lines = [
        "# Security Workflow Run Summary",
        "",
        f"Generated: {datetime.utcnow().isoformat()}Z",
        "",
        "| Task | Kind | Status | Output |",
        "|---|---|---|---|",
    ]
    for item in results:
        lines.append(
            f"| {item.get('task')} | {item.get('kind', 'internal')} | {item.get('status')} | {item.get('output', '')} |"
        )
    lines += [
        "",
        "## Interpretation",
        "- `ok`: task executed successfully.",
        "- `failed`: task ran but returned a non-zero exit code; inspect the output/log.",
        "- `not-installed`: optional external tool not present; this is not fatal for source-based review.",
        "- Use these artifacts as evidence, then verify hotspots from source before making conclusions.",
    ]
    summary_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description="Run the bmad-vnpt-security workflow helper")
    p.add_argument("--path", default=".")
    p.add_argument("--output-dir", default="security-audit-output")
    p.add_argument("--framework", default="all", choices=["soc2", "iso27001", "gdpr", "all"])
    p.add_argument("--skip-external", action="store_true")
    args = p.parse_args()

    target = Path(args.path).resolve()
    out = Path(args.output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)

    results = []
    for task in ["owasp", "dependencies", "secrets", "auth", "authorization", "input", "compliance", "report"]:
        results.append(run_internal(task, target, out, framework=args.framework))

    if not args.skip_external:
        for name in ["semgrep", "gitleaks", "trivy"]:
            results.append(run_external(name, target, out))

    render_summary(results, out / "SUMMARY.md")
    (out / "workflow-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(out / "SUMMARY.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Note: workflow pack v2 adds specialist review commands at the OpenCode/BMAD layer.
