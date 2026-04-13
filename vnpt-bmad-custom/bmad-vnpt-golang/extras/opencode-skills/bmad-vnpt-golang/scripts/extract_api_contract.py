#!/usr/bin/env python3
"""
Go API Contract Extractor
=========================
Extract API contracts from Go Echo handlers to generate OpenAPI specs and TypeScript interfaces.

Usage:
    python extract_api_contract.py features/workflow
    python extract_api_contract.py features/workflow --output openapi.json
    python extract_api_contract.py features/workflow --typescript types.ts
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime


@dataclass
class StructField:
    name: str
    go_type: str
    json_tag: str
    required: bool = True
    description: str = ""


@dataclass 
class GoStruct:
    name: str
    fields: List[StructField] = field(default_factory=list)
    description: str = ""


@dataclass
class APIEndpoint:
    method: str
    path: str
    handler: str
    summary: str = ""
    request_body: Optional[str] = None
    response_type: Optional[str] = None
    path_params: List[str] = field(default_factory=list)
    query_params: List[str] = field(default_factory=list)


class GoContractExtractor:
    GO_TO_OPENAPI = {
        "string": {"type": "string"},
        "int": {"type": "integer"}, "int64": {"type": "integer", "format": "int64"},
        "float64": {"type": "number"}, "bool": {"type": "boolean"},
        "time.Time": {"type": "string", "format": "date-time"},
        "primitive.ObjectID": {"type": "string"},
    }
    
    GO_TO_TS = {
        "string": "string", "int": "number", "int64": "number",
        "float64": "number", "bool": "boolean", "time.Time": "string",
        "primitive.ObjectID": "string", "interface{}": "unknown", "any": "unknown",
    }

    def __init__(self):
        self.structs: Dict[str, GoStruct] = {}
        self.endpoints: List[APIEndpoint] = []
        self.base_path = "/api/v1"

    def extract(self, dirpath: Path) -> None:
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git')]
            for f in files:
                if f.endswith('.go') and not f.endswith('_test.go'):
                    self._parse_file(Path(root) / f)

    def _parse_file(self, filepath: Path) -> None:
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except:
            return
        self._extract_structs(content)
        self._extract_routes(content)

    def _extract_structs(self, content: str) -> None:
        for m in re.finditer(r'type\s+(\w+)\s+struct\s*\{([^}]*)\}', content, re.DOTALL):
            name, body = m.group(1), m.group(2)
            if not name[0].isupper() or name in self.structs:
                continue
            struct = GoStruct(name=name)
            for fm in re.finditer(r'(\w+)\s+(\S+)(?:\s+`([^`]+)`)?', body):
                fname, ftype, tags = fm.group(1), fm.group(2), fm.group(3) or ""
                if not fname[0].isupper():
                    continue
                jm = re.search(r'json:"([^"]+)"', tags)
                jtag = jm.group(1).split(',')[0] if jm else fname.lower()
                if jtag == '-':
                    continue
                struct.fields.append(StructField(
                    name=fname, go_type=ftype, json_tag=jtag,
                    required='omitempty' not in tags
                ))
            if struct.fields:
                self.structs[name] = struct

    def _extract_routes(self, content: str) -> None:
        gm = re.search(r'\.Group\s*\(\s*["\']([^"\']+)["\']', content)
        if gm:
            self.base_path = gm.group(1)
        for m in re.finditer(r'\.(?P<m>GET|POST|PUT|DELETE|PATCH)\s*\(\s*["\'](?P<p>[^"\']+)["\']\s*,\s*(?P<h>\w+)', content):
            path = m.group('p')
            self.endpoints.append(APIEndpoint(
                method=m.group('m'), path=path, handler=m.group('h'),
                path_params=re.findall(r':(\w+)', path)
            ))

    def to_openapi(self, title="API", version="1.0.0") -> Dict[str, Any]:
        spec = {
            "openapi": "3.0.3",
            "info": {"title": title, "version": version},
            "paths": {},
            "components": {"schemas": {}}
        }
        for name, s in self.structs.items():
            props = {}
            req = []
            for f in s.fields:
                props[f.json_tag] = self._type_to_openapi(f.go_type)
                if f.required:
                    req.append(f.json_tag)
            schema = {"type": "object", "properties": props}
            if req:
                schema["required"] = req
            spec["components"]["schemas"][name] = schema
        for ep in self.endpoints:
            p = re.sub(r':(\w+)', r'{\1}', ep.path)
            if p not in spec["paths"]:
                spec["paths"][p] = {}
            op = {"summary": ep.summary or f"{ep.method} {ep.path}", "responses": {"200": {"description": "OK"}}}
            if ep.path_params:
                op["parameters"] = [{"name": n, "in": "path", "required": True, "schema": {"type": "string"}} for n in ep.path_params]
            spec["paths"][p][ep.method.lower()] = op
        return spec

    def _type_to_openapi(self, t: str) -> Dict:
        if t.startswith('[]'):
            return {"type": "array", "items": self._type_to_openapi(t[2:])}
        if t.startswith('*'):
            return self._type_to_openapi(t[1:])
        if t in self.GO_TO_OPENAPI:
            return dict(self.GO_TO_OPENAPI[t])
        if t in self.structs:
            return {"$ref": f"#/components/schemas/{t}"}
        return {"type": "string"}

    def to_typescript(self) -> str:
        lines = [f"// Generated: {datetime.now().isoformat()}", ""]
        for name, s in sorted(self.structs.items()):
            lines.append(f"export interface {name} {{")
            for f in s.fields:
                opt = "?" if not f.required else ""
                lines.append(f"  {f.json_tag}{opt}: {self._type_to_ts(f.go_type)};")
            lines.extend(["}", ""])
        return "\n".join(lines)

    def _type_to_ts(self, t: str) -> str:
        if t.startswith('[]'):
            return f"{self._type_to_ts(t[2:])}[]"
        if t.startswith('*'):
            return f"{self._type_to_ts(t[1:])} | null"
        return self.GO_TO_TS.get(t, t if t in self.structs else "unknown")

    def print_summary(self) -> None:
        print(f"\n{'='*50}\n📋 API CONTRACT SUMMARY\n{'='*50}")
        print(f"📦 Structs: {len(self.structs)}")
        print(f"🔗 Endpoints: {len(self.endpoints)}")
        for name in sorted(self.structs):
            print(f"   • {name}")
        for ep in self.endpoints:
            print(f"   • {ep.method:6} {ep.path}")
        print("=" * 50)


def main():

    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(description="Extract API contracts from Go code")
    parser.add_argument("path", help="Path to Go feature directory")
    parser.add_argument("-o", "--output", help="Output OpenAPI spec file")
    parser.add_argument("-t", "--typescript", help="Output TypeScript file")
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    ext = GoContractExtractor()
    ext.extract(target)

    if args.output:
        Path(args.output).write_text(json.dumps(ext.to_openapi(), indent=2))
        print(f"✅ OpenAPI saved: {args.output}")
    if args.typescript:
        Path(args.typescript).write_text(ext.to_typescript())
        print(f"✅ TypeScript saved: {args.typescript}")
    if args.json:
        print(json.dumps(ext.to_openapi(), indent=2))
    elif not args.output and not args.typescript:
        ext.print_summary()


if __name__ == "__main__":
    main()
