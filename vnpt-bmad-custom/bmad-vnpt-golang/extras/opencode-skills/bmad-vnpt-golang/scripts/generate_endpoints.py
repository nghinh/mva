#!/usr/bin/env python3
"""
API Endpoint Generator
======================
Generate Echo handler stubs and route registration from endpoint definitions.

Usage:
    python generate_endpoints.py --feature notifications --endpoints endpoints.json
    python generate_endpoints.py --feature notifications --interactive
"""

import argparse
import json
from pathlib import Path
from typing import List, Dict, Any


def to_pascal_case(name: str) -> str:
    return ''.join(word.capitalize() for word in name.split('_'))


def to_camel_case(name: str) -> str:
    words = name.split('_')
    return words[0].lower() + ''.join(word.capitalize() for word in words[1:])


def parse_path_params(path: str) -> List[str]:
    """Extract path parameters from URL path."""
    import re
    return re.findall(r':(\w+)', path)


def generate_handler(endpoint: Dict[str, Any], feature_name: str) -> str:
    """Generate a single handler function."""
    method = endpoint['method'].upper()
    path = endpoint['path']
    operation_id = endpoint.get('operation_id', f"{method.lower()}{path.replace('/', '_').replace(':', '')}")
    summary = endpoint.get('summary', f'{method} {path}')
    
    name_pascal = to_pascal_case(feature_name)
    handler_name = to_pascal_case(operation_id.replace('_', ' ').replace('-', ' ').replace(' ', '_'))
    
    path_params = parse_path_params(path)
    
    # Build handler code
    lines = []
    lines.append(f'// {handler_name} handles {method} {path}')
    lines.append(f'// {summary}')
    lines.append(f'func (c *{name_pascal}Controller) {handler_name}(ctx echo.Context) error {{')
    
    # Path parameters
    for param in path_params:
        lines.append(f'\t{param} := ctx.Param("{param}")')
        lines.append(f'\tif {param} == "" {{')
        lines.append(f'\t\treturn ctx.JSON(http.StatusBadRequest, map[string]string{{"error": "{param} is required"}})')
        lines.append('\t}')
        lines.append('')
    
    # Request body for POST/PUT/PATCH
    if method in ['POST', 'PUT', 'PATCH']:
        req_type = endpoint.get('request_type', f'{handler_name}Request')
        lines.append(f'\tvar req {req_type}')
        lines.append('\tif err := ctx.Bind(&req); err != nil {')
        lines.append('\t\treturn ctx.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})')
        lines.append('\t}')
        lines.append('')
    
    # TODO placeholder
    lines.append('\t// TODO: Implement business logic')
    lines.append('\t// result, err := c.service.SomeMethod(ctx.Request().Context(), ...)')
    lines.append('\t// if err != nil {')
    lines.append('\t//     return c.handleError(ctx, err)')
    lines.append('\t// }')
    lines.append('')
    
    # Response
    if method == 'DELETE':
        lines.append('\treturn ctx.NoContent(http.StatusNoContent)')
    elif method == 'POST':
        lines.append('\treturn ctx.JSON(http.StatusCreated, map[string]string{"message": "Created"})')
    else:
        lines.append('\treturn ctx.JSON(http.StatusOK, map[string]string{"message": "OK"})')
    
    lines.append('}')
    
    return '\n'.join(lines)


def generate_routes(endpoints: List[Dict[str, Any]], feature_name: str) -> str:
    """Generate route registration code."""
    name_pascal = to_pascal_case(feature_name)
    name_lower = feature_name.lower()
    
    lines = []
    lines.append(f'// RegisterRoutes binds all {name_pascal} endpoints.')
    lines.append(f'func RegisterRoutes(g *echo.Group, c *{name_pascal}Controller) {{')
    lines.append(f'\tgroup := g.Group("/{name_lower}s")')
    lines.append('')
    
    for ep in endpoints:
        method = ep['method'].upper()
        path = ep['path'].replace(f'/{name_lower}s', '')  # Remove base path
        if not path:
            path = ''
        
        operation_id = ep.get('operation_id', f"{method.lower()}{ep['path'].replace('/', '_').replace(':', '')}")
        handler_name = to_pascal_case(operation_id.replace('_', ' ').replace('-', ' ').replace(' ', '_'))
        
        lines.append(f'\tgroup.{method.capitalize()}("{path}", c.{handler_name})')
    
    lines.append('}')
    
    return '\n'.join(lines)


def generate_request_types(endpoints: List[Dict[str, Any]]) -> str:
    """Generate request DTO structs."""
    lines = []
    lines.append('// Request DTOs')
    lines.append('')
    
    for ep in endpoints:
        method = ep['method'].upper()
        if method not in ['POST', 'PUT', 'PATCH']:
            continue
        
        body = ep.get('body', {})
        if not body:
            continue
        
        operation_id = ep.get('operation_id', f"{method.lower()}{ep['path'].replace('/', '_').replace(':', '')}")
        type_name = to_pascal_case(operation_id.replace('_', ' ').replace('-', ' ').replace(' ', '_')) + 'Request'
        
        lines.append(f'type {type_name} struct {{')
        for field_name, field_type in body.items():
            go_type = {
                'string': 'string',
                'integer': 'int',
                'number': 'float64',
                'boolean': 'bool',
                'array': '[]interface{}',
                'object': 'map[string]interface{}',
            }.get(field_type, 'interface{}')
            
            lines.append(f'\t{to_pascal_case(field_name)} {go_type} `json:"{field_name}"`')
        lines.append('}')
        lines.append('')
    
    return '\n'.join(lines)


def interactive_mode(feature_name: str) -> List[Dict[str, Any]]:
    """Interactive endpoint definition."""
    print(f"=== Endpoint Generator for {feature_name} ===")
    print("Define endpoints (empty path to finish):")
    
    endpoints = []
    while True:
        print()
        path = input("Path (e.g., /users/:id): ").strip()
        if not path:
            break
        
        method = input("Method [GET/POST/PUT/DELETE]: ").upper().strip() or "GET"
        summary = input("Summary: ").strip() or f"{method} {path}"
        
        body = None
        if method in ['POST', 'PUT', 'PATCH']:
            fields = input("Body fields (name:string,age:integer): ").strip()
            if fields:
                body = {}
                for field in fields.split(','):
                    parts = field.strip().split(':')
                    if len(parts) == 2:
                        body[parts[0]] = parts[1]
        
        endpoints.append({
            'method': method,
            'path': path,
            'summary': summary,
            'body': body
        })
        print(f"  ✓ Added: {method} {path}")
    
    return endpoints


def main():
    parser = argparse.ArgumentParser(
        description="Generate Echo handler stubs from endpoint definitions"
    )
    parser.add_argument("--feature", required=True, help="Feature name")
    parser.add_argument("--endpoints", help="JSON file with endpoint definitions")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive mode")
    parser.add_argument("--output", "-o", help="Output directory")
    
    args = parser.parse_args()
    
    if args.interactive:
        endpoints = interactive_mode(args.feature)
    elif args.endpoints:
        with open(args.endpoints) as f:
            endpoints = json.load(f)
    else:
        print("Error: Either --endpoints or --interactive is required")
        return
    
    if not endpoints:
        print("No endpoints defined.")
        return
    
    # Generate code
    handlers = '\n\n'.join(generate_handler(ep, args.feature) for ep in endpoints)
    routes = generate_routes(endpoints, args.feature)
    request_types = generate_request_types(endpoints)
    
    output = f'''package {args.feature.lower()}

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

{request_types}

{handlers}

{routes}
'''
    
    if args.output:
        output_path = Path(args.output) / "generated_endpoints.go"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output)
        print(f"Generated code saved to: {output_path}")
    else:
        print("=" * 60)
        print("GENERATED CODE")
        print("=" * 60)
        print(output)


if __name__ == "__main__":
    main()
