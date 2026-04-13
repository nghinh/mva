#!/usr/bin/env python3
from __future__ import annotations
import argparse
import shutil
from pathlib import Path

def copy_file(src: Path, dst: Path) -> None:
    if not src.is_file():
        raise FileNotFoundError(f"Missing source file: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"Copied {src} -> {dst}")

def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing source path: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)
    print(f"Copied {src} -> {dst}")

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default=".")
    p.add_argument("--package", required=True)
    args = p.parse_args()

    repo = Path(args.repo).resolve()
    pkg = Path(args.package).resolve()

    copy_file(
        pkg / "extras/opencode-commands/bmad-vnpt-web-react.md",
        repo / ".opencode/commands/bmad-vnpt-web-react.md",
    )

    # Install the full BMAD workflow skill folder WITH rules/templates and original pack files
    copy_tree(
        pkg / "extras/opencode-skills/bmad-vnpt-web-react",
        repo / ".opencode/skills/bmad-vnpt-web-react",
    )

    # Also install the original pack as an alias folder for direct reference if needed
    copy_tree(
        pkg / "extras/opencode-skills/vnpt-react-developer",
        repo / ".opencode/skills/vnpt-react-developer",
    )

    # Install audit tooling
    audit_dst = repo / "tools" / "vnpt-react-audit"
    copy_tree(
        pkg / "tools" / "audit",
        audit_dst,
    )

    print("Installed audit tools to:", audit_dst)
    print("Convenience quality-gate runners:")
    print(f"  python {audit_dst / 'run_quality_gate.py'} --repo {repo} --source src")
    print(f"  python {audit_dst / 'enforce_quality_gate.py'} --repo {repo} --source src")
    print("Automatic audit:")
    print(f"  python {audit_dst / 'audit_react_skill.py'} --repo {repo}")
    print("Safe autofix:")
    print(f"  python {audit_dst / 'autofix_react_skill.py'} --repo {repo} --source src")

    print("Optional BMAD registration:")
    print("  npx bmad-method@6.2.0 install")
    print("  Then provide this package's src/ directory as custom module content.")
    print("Restart OpenCode in this repo after installation.")

if __name__ == "__main__":
    main()
