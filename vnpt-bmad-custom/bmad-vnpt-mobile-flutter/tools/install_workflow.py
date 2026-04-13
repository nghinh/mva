#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print('Usage: install_workflow.py <package_root> <repo_root>')
        return 1
    package_root = Path(sys.argv[1]).resolve()
    repo_root = Path(sys.argv[2]).resolve()
    (repo_root / '.opencode' / 'commands').mkdir(parents=True, exist_ok=True)
    (repo_root / '.opencode' / 'skills').mkdir(parents=True, exist_ok=True)
    shutil.copy2(
        package_root / 'extras' / 'opencode-commands' / 'bmad-vnpt-mobile-flutter.md',
        repo_root / '.opencode' / 'commands' / 'bmad-vnpt-mobile-flutter.md',
    )
    dst = repo_root / '.opencode' / 'skills' / 'bmad-vnpt-mobile-flutter'
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(
        package_root / 'extras' / 'opencode-skills' / 'bmad-vnpt-mobile-flutter',
        dst,
    )
    shutil.copy2(
        package_root / 'src' / 'workflows' / 'bmad-vnpt-mobile-flutter' / 'workflow.md',
        dst / 'workflow.md',
    )
    print('Installed bmad-vnpt-mobile-flutter')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
