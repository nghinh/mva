#!/usr/bin/env python3
from __future__ import annotations
import shutil
import sys
from pathlib import Path

SECURITY_SKILLS = [
    "bmad-vnpt-security",
    "bmad-vnpt-security-appsec",
    "bmad-vnpt-security-auth",
    "bmad-vnpt-security-api",
    "bmad-vnpt-security-devsecops",
    "bmad-vnpt-security-cloud-k8s",
    "bmad-vnpt-security-compliance",
]

def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)

def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] != '--repo':
        print('Usage: install_workflow.py --repo /path/to/repo', file=sys.stderr)
        return 2
    repo = Path(sys.argv[2]).expanduser().resolve()
    package = Path(__file__).resolve().parents[1]
    (repo/'.opencode'/'commands').mkdir(parents=True, exist_ok=True)
    (repo/'.opencode'/'skills').mkdir(parents=True, exist_ok=True)
    for name in SECURITY_SKILLS:
        copy_file(package/'extras'/'opencode-commands'/f'{name}.md', repo/'.opencode'/'commands'/f'{name}.md')
        copy_tree(package/'extras'/'opencode-skills'/name, repo/'.opencode'/'skills'/name)
        copy_file(package/'src'/'workflows'/name/'workflow.md', repo/'.opencode'/'skills'/name/'workflow.md')
    print('Installed security workflow pack.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
