#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

TEMPLATE = {
    'routes/{name}.ts': """export const register{name_pascal}Routes = () => {
  // TODO: add route registration
};
""",
    'services/{name}.service.ts': """export class {name_pascal}Service {
  // TODO: implement service methods
}
""",
    'lib/{name}.schema.ts': """export type {name_pascal}Input = {
  // TODO: define validated input
};
""",
}


def pascal(name: str) -> str:
    return ''.join(part.capitalize() for part in name.replace('_', '-').split('-') if part)


def main() -> int:
    if len(sys.argv) < 2:
        print('usage: scaffold_feature.py <feature-name> [repo]')
        return 2
    name = sys.argv[1].strip().lower()
    repo = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path.cwd()
    src = repo / 'src'
    if not src.exists():
        print('src/ not found; refusing to scaffold into unknown layout', file=sys.stderr)
        return 1
    values = {'name': name, 'name_pascal': pascal(name)}
    created = []
    for rel, content in TEMPLATE.items():
        dst = src / Path(rel.format(**values))
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():
            dst.write_text(content.format(**values), encoding='utf-8')
            created.append(str(dst.relative_to(repo)))
    print('Created:' if created else 'Nothing created')
    for item in created:
        print(f'- {item}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
