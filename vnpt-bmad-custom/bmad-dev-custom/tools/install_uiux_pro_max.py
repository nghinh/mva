#!/usr/bin/env python3
from __future__ import annotations
import argparse, shutil, subprocess, sys, tempfile
from pathlib import Path

REPO = 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git'


def run(cmd, cwd=None):
    print('$', ' '.join(map(str, cmd)))
    subprocess.run(cmd, cwd=cwd, check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--repo', default='.')
    args = p.parse_args()
    repo = Path(args.repo).resolve()
    target = repo / '.opencode/skills/ui-ux-pro-max'
    if target.exists():
        print(f'ui-ux-pro-max already exists at {target}')
        return 0
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        run(['git', 'clone', '--depth', '1', REPO, str(td_path / 'ui-ux-pro-max-skill')])
        src = td_path / 'ui-ux-pro-max-skill'
        candidates = [
            src / '.opencode/skills/ui-ux-pro-max',
            src / '.claude/skills/ui-ux-pro-max',
            src / 'ui-ux-pro-max',
            src / 'src/ui-ux-pro-max',
        ]
        picked = None
        for c in candidates:
            if c.exists():
                picked = c
                break
        if picked is None:
            raise FileNotFoundError('Could not locate ui-ux-pro-max skill folder in cloned repository.')
        shutil.copytree(picked, target)
        print(f'Installed ui-ux-pro-max to {target}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
