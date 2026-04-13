#!/usr/bin/env python3
"""
Dependency Injection Wiring Generator
======================================
Generate the wiring code for routers/constant.go based on a feature's structure.

Usage:
    python generate_di_wiring.py <feature_name>
    python generate_di_wiring.py notifications
"""

import argparse
from pathlib import Path


def to_pascal_case(name: str) -> str:
    """Convert snake_case to PascalCase."""
    return ''.join(word.capitalize() for word in name.split('_'))


def to_camel_case(name: str) -> str:
    """Convert snake_case to camelCase."""
    words = name.split('_')
    return words[0].lower() + ''.join(word.capitalize() for word in words[1:])


def generate_wiring(feature_name: str, module_path: str = "system_integration_management") -> str:
    """Generate DI wiring code for a feature."""
    name_lower = feature_name.lower().replace('-', '_')
    name_pascal = to_pascal_case(name_lower)
    name_camel = to_camel_case(name_lower)

    wiring = f'''
// ============================================================
// {name_pascal} Feature Wiring
// ============================================================
// Add the following to routers/constant.go

// 1. Add imports
/*
import (
    {name_lower}Ctrl "{module_path}/features/{name_lower}/controllers"
    {name_lower}Repo "{module_path}/features/{name_lower}/repositories"
    {name_lower}Router "{module_path}/features/{name_lower}/routers"
    {name_lower}Svc "{module_path}/features/{name_lower}/services"
)
*/

// 2. Add variables (near other controller declarations)
/*
var (
    {name_camel}Controller *{name_lower}Ctrl.{name_pascal}Controller
)
*/

// 3. Add initialization in InitialConfiguration() function
/*
func InitialConfiguration(cfgPath string) configModel.AppConfig {{
    // ... existing code ...

    // Initialize {name_pascal} feature
    {name_camel}Repo := {name_lower}Repo.NewMongoRepository(mongoDatabase)
    {name_camel}Service := {name_lower}Svc.New{name_pascal}Service({name_camel}Repo)
    {name_camel}Controller = {name_lower}Ctrl.New{name_pascal}Controller({name_camel}Service)

    // ... rest of initialization ...
}}
*/

// 4. Add route registration in SetupRoutes() or equivalent
/*
func SetupRoutes(e *echo.Echo) {{
    // ... existing routes ...

    // {name_pascal} routes
    apiGroup := e.Group("/api/v1")
    {name_lower}Router.RegisterRoutes(apiGroup, {name_camel}Controller)
}}
*/

// ============================================================
// Alternative: Using a Feature Module Pattern
// ============================================================
// If you prefer a module-based approach, create this file:
// features/{name_lower}/module.go

/*
package {name_lower}

import (
    "github.com/labstack/echo/v4"
    "go.mongodb.org/mongo-driver/mongo"
)

// Module encapsulates all {name_pascal} dependencies.
type Module struct {{
    Controller *{name_pascal}Controller
    Service    {name_pascal}Service
    Repository {name_pascal}Repository
}}

// NewModule creates and wires all {name_pascal} dependencies.
func NewModule(db *mongo.Database) *Module {{
    repo := NewMongoRepository(db)
    service := New{name_pascal}Service(repo)
    controller := New{name_pascal}Controller(service)

    return &Module{{
        Controller: controller,
        Service:    service,
        Repository: repo,
    }}
}}

// RegisterRoutes registers all {name_pascal} routes.
func (m *Module) RegisterRoutes(g *echo.Group) {{
    RegisterRoutes(g, m.Controller)
}}
*/

// Then in routers/constant.go:
/*
{name_camel}Module := {name_lower}.NewModule(mongoDatabase)
{name_camel}Module.RegisterRoutes(apiGroup)
*/
'''
    return wiring


def main():
    parser = argparse.ArgumentParser(
        description="Generate DI wiring code for a Go feature"
    )
    parser.add_argument("feature_name", help="Name of the feature")
    parser.add_argument("--module", default="system_integration_management",
                        help="Go module path")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")

    args = parser.parse_args()

    wiring = generate_wiring(args.feature_name, args.module)

    if args.output:
        Path(args.output).write_text(wiring)
        print(f"Wiring code saved to: {args.output}")
    else:
        print(wiring)


if __name__ == "__main__":
    main()
