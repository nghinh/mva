#!/usr/bin/env python3
from pathlib import Path

def main() -> int:
    repo = Path.cwd()
    checks = [
        repo / ".opencode" / "commands" / "bmad-vnpt-python.md",
        repo / ".opencode" / "skills" / "bmad-vnpt-python" / "SKILL.md",
        repo / ".opencode" / "skills" / "bmad-vnpt-python" / "workflow.md",
    ]
    missing = [str(p) for p in checks if not p.exists()]
    if missing:
        print("Missing files:")
        for item in missing:
            print("-", item)
        return 1
    print("bmad-vnpt-python verified")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
