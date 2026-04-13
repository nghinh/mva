#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json
import subprocess
import sys
from pathlib import Path

def run(cmd):
    print("$", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

def summarize(report: dict) -> dict:
    sev = report.get("summary", {}).get("by_severity", {})
    return {
        "error": int(sev.get("error", 0)),
        "warning": int(sev.get("warning", 0)),
        "info": int(sev.get("info", 0)),
        "count": int(report.get("violation_count", 0)),
    }

def write_gate_result(repo: Path, source: str, before: dict, after: dict, autofix_ran: bool):
    out = repo / "reports" / "react-skill-audit" / "gate-result.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    passed = after["error"] == 0
    status = "PASS" if passed else "MANUAL_REVIEW_REQUIRED"
    text = f"""# React Quality Gate Result

## Status
{status}

## Source
- repo: `{repo}`
- source root: `{source}`

## Before autofix
- errors: {before['error']}
- warnings: {before['warning']}
- info: {before['info']}
- total findings: {before['count']}

## After autofix
- errors: {after['error']}
- warnings: {after['warning']}
- info: {after['info']}
- total findings: {after['count']}

## Autofix
- ran: {"yes" if autofix_ran else "no"}

## Next required step
The AI agent must now:
1. read `reports/react-skill-audit/react-skill-audit.json`
2. read `reports/react-skill-audit/react-skill-audit.md`
3. perform manual review using `tools/vnpt-react-audit/review_with_ai_prompt.md`
4. fix remaining issues or explicitly justify deviations
5. rerun the quality gate if source code changed again
"""
    out.write_text(text, encoding="utf-8")
    print(f"Wrote {out}")

def main():
    p = argparse.ArgumentParser(description="Run the enforced VNPT React quality gate.")
    p.add_argument("--repo", default=".")
    p.add_argument("--source", default="src")
    p.add_argument("--skip-autofix", action="store_true")
    args = p.parse_args()

    repo = Path(args.repo).resolve()
    audit = repo / "tools" / "vnpt-react-audit" / "audit_react_skill.py"
    autofix = repo / "tools" / "vnpt-react-audit" / "autofix_react_skill.py"

    if not audit.exists():
        raise FileNotFoundError(f"Missing audit script: {audit}")
    if not autofix.exists():
        raise FileNotFoundError(f"Missing autofix script: {autofix}")

    run([sys.executable, str(audit), "--repo", str(repo), "--source", args.source])
    report_json = repo / "reports" / "react-skill-audit" / "react-skill-audit.json"
    before = summarize(load_json(report_json))

    autofix_ran = False
    if not args.skip_autofix:
        run([sys.executable, str(autofix), "--repo", str(repo), "--source", args.source])
        autofix_ran = True
        run([sys.executable, str(audit), "--repo", str(repo), "--source", args.source])

    after = summarize(load_json(report_json))
    write_gate_result(repo, args.source, before, after, autofix_ran)

    print()
    print("Automatic gate phase complete.")
    if after["error"] > 0:
        print("Gate status: MANUAL_REVIEW_REQUIRED")
    else:
        print("Gate status: READY_FOR_MANUAL_REVIEW_SIGNOFF")
    print("The AI agent must continue with manual review and apply/fix findings before declaring completion.")

if __name__ == "__main__":
    main()
