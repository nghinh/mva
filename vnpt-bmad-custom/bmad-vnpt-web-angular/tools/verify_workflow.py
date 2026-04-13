#!/usr/bin/env python3
from pathlib import Path

def main() -> int:
    repo = Path.cwd()
    checks = [
        repo / '.opencode' / 'commands' / 'bmad-vnpt-web-angular.md',
        repo / '.opencode' / 'skills' / 'bmad-vnpt-web-angular' / 'SKILL.md',
        repo / '.opencode' / 'skills' / 'bmad-vnpt-web-angular' / 'workflow.md',
    ]
    missing = [str(p) for p in checks if not p.exists()]
    if missing:
        print('Missing files:')
        for item in missing:
            print('-', item)
        return 1
    print('bmad-vnpt-web-angular verified.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
