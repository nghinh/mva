#!/usr/bin/env python3
"""
Route Validation Script - Ultimate Version
Uses enhanced parsing to accurately detect duplicate routes in Echo framework

Key features:
- Tracks nested group hierarchies accurately
- Handles complex variable assignments and method chains
- Calculates full paths correctly including all group prefixes
- Filters false positives by comparing full paths
- Generates detailed reports with JSON export capability
- Integrates route-controller mismatch detection

Usage:
    python validate_route_controller_mismatch.py [--output report.json] [--verbose]
"""

import os
import re
import sys
import subprocess
import json
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Set, Optional, Any
from dataclasses import dataclass, field


@dataclass
class Handler:
    """Represents a controller handler function."""

    controller_file: str
    feature: str
    controller_name: str
    handler_name: str
    line_number: int
    controller_type: str = ""  # The actual controller type from receiver
    controller_types: List[str] = field(
        default_factory=list
    )  # All possible controller types


@dataclass
class RouteInfo:
    """Represents a route registration"""

    file_path: str
    line_number: int
    method: str  # GET, POST, etc.
    path: str  # The route path segment
    full_path: str  # The complete path including all group prefixes
    handler: str  # Handler function name
    feature: str  # Feature name
    group_chain: List[str] = field(default_factory=list)  # Hierarchy of groups


@dataclass
class GroupInfo:
    """Represents a group in the hierarchy"""

    file_path: str
    line_number: int
    variable_name: str  # Variable name if assigned
    path_prefix: str
    depth: int = 0


@dataclass
class NamingViolation:
    """Represents a controller naming violation"""

    violation_type: str  # P0-CRITICAL, P1-HIGH, P2-MEDIUM
    violation_category: (
        str  # single_letter, generic_controller, abbreviation, snake_case
    )
    file_path: str
    line_number: int
    variable_name: str
    description: str
    suggested_fix: str


class RouteValidator:
    """Main validator class with enhanced parsing capabilities"""

    def __init__(self, backend_dir: str = None):
        if backend_dir is None:
            backend_dir = str(Path(__file__).parent.parent.parent.parent.parent)
        self.backend_dir = Path(backend_dir)
        self.routes: List[RouteInfo] = []
        self.handlers: Dict[str, Handler] = {}
        self.duplicates: Dict[str, List[RouteInfo]] = defaultdict(list)
        self.unregistered_handlers: List[Handler] = []
        self.missing_handler_routes: List[Tuple[RouteInfo, List[str]]] = []
        self.naming_violations: List[NamingViolation] = []

        # Known group patterns from main router and sub-routers
        self.known_groups = {
            "v1": "/v1",
            "v2": "/v2",
            "v3": "/v3",
            "mdm": "/mdm",
            "aoc": "/aoc",
            "vms": "/vms",
            "hml": "/hml",
            "v2x": "/v2x",
            "platoon": "/platoon",
            "dcp": "/dcp",
            "apollo": "/apollo",
            "odd": "/odd",
            "maps": "/maps",
            "tiles": "/tiles",
            "benchmarks": "/benchmarks",
            "pointcloud": "/pointcloud",
            "benchmark": "/benchmark",
            "benchmark_results": "/benchmark-results",
            "telemetry": "/telemetry",
            "missions": "/missions",
            "vehicles": "/vehicles",
            "fleets": "/fleets",
            "fleet-optimization": "/fleet-optimization",
            "workflow": "/workflow",
            "workflows": "/workflows",
            "maps/:map_id": "/maps/:map_id",
            "maps/:tile_id": "/maps/:tile_id",
            "benchmark-results": "/benchmark-results",
        }

        # Base paths for different features
        self.feature_base_paths = {
            "mdm": "/api/v1/mdm",
            "aoc": "/api/v1/aoc",
            "vms": "/api/v1/vms",
            "hml": "/api/v1/hml",
            "v2x": "/api/v1/v2x",
            "platoon": "/api/v1/platoon",
            "dcp": "/api/v1/dcp",
            "apollo": "/api/v1/apollo",
        }

    def find_router_files(self) -> List[Path]:
        """Find all router files in the project"""
        router_files = []

        # Common router file patterns
        patterns = [
            "**/routers/*.go",
            "**/router*.go",
        ]

        for pattern in patterns:
            matched = list(self.backend_dir.glob(pattern))
            router_files.extend(matched)

        # Filter out test files, non-Go files, and skeleton/template files
        exclude_patterns = [
            ".claude/skills/",
            ".github/skills/",
            "skeleton/",
            "template/",
            "_template_",
        ]

        router_files = [
            f
            for f in router_files
            if (
                f.is_file()
                and f.suffix == ".go"
                and "_test.go" not in f.name
                and not any(excl in str(f) for excl in exclude_patterns)
            )
        ]

        return sorted(set(router_files))

    def find_controller_files(self) -> List[Path]:
        """Find all controller files in the project"""
        controllers = []
        features_dir = self.backend_dir / "features"

        if features_dir.exists():
            # Find all controller files (recursively under controllers/)
            # Pattern: *_controller.go OR *_controller_*.go
            for controller_file in features_dir.rglob("*_controller*.go"):
                # Must be under a controllers/ directory at some level
                if (
                    "controllers" in controller_file.parts
                    and controller_file.is_file()
                    and not controller_file.name.endswith("_test.go")
                ):
                    controllers.append(controller_file)

        return sorted(set(controllers))

    def extract_feature_name(self, file_path: Path) -> str:
        """Extract feature name from file path"""
        parts = file_path.parts
        for i, part in enumerate(parts):
            if part == "features" and i + 1 < len(parts):
                return parts[i + 1]
        return "unknown"

    def extract_controller_name(self, controller_file: Path) -> str:
        """Extract controller name from file name"""
        return controller_file.stem.replace("_controller", "")

    def extract_actual_handler(self, handler_str: str) -> str:
        """Extract actual controller.handler from wrapper functions"""
        # Pattern 1: Direct controller.method
        if re.match(r"^\w+\.\w+$", handler_str):
            return handler_str

        # Pattern 2: Helper wrapper like applyRBAC(controller.Method, args...)
        # Extract controller.Method from the wrapper
        wrapper_match = re.search(r"(\w+)\.(\w+)\s*[\),]", handler_str)
        if wrapper_match:
            controller = wrapper_match.group(1)
            method = wrapper_match.group(2)
            return f"{controller}.{method}"

        # Pattern 3: Method chain like b.applyRBAC(controller.Method)
        # Find the innermost controller.Method
        inner_match = re.search(r"(\w+)\.(\w+)\s*[\),]", handler_str)
        if inner_match:
            controller = inner_match.group(1)
            method = inner_match.group(2)
            return f"{controller}.{method}"

        # Return original if no pattern matches
        return handler_str

    def parse_router_file(self, file_path: Path) -> List[RouteInfo]:
        """Parse a Go router file and extract route information"""
        routes = []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Failed to read {file_path}: {e}", file=sys.stderr)
            return routes

        lines = content.split("\n")

        # Extract feature name and determine base path
        feature_name = self.extract_feature_name(file_path)
        base_path = "/api"
        if feature_name in self.feature_base_paths:
            base_path += self.feature_base_paths[feature_name]

        # Track group hierarchy
        group_stack: List[str] = []

        # Track all group variables seen in this file so far
        group_variables: Dict[str, str] = {}

        i = 0
        while i < len(lines):
            line = lines[i]
            line_num = i + 1
            stripped = line.strip()

            # Skip comments
            if stripped.startswith("//") or stripped.startswith("/*"):
                i += 1
                continue

            # Track group declarations
            # Pattern: variable := anything.Group("/path")
            group_match = re.search(
                r'(\w+)\s*:=\s*\w+\.?(?:Group|Use)\s*\(\s*[\'"]([^\'"]+)[\'"]', line
            )
            if group_match:
                var_name = group_match.group(1)
                path_prefix = group_match.group(2)
                # Store variable mapping
                group_variables[var_name] = path_prefix
                # Add to stack
                group_stack.append(path_prefix)
                i += 1
                continue

            # Pattern: nested.Group("/path") where nested is a variable
            nested_group_match = re.search(
                r'(\w+)\.(?:Group|Use)\s*\(\s*[\'"]([^\'"]+)[\'"]', line
            )
            if nested_group_match:
                var_name = nested_group_match.group(1)
                path_prefix = nested_group_match.group(2)

                # Check if this is a known group variable
                if var_name in group_variables or var_name in self.known_groups:
                    # Get the prefix
                    if var_name in group_variables:
                        prefix = group_variables[var_name]
                    else:
                        prefix = self.known_groups.get(var_name, "")

                    # If path_prefix is not absolute, combine
                    if not path_prefix.startswith("/"):
                        combined = prefix.rstrip("/") + "/" + path_prefix
                    else:
                        combined = prefix + path_prefix

                    group_stack.append(combined)
                    i += 1
                    continue

            # Track route registrations
            # Pattern: group.METHOD("/path", handler)
            # Capture everything until closing paren to handle wrapper functions with multiple args
            http_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
            for method in http_methods:
                # Match: group.METHOD("/path", handler[, middleware...])
                # Modified: Capture everything until closing paren instead of stopping at first comma
                pattern = rf'(\w+)\.{method}\s*\(\s*[\'"]([^\'"]+)[\'"]\s*,\s*([^)]+)'
                match = re.search(pattern, line)

                if match:
                    group_var = match.group(1)
                    route_path = match.group(2)
                    handler = match.group(3).strip()

                    # Skip if this is a comment or not a real route
                    if handler.startswith("//") or handler.startswith("/*"):
                        break

                    # Skip anonymous functions (func(c echo.Context))
                    if handler.startswith("func("):
                        break

                    # Extract actual controller.method from wrapper functions
                    actual_handler = self.extract_actual_handler(handler)

                    # Build full path
                    current_path = base_path

                    # Add group prefix if group_var is a known group variable
                    if group_var in group_variables:
                        group_prefix = group_variables[group_var]
                        if current_path and not current_path.endswith("/"):
                            current_path += "/"
                        current_path += group_prefix.lstrip("/")
                    else:
                        # Add all group prefixes from stack
                        for group_prefix in group_stack:
                            group_prefix = group_prefix.lstrip("/")
                            if current_path and not current_path.endswith("/"):
                                current_path += "/"
                            current_path += group_prefix

                    # Add route path
                    if current_path and not current_path.endswith("/"):
                        current_path += "/"
                    current_path += route_path.lstrip("/")

                    # Remove duplicate slashes
                    full_path = re.sub(r"/+", "/", current_path)

                    routes.append(
                        RouteInfo(
                            file_path=str(file_path.relative_to(self.backend_dir)),
                            line_number=line_num,
                            method=method,
                            path=route_path,
                            full_path=full_path,
                            handler=actual_handler,  # Use extracted handler
                            feature=feature_name,
                            group_chain=group_stack.copy(),
                        )
                    )
                    break  # Found a method, no need to check others

            # Pop group when we see a closing brace at appropriate indentation
            if stripped == "}" and group_stack:
                # Check indentation - groups usually defined at indent level 4-8
                indent = len(line) - len(line.lstrip())
                if indent <= 8:
                    group_stack.pop()

            i += 1

        return routes

    def infer_controller_type(self, controller_file: Path) -> List[str]:
        """Infer controller type from file name if not explicitly defined. Returns multiple possibilities."""
        stem = controller_file.stem
        possibilities = []

        # Remove _controller suffix
        if stem.endswith("_controller"):
            base = stem[:-10]  # Remove "_controller"

            # Pattern 1: Direct conversion
            # abc_http_controller.go -> AbcHttpController
            parts = base.split("_")
            pascal_case = "".join(p.capitalize() for p in parts)
            controller_type = pascal_case + "Controller"
            possibilities.append(controller_type)

            # Pattern 2: Uppercase "HTTP"
            # abc_http_controller.go -> AbcHTTPController
            # Replace "Http" with "HTTP" in the base parts
            pascal_parts = [
                p.upper() if p.lower() == "http" else p.capitalize() for p in parts
            ]
            pascal_case_http = "".join(pascal_parts)
            controller_type_http = pascal_case_http + "Controller"
            if controller_type_http != controller_type:
                possibilities.append(controller_type_http)

            # Pattern 3: Drop "http" suffix
            # abc_http_controller.go -> AbcController
            parts_no_http = [p for p in parts if p.lower() != "http"]
            if parts_no_http:
                pascal_case_no_http = "".join(p.capitalize() for p in parts_no_http)
                controller_type_no_http = pascal_case_no_http + "Controller"
                possibilities.append(controller_type_no_http)

        return possibilities

    def parse_controller_file(self, controller_file: Path) -> List[Handler]:
        """Parse a controller file to extract handler functions"""
        handlers = []
        feature = self.extract_feature_name(controller_file)
        controller_name = self.extract_controller_name(controller_file)

        try:
            with open(controller_file, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Failed to read {controller_file}: {e}", file=sys.stderr)
            return handlers

        lines = content.split("\n")

        # First, extract the controller type name from the file
        # Pattern: type XXXController struct
        controller_type = ""
        type_pattern = r"type\s+(\w+Controller)\s+struct"
        for line in lines:
            match = re.search(type_pattern, line)
            if match:
                controller_type = match.group(1)
                break

        # Collect all possible controller types
        controller_types = []
        if controller_type:
            controller_types.append(controller_type)
            # Also try variations
            if "HTTP" in controller_type:
                # Add version without HTTP
                controller_types.append(controller_type.replace("HTTP", ""))
            else:
                # Add version with HTTP
                controller_types.append(
                    controller_type.replace("Controller", "HTTPController")
                )
        else:
            # Infer from file name
            controller_types = self.infer_controller_type(controller_file)

        # Pattern to match handler functions (receiver methods)
        # Format: func (r *Controller) MethodName(ctx echo.Context) error
        receiver_pattern = r"func\s+\([^)]+\s+\*?(\w+)\)\s+(\w+)\s*\("

        for line_num, line in enumerate(lines, 1):
            match = re.search(receiver_pattern, line)
            if match:
                receiver = match.group(1)
                handler_name = match.group(2)

                # Only include if it's an echo handler (takes echo.Context)
                if "echo.Context" in line:
                    # Use actual receiver type if it's a Controller
                    actual_controller_types = controller_types.copy()
                    if (
                        receiver.endswith("Controller")
                        and receiver not in actual_controller_types
                    ):
                        # Add actual receiver type
                        actual_controller_types.insert(0, receiver)
                        # Also add variations of the receiver type
                        if "HTTP" in receiver:
                            actual_controller_types.append(receiver.replace("HTTP", ""))
                        else:
                            actual_controller_types.append(
                                receiver.replace("Controller", "HTTPController")
                            )
                        # Also try without Impl suffix (e.g., fleetOptimizationHTTPControllerImpl -> fleetOptimizationHTTPController)
                        if receiver.endswith("Impl"):
                            base_receiver = receiver[:-4]  # Remove "Impl"
                            actual_controller_types.insert(0, base_receiver)
                            if "HTTP" in base_receiver:
                                actual_controller_types.append(
                                    base_receiver.replace("HTTP", "")
                                )
                            else:
                                actual_controller_types.append(
                                    base_receiver.replace(
                                        "Controller", "HTTPController"
                                    )
                                )

                    handler = Handler(
                        controller_file=str(
                            controller_file.relative_to(self.backend_dir)
                        ),
                        feature=feature,
                        controller_name=controller_name,
                        handler_name=handler_name,
                        line_number=line_num,
                        controller_type=actual_controller_types[0]
                        if actual_controller_types
                        else "",
                        controller_types=actual_controller_types,
                    )
                    handlers.append(handler)

        return handlers

        lines = content.split("\n")

        # First, extract the controller type name from the file
        # Pattern: type XXXController struct
        controller_type = ""
        type_pattern = r"type\s+(\w+Controller)\s+struct"
        for line in lines:
            match = re.search(type_pattern, line)
            if match:
                controller_type = match.group(1)
                break

        # Collect all possible controller types
        controller_types = []
        if controller_type:
            controller_types.append(controller_type)
            # Also try variations
            if "HTTP" in controller_type:
                # Add version without HTTP
                controller_types.append(controller_type.replace("HTTP", ""))
            else:
                # Add version with HTTP
                controller_types.append(
                    controller_type.replace("Controller", "HTTPController")
                )
        else:
            # Infer from file name
            controller_types = self.infer_controller_type(controller_file)

        # Pattern to match handler functions (receiver methods)
        # Format: func (r *Controller) MethodName(ctx echo.Context) error
        receiver_pattern = r"func\s+\([^)]+\s+\*?(\w+)\)\s+(\w+)\s*\("

        for line_num, line in enumerate(lines, 1):
            match = re.search(receiver_pattern, line)
            if match:
                receiver = match.group(1)
                handler_name = match.group(2)

                # Only include if it's an echo handler (takes echo.Context)
                if "echo.Context" in line:
                    handler = Handler(
                        controller_file=str(
                            controller_file.relative_to(self.backend_dir)
                        ),
                        feature=feature,
                        controller_name=controller_name,
                        handler_name=handler_name,
                        line_number=line_num,
                        controller_type=controller_types[0] if controller_types else "",
                        controller_types=controller_types,
                    )
                    handlers.append(handler)

        return handlers

    def check_single_letter_variables(self, file_path: Path) -> List[NamingViolation]:
        """
        P0-CRITICAL: Detect single-letter controller variables in route handlers.
        Pattern: c.Method, qc.Method, rc.Method
        """
        violations = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Failed to read {file_path}: {e}", file=sys.stderr)
            return violations

        lines = content.split("\n")

        # Pattern to match single-letter controller variables in routes
        # Matches: group.METHOD("/path", c.Handler) or similar
        single_letter_pattern = r"(\w+)\.(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\([^,]*,\s*([a-z])\.\w+"

        for line_num, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue

            match = re.search(single_letter_pattern, line)
            if match:
                group_var = match.group(1)
                controller_var = match.group(2)

                violations.append(
                    NamingViolation(
                        violation_type="P0-CRITICAL",
                        violation_category="single_letter",
                        file_path=str(file_path.relative_to(self.backend_dir)),
                        line_number=line_num,
                        variable_name=controller_var,
                        description=f"Single-letter controller variable '{controller_var}' detected in route registration",
                        suggested_fix=f"Rename '{controller_var}' to descriptive name (e.g., 'authController', 'dataController')",
                    )
                )

        return violations

    def check_generic_controller(self, file_path: Path) -> List[NamingViolation]:
        """
        P1-HIGH: Detect generic 'controller' variable name in route handlers.
        Pattern: controller.Method
        """
        violations = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Failed to read {file_path}: {e}", file=sys.stderr)
            return violations

        lines = content.split("\n")

        # Pattern to match generic 'controller' variable in routes
        # Matches: group.METHOD("/path", controller.Handler)
        generic_pattern = r"(\w+)\.(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\([^,]*,\s*controller\.\w+"

        for line_num, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue

            match = re.search(generic_pattern, line)
            if match:
                group_var = match.group(1)

                violations.append(
                    NamingViolation(
                        violation_type="P1-HIGH",
                        violation_category="generic_controller",
                        file_path=str(file_path.relative_to(self.backend_dir)),
                        line_number=line_num,
                        variable_name="controller",
                        description="Generic 'controller' variable name detected - lacks specificity",
                        suggested_fix="Rename 'controller' to specific name (e.g., 'authController', 'dataController')",
                    )
                )

        return violations

    def check_abbreviation_consistency(self, file_path: Path) -> List[NamingViolation]:
        """
        P2-MEDIUM: Detect inconsistent abbreviation usage (Ctrl vs Controller).
        """
        violations = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Failed to read {file_path}: {e}", file=sys.stderr)
            return violations

        lines = content.split("\n")

        # Patterns to detect 'Ctrl' abbreviation
        ctrl_pattern = r"(\w+)\.(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\([^,]*,\s*(\w+Ctrl)\.\w+"

        for line_num, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue

            match = re.search(ctrl_pattern, line)
            if match:
                group_var = match.group(1)
                controller_var = match.group(2)

                violations.append(
                    NamingViolation(
                        violation_type="P2-MEDIUM",
                        violation_category="abbreviation",
                        file_path=str(file_path.relative_to(self.backend_dir)),
                        line_number=line_num,
                        variable_name=controller_var,
                        description=f"Inconsistent abbreviation '{controller_var}' detected - should use 'Controller'",
                        suggested_fix=f"Rename '{controller_var}' to use 'Controller' suffix (e.g., '{controller_var.replace('Ctrl', 'Controller')}')",
                    )
                )

        return violations

    def check_snake_case(self, file_path: Path) -> List[NamingViolation]:
        """
        P2-MEDIUM: Detect snake_case in controller variable names.
        """
        violations = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Failed to read {file_path}: {e}", file=sys.stderr)
            return violations

        lines = content.split("\n")

        # Pattern to detect snake_case in controller variables
        # Matches: group.METHOD("/path", snake_case_var.Method) where var ends with Controller
        # This ensures we only match controller variables, not middleware like cors.Handler
        snake_case_pattern = r"(\w+)\.(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\([^,]*,\s*([a-z][a-z0-9]*_[a-z0-9]+(?:Controller|Ctrl))\.\w+"

        for line_num, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue

            match = re.search(snake_case_pattern, line)
            if match:
                group_var = match.group(1)
                # Extract the snake_case variable name
                var_match = re.search(
                    r",\s*([a-z][a-z0-9]*_[a-z0-9]+(?:Controller|Ctrl))\.\w+", line
                )
                if var_match:
                    controller_var = var_match.group(1)

                    violations.append(
                        NamingViolation(
                            violation_type="P2-MEDIUM",
                            violation_category="snake_case",
                            file_path=str(file_path.relative_to(self.backend_dir)),
                            line_number=line_num,
                            variable_name=controller_var,
                            description=f"snake_case variable name '{controller_var}' detected - should use camelCase",
                            suggested_fix=f"Rename '{controller_var}' to camelCase (e.g., '{self._snake_to_camel(controller_var)}')",
                        )
                    )

        return violations

        lines = content.split("\n")

        # Pattern to detect snake_case in controller variables
        # Matches: group.METHOD("/path", snake_case_var.Method)
        snake_case_pattern = r"(\w+)\.(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\([^,]*,\s*[a-z][a-z0-9]*_[a-z0-9]+\.\w+"

        for line_num, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue

            match = re.search(snake_case_pattern, line)
            if match:
                group_var = match.group(1)
                # Extract the snake_case variable name
                var_match = re.search(r",\s*([a-z][a-z0-9]*_[a-z0-9]+)\.\w+", line)
                if var_match:
                    controller_var = var_match.group(1)

                    violations.append(
                        NamingViolation(
                            violation_type="P2-MEDIUM",
                            violation_category="snake_case",
                            file_path=str(file_path.relative_to(self.backend_dir)),
                            line_number=line_num,
                            variable_name=controller_var,
                            description=f"snake_case variable name '{controller_var}' detected - should use camelCase",
                            suggested_fix=f"Rename '{controller_var}' to camelCase (e.g., '{self._snake_to_camel(controller_var)}')",
                        )
                    )

        return violations

    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        parts = snake_str.split("_")
        return parts[0] + "".join(part.capitalize() for part in parts[1:])

    def _pascal_to_camel(self, pascal_str: str) -> str:
        """Convert PascalCase to camelCase, handling acronyms like APIKey -> apiKey."""
        if not pascal_str:
            return pascal_str
        if len(pascal_str) == 1:
            return pascal_str.lower()

        # Find the split point: where the first word ends
        # Pattern: Look for lowercase -> uppercase transition OR uppercase -> uppercase -> lowercase
        # Examples:
        #   APIKey: API|Key (uppercase -> uppercase -> lowercase)
        #   DataUpload: Data|Upload (lowercase -> uppercase)
        #   MapHTTP: Map|HTTP (lowercase -> uppercase)
        split_index = 1  # At least the first character
        found_boundary = False

        for i in range(1, len(pascal_str)):
            # Check if we're at a lowercase -> uppercase transition
            if i > 0 and pascal_str[i - 1].islower() and pascal_str[i].isupper():
                split_index = i
                found_boundary = True
                break

            # Check if we're at an uppercase -> uppercase -> lowercase transition
            # (acronym boundary like API|Key)
            if (
                i > 1
                and pascal_str[i - 2].isupper()
                and pascal_str[i - 1].isupper()
                and pascal_str[i].islower()
            ):
                split_index = i - 1
                found_boundary = True
                break

        # If no boundary found and entire string is uppercase, lowercase it all
        # Example: ODD -> odd, API -> api, HTTP -> http
        if not found_boundary and pascal_str.isupper():
            return pascal_str.lower()

        # Split into first word and rest
        first_word = pascal_str[:split_index]
        rest = pascal_str[split_index:]

        # Lowercase the first word (handles acronyms like API -> api, Data -> data)
        first_word = first_word.lower()

        return first_word + rest

    def analyze_routes(self):
        """Analyze all routes and find duplicates"""
        print("🔍 Analyzing router files...")
        router_files = self.find_router_files()

        print(f"   Found {len(router_files)} router files")

        for router_file in router_files:
            file_routes = self.parse_router_file(router_file)
            self.routes.extend(file_routes)

        print(f"   Total routes found: {len(self.routes)}")

        # Find duplicates
        print("\n🔎 Checking for duplicates...")
        route_key_map: Dict[str, List[RouteInfo]] = defaultdict(list)

        for route in self.routes:
            # Key = method + full_path (this catches true duplicates)
            key = f"{route.method} {route.full_path}"
            route_key_map[key].append(route)

        # Separate duplicates and false positives
        for key, route_list in route_key_map.items():
            if len(route_list) > 1:
                # Check if these are truly duplicates
                same_file = all(
                    r.file_path == route_list[0].file_path for r in route_list
                )
                same_handler = all(
                    r.handler == route_list[0].handler for r in route_list
                )
                same_full_path = all(
                    r.full_path == route_list[0].full_path for r in route_list
                )

                if same_file and same_handler:
                    # True duplicate in same file with same handler
                    self.duplicates[key] = route_list
                elif same_full_path:
                    # Different files/handlers with same full path - possible real issue
                    self.duplicates[key] = route_list
                # Different full paths = NOT duplicates, ignore

    def normalize_controller_name(self, controller_var: str) -> str:
        """Normalize controller variable name to match controller type"""
        # Remove common prefixes/suffixes and convert to lowercase for comparison
        # Also handle router.field.controller.field -> controller.field pattern
        # Example: router.platoonController.GetMetrics -> platoonController.GetMetrics
        # versionedRouterBuilder.applyVersionedRBAC(...) -> oddController.GetODD
        # b.ApplyMiddleware(...) -> controller.Method(...)
        normalized = controller_var.lower()

        # Check for struct.field before actual controller pattern
        if "." in normalized:
            parts = normalized.split(".")

            # Pattern 1: router.X.controller.field -> X.controller.field
            # Use regex to remove struct wrapper prefixes (router, builder, versioned)
            # Match: (router|builder|versioned) at word boundary followed by "."
            import re

            pattern = r"\b(router|builder|versioned)\.+\."
            for i, part in enumerate(parts):
                match = re.search(pattern, part + ".")
                if match:
                    # Found struct wrapper before actual controller
                    # Remove the wrapper part including the dot (e.g., remove "router.")
                    part_without_wrapper = re.sub(pattern, "", part + ".")

                    normalized = ".".join([part_without_wrapper] + parts[i + 1 :])
                    break

            # Pattern 2: ApplyMiddleware(...) -> ApplyMiddleware(...)
            # Check for method pattern at the end
            for part in parts:
                if part.startswith(("apply", "handle")):
                    # Remove method name from the end
                    method_parts = part.split("(")
                    if len(method_parts) > 1:
                        # Extract just the function name
                        method_name = method_parts[0]
                        # Find index of this method part
                        method_idx = parts.index(part)
                        # Keep everything up to this method (removes the method call)
                        normalized = ".".join(parts[:method_idx])
                        break

        # Remove trailing "controller" if present (should not be needed after above)
        if normalized.endswith("controller"):
            normalized = normalized[:-10]

        return normalized

    def get_possible_controller_keys(self, handler: Handler) -> List[str]:
        """Generate all possible keys for a handler based on controller type and file name"""
        keys = []
        feature = handler.feature
        handler_name = handler.handler_name

        # Key 1: Using controller_name from file name (original behavior)
        keys.append(f"{feature}.{handler.controller_name}.{handler_name}")

        # Key 2-4: Using all possible controller_types
        for controller_type in handler.controller_types:
            keys.append(f"{feature}.{controller_type}.{handler_name}")

            # Router variable name pattern (camelCase with capital C)
            # Pattern: AlertHTTPController -> alertController
            type_name = controller_type

            # Drop "HTTP" suffix if present (e.g., AlertHTTPController -> AlertController)
            if "HTTP" in type_name:
                type_name = type_name.replace("HTTP", "")

            # Now convert to camelCase variable name
            if type_name.endswith("Controller"):
                # Remove "Controller" suffix
                base_name = type_name[:-10]  # Remove "Controller"
                if base_name:
                    # Proper PascalCase to camelCase conversion
                    # Handles acronyms like API -> api, HTTP -> http
                    camel_case_base = self._pascal_to_camel(base_name)
                    # Add "Controller" suffix (capital C, camelCase)
                    camel_case_var = camel_case_base + "Controller"
                    keys.append(f"{feature}.{camel_case_var}.{handler_name}")

                    # Also try lowercase "controller" for consistency
                    keys.append(
                        f"{feature}.{camel_case_base.lower()}controller.{handler_name}"
                    )

                    # Pattern 4: Simplified variable name (dropping common prefixes)
                    # e.g., DataUploadController -> uploadController
                    # Drop common prefixes like "Data", "Api", "Auth", "User"
                    common_prefixes = ["Data", "API", "Auth", "User", "Admin", "Config"]
                    for prefix in common_prefixes:
                        if base_name.startswith(prefix):
                            simplified_base = base_name[len(prefix) :]
                            if simplified_base:
                                # First letter lowercase
                                simplified_var = (
                                    simplified_base[0].lower() + simplified_base[1:]
                                )
                                simplified_var += "Controller"
                                keys.append(
                                    f"{feature}.{simplified_var}.{handler_name}"
                                )
                            break

                    # Pattern 5: Use only the middle word if it's descriptive
                    # e.g., DataUploadController -> uploadController
                    parts = []
                    current = ""
                    for char in base_name:
                        if char.isupper() and current:
                            parts.append(current)
                            current = char
                        else:
                            current += char
                    if current:
                        parts.append(current)

                    if len(parts) >= 2:
                        # Use the middle part (e.g., "Upload" from "DataUpload")
                        middle_part = parts[len(parts) // 2]
                        if len(middle_part) > 2:  # Only if it's meaningful
                            simplified_var = (
                                middle_part[0].lower() + middle_part[1:] + "Controller"
                            )
                            keys.append(f"{feature}.{simplified_var}.{handler_name}")

        return keys

    def analyze_handlers(self):
        """Analyze handlers and find mismatches"""
        print("\n🔍 Analyzing controller files...")
        controller_files = self.find_controller_files()

        print(f"   Found {len(controller_files)} controller files")

        for controller_file in controller_files:
            file_handlers = self.parse_controller_file(controller_file)
            for handler in file_handlers:
                # Store multiple keys for each handler to handle different naming conventions
                keys = self.get_possible_controller_keys(handler)
                for key in keys:
                    self.handlers[key] = handler

        print(f"   Total handlers found: {len(self.handlers)}")

        # Find unregistered handlers
        registered_handlers = set()
        for route in self.routes:
            # Extract handler name from route
            # Format: controller.Method
            handler_match = re.search(r"(\w+)\.(\w+)", route.handler)
            if handler_match:
                controller_name = handler_match.group(1)
                handler_name = handler_match.group(2)
                registered_handlers.add(
                    f"{route.feature}.{controller_name}.{handler_name}"
                )

        for key, handler in self.handlers.items():
            if key not in registered_handlers:
                # Skip common non-http handlers like GetHub
                if not handler.handler_name.startswith(
                    "Get"
                ) or handler.handler_name in ["GetHub"]:
                    self.unregistered_handlers.append(handler)

        # Find routes with missing handlers
        for route in self.routes:
            handler_match = re.search(r"(\w+)\.(\w+)", route.handler)
            if handler_match:
                controller_name = handler_match.group(1)
                handler_name = handler_match.group(2)
                key = f"{route.feature}.{controller_name}.{handler_name}"

                if key not in self.handlers:
                    self.missing_handler_routes.append((route, [key]))

    def analyze_naming_violations(self):
        """Analyze naming violations in router files"""
        print("\n🔍 Checking naming violations...")
        router_files = self.find_router_files()

        print(f"   Scanning {len(router_files)} router files for violations...")

        for router_file in router_files:
            # Run all naming violation checks
            violations = []

            violations.extend(self.check_single_letter_variables(router_file))
            violations.extend(self.check_generic_controller(router_file))
            violations.extend(self.check_abbreviation_consistency(router_file))
            violations.extend(self.check_snake_case(router_file))

            self.naming_violations.extend(violations)

        # Count violations by type
        violation_counts = {}
        for v in self.naming_violations:
            key = f"{v.violation_type}-{v.violation_category}"
            violation_counts[key] = violation_counts.get(key, 0) + 1

        if violation_counts:
            print(f"   Found {len(self.naming_violations)} naming violations:")
            for key, count in sorted(violation_counts.items()):
                print(f"      - {key}: {count}")
        else:
            print("   ✅ No naming violations found")

    def analyze(self):
        """Run complete analysis"""
        self.analyze_routes()
        self.analyze_handlers()
        self.analyze_naming_violations()

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive report"""
        report = {
            "summary": {
                "total_routes": len(self.routes),
                "total_handlers": len(self.handlers),
                "total_duplicates": len(self.duplicates),
                "unregistered_handlers": len(self.unregistered_handlers),
                "missing_handler_routes": len(self.missing_handler_routes),
                "naming_violations": len(self.naming_violations),
                "router_files_analyzed": len(self.find_router_files()),
                "controller_files_analyzed": len(self.find_controller_files()),
            },
            "duplicates": {},
            "unregistered_handlers": [],
            "missing_handler_routes": [],
            "naming_violations": [],
            "all_routes": [],
            "handlers_by_feature": {},
        }

        # Add duplicate details
        for key, route_list in self.duplicates.items():
            report["duplicates"][key] = [
                {
                    "file": r.file_path,
                    "line": r.line_number,
                    "method": r.method,
                    "path": r.path,
                    "full_path": r.full_path,
                    "handler": r.handler,
                    "feature": r.feature,
                    "group_chain": r.group_chain,
                }
                for r in route_list
            ]

        # Add unregistered handlers
        for handler in self.unregistered_handlers:
            report["unregistered_handlers"].append(
                {
                    "file": handler.controller_file,
                    "line": handler.line_number,
                    "feature": handler.feature,
                    "controller": handler.controller_name,
                    "handler": handler.handler_name,
                }
            )

        # Add missing handler routes
        for route, missing in self.missing_handler_routes:
            report["missing_handler_routes"].append(
                {
                    "file": route.file_path,
                    "line": route.line_number,
                    "method": route.method,
                    "path": route.path,
                    "full_path": route.full_path,
                    "handler": route.handler,
                    "feature": route.feature,
                    "missing_handlers": missing,
                }
            )

        # Add naming violations
        for violation in self.naming_violations:
            report["naming_violations"].append(
                {
                    "type": violation.violation_type,
                    "category": violation.violation_category,
                    "file": violation.file_path,
                    "line": violation.line_number,
                    "variable": violation.variable_name,
                    "description": violation.description,
                    "suggested_fix": violation.suggested_fix,
                }
            )

        # Add all routes (for debugging)
        report["all_routes"] = [
            {
                "file": r.file_path,
                "line": r.line_number,
                "method": r.method,
                "path": r.path,
                "full_path": r.full_path,
                "handler": r.handler,
                "feature": r.feature,
            }
            for r in self.routes
        ]

        # Group handlers by feature
        handlers_by_feature = defaultdict(list)
        for key, handler in self.handlers.items():
            handlers_by_feature[handler.feature].append(handler)

        for feature in sorted(handlers_by_feature.keys()):
            handlers = handlers_by_feature[feature]
            report["handlers_by_feature"][feature] = [
                {
                    "controller": h.controller_name,
                    "handler": h.handler_name,
                    "file": h.controller_file,
                    "line": h.line_number,
                }
                for h in handlers
            ]

        return report

    def print_report(self, report: Dict[str, Any]) -> int:
        """Print formatted report to console"""
        summary = report["summary"]

        print("\n" + "=" * 70)
        print("ROUTE VALIDATION REPORT")
        print("=" * 70)

        print(f"\n📊 Summary:")
        print(f"   Total Routes: {summary['total_routes']}")
        print(f"   Total Handlers: {summary['total_handlers']}")
        print(f"   Router Files: {summary['router_files_analyzed']}")
        print(f"   Controller Files: {summary['controller_files_analyzed']}")
        print(f"   Duplicates: {summary['total_duplicates']}")
        print(f"   Unregistered Handlers: {summary['unregistered_handlers']}")
        print(f"   Routes with Missing Handlers: {summary['missing_handler_routes']}")
        print(f"   Naming Violations: {summary['naming_violations']}")

        # Critical issues (include P0-CRITICAL naming violations)
        p0_violations = sum(
            1 for v in report["naming_violations"] if v["type"] == "P0-CRITICAL"
        )
        critical_issues = (
            summary["total_duplicates"]
            + summary["missing_handler_routes"]
            + p0_violations
        )

        print("\n" + "-" * 70)
        print("CRITICAL ISSUES")
        print("-" * 70)

        if critical_issues == 0:
            print("\n✅ No critical issues found!")
        else:
            if summary["total_duplicates"] > 0:
                print(f"\n⚠️  Found {summary['total_duplicates']} duplicate route(s):\n")

                for i, (key, routes) in enumerate(report["duplicates"].items(), 1):
                    print(f"{i}. {key}")
                    for route in routes:
                        print(f"   - {route['file']}:{route['line']}")
                        print(f"     Handler: {route['handler']}")
                        print(f"     Full Path: {route['full_path']}")
                    print()

            if summary["missing_handler_routes"] > 0:
                print(
                    f"\n⚠️  Found {summary['missing_handler_routes']} route(s) with missing handlers:\n"
                )

                for i, route_info in enumerate(
                    report["missing_handler_routes"][:10], 1
                ):
                    print(f"{i}. {route_info['method']} {route_info['full_path']}")
                    print(f"   - {route_info['file']}:{route_info['line']}")
                    print(f"     Handler: {route_info['handler']}")
                    print(f"     Missing: {', '.join(route_info['missing_handlers'])}")
                    print()

                if summary["missing_handler_routes"] > 10:
                    print(f"... and {summary['missing_handler_routes'] - 10} more")

        # Warnings
        print("\n" + "-" * 70)
        print("WARNINGS")
        print("-" * 70)

        if summary["unregistered_handlers"] > 0:
            print(
                f"\nℹ️  Found {summary['unregistered_handlers']} potentially unregistered handler(s)"
            )
            print("   (These may be helper methods or intentionally not registered)")

        # Naming violations
        print("\n" + "-" * 70)
        print("NAMING VIOLATIONS")
        print("-" * 70)

        if summary["naming_violations"] == 0:
            print("\n✅ No naming violations found!")
        else:
            # Group violations by type
            violations_by_type = defaultdict(list)
            for violation in report["naming_violations"]:
                violations_by_type[violation["type"]].append(violation)

            for violation_type in ["P0-CRITICAL", "P1-HIGH", "P2-MEDIUM"]:
                if violation_type in violations_by_type:
                    violations = violations_by_type[violation_type]
                    print(f"\n🔴 {violation_type}: {len(violations)} violation(s)\n")

                    for i, violation in enumerate(violations[:10], 1):
                        print(f"{i}. {violation['category']}: {violation['variable']}")
                        print(f"   - {violation['file']}:{violation['line']}")
                        print(f"   Description: {violation['description']}")
                        print(f"   Fix: {violation['suggested_fix']}")
                        print()

                    if len(violations) > 10:
                        print(
                            f"... and {len(violations) - 10} more {violation_type} violations"
                        )

        # Handlers by feature
        print("\n" + "-" * 70)
        print("HANDLERS BY FEATURE")
        print("-" * 70)

        for feature in sorted(report["handlers_by_feature"].keys()):
            handlers = report["handlers_by_feature"][feature]
            print(f"\n📦 {feature}: {len(handlers)} handlers")

            for handler in handlers[:5]:  # Show first 5
                print(f"   - {handler['controller']}.{handler['handler']}")

            if len(handlers) > 5:
                print(f"   ... and {len(handlers) - 5} more")

        print("\n" + "=" * 70)

        # Status
        if critical_issues == 0:
            print("\n✅ PASS: No critical issues found")
            return 0
        else:
            print(f"\n❌ FAIL: Found {critical_issues} critical issue(s)")
            return 1


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Validate Echo router routes for duplicates and handler mismatches",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Run validation
    python validate_route_controller_mismatch.py

    # Save report to JSON
    python validate_route_controller_mismatch.py --output report.json

    # Verbose output
    python validate_route_controller_mismatch.py --verbose

    # Specify custom backend directory
    python validate_route_controller_mismatch.py --backend-dir /path/to/backend
        """,
    )

    parser.add_argument(
        "--backend-dir",
        default=None,
        help="Path to backend directory (default: auto-detect)",
    )
    parser.add_argument("--output", help="Output JSON file path (optional)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")

    args = parser.parse_args()

    validator = RouteValidator(backend_dir=args.backend_dir)
    validator.analyze()
    exit_code = validator.print_report(validator.generate_report())

    # Save to JSON if requested
    if args.output:
        report = validator.generate_report()
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            print(f"\n💾 Report saved to {args.output}")
        except Exception as e:
            print(f"⚠️  Failed to save report: {e}", file=sys.stderr)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
