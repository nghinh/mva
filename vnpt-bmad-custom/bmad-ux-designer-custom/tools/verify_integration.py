#!/usr/bin/env python3
from pathlib import Path
import sys
repo = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
checks = {
    'bmm-ux-designer customize': repo / '_bmad/_config/agents/bmm-ux-designer.customize.yaml',
    'ui-ux-pro-max skill dir': repo / '.opencode/skills/ui-ux-pro-max',
}
ok = True
for label, path in checks.items():
    exists = path.exists()
    print(f"{'OK' if exists else 'MISSING'} - {label}: {path}")
    ok = ok and exists
sys.exit(0 if ok else 1)
