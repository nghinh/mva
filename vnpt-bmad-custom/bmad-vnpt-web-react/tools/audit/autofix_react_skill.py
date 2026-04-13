\
#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

INDEX_TS_TEMPLATE = """export * from './types';\nexport { default } from './index';\n"""
TYPES_TS_TEMPLATE = """export interface {component}Props {{\n  // TODO: define props\n}}\n"""
HOOKS_TS_TEMPLATE = """// TODO: move non-trivial component logic here if needed.\nexport function use{component}() {{\n  return {{}};\n}}\n"""
TEST_TSX_TEMPLATE = """import {{ render, screen }} from '@testing-library/react';\nimport {component} from './index';\n\ndescribe('{component}', () => {{\n  it('renders without crashing', () => {{\n    render(<{component} /> as any);\n    expect(screen.queryByTestId('{kebab}')).toBeInTheDocument;\n  }});\n}});\n"""

def kebab_to_pascal(name: str) -> str:
    return ''.join(part.capitalize() for part in name.split('-') if part)

def ensure_file(path: Path, content: str):
    if not path.exists():
        path.write_text(content, encoding='utf-8')
        print(f"Created {path}")

def main():
    p = argparse.ArgumentParser(description="Apply safe autofixes for the VNPT React Developer audit.")
    p.add_argument("--repo", default=".")
    p.add_argument("--source", default="src")
    args = p.parse_args()

    repo = Path(args.repo).resolve()
    source_root = (repo / args.source).resolve() if not Path(args.source).is_absolute() else Path(args.source).resolve()

    for directory in source_root.rglob("*"):
        if not directory.is_dir():
            continue
        files = {p.name for p in directory.iterdir() if p.is_file()}
        if "index.tsx" in files:
            component = kebab_to_pascal(directory.name or "Component")
            ensure_file(directory / "types.ts", TYPES_TS_TEMPLATE.format(component=component))
            ensure_file(directory / "hooks.ts", HOOKS_TS_TEMPLATE.format(component=component))
            ensure_file(directory / "index.ts", INDEX_TS_TEMPLATE)
            test_name = f"{directory.name}.test.tsx"
            ensure_file(directory / test_name, TEST_TSX_TEMPLATE.format(component=component, kebab=directory.name))
    print("Autofix pass complete. Review generated files before committing.")

if __name__ == "__main__":
    main()
