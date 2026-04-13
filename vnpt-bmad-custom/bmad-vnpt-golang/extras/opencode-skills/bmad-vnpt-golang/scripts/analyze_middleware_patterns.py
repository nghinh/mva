#!/usr/bin/env python3
"""
Analyze Middleware Patterns

Analyzes Echo middleware implementations for best practices.
Checks for proper error handling, context propagation, logging, and performance.

Usage:
    python analyze_middleware_patterns.py --path <feature_path>

Checks:
    - Proper next() calling
    - Error handling with context
    - Request/Response logging
    - Performance timing
    - Context value injection
    - Recovery from panics

Author: Expert Go Backend Developer Skill
"""

import argparse
import os
import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


class Severity(Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class MiddlewareIssue:
    file_path: str
    line_number: int
    middleware_name: str
    category: str
    description: str
    severity: Severity
    suggestion: str


# Middleware best practices patterns
MIDDLEWARE_PATTERNS = {
    # Anti-patterns
    "anti_patterns": [
        {
            "pattern": r"func\s*\([^)]*\)\s*\([^)]*\)\s*\{[^}]*return\s+next\([^)]*\)[^}]*\}",
            "category": "Control Flow",
            "description": "Middleware returns immediately without handling next() error",
            "severity": Severity.CRITICAL,
            "suggestion": "Check error from next(): if err := next(c); err != nil { return err }"
        },
        {
            "pattern": r"next\s*:=\s*[^;]+;\s*return\s+nil",
            "category": "Error Handling",
            "description": "Middleware ignores error from next handler",
            "severity": Severity.CRITICAL,
            "suggestion": "Propagate error: if err := next(c); err != nil { return err }"
        },
        {
            "pattern": r"panic\s*\([^)]*\)",
            "category": "Recovery",
            "description": "Panic in middleware without recovery",
            "severity": Severity.WARNING,
            "suggestion": "Use recover() middleware or return error instead"
        },
        {
            "pattern": r"c\.Set\([^)]+\)\s*;\s*[^c]*next\(",
            "category": "Context Safety",
            "description": "Context value set without checking existence",
            "severity": Severity.INFO,
            "suggestion": "Check if key exists: if c.Get(key) == nil { c.Set(key, value) }"
        },
        {
            "pattern": r"time\.Sleep\s*\(",
            "category": "Performance",
            "description": "Blocking sleep in middleware",
            "severity": Severity.WARNING,
            "suggestion": "Use context timeout instead of sleep"
        },
        {
            "pattern": r"fmt\.Printf|fmt\.Println|log\.Print",
            "category": "Logging",
            "description": "Using standard print/log instead of structured logging",
            "severity": Severity.WARNING,
            "suggestion": "Use utils/logging for structured logging"
        },
        {
            "pattern": r"c\.Request\(\)\.(?:Body|Header)\s*(?:\n|;)",
            "category": "Body Handling",
            "description": "Reading request body without restoring",
            "severity": Severity.WARNING,
            "suggestion": "Restore body for downstream handlers if reading"
        },
        {
            "pattern": r"context\.Background\(\)",
            "category": "Context Propagation",
            "description": "Using context.Background() in middleware",
            "severity": Severity.WARNING,
            "suggestion": "Use c.Request().Context() for request context"
        },
    ],

    # Required patterns for good middleware
    "required_patterns": [
        {
            "pattern": r"defer\s+func\([^)]*\)\s*\{[^}]*recover\s*\(",
            "name": "Recovery",
            "description": "Recovery middleware should have defer/recover"
        },
        {
            "pattern": r"c\.Request\(\)\.WithContext\s*\(",
            "name": "Context Update",
            "description": "Middleware updating request context should use WithContext"
        },
        {
            "pattern": r"start\s*:?=\s*time\.Now\(\)",
            "name": "Timing",
            "description": "Logging middleware should track request duration"
        },
        {
            "pattern": r"requestID|request_id|RequestID",
            "name": "Request ID",
            "description": "Middleware should set/propagate request ID"
        },
    ]
}

# Common middleware implementations
MIDDLEWARE_TEMPLATES = {
    "logging": '''func LoggingMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        start := time.Now()

        // Generate request ID
        requestID := c.Request().Header.Get("X-Request-ID")
        if requestID == "" {
            requestID = uuid.New().String()
        }
        c.Set("request_id", requestID)
        c.Response().Header().Set("X-Request-ID", requestID)

        // Log request
        logger.Info("Request started",
            "method", c.Request().Method,
            "path", c.Request().URL.Path,
            "request_id", requestID,
            "tenant_id", c.Get("tenant_id"),
        )

        // Call next handler
        err := next(c)
        if err != nil {
            c.Error(err)
        }

        // Log response
        logger.Info("Request completed",
            "method", c.Request().Method,
            "path", c.Request().URL.Path,
            "status", c.Response().Status,
            "duration", time.Since(start).String(),
            "request_id", requestID,
        )

        return nil
    }
}
''',

    "recovery": '''func RecoveryMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        defer func() {
            if r := recover(); r != nil {
                err, ok := r.(error)
                if !ok {
                    err = fmt.Errorf("panic: %v", r)
                }

                logger.Error("Panic recovered",
                    "error", err,
                    "path", c.Request().URL.Path,
                    "method", c.Request().Method,
                    "stack", string(debug.Stack()),
                )

                c.JSON(http.StatusInternalServerError, map[string]string{
                    "error": "Internal server error",
                })
            }
        }()
        return next(c)
    }
}
''',

    "auth": '''func AuthMiddleware(jwtSecret string) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            authHeader := c.Request().Header.Get("Authorization")
            if authHeader == "" {
                return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
            }

            tokenString := strings.TrimPrefix(authHeader, "Bearer ")
            if tokenString == authHeader {
                return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization format")
            }

            claims, err := validateJWT(tokenString, jwtSecret)
            if err != nil {
                return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
            }

            // Set context values
            c.Set("user_id", claims.UserID)
            c.Set("tenant_id", claims.TenantID)
            c.Set("roles", claims.Roles)

            // Update request context
            ctx := context.WithValue(c.Request().Context(), "user_id", claims.UserID)
            c.SetRequest(c.Request().WithContext(ctx))

            return next(c)
        }
    }
}
''',

    "tenant": '''func TenantMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        tenantID := c.Request().Header.Get("X-Tenant-ID")
        if tenantID == "" {
            // Try to get from JWT claims
            if claims, ok := c.Get("claims").(*Claims); ok {
                tenantID = claims.TenantID
            }
        }

        if tenantID == "" {
            return echo.NewHTTPError(http.StatusBadRequest, "tenant ID required")
        }

        c.Set("tenant_id", tenantID)

        // Update request context
        ctx := context.WithValue(c.Request().Context(), "tenant_id", tenantID)
        c.SetRequest(c.Request().WithContext(ctx))

        return next(c)
    }
}
''',

    "ratelimit": '''func RateLimitMiddleware(rps int, burst int) echo.MiddlewareFunc {
    limiter := make(map[string]*rate.Limiter)
    mu := sync.RWMutex{}

    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            key := c.RealIP()

            mu.RLock()
            limiter, exists := limiter[key]
            mu.RUnlock()

            if !exists {
                limiter = rate.NewLimiter(rate.Limit(rps), burst)
                mu.Lock()
                limiter[key] = limiter
                mu.Unlock()
            }

            if !limiter.Allow() {
                return echo.NewHTTPError(http.StatusTooManyRequests, "rate limit exceeded")
            }

            return next(c)
        }
    }
}
''',

    "cors": '''func CORSMiddleware(allowedOrigins []string) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            origin := c.Request().Header.Get("Origin")

            // Check if origin is allowed
            allowed := false
            for _, o := range allowedOrigins {
                if o == "*" || o == origin {
                    allowed = true
                    break
                }
            }

            if allowed {
                c.Response().Header().Set("Access-Control-Allow-Origin", origin)
                c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")
                c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
            }

            // Handle preflight
            if c.Request().Method == "OPTIONS" {
                return c.NoContent(http.StatusNoContent)
            }

            return next(c)
        }
    }
}
''',
}


def analyze_file(file_path: Path) -> list[MiddlewareIssue]:
    """Analyze a single Go file for middleware patterns."""
    issues = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)
        return issues

    # Check if file contains middleware
    if not re.search(r'(?:Middleware|middleware|func\s*\([^)]*echo\.Context)', content):
        return issues

    # Extract middleware names
    middleware_pattern = re.compile(r'func\s+(\w+Middleware)\s*\(')
    middleware_names = [m.group(1) for m in middleware_pattern.finditer(content)]

    # Check anti-patterns
    for pattern_def in MIDDLEWARE_PATTERNS["anti_patterns"]:
        pattern = pattern_def["pattern"]
        regex = re.compile(pattern, re.DOTALL)

        for match in regex.finditer(content):
            line_num = content[:match.start()].count('\n') + 1

            # Find which middleware this belongs to
            middleware_name = "unknown"
            for name in middleware_names:
                name_pattern = re.compile(rf'func\s+{name}\s*\([^}}]*\}}')
                name_match = name_pattern.search(content)
                if name_match and name_match.start() < match.start():
                    middleware_name = name

            issues.append(MiddlewareIssue(
                file_path=str(file_path),
                line_number=line_num,
                middleware_name=middleware_name,
                category=pattern_def["category"],
                description=pattern_def["description"],
                severity=pattern_def["severity"],
                suggestion=pattern_def["suggestion"]
            ))

    return issues


def check_required_patterns(directory: Path) -> list[dict]:
    """Check for required patterns in middleware."""
    found = {p["name"]: False for p in MIDDLEWARE_PATTERNS["required_patterns"]}

    for file_path in directory.rglob('*.go'):
        if '_test.' in str(file_path):
            continue
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            for pattern_def in MIDDLEWARE_PATTERNS["required_patterns"]:
                if re.search(pattern_def["pattern"], content):
                    found[pattern_def["name"]] = True
        except Exception:
            pass

    return [{"name": k, "found": v, "description": next(
        (p["description"] for p in MIDDLEWARE_PATTERNS["required_patterns"] if p["name"] == k), ""
    )} for k, v in found.items()]


def analyze_directory(directory: Path) -> list[MiddlewareIssue]:
    """Analyze all Go files in a directory."""
    all_issues = []

    for file_path in directory.rglob('*.go'):
        if '_test.' in str(file_path) or 'vendor/' in str(file_path):
            continue
        issues = analyze_file(file_path)
        all_issues.extend(issues)

    return all_issues


def generate_report(issues: list[MiddlewareIssue], required: list[dict]) -> str:
    """Generate a middleware analysis report."""
    lines = ["# Middleware Pattern Analysis Report\n"]

    # Summary
    critical = len([i for i in issues if i.severity == Severity.CRITICAL])
    warning = len([i for i in issues if i.severity == Severity.WARNING])
    info = len([i for i in issues if i.severity == Severity.INFO])

    lines.append("## Summary\n")
    lines.append(f"| Severity | Count |")
    lines.append(f"|----------|-------|")
    lines.append(f"| 🔴 Critical | {critical} |")
    lines.append(f"| 🟡 Warning | {warning} |")
    lines.append(f"| 🔵 Info | {info} |")

    if critical > 0:
        lines.append(f"\n⛔ **{critical} CRITICAL issues found**")

    # Required patterns check
    lines.append("\n## Required Patterns Check\n")
    lines.append("| Pattern | Status | Description |")
    lines.append("|---------|--------|-------------|")
    for r in required:
        status = "✅" if r["found"] else "❌"
        lines.append(f"| {r['name']} | {status} | {r['description']} |")

    # Issues by middleware
    if issues:
        lines.append("\n## Issues by Middleware\n")

        by_middleware = {}
        for issue in issues:
            if issue.middleware_name not in by_middleware:
                by_middleware[issue.middleware_name] = []
            by_middleware[issue.middleware_name].append(issue)

        for mw_name, mw_issues in sorted(by_middleware.items()):
            lines.append(f"\n### {mw_name}\n")
            for issue in mw_issues:
                severity_emoji = {"CRITICAL": "🔴", "WARNING": "🟡", "INFO": "🔵"}
                emoji = severity_emoji.get(issue.severity.value, "")
                lines.append(f"- {emoji} **{issue.file_path}:{issue.line_number}**")
                lines.append(f"  - Category: {issue.category}")
                lines.append(f"  - {issue.description}")
                lines.append(f"  - 💡 {issue.suggestion}")

    # Best practice templates
    lines.append("\n## Middleware Best Practice Templates\n")
    lines.append("Common middleware implementations are available in the skill.\n")
    lines.append("| Middleware | Purpose |")
    lines.append("|------------|---------|")
    for name in MIDDLEWARE_TEMPLATES.keys():
        lines.append(f"| {name} | See template in analyze_middleware_patterns.py |")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Analyze middleware patterns for best practices'
    )
    parser.add_argument(
        '--path',
        required=True,
        help='Path to the feature directory'
    )
    parser.add_argument(
        '--output',
        help='Output file for report (default: stdout)'
    )
    parser.add_argument(
        '--show-template',
        choices=list(MIDDLEWARE_TEMPLATES.keys()),
        help='Show a specific middleware template'
    )

    args = parser.parse_args()

    if args.show_template:
        print(f"\n# {args.show_template.title()} Middleware Template\n")
        print(MIDDLEWARE_TEMPLATES[args.show_template])
        return

    path = Path(args.path)
    if not path.exists():
        print(f"Error: Path does not exist: {path}", file=sys.stderr)
        sys.exit(1)

    # Analyze
    if path.is_file():
        issues = analyze_file(path)
        required = []
    else:
        issues = analyze_directory(path)
        required = check_required_patterns(path)

    # Generate report
    report = generate_report(issues, required)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"Report written to {args.output}")
    else:
        print(report)

    # Exit code
    critical_count = len([i for i in issues if i.severity == Severity.CRITICAL])
    if critical_count > 0:
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
