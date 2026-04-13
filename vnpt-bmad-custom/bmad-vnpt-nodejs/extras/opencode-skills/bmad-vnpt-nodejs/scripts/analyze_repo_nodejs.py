#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


def detect_pm(repo: Path) -> str:
    if (repo / 'pnpm-lock.yaml').exists():
        return 'pnpm'
    if (repo / 'yarn.lock').exists():
        return 'yarn'
    if (repo / 'package-lock.json').exists():
        return 'npm'
    if (repo / 'bun.lockb').exists() or (repo / 'bun.lock').exists():
        return 'bun'
    return 'unknown'


def main() -> int:
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    package_json = repo / 'package.json'
    if not package_json.exists():
        print('No package.json found', file=sys.stderr)
        return 1
    data = json.loads(package_json.read_text(encoding='utf-8'))
    scripts = sorted(data.get('scripts', {}).keys())
    report = {
        'name': data.get('name'),
        'packageManager': data.get('packageManager'),
        'detectedPackageManager': detect_pm(repo),
        'type': data.get('type', 'commonjs (implicit)'),
        'hasWorkspaces': bool(data.get('workspaces')),
        'hasExports': 'exports' in data,
        'hasTypes': 'types' in data or 'typings' in data,
        'scripts': scripts,
        'hasTsconfig': (repo / 'tsconfig.json').exists(),
        'hasEslintFlatConfig': any((repo / name).exists() for name in ['eslint.config.js','eslint.config.mjs','eslint.config.cjs']),
        'hasNodeTest': 'test' in scripts and 'node --test' in str(data.get('scripts', {}).get('test', '')),
        'sourceDirs': [str(p.relative_to(repo)) for p in repo.iterdir() if p.is_dir() and p.name in {'src','apps','packages','services','test','tests'}],
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
