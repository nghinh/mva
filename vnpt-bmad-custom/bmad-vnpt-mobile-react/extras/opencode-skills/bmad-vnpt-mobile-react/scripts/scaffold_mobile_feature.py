#!/usr/bin/env python3
from __future__ import annotations
import argparse
from pathlib import Path

TEMPLATE_FILES = {
    "api/get-example.ts": "export async function getExample() {\n  throw new Error('implement me');\n}\n",
    "hooks/use-example-query.ts": "export function useExampleQuery() {\n  throw new Error('implement me');\n}\n",
    "screens/example-screen.tsx": "export function ExampleScreen() {\n  return null;\n}\n",
    "types.ts": "export type ExampleItem = { id: string };\n",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("feature")
    parser.add_argument("--root", default="src/features")
    args = parser.parse_args()

    feature_root = Path(args.root) / args.feature
    for relative_path, content in TEMPLATE_FILES.items():
        target = feature_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_text(content, encoding="utf-8")
            print(f"created {target}")
        else:
            print(f"skip existing {target}")


if __name__ == "__main__":
    main()
