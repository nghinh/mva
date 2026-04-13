#!/usr/bin/env python3
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
repo = Path.cwd()
(repo / '.opencode' / 'commands').mkdir(parents=True, exist_ok=True)
(repo / '.opencode' / 'skills').mkdir(parents=True, exist_ok=True)

shutil.copy2(root / 'extras' / 'opencode-commands' / 'bmad-vnpt-web-vue.md', repo / '.opencode' / 'commands' / 'bmad-vnpt-web-vue.md')
skill_src = root / 'extras' / 'opencode-skills' / 'bmad-vnpt-web-vue'
skill_dst = repo / '.opencode' / 'skills' / 'bmad-vnpt-web-vue'
if skill_dst.exists():
    shutil.rmtree(skill_dst)
shutil.copytree(skill_src, skill_dst)
print('Installed bmad-vnpt-web-vue')
