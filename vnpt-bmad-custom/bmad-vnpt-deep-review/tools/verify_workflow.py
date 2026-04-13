#!/usr/bin/env python3
from pathlib import Path
import sys

repo = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
checks = {
    "Workflow skill SKILL.md": repo / ".opencode/skills/bmad-vnpt-deep-review/SKILL.md",
    "Workflow skill workflow.md": repo / ".opencode/skills/bmad-vnpt-deep-review/workflow.md",
    "Workflow command": repo / ".opencode/commands/bmad-vnpt-deep-review.md",
}
ok = True
for label, path in checks.items():
    exists = path.exists()
    print(f"{'OK' if exists else 'MISSING'} - {label}: {path}")
    ok = ok and exists

skill_file = repo / ".opencode/skills/bmad-vnpt-deep-review/SKILL.md"
if skill_file.is_file():
    text = skill_file.read_text(encoding="utf-8")
    required_markers = [
        "GitNexus",
        "Serena",
        "entry points",
        "callers/callees",
        "downstream impact",
        "Do not edit code",
    ]
    for marker in required_markers:
        present = marker in text
        print(f"{'OK' if present else 'MISSING'} - workflow marker: {marker}")
        ok = ok and present

sys.exit(0 if ok else 1)
