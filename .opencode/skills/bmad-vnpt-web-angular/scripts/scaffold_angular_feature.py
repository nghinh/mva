#!/usr/bin/env python3
from pathlib import Path
import sys

def main() -> int:
    if len(sys.argv) != 3:
        print('Usage: scaffold_angular_feature.py <repo_root> <feature_name>')
        return 1
    repo = Path(sys.argv[1]).resolve()
    feature = sys.argv[2].strip().replace('-', '_').lower()
    base = repo / 'src' / 'app' / 'features' / feature
    for sub in ['data', 'models', 'pages', 'state']:
        (base / sub).mkdir(parents=True, exist_ok=True)
    print(f'Created Angular feature skeleton at {base}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
