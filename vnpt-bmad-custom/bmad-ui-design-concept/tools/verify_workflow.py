#!/usr/bin/env python3
from pathlib import Path
import sys

repo = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
checks = {
    'OpenCode workflow skill': repo / '.opencode/skills/bmad-create-ui-design-concept/SKILL.md',
    'OpenCode workflow command': repo / '.opencode/commands/bmad-create-ui-design-concept.md',
}
ok = True
for label, path in checks.items():
    exists = path.is_file()
    print(f"{'OK' if exists else 'MISSING'} - {label}: {path}")
    ok = ok and exists

skill_file = repo / '.opencode/skills/bmad-create-ui-design-concept/SKILL.md'
if skill_file.is_file():
    text = skill_file.read_text(encoding='utf-8')
    required_markers = [
        'docs/ux-design.md',
        'docs/project-context.md',
        'PRD',
        'architecture',
        'Artifact Intake Summary',
        'docs/ui-design/product-concept.html',
    ]
    for marker in required_markers:
        present = marker in text
        print(f"{'OK' if present else 'MISSING'} - workflow marker: {marker}")
        ok = ok and present

sys.exit(0 if ok else 1)
