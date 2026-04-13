#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser(description="Verify bmad-vnpt-devops installation")
    p.add_argument("repo", help="Target repository")
    args = p.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    required = [
        repo / ".opencode" / "commands" / "bmad-vnpt-devops.md",
        repo / ".opencode" / "skills" / "bmad-vnpt-devops" / "SKILL.md",
        repo / ".opencode" / "skills" / "bmad-vnpt-devops" / "workflow.md",
        repo / ".opencode" / "skills" / "bmad-vnpt-devops" / "scripts" / "verify_devops.py",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing installed files:\n- " + "\n- ".join(missing))
    print("bmad-vnpt-devops installation looks good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
