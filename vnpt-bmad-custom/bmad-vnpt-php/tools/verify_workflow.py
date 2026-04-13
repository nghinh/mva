#!/usr/bin/env python3
from pathlib import Path
import sys

repo = Path.cwd()
checks = [
    repo / '.opencode' / 'commands' / 'bmad-vnpt-php.md',
    repo / '.opencode' / 'skills' / 'bmad-vnpt-php' / 'SKILL.md',
    repo / '.opencode' / 'skills' / 'bmad-vnpt-php' / 'workflow.md',
]
missing = [str(p) for p in checks if not p.exists()]
if missing:
    print('Missing files:
- ' + '
- '.join(missing))
    sys.exit(1)
print('bmad-vnpt-php verified')
