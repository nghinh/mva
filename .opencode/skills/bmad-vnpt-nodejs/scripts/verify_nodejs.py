#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def main() -> int:
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    pkg = repo / 'package.json'
    if not pkg.exists():
        print('package.json not found', file=sys.stderr)
        return 1

    data = read_json(pkg)
    errors: list[str] = []
    warnings: list[str] = []

    scripts = data.get('scripts', {})
    for key in ['build', 'test']:
        if key not in scripts:
            warnings.append(f'missing script: {key}')
    if 'lint' not in scripts and 'typecheck' not in scripts:
        warnings.append('missing both lint and typecheck scripts')

    if not (repo / 'package-lock.json').exists() and not (repo / 'pnpm-lock.yaml').exists() and not (repo / 'yarn.lock').exists() and not (repo / 'bun.lockb').exists() and not (repo / 'bun.lock').exists():
        warnings.append('no lockfile detected')

    if (repo / 'tsconfig.json').exists():
        try:
            ts = json.loads((repo / 'tsconfig.json').read_text(encoding='utf-8'))
            compiler = ts.get('compilerOptions', {})
            if compiler.get('strict') is not True:
                warnings.append('tsconfig.json does not set compilerOptions.strict=true')
        except Exception as exc:
            errors.append(f'cannot parse tsconfig.json: {exc}')

    if data.get('private') is not True and 'license' not in data:
        warnings.append('public package without license field')

    if data.get('type') not in [None, 'module', 'commonjs']:
        warnings.append(f"unexpected package.json type: {data.get('type')}")

    if errors:
        print('Node.js verification errors:')
        for item in errors:
            print(f'- {item}')
    if warnings:
        print('Node.js verification warnings:')
        for item in warnings:
            print(f'- {item}')

    print('Node.js verification complete')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
