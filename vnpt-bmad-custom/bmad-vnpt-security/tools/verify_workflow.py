#!/usr/bin/env python3
from __future__ import annotations
import sys
from pathlib import Path

SECURITY_SKILLS = [
    "bmad-vnpt-security",
    "bmad-vnpt-security-appsec",
    "bmad-vnpt-security-auth",
    "bmad-vnpt-security-api",
    "bmad-vnpt-security-devsecops",
    "bmad-vnpt-security-cloud-k8s",
    "bmad-vnpt-security-compliance",
]

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: verify_workflow.py /path/to/repo", file=sys.stderr)
        return 2
    repo = Path(sys.argv[1]).expanduser().resolve()
    missing = []
    for name in SECURITY_SKILLS:
        for p in [
            repo / ".opencode" / "commands" / f"{name}.md",
            repo / ".opencode" / "skills" / name / "SKILL.md",
            repo / ".opencode" / "skills" / name / "workflow.md",
        ]:
            if not p.exists():
                missing.append(str(p))
    if missing:
        raise FileNotFoundError("Missing installed files:\n- " + "\n- ".join(missing))
    print("Security workflow pack verified.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())


# Stack-specific workflow sanity checks added in v3
