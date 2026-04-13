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
        pkg / "extras/opencode-commands/bmad-vnpt-golang.md",
        repo / ".opencode/commands/bmad-vnpt-golang.md",
    )
    copy_tree(
        pkg / "extras/opencode-skills/bmad-vnpt-golang",
        repo / ".opencode/skills/bmad-vnpt-golang",
    )
    copy_file(
        pkg / "src/workflows/bmad-vnpt-golang/workflow.md",
        repo / ".opencode/skills/bmad-vnpt-golang/workflow.md",
    )

    print("Optional BMAD registration:")
    print("  npx bmad-method@6.2.0 install")
    print("  Then provide this package's src/ directory as custom module content.")
    print("Restart OpenCode in this repo after installation.")


if __name__ == "__main__":
    main()
