#!/usr/bin/env python3
from pathlib import Path
import shutil


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)


root = Path(__file__).resolve().parents[1]
repo = Path.cwd()
copy_file(root / 'extras' / 'opencode-commands' / 'bmad-vnpt-php.md', repo / '.opencode' / 'commands' / 'bmad-vnpt-php.md')
copy_tree(root / 'extras' / 'opencode-skills' / 'bmad-vnpt-php', repo / '.opencode' / 'skills' / 'bmad-vnpt-php')
copy_file(root / 'src' / 'workflows' / 'bmad-vnpt-php' / 'workflow.md', repo / '.opencode' / 'skills' / 'bmad-vnpt-php' / 'workflow.md')
print('Installed bmad-vnpt-php')
