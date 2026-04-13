#!/usr/bin/env python3
from __future__ import annotations
import argparse, shutil, subprocess, sys
from pathlib import Path

UX_CUSTOM = 'extras/agent-customization/bmm-ux-designer.customize.yaml'


def copy_file(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f'Copied {src} -> {dst}')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--repo', default='.')
    p.add_argument('--package', required=True)
    args = p.parse_args()
    repo = Path(args.repo).resolve()
    pkg = Path(args.package).resolve()

    copy_file(pkg / UX_CUSTOM, repo / '_bmad/_config/agents/bmm-ux-designer.customize.yaml')

    try:
        subprocess.run([sys.executable, str(pkg / 'tools/install_uiux_pro_max.py'), '--repo', str(repo)], check=True)
    except Exception:
        print('Warning: ui-ux-pro-max auto-install failed. Install it manually if needed.')

    print('Next BMAD step:')
    print('  npx bmad-method@6.2.0 install')
    print('  Then choose Recompile Agents')
    print('Restart OpenCode in this repo after installation.')

if __name__ == '__main__':
    main()
