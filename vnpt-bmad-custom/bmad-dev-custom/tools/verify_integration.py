#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import sys

SKILLS = [
    'bmad-vnpt-c-cpp',
    'bmad-vnpt-dotnet',
    'bmad-vnpt-golang',
    'bmad-vnpt-java-springboot',
    'bmad-vnpt-nodejs',
    'bmad-vnpt-php',
    'bmad-vnpt-python',
    'bmad-vnpt-mobile-flutter',
    'bmad-vnpt-mobile-react',
    'bmad-vnpt-web-angular',
    'bmad-vnpt-web-react',
    'bmad-vnpt-web-vue',
]

repo = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
checks = {
    'bmm-dev customize': repo / '_bmad/_config/agents/bmm-dev.customize.yaml',
    'ui-ux-pro-max skill dir': repo / '.opencode/skills/ui-ux-pro-max',
}
for skill in SKILLS:
    checks[f'{skill} skill'] = repo / f'.opencode/skills/{skill}/SKILL.md'
    checks[f'{skill} command'] = repo / f'.opencode/commands/{skill}.md'

ok = True
for label, path in checks.items():
    exists = path.exists()
    print(f"{'OK' if exists else 'MISSING'} - {label}: {path}")
    ok = ok and exists
sys.exit(0 if ok else 1)
