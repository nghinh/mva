#!/usr/bin/env python3
from pathlib import Path
import sys

repo = Path.cwd()
checks = [
    repo / '.opencode' / 'commands' / 'bmad-vnpt-web-vue.md',
    repo / '.opencode' / 'skills' / 'bmad-vnpt-web-vue' / 'SKILL.md',
    repo / '.opencode' / 'skills' / 'bmad-vnpt-web-vue' / 'workflow.md',
]
missing = [str(p) for p in checks if not p.exists()]
if missing:
    print('Missing files:
- ' + '
- '.join(missing))
    sys.exit(1)
print('bmad-vnpt-web-vue verified')
