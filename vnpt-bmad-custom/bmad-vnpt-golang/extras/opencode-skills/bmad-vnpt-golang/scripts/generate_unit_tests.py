#!/usr/bin/env python3
"""
Go Unit Test Generator
=======================
Generate unit test stubs from Go function signatures.

Usage:
    python generate_unit_tests.py features/workflow/services/service.go
    python generate_unit_tests.py features/workflow/services/service.go --mocks
    python generate_unit_tests.py features/workflow --recursive
"""

import os
import sys
import re
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


@dataclass
class FunctionSignature:
    name: str
    receiver: Optional[str]
    receiver_type: str
    params: List[Tuple[str, str]]
    returns: List[str]
    file: str
    line: int


@dataclass
class InterfaceMethod:
    name: str
    params: List[Tuple[str, str]]
    returns: List[str]


@dataclass
class GoInterface:
    name: str
    methods: List[InterfaceMethod] = field(default_factory=list)


class TestGenerator:
    def __init__(self, generate_mocks: bool = False):
        self.generate_mocks = generate_mocks
        self.functions: List[FunctionSignature] = []
        self.interfaces: Dict[str, GoInterface] = {}
        self.structs: List[str] = []
        self.package_name = ""

    def parse_file(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        
        # Get package name
        m = re.search(r'^package\s+(\w+)', content, re.MULTILINE)
        if m:
            self.package_name = m.group(1)
        
        # Extract interfaces
        self._extract_interfaces(content)
        
        # Extract structs
        for m in re.finditer(r'type\s+(\w+)\s+struct\s*\{', content):
            self.structs.append(m.group(1))
        
        # Extract functions
        self._extract_functions(content, filepath)

    def _extract_interfaces(self, content: str) -> None:
        pattern = r'type\s+(\w+)\s+interface\s*\{([^}]+)\}'
        for m in re.finditer(pattern, content, re.DOTALL):
            iface_name = m.group(1)
            iface_body = m.group(2)
            
            iface = GoInterface(name=iface_name)
            
            # Parse methods
            method_pattern = r'(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\S+))?'
            for mm in re.finditer(method_pattern, iface_body):
                method_name = mm.group(1)
                params_str = mm.group(2)
                returns_str = mm.group(3) or mm.group(4) or ""
                
                params = self._parse_params(params_str)
                returns = [r.strip() for r in returns_str.split(',') if r.strip()]
                
                iface.methods.append(InterfaceMethod(
                    name=method_name, params=params, returns=returns
                ))
            
            self.interfaces[iface_name] = iface

    def _extract_functions(self, content: str, filepath: Path) -> None:
        # Pattern: func (r ReceiverType) Name(params) (returns)
        pattern = r'func\s+(?:\((\w+)\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\w+))?'
        
        for m in re.finditer(pattern, content):
            receiver = m.group(1)
            receiver_type = m.group(2) or ""
            name = m.group(3)
            params_str = m.group(4)
            returns_str = m.group(5) or m.group(6) or ""
            
            # Skip unexported and special functions
            if not name[0].isupper() or name in ('Init', 'Main'):
                continue
            
            params = self._parse_params(params_str)
            returns = [r.strip() for r in returns_str.split(',') if r.strip()]
            
            line_num = content[:m.start()].count('\n') + 1
            
            self.functions.append(FunctionSignature(
                name=name, receiver=receiver, receiver_type=receiver_type,
                params=params, returns=returns,
                file=str(filepath), line=line_num
            ))

    def _parse_params(self, params_str: str) -> List[Tuple[str, str]]:
        """Parse parameter string into list of (name, type) tuples."""
        params = []
        if not params_str.strip():
            return params
        
        for p in params_str.split(','):
            p = p.strip()
            if not p:
                continue
            parts = p.split()
            if len(parts) >= 2:
                params.append((parts[0], ' '.join(parts[1:])))
            elif parts:
                params.append(("", parts[0]))
        
        return params

    def generate_tests(self) -> str:
        lines = [
            f"package {self.package_name}",
            "",
            "import (",
            '\t"context"',
            '\t"testing"',
            "",
            '\t"github.com/stretchr/testify/assert"',
            '\t"github.com/stretchr/testify/require"',
            ")",
            ""
        ]
        
        # Generate tests for each function
        for func in self.functions:
            lines.extend(self._generate_test(func))
            lines.append("")
        
        return "\n".join(lines)

    def _generate_test(self, func: FunctionSignature) -> List[str]:
        test_name = f"Test{func.receiver_type}{func.name}" if func.receiver_type else f"Test{func.name}"
        
        lines = [
            f"func {test_name}(t *testing.T) {{",
            "\t// Arrange",
        ]
        
        # Setup receiver if needed
        if func.receiver_type:
            lines.append(f"\tsut := &{func.receiver_type}{{")
            lines.append("\t\t// TODO: Initialize dependencies")
            lines.append("\t}")
        
        # Create test context if needed
        has_ctx = any(ptype == "context.Context" for _, ptype in func.params)
        if has_ctx:
            lines.append("\tctx := context.Background()")
        
        lines.append("")
        lines.append("\ttests := []struct {")
        lines.append('\t\tname string')
        
        # Add input fields
        for pname, ptype in func.params:
            if ptype != "context.Context":
                field_name = pname if pname else "input"
                lines.append(f'\t\t{field_name} {ptype}')
        
        # Add expected output fields
        for i, ret in enumerate(func.returns):
            if ret == "error":
                lines.append('\t\twantErr bool')
            else:
                lines.append(f'\t\twant{i if i > 0 else ""} {ret}')
        
        lines.append("\t}{")
        
        # Add test cases
        lines.append('\t\t{')
        lines.append('\t\t\tname: "success case",')
        lines.append('\t\t\t// TODO: Add test inputs')
        if any(r == "error" for r in func.returns):
            lines.append('\t\t\twantErr: false,')
        lines.append('\t\t},')
        lines.append('\t\t{')
        lines.append('\t\t\tname: "error case",')
        lines.append('\t\t\t// TODO: Add error inputs')
        if any(r == "error" for r in func.returns):
            lines.append('\t\t\twantErr: true,')
        lines.append('\t\t},')
        lines.append("\t}")
        
        lines.append("")
        lines.append("\tfor _, tt := range tests {")
        lines.append('\t\tt.Run(tt.name, func(t *testing.T) {')
        lines.append("\t\t\t// Act")
        
        # Generate function call
        call_args = []
        if has_ctx:
            call_args.append("ctx")
        for pname, ptype in func.params:
            if ptype != "context.Context":
                call_args.append(f"tt.{pname if pname else 'input'}")
        
        if func.receiver:
            caller = "sut"
        else:
            caller = ""
        
        call_str = f"{caller}." if caller else ""
        call_str += f"{func.name}({', '.join(call_args)})"
        
        if len(func.returns) > 1 or (len(func.returns) == 1 and func.returns[0] != "error"):
            lines.append(f"\t\t\tgot, err := {call_str}")
        elif func.returns and func.returns[0] == "error":
            lines.append(f"\t\t\terr := {call_str}")
        else:
            lines.append(f"\t\t\t{call_str}")
        
        lines.append("")
        lines.append("\t\t\t// Assert")
        
        if any(r == "error" for r in func.returns):
            lines.append("\t\t\tif tt.wantErr {")
            lines.append('\t\t\t\trequire.Error(t, err)')
            lines.append("\t\t\t\treturn")
            lines.append("\t\t\t}")
            lines.append('\t\t\trequire.NoError(t, err)')
        
        for i, ret in enumerate(func.returns):
            if ret != "error":
                lines.append(f'\t\t\tassert.Equal(t, tt.want{i if i > 0 else ""}, got)')
        
        lines.append("\t\t})")
        lines.append("\t}")
        lines.append("}")
        
        return lines

    def generate_mocks(self) -> str:
        lines = [
            f"package {self.package_name}",
            "",
            "// Auto-generated mocks",
            ""
        ]
        
        for iface in self.interfaces.values():
            lines.extend(self._generate_mock(iface))
            lines.append("")
        
        return "\n".join(lines)

    def _generate_mock(self, iface: GoInterface) -> List[str]:
        mock_name = f"Mock{iface.name}"
        lines = [
            f"// {mock_name} is a mock implementation of {iface.name}",
            f"type {mock_name} struct {{",
        ]
        
        for method in iface.methods:
            func_type = self._method_to_func_type(method)
            lines.append(f"\t{method.name}Func {func_type}")
        
        lines.append("}")
        
        for method in iface.methods:
            lines.extend(self._generate_mock_method(mock_name, method))
        
        return lines

    def _method_to_func_type(self, method: InterfaceMethod) -> str:
        params = ", ".join(f"{p[0]} {p[1]}" if p[0] else p[1] for p in method.params)
        returns = ", ".join(method.returns)
        if len(method.returns) > 1:
            returns = f"({returns})"
        return f"func({params}) {returns}"

    def _generate_mock_method(self, mock_name: str, method: InterfaceMethod) -> List[str]:
        params = ", ".join(f"{p[0]} {p[1]}" if p[0] else p[1] for p in method.params)
        returns = ", ".join(method.returns)
        if len(method.returns) > 1:
            returns = f"({returns})"
        
        lines = [
            "",
            f"func (m *{mock_name}) {method.name}({params}) {returns} {{",
            f"\treturn m.{method.name}Func({', '.join(p[0] for p in method.params if p[0])})",
            "}"
        ]
        return lines


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Generate Go unit test stubs")
    parser.add_argument("path", help="Path to Go file or directory")
    parser.add_argument("--mocks", action="store_true", help="Generate mock implementations")
    parser.add_argument("-r", "--recursive", action="store_true", help="Process directory recursively")
    parser.add_argument("-o", "--output", help="Output file (default: stdout)")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    generator = TestGenerator(generate_mocks=args.mocks)

    if target.is_file():
        generator.parse_file(target)
    else:
        for root, _, files in os.walk(target):
            for f in files:
                if f.endswith('.go') and not f.endswith('_test.go'):
                    generator.parse_file(Path(root) / f)
            if not args.recursive:
                break

    output = generator.generate_tests()
    
    if args.mocks and generator.interfaces:
        output += "\n\n// ===== MOCKS =====\n\n"
        output += generator.generate_mocks()

    if args.output:
        Path(args.output).write_text(output)
        print(f"✅ Tests saved to: {args.output}")
    else:
        print(output)

    print(f"\n📊 Generated tests for {len(generator.functions)} functions", file=sys.stderr)
    if generator.interfaces:
        print(f"📊 Found {len(generator.interfaces)} interfaces", file=sys.stderr)


if __name__ == "__main__":
    main()
