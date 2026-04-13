#!/usr/bin/env python3
from pathlib import Path
import shutil

def main() -> int:
    root = Path(__file__).resolve().parents[1]
    repo = Path.cwd()
    (repo / '.opencode' / 'commands').mkdir(parents=True, exist_ok=True)
    (repo / '.opencode' / 'skills' / 'bmad-vnpt-dotnet').mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / 'extras' / 'opencode-commands' / 'bmad-vnpt-dotnet.md', repo / '.opencode' / 'commands' / 'bmad-vnpt-dotnet.md')
    src = root / 'extras' / 'opencode-skills' / 'bmad-vnpt-dotnet'
    dst = repo / '.opencode' / 'skills' / 'bmad-vnpt-dotnet'
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    shutil.copy2(root / 'src' / 'workflows' / 'bmad-vnpt-dotnet' / 'workflow.md', dst / 'workflow.md')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
