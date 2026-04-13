# Senior Go Backend Skeleton

This folder contains a reference implementation (skeleton) of a feature module following the **Senior Go Backend Developer** skill guidelines.

## Directory Structure

```
features/example_feature/
├── models/         # Domain entities & Custom Errors (Pure Go)
├── repositories/   # Storage interfaces & Implementations (MongoDB/Postgres)
├── services/       # Business Logic (Interface & Implementation)
├── controllers/    # HTTP Handlers (Echo Framework)
├── adapters/       # External Service Wrappers
└── routers/        # Route Definitions
```

## How to use

1.  **Copy**: Copy the `features/example_feature` folder to `features/<your_new_feature>`.
2.  **Rename**: Rename files and packages to match your feature name.
3.  **Implement**:
    *   Define your data structs in `models/`.
    *   Define `Service` and `Repository` interfaces first.
    *   Implement Repository (e.g., `mongo_repository.go`).
    *   Implement Service logic (e.g., `service_impl.go`).
    *   Implement Controller handlers (`http_controller.go`).
    *   Register routes in `routers/router.go`.
4.  **Wire**: Go to your application's central wiring file (e.g., `routers/constant.go`) to initialize and inject dependencies.

## Key Principles Demonstrated

*   **Interface-First**: Services depend on `Repository` interface, Controllers depend on `Service` interface.
*   **Context Propagation**: `context.Context` is passed from Controller -> Service -> Repository.
*   **Error Wrapping**: Used `fmt.Errorf("%w", err)` for tracing.
*   **No Global State**: All dependencies are injected via `New...` constructors.
