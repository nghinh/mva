#!/usr/bin/env python3
from __future__ import annotations
import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    args = parser.parse_args()
    repo = Path(args.repo).resolve()

    checks = {
        "expo-router": (repo / "src" / "app").exists() or (repo / "app").exists(),
        "eas-config": (repo / "eas.json").exists(),
        "tanstack-query": any(repo.rglob("*query-client*")),
        "storage-lib": (repo / "src" / "lib" / "storage").exists(),
    }

    print("Mobile structure audit")
    for key, value in checks.items():
        print(f"- {key}: {'yes' if value else 'no'}")


if __name__ == "__main__":
    main()
