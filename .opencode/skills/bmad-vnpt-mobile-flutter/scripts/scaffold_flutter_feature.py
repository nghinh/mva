#!/usr/bin/env python3
from pathlib import Path
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print('Usage: scaffold_flutter_feature.py <repo_root> <feature_name>')
        return 1
    repo = Path(sys.argv[1]).resolve()
    feature = sys.argv[2].strip().replace('-', '_')
    base = repo / 'lib' / 'features' / feature
    for path in [
        base / 'presentation' / 'screens',
        base / 'presentation' / 'providers',
        base / 'data' / 'repositories',
        base / 'data' / 'services',
        base / 'domain' / 'models',
    ]:
        path.mkdir(parents=True, exist_ok=True)
    print(f'Created Flutter feature scaffold at {base}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
