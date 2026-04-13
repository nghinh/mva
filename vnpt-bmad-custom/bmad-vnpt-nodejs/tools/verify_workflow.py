#!/usr/bin/env python3
from __future__ import annotations
import sys
from pathlib import Path


def main() -> int:
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    checks = [
        repo / '.opencode/commands/bmad-vnpt-nodejs.md',
        repo / '.opencode/skills/bmad-vnpt-nodejs/SKILL.md',
        repo / '.opencode/skills/bmad-vnpt-nodejs/workflow.md',
        repo / '.opencode/skills/bmad-vnpt-nodejs/scripts/verify_nodejs.py',
        repo / '.opencode/skills/bmad-vnpt-nodejs/skeleton/express-ts-app/package.json',
    ]
    missing = [str(p) for p in checks if not p.exists()]
    if missing:
        print('Missing installed files:\n- ' + '\n- '.join(missing), file=sys.stderr)
        return 1
    print('bmad-vnpt-nodejs verification passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
