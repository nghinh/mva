#!/usr/bin/env python3
from pathlib import Path

checks = [
    Path('.opencode/commands/bmad-vnpt-dotnet.md'),
    Path('.opencode/skills/bmad-vnpt-dotnet/SKILL.md'),
    Path('.opencode/skills/bmad-vnpt-dotnet/workflow.md'),
]
missing = [str(p) for p in checks if not p.exists()]
if missing:
    print('Missing files:
- ' + '
- '.join(missing))
    raise SystemExit(1)
print('bmad-vnpt-dotnet verified')
