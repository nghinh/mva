# Architecture Reference

## Architectural Intent
The default architecture is feature-based clean architecture. Organize code by feature first, then by layer.

```text
features/<feature_name>/
├── models/
├── services/
├── repositories/
├── adapters/
├── controllers/
└── routers/
```

## Layer Responsibilities
- `models/`: domain entities, DTOs, contracts, typed errors, constants
- `services/`: business logic and orchestration
- `repositories/`: persistence access and query logic
- `adapters/`: external system wrappers and third-party integrations
- `controllers/`: transport handlers and request/response mapping
- `routers/`: route registration and module wiring helpers

## Core Rules

### Interface-first and DI
- Depend on interfaces where boundaries matter.
- Prefer constructor injection.
- Avoid global mutable business state.
- Keep dependency wiring centralized if the repo already uses a wiring entry point.

### Feature package naming
Inside one feature, subfolders use the feature package name, not the folder name.

Example:
```go
// features/ssc/models/user.go
package ssc

// features/ssc/services/auth_service.go
package ssc
```

### Import aliasing
When importing sibling layers, alias imports using `<feature>_<layer>`.

Example:
```go
import (
    ssc_models "github.com/<module>/features/ssc/models"
    ssc_repos  "github.com/<module>/features/ssc/repositories"
)
```

Use explicit aliases proactively. Do not wait for compiler errors.

### Folder preservation
Do not delete or flatten architectural folders just because they are empty or to fix import issues.

Forbidden patterns:
- moving `models/*.go` into the feature root to avoid aliasing
- renaming packages to match folder names when the feature package convention is already established
- bypassing repositories by putting persistence logic directly into controllers

### Multi-tenancy
Where the domain is multi-tenant:
- propagate tenant-aware context to repositories and caches
- do not mix cross-tenant cache keys or data access
- include tenant information in validation, persistence, and logging where appropriate

### Adapters
Wrap external drivers and SDKs inside adapters where doing so preserves testability and keeps service logic clean.

### Boundary validation
Validate external inputs at the transport/controller boundary. Keep business validation in services when it belongs to domain rules rather than transport parsing.

## When to Refactor
Refactor when:
- a service file becomes a monolith
- controllers accumulate domain logic
- repositories leak transport concerns
- adapters start encoding business decisions

Preferred split examples:
- `workflow_service.go`
- `workflow_validation.go`
- `workflow_execution.go`
- `workflow_persistence.go`
- `workflow_notifications.go`

## Decision Heuristics
- Small safe change first
- Preserve repository conventions over generic preferences
- Only introduce new layers or abstractions when they solve an actual boundary or lifecycle problem

