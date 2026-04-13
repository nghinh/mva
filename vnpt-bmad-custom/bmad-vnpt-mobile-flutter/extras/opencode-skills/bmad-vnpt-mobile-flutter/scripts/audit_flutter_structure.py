#!/usr/bin/env python3
from pathlib import Path
import sys


def main() -> int:
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    checks = [
        repo / 'pubspec.yaml',
        repo / 'lib',
    ]
    missing = [str(p) for p in checks if not p.exists()]
    if missing:
        print('Missing Flutter basics:')
        for item in missing:
            print('-', item)
        return 1
    print('Flutter structure baseline looks present.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
