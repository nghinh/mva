#!/usr/bin/env python3
from pathlib import Path
import sys

def main() -> int:
    repo = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
    findings = []
    if not (repo / 'src' / 'app').exists():
        findings.append('Missing src/app directory')
    if not ((repo / 'src' / 'app' / 'app.routes.ts').exists() or (repo / 'src' / 'app' / 'app-routing.module.ts').exists()):
        findings.append('Missing main routing entry')
    if findings:
        print('Findings:')
        for item in findings:
            print('-', item)
        return 1
    print('Angular structure looks minimally valid.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
