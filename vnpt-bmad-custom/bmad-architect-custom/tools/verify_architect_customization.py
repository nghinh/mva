#!/usr/bin/env python3
from pathlib import Path
import sys

repo = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
path = repo / '_bmad' / '_config' / 'agents' / 'bmm-architect.customize.yaml'
print(path)
if not path.is_file():
    print('MISSING')
    raise SystemExit(1)
text = path.read_text()
checks = {
    'likec4_required': 'LikeC4' in text,
    'context_file': 'context.likec4' in text,
    'container_file': 'container.likec4' in text,
    'component_file': 'component.likec4' in text,
    'architecture_links_required': 'must explicitly reference these files with navigable links' in text or 'link to the LikeC4 files' in text,
}
print('OK')
all_ok = True
for k, v in checks.items():
    print(f'{k}: ' + ('OK' if v else 'MISSING'))
    all_ok = all_ok and v
raise SystemExit(0 if all_ok else 2)
