#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    pkg = repo / 'package.json'
    if not pkg.exists():
        print(json.dumps({'error': 'package.json not found'}, indent=2))
        return 1
    data = json.loads(pkg.read_text(encoding='utf-8'))
    scripts = data.get('scripts', {})
    report = {
        'name': data.get('name'),
        'private': data.get('private'),
        'moduleType': data.get('type', 'commonjs (implicit)'),
        'engines': data.get('engines'),
        'packageManager': data.get('packageManager'),
        'hasLockfile': any((repo / name).exists() for name in ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock']),
        'qualityScripts': {k: scripts.get(k) for k in ['lint', 'typecheck', 'test', 'build', 'verify', 'start', 'dev'] if k in scripts},
        'hasTsconfig': (repo / 'tsconfig.json').exists(),
        'hasEnvExample': any((repo / name).exists() for name in ['.env.example', '.env.sample']),
        'hasDockerfile': (repo / 'Dockerfile').exists(),
        'hasCI': (repo / '.github/workflows').exists(),
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
