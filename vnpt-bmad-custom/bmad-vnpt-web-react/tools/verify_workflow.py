#!/usr/bin/env python3
from pathlib import Path
import sys

repo = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
checks = {
    "Audit script": repo / "tools/vnpt-react-audit/audit_react_skill.py",
    "Autofix script": repo / "tools/vnpt-react-audit/autofix_react_skill.py",
    "Manual review prompt": repo / "tools/vnpt-react-audit/review_with_ai_prompt.md",
    "Quality gate runner": repo / "tools/vnpt-react-audit/run_quality_gate.py",
    "Enforced gate runner": repo / "tools/vnpt-react-audit/enforce_quality_gate.py",
    "Workflow skill SKILL.md": repo / ".opencode/skills/bmad-vnpt-web-react/SKILL.md",
    "Workflow command": repo / ".opencode/commands/bmad-vnpt-web-react.md",
        "Bundled local workflow.md": repo / ".opencode/skills/bmad-vnpt-web-react/workflow.md",
    "Bundled rules dir": repo / ".opencode/skills/bmad-vnpt-web-react/rules",
    "Bundled templates dir": repo / ".opencode/skills/bmad-vnpt-web-react/templates",
    "Alias pack SKILL.md": repo / ".opencode/skills/vnpt-react-developer/SKILL.md",
}
ok = True
for label, path in checks.items():
    exists = path.exists()
    print(f"{'OK' if exists else 'MISSING'} - {label}: {path}")
    ok = ok and exists

skill_file = repo / ".opencode/skills/bmad-vnpt-web-react/SKILL.md"
if skill_file.is_file():
    text = skill_file.read_text(encoding="utf-8")
    required_markers = [
                "workflow.md",
        "rules/",
        "templates/",
        "Artifact Intake Summary",
        "Mandatory Post-Generation Quality Gate",
        "automatic audit",
        "manual review",
        "two-layer quality gate",
        "Standard local audit commands",
        "Agent Must Run The Gate",
        "Agent Execution Requirement",
        "Standard Audit Command Execution",
        "types.ts",
        "hooks.ts",
        "index.tsx",
        ".test.tsx",
    ]
    for marker in required_markers:
        present = marker in text
        print(f"{'OK' if present else 'MISSING'} - workflow marker: {marker}")
        ok = ok and present

sys.exit(0 if ok else 1)
