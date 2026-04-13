#!/usr/bin/env python3
from pathlib import Path
import argparse, shutil, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--repo', required=True)
    p.add_argument('--package', required=True)
    args = p.parse_args()
    repo = Path(args.repo).resolve()
    pkg = Path(args.package).resolve()
    src = pkg / 'extras' / 'agent-customization' / 'bmm-architect.customize.yaml'
    dst = repo / '_bmad' / '_config' / 'agents' / 'bmm-architect.customize.yaml'
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f'Installed {dst}')
    print('Next: run `npx bmad-method@6.2.0 install` and choose `Recompile Agents`.')

if __name__ == '__main__':
    sys.exit(main())
