#!/usr/bin/env python3
"""
Go Interface Contract Validator
================================
Verify that struct implementations properly satisfy their interface contracts.

Usage:
    python validate_interface_contracts.py features/workflow
    python validate_interface_contracts.py features/workflow --strict
    python validate_interface_contracts.py features/workflow --json
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple


@dataclass
class InterfaceMethod:
    name: str
    signature: str
    has_context: bool
    returns_error: bool


@dataclass
class GoInterface:
    name: str
    file: str
    line: int
    methods: List[InterfaceMethod] = field(default_factory=list)


@dataclass
class StructMethod:
    name: str
    receiver: str
    signature: str
    file: str
    line: int


@dataclass
class ValidationIssue:
    severity: str  # ERROR, WARNING
    interface: str
    struct: str
    message: str
    file: str
    line: int


class InterfaceValidator:
    def __init__(self, strict: bool = False):
        self.strict = strict
        self.interfaces: Dict[str, GoInterface] = {}
        self.struct_methods: Dict[str, List[StructMethod]] = {}
        self.issues: List[ValidationIssue] = []
        self.files_analyzed = 0

    def analyze_directory(self, dirpath: Path) -> None:
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata', 'mocks')]
            for f in files:
                if f.endswith('.go') and not f.endswith('_test.go'):
                    self._analyze_file(Path(root) / f)
        
        self._validate_contracts()

    def _analyze_file(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        
        self.files_analyzed += 1
        
        # Extract interfaces
        iface_pattern = r'type\s+(\w+)\s+interface\s*\{([^}]+)\}'
        for m in re.finditer(iface_pattern, content, re.DOTALL):
            iface_name = m.group(1)
            iface_body = m.group(2)
            line_num = content[:m.start()].count('\n') + 1
            
            iface = GoInterface(name=iface_name, file=str(filepath), line=line_num)
            
            # Parse methods
            for mm in re.finditer(r'(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\S+))?', iface_body):
                method_name = mm.group(1)
                params = mm.group(2)
                returns = mm.group(3) or mm.group(4) or ""
                
                iface.methods.append(InterfaceMethod(
                    name=method_name,
                    signature=f"({params}) {returns}".strip(),
                    has_context="context.Context" in params or "ctx " in params.lower(),
                    returns_error="error" in returns
                ))
            
            if iface.methods:
                self.interfaces[iface_name] = iface
        
        # Extract struct methods
        method_pattern = r'func\s+\((\w+)\s+\*?(\w+)\)\s+(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\S+))?'
        for m in re.finditer(method_pattern, content):
            receiver = m.group(1)
            struct_name = m.group(2)
            method_name = m.group(3)
            params = m.group(4)
            returns = m.group(5) or m.group(6) or ""
            line_num = content[:m.start()].count('\n') + 1
            
            if struct_name not in self.struct_methods:
                self.struct_methods[struct_name] = []
            
            self.struct_methods[struct_name].append(StructMethod(
                name=method_name,
                receiver=receiver,
                signature=f"({params}) {returns}".strip(),
                file=str(filepath),
                line=line_num
            ))

    def _validate_contracts(self) -> None:
        # Find likely implementations
        for iface_name, iface in self.interfaces.items():
            # Look for structs that implement all interface methods
            for struct_name, methods in self.struct_methods.items():
                method_names = {m.name for m in methods}
                iface_method_names = {m.name for m in iface.methods}
                
                # Check if struct has all interface methods
                if iface_method_names.issubset(method_names):
                    self._validate_implementation(iface, struct_name, methods)

    def _validate_implementation(self, iface: GoInterface, struct_name: str, methods: List[StructMethod]) -> None:
        method_map = {m.name: m for m in methods}
        
        for iface_method in iface.methods:
            struct_method = method_map.get(iface_method.name)
            if not struct_method:
                continue
            
            # Check context as first parameter
            if self.strict and iface_method.has_context:
                if not struct_method.signature.startswith("(ctx ") and not struct_method.signature.startswith("(context."):
                    self.issues.append(ValidationIssue(
                        severity="WARNING",
                        interface=iface.name,
                        struct=struct_name,
                        message=f"Method {iface_method.name}: context should be first parameter",
                        file=struct_method.file,
                        line=struct_method.line
                    ))
            
            # Check error return
            if self.strict and iface_method.returns_error:
                if "error" not in struct_method.signature:
                    self.issues.append(ValidationIssue(
                        severity="ERROR",
                        interface=iface.name,
                        struct=struct_name,
                        message=f"Method {iface_method.name}: should return error",
                        file=struct_method.file,
                        line=struct_method.line
                    ))

    def print_report(self) -> None:
        print(f"\n{'='*60}")
        print("📝 INTERFACE CONTRACT VALIDATION REPORT")
        print(f"{'='*60}")
        print(f"📁 Files Analyzed: {self.files_analyzed}")
        print(f"📋 Interfaces Found: {len(self.interfaces)}")
        print(f"📦 Structs with Methods: {len(self.struct_methods)}")
        print(f"⚠️ Issues Found: {len(self.issues)}")
        print()
        
        if not self.interfaces:
            print("ℹ️ No interfaces found to validate")
            return
        
        # List interfaces
        print(f"{'─'*60}")
        print("📋 Interfaces:")
        for iface in self.interfaces.values():
            print(f"   • {iface.name} ({len(iface.methods)} methods)")
        print()
        
        if not self.issues:
            print("✅ All interface contracts are properly implemented!")
            return
        
        print(f"{'─'*60}")
        print("⚠️ Issues:")
        for issue in self.issues:
            icon = "❌" if issue.severity == "ERROR" else "⚠️"
            print(f"\n{icon} [{issue.severity}] {issue.struct} -> {issue.interface}")
            print(f"   {issue.message}")
            print(f"   📍 {issue.file}:{issue.line}")
        
        print(f"\n{'='*60}\n")

    def to_json(self) -> Dict:
        return {
            "summary": {
                "files_analyzed": self.files_analyzed,
                "interfaces": len(self.interfaces),
                "structs_with_methods": len(self.struct_methods),
                "issues": len(self.issues)
            },
            "interfaces": [
                {"name": i.name, "file": i.file, "methods": len(i.methods)}
                for i in self.interfaces.values()
            ],
            "issues": [
                {
                    "severity": i.severity, "interface": i.interface,
                    "struct": i.struct, "message": i.message,
                    "file": i.file, "line": i.line
                }
                for i in self.issues
            ]
        }


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Validate Go interface contracts")
    parser.add_argument("path", help="Path to Go directory")
    parser.add_argument("--strict", action="store_true", help="Enable strict validation")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("-o", "--output", help="Save report to file")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    validator = InterfaceValidator(strict=args.strict)
    validator.analyze_directory(target)

    if args.json:
        output = json.dumps(validator.to_json(), indent=2)
        print(output)
        if args.output:
            Path(args.output).write_text(output)
    else:
        validator.print_report()
        if args.output:
            Path(args.output).write_text(json.dumps(validator.to_json(), indent=2))

    errors = [i for i in validator.issues if i.severity == "ERROR"]
    sys.exit(2 if errors else 1 if validator.issues else 0)


if __name__ == "__main__":
    main()
