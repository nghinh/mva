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


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing source path: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)


def main() -> int:
    p = argparse.ArgumentParser(description="Install bmad-vnpt-devops into a repository")
    p.add_argument("--repo", required=True, help="Target repository")
    p.add_argument("--package", default=None, help="Path to bmad-vnpt-devops package")
    args = p.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    pkg = Path(args.package).expanduser().resolve() if args.package else Path(__file__).resolve().parents[1]

    (repo / ".opencode" / "skills").mkdir(parents=True, exist_ok=True)
    (repo / ".opencode" / "commands").mkdir(parents=True, exist_ok=True)

    copy_file(
        pkg / "extras" / "opencode-commands" / "bmad-vnpt-devops.md",
        repo / ".opencode" / "commands" / "bmad-vnpt-devops.md",
    )
    copy_tree(
        pkg / "extras" / "opencode-skills" / "bmad-vnpt-devops",
        repo / ".opencode" / "skills" / "bmad-vnpt-devops",
    )
    copy_file(
        pkg / "src" / "workflows" / "bmad-vnpt-devops" / "workflow.md",
        repo / ".opencode" / "skills" / "bmad-vnpt-devops" / "workflow.md",
    )
    print("Installed bmad-vnpt-devops successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
