#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys


def find_any(repo: Path, names: list[str]) -> list[Path]:
    found: list[Path] = []
    for name in names:
        found.extend(repo.rglob(name))
    return found


def main() -> int:
    p = argparse.ArgumentParser(description="Lightweight C/C++ repo verifier")
    p.add_argument("repo", nargs="?", default=".")
    args = p.parse_args()
    repo = Path(args.repo).resolve()

    findings: list[str] = []

    cmake_files = find_any(repo, ["CMakeLists.txt"])
    native_files = find_any(repo, ["*.c", "*.cc", "*.cpp", "*.cxx", "*.h", "*.hh", "*.hpp", "*.hxx"])

    if not native_files:
        findings.append("No C/C++ source or header files were found.")
    if not cmake_files:
        findings.append("No CMakeLists.txt found. This is acceptable only if the repo intentionally uses another build system.")

    clang_format = repo / ".clang-format"
    if not clang_format.exists():
        findings.append("Missing .clang-format (recommended).")

    clang_tidy = repo / ".clang-tidy"
    if not clang_tidy.exists():
        findings.append("Missing .clang-tidy (recommended).")

    test_dirs = [p for p in [repo / "tests", repo / "test"] if p.exists()]
    if not test_dirs:
        findings.append("No tests/ or test/ directory found.")

    print("C/C++ repo quick check")
    print(f"- repo: {repo}")
    print(f"- cmake files: {len(cmake_files)}")
    print(f"- native files: {len(native_files)}")

    if findings:
        print("\nObservations:")
        for item in findings:
            print(f"- {item}")
        return 0

    print("\nNo structural warnings detected by the lightweight verifier.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
