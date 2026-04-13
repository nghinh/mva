#!/usr/bin/env python3
from pathlib import Path
import sys


def main() -> int:
    repo_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    checks = [
        repo_root / '.opencode' / 'commands' / 'bmad-vnpt-mobile-flutter.md',
        repo_root / '.opencode' / 'skills' / 'bmad-vnpt-mobile-flutter' / 'SKILL.md',
        repo_root / '.opencode' / 'skills' / 'bmad-vnpt-mobile-flutter' / 'workflow.md',
    ]
    missing = [str(p) for p in checks if not p.exists()]
    if missing:
        print('Missing files:')
        for item in missing:
            print('-', item)
        return 1
    print('bmad-vnpt-mobile-flutter verification passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
