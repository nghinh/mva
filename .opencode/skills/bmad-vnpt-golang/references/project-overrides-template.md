# Project Overrides Template

Use this file as a template for repo-specific conventions. Do not hardcode these assumptions into the core skill unless they are truly universal across your repositories.

## Example override sections

### Module path
- Go module path:

### Logger
- Preferred logger package:
- Structured field format:
- Disallowed logging patterns:

### Wiring entry points
- Main DI / router wiring file(s):
- Module registration pattern:

### Skeletons / generators
- Preferred skeleton path:
- Feature generator conventions:

### Stack constraints
- Go version:
- HTTP framework:
- Database drivers:
- Messaging stack:
- Cache stack:

### Multi-tenancy rules
- How tenant ID is propagated:
- Required tenant keys / middleware:
- Cache key conventions:

### Repository-specific thresholds
- Maximum file/function size if stricter than default:
- Required validation scripts:
- Build/test commands:

## Example
```text
Logger package: <project-root>/utils/logging
Wiring file: routers/constant.go
Skeleton path: .opencode/skills/bmad-vnpt-golang/skeleton
Framework: Echo v4
```

