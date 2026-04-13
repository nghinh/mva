#!/usr/bin/env python3
from __future__ import annotations
import argparse, shutil
from pathlib import Path

def copy_file(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"Copied {src} -> {dst}")

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--repo', default='.')
    p.add_argument('--package', required=True)
    args = p.parse_args()
    repo = Path(args.repo).resolve()
    pkg = Path(args.package).resolve()

    copy_file(pkg / 'extras/opencode-commands/bmad-create-ui-design-concept.md', repo / '.opencode/commands/bmad-create-ui-design-concept.md')
    skill_dir = repo / '.opencode/skills/bmad-create-ui-design-concept'
    skill_dir.mkdir(parents=True, exist_ok=True)
    copy_file(pkg / 'src/workflows/bmad-create-ui-design-concept/workflow.md', skill_dir / 'SKILL.md')
    print('Next BMAD step (optional, to register custom workflow in BMAD):')
    print('  npx bmad-method@6.2.0 install')
    print('  Then provide this package\'s src/ path as custom module.')
    print('Restart OpenCode in this repo after installation.')

if __name__ == '__main__':
    main()
