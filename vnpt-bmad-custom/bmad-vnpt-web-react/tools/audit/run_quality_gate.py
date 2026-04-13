#!/usr/bin/env python3
from __future__ import annotations
import argparse
import subprocess
import sys
from pathlib import Path

def run(cmd):
    print("$", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)

def main():
    p = argparse.ArgumentParser(description="Run the mandatory VNPT React two-layer quality gate.")
    p.add_argument("--repo", default=".")
    p.add_argument("--source", default="src", help="Frontend source root relative to repo, e.g. src or apps/web/src")
    p.add_argument("--skip-autofix", action="store_true")
    args = p.parse_args()

    repo = Path(args.repo).resolve()
    audit = repo / "tools" / "vnpt-react-audit" / "audit_react_skill.py"
    autofix = repo / "tools" / "vnpt-react-audit" / "autofix_react_skill.py"
    prompt = repo / "tools" / "vnpt-react-audit" / "review_with_ai_prompt.md"

    if not audit.exists():
        raise FileNotFoundError(f"Missing audit script: {audit}")
    if not autofix.exists():
        raise FileNotFoundError(f"Missing autofix script: {autofix}")
    if not prompt.exists():
        raise FileNotFoundError(f"Missing manual review prompt: {prompt}")

    run([sys.executable, str(audit), "--repo", str(repo), "--source", args.source])

    if not args.skip_autofix:
        run([sys.executable, str(autofix), "--repo", str(repo), "--source", args.source])

    print()
    print("Automatic audit completed.")
    print("Next mandatory manual-review inputs:")
    print(f"- {repo / 'reports/react-skill-audit/react-skill-audit.json'}")
    print(f"- {repo / 'reports/react-skill-audit/react-skill-audit.md'}")
    print(f"- {prompt}")
    print()
    print("Gate status: MANUAL REVIEW REQUIRED")
    print("Do not declare the workflow complete until the manual review finishes and findings are fixed or justified.")

if __name__ == "__main__":
    main()
