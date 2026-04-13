#!/usr/bin/env python3
"""
Go Dependency Graph Analyzer
=============================
Analyze package dependencies, detect coupling issues, and generate dependency graphs.

Usage:
    python analyze_dependencies.py features/
    python analyze_dependencies.py features/ --metrics
    python analyze_dependencies.py features/ --graph deps.dot
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple
from collections import defaultdict


@dataclass
class PackageMetrics:
    name: str
    path: str
    imports: Set[str] = field(default_factory=set)
    imported_by: Set[str] = field(default_factory=set)
    efferent: int = 0  # Ce - packages this depends on
    afferent: int = 0  # Ca - packages depending on this
    instability: float = 0.0  # I = Ce / (Ce + Ca)


class DependencyAnalyzer:
    def __init__(self, base_module: str = ""):
        self.base_module = base_module
        self.packages: Dict[str, PackageMetrics] = {}
        self.import_graph: Dict[str, Set[str]] = defaultdict(set)

    def analyze_directory(self, dirpath: Path) -> None:
        # Detect module name from go.mod
        go_mod = dirpath / "go.mod"
        if go_mod.exists():
            content = go_mod.read_text()
            m = re.search(r'module\s+(\S+)', content)
            if m:
                self.base_module = m.group(1)
        
        # Find all packages
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata')]
            
            go_files = [f for f in files if f.endswith('.go') and not f.endswith('_test.go')]
            if go_files:
                self._analyze_package(Path(root), go_files)
        
        # Calculate metrics
        self._calculate_metrics()

    def _analyze_package(self, pkg_path: Path, files: List[str]) -> None:
        pkg_name = str(pkg_path)
        
        if pkg_name not in self.packages:
            self.packages[pkg_name] = PackageMetrics(
                name=pkg_path.name, path=pkg_name
            )
        
        for f in files:
            filepath = pkg_path / f
            try:
                content = filepath.read_text(encoding='utf-8', errors='replace')
            except:
                continue
            
            # Extract imports
            for m in re.finditer(r'import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")', content, re.DOTALL):
                imports_block = m.group(1) or m.group(2)
                for imp_match in re.finditer(r'"([^"]+)"', imports_block if m.group(1) else f'"{imports_block}"'):
                    imp = imp_match.group(1)
                    # Filter to internal imports
                    if self.base_module and imp.startswith(self.base_module):
                        self.packages[pkg_name].imports.add(imp)
                        self.import_graph[pkg_name].add(imp)

    def _calculate_metrics(self) -> None:
        # Build reverse graph
        for pkg, imports in self.import_graph.items():
            for imp in imports:
                # Find matching package
                for pkg_path in self.packages:
                    if pkg_path.endswith(imp.replace(self.base_module + "/", "")):
                        self.packages[pkg_path].imported_by.add(pkg)
                        break
        
        # Calculate coupling metrics
        for pkg in self.packages.values():
            pkg.efferent = len(pkg.imports)
            pkg.afferent = len(pkg.imported_by)
            total = pkg.efferent + pkg.afferent
            pkg.instability = pkg.efferent / total if total > 0 else 0.0

    def detect_cycles(self) -> List[List[str]]:
        """Detect import cycles using DFS."""
        cycles = []
        visited = set()
        rec_stack = []
        
        def dfs(pkg: str, path: List[str]) -> None:
            if pkg in rec_stack:
                cycle_start = rec_stack.index(pkg)
                cycles.append(rec_stack[cycle_start:] + [pkg])
                return
            if pkg in visited:
                return
            
            visited.add(pkg)
            rec_stack.append(pkg)
            
            for imp in self.import_graph.get(pkg, []):
                dfs(imp, path + [imp])
            
            rec_stack.pop()
        
        for pkg in self.packages:
            dfs(pkg, [pkg])
        
        return cycles

    def get_highly_coupled(self, threshold: int = 5) -> List[PackageMetrics]:
        """Get packages with high coupling (many dependencies)."""
        return [p for p in self.packages.values() if p.efferent > threshold]

    def generate_dot(self) -> str:
        """Generate DOT format for GraphViz."""
        lines = ["digraph Dependencies {", "  rankdir=TB;", "  node [shape=box];"]
        
        for pkg, imports in self.import_graph.items():
            pkg_short = Path(pkg).name
            for imp in imports:
                imp_short = imp.split("/")[-1]
                lines.append(f'  "{pkg_short}" -> "{imp_short}";')
        
        lines.append("}")
        return "\n".join(lines)

    def print_report(self) -> None:
        print(f"\n{'='*60}")
        print("🔗 DEPENDENCY ANALYSIS REPORT")
        print(f"{'='*60}")
        print(f"📦 Packages Found: {len(self.packages)}")
        print(f"🔗 Import Relationships: {sum(len(i) for i in self.import_graph.values())}")
        print()
        
        # Cycle detection
        cycles = self.detect_cycles()
        if cycles:
            print(f"🔴 IMPORT CYCLES DETECTED: {len(cycles)}")
            for cycle in cycles[:5]:  # Show first 5
                print(f"   ⚠️ {' -> '.join(Path(p).name for p in cycle)}")
            print()
        else:
            print("✅ No import cycles detected")
            print()
        
        # Highly coupled packages
        coupled = self.get_highly_coupled()
        if coupled:
            print(f"{'─'*60}")
            print("⚠️ Highly Coupled Packages (efferent > 5):")
            for pkg in sorted(coupled, key=lambda x: -x.efferent):
                print(f"   📦 {pkg.name}: {pkg.efferent} imports, {pkg.afferent} dependents")
            print()
        
        # Instability report
        print(f"{'─'*60}")
        print("📊 Package Instability (0=stable, 1=unstable):")
        for pkg in sorted(self.packages.values(), key=lambda x: -x.instability)[:10]:
            bar = "█" * int(pkg.instability * 10) + "░" * (10 - int(pkg.instability * 10))
            print(f"   [{bar}] {pkg.instability:.2f} - {pkg.name}")
        
        print(f"\n{'='*60}\n")

    def to_json(self) -> Dict:
        return {
            "summary": {
                "packages": len(self.packages),
                "relationships": sum(len(i) for i in self.import_graph.values()),
                "cycles": len(self.detect_cycles()),
                "highly_coupled": len(self.get_highly_coupled())
            },
            "packages": [
                {
                    "name": p.name, "path": p.path,
                    "efferent": p.efferent, "afferent": p.afferent,
                    "instability": round(p.instability, 3),
                    "imports": list(p.imports)
                }
                for p in sorted(self.packages.values(), key=lambda x: -x.instability)
            ],
            "cycles": self.detect_cycles()
        }


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Analyze Go package dependencies")
    parser.add_argument("path", help="Path to Go project root")
    parser.add_argument("--metrics", action="store_true", help="Show detailed metrics")
    parser.add_argument("--graph", help="Output DOT file for GraphViz")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("-o", "--output", help="Save report to file")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    analyzer = DependencyAnalyzer()
    analyzer.analyze_directory(target)

    if args.graph:
        Path(args.graph).write_text(analyzer.generate_dot())
        print(f"✅ DOT graph saved: {args.graph}")
        print(f"   Visualize with: dot -Tpng {args.graph} -o deps.png")

    if args.json:
        output = json.dumps(analyzer.to_json(), indent=2)
        print(output)
        if args.output:
            Path(args.output).write_text(output)
    else:
        analyzer.print_report()
        if args.output:
            Path(args.output).write_text(json.dumps(analyzer.to_json(), indent=2))

    cycles = analyzer.detect_cycles()
    sys.exit(2 if cycles else 0)


if __name__ == "__main__":
    main()
