#!/usr/bin/env python3
from pathlib import Path
import shutil

def main() -> int:
    root = Path(__file__).resolve().parents[1]
    repo = Path.cwd()
    (repo / ".opencode" / "commands").mkdir(parents=True, exist_ok=True)
    (repo / ".opencode" / "skills" / "bmad-vnpt-python").mkdir(parents=True, exist_ok=True)
    shutil.copy2(
        root / "extras" / "opencode-commands" / "bmad-vnpt-python.md",
        repo / ".opencode" / "commands" / "bmad-vnpt-python.md",
    )
    skill_root = root / "extras" / "opencode-skills" / "bmad-vnpt-python"
    dst = repo / ".opencode" / "skills" / "bmad-vnpt-python"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(skill_root, dst)
    print("Installed bmad-vnpt-python")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
