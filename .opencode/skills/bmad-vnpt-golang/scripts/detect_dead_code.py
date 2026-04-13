#!/usr/bin/env python3
"""
Go Dead Code Detector
======================
Detect unused functions, variables, and constants in Go code.

Usage:
    python detect_dead_code.py features/workflow
    python detect_dead_code.py features/workflow --include-exports
    python detect_dead_code.py features/workflow --json
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set
from collections import defaultdict


@dataclass
class CodeSymbol:
    name: str
    kind: str  # function, variable, constant, type
    file: str
    line: int
    exported: bool
    references: int = 0


class DeadCodeDetector:
    def __init__(self, include_exports: bool = False):
        self.include_exports = include_exports
        self.symbols: Dict[str, CodeSymbol] = {}
        self.references: Set[str] = set()
        self.files_analyzed = 0

    def analyze_directory(self, dirpath: Path) -> None:
        # First pass: collect all symbol definitions
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata', 'mocks')]
            for f in files:
                if f.endswith('.go') and not f.endswith('_test.go'):
                    self._collect_symbols(Path(root) / f)
        
        # Second pass: collect all references
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata', 'mocks')]
            for f in files:
                if f.endswith('.go'):
                    self._collect_references(Path(root) / f)
        
        # Count references
        for name, sym in self.symbols.items():
            sym.references = self.references.count(name) if name in self.references else 0

    def _collect_symbols(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        
        self.files_analyzed += 1
        lines = content.split('\n')
        
        # Functions: func Name(...) or func (r Receiver) Name(...)
        for i, line in enumerate(lines):
            # Function definitions
            m = re.match(r'func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(', line)
            if m:
                name = m.group(1)
                if name not in ('init', 'main'):  # Skip special functions
                    self._add_symbol(name, 'function', str(filepath), i + 1)
            
            # Variable/constant definitions
            m = re.match(r'(?:var|const)\s+(\w+)\s+', line)
            if m:
                self._add_symbol(m.group(1), 'variable', str(filepath), i + 1)
            
            # Type definitions
            m = re.match(r'type\s+(\w+)\s+', line)
            if m:
                self._add_symbol(m.group(1), 'type', str(filepath), i + 1)

    def _add_symbol(self, name: str, kind: str, file: str, line: int) -> None:
        exported = name[0].isupper() if name else False
        
        # Skip if exports not included and symbol is exported
        if exported and not self.include_exports:
            return
        
        key = f"{file}:{name}"
        if key not in self.symbols:
            self.symbols[key] = CodeSymbol(
                name=name, kind=kind, file=file, line=line, exported=exported
            )

    def _collect_references(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        
        # Remove string literals and comments
        clean = re.sub(r'"[^"]*"', '', content)
        clean = re.sub(r'`[^`]*`', '', clean)
        clean = re.sub(r'//.*', '', clean)
        clean = re.sub(r'/\*.*?\*/', '', clean, flags=re.DOTALL)
        
        # Find all identifiers
        for name in re.findall(r'\b([a-zA-Z_]\w*)\b', clean):
            self.references.add(name)

    def get_dead_code(self) -> List[CodeSymbol]:
        dead = []
        for sym in self.symbols.values():
            # Symbol is dead if it has no references (besides definition)
            # For functions, check if name appears anywhere
            if sym.name not in self.references:
                dead.append(sym)
        return sorted(dead, key=lambda x: (x.file, x.line))

    def print_report(self) -> None:
        dead = self.get_dead_code()
        
        print(f"\n{'='*60}")
        print("🕳️  DEAD CODE DETECTION REPORT")
        print(f"{'='*60}")
        print(f"📁 Files Analyzed: {self.files_analyzed}")
        print(f"📊 Symbols Found: {len(self.symbols)}")
        print(f"💀 Potentially Dead: {len(dead)}")
        print()
        
        if not dead:
            print("✅ No dead code detected!")
            return
        
        # Group by kind
        by_kind = defaultdict(list)
        for sym in dead:
            by_kind[sym.kind].append(sym)
        
        for kind, symbols in sorted(by_kind.items()):
            print(f"{'─'*60}")
            print(f"📁 {kind.upper()}S ({len(symbols)} unused)")
            print(f"{'─'*60}")
            
            for sym in symbols:
                icon = "⚠️" if sym.exported else "💀"
                print(f"{icon} {sym.name}")
                print(f"   📍 {sym.file}:{sym.line}")
        
        print(f"\n{'='*60}")
        print("💡 Review these symbols - they may be:")
        print("   • Unused code that can be safely deleted")
        print("   • API endpoints used externally")
        print("   • Interface implementations")
        print(f"{'='*60}\n")

    def to_json(self) -> Dict:
        dead = self.get_dead_code()
        return {
            "summary": {
                "files_analyzed": self.files_analyzed,
                "symbols_found": len(self.symbols),
                "dead_code_count": len(dead)
            },
            "dead_code": [
                {"name": s.name, "kind": s.kind, "file": s.file, 
                 "line": s.line, "exported": s.exported}
                for s in dead
            ]
        }


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Detect dead code in Go projects")
    parser.add_argument("path", help="Path to Go directory")
    parser.add_argument("--include-exports", action="store_true", 
                       help="Include exported symbols (may have external usage)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("-o", "--output", help="Save report to file")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    detector = DeadCodeDetector(include_exports=args.include_exports)
    detector.analyze_directory(target)

    if args.json:
        output = json.dumps(detector.to_json(), indent=2)
        print(output)
        if args.output:
            Path(args.output).write_text(output)
    else:
        detector.print_report()
        if args.output:
            Path(args.output).write_text(json.dumps(detector.to_json(), indent=2))

    dead = detector.get_dead_code()
    sys.exit(1 if dead else 0)


if __name__ == "__main__":
    main()
