# Router and Controller Conventions

Open this reference for route registration, controller construction, and router organization work.

## Controller Variable Naming
Use descriptive variable names.

Preferred:
```go
benchmarkController := hml_controllers.NewBenchmarkController(...)
apiKeyController := dpe_controllers.NewAPIKeyController(...)
```

Avoid:
```go
controller := ...
c := ...
qc := ...
```

## Naming Rules
- Use camelCase for variables.
- Prefer full descriptive names.
- If a repo consistently uses `Ctrl`, follow the repo-wide convention. Do not mix styles within the same router file.
- Controller variable name should reveal the domain/resource it handles.

## Route Organization
Preferred:
- dedicated router files per resource or subdomain
- small registration functions
- consistent middleware wrapping

Example:
```go
func RegisterMFARoutes(v1 *echo.Group, authController *ssc_controllers.AuthHTTPController, rbac *ssc_middleware.RBACMiddleware) {
    v1.POST("/auth/mfa/enable", authController.EnableMFA, applyRBAC(...))
    v1.POST("/auth/mfa/disable", authController.DisableMFA, applyRBAC(...))
}
```

## Handler Standards
- Pull request context from `ctx.Request().Context()`.
- Validate bind errors.
- Validate required path/query/body fields.
- Delegate business logic to services.
- Keep controllers thin.

## Middleware Wrapping
Middleware wrapper helpers are acceptable when already present in the repo, but the underlying controller variables still need descriptive names.

## When to Split Routers
Split when:
- a router file handles unrelated resources
- route registration becomes difficult to scan
- controller construction and route registration are mixed chaotically

