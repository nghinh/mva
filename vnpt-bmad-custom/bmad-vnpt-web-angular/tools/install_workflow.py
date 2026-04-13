#!/usr/bin/env python3
from pathlib import Path
import shutil

def copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)

def main() -> int:
    root = Path(__file__).resolve().parents[1]
    repo = Path.cwd()
    copy(root / 'extras' / 'opencode-commands' / 'bmad-vnpt-web-angular.md', repo / '.opencode' / 'commands' / 'bmad-vnpt-web-angular.md')
    copy(root / 'extras' / 'opencode-skills' / 'bmad-vnpt-web-angular', repo / '.opencode' / 'skills' / 'bmad-vnpt-web-angular')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
