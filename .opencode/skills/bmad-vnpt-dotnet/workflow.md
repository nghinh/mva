# bmad-vnpt-dotnet workflow

## Purpose
Build, review, and evolve modern .NET systems with strong defaults for ASP.NET Core, EF Core, DI, configuration, observability, and testing.

## Default stance
- Prefer ASP.NET Core Minimal APIs for new HTTP APIs unless the repo clearly standardizes on controllers.
- Respect existing repo conventions before introducing new patterns.
- Keep boundaries clear: Api -> Application -> Domain -> Infrastructure.
- Keep business rules out of controllers/endpoints and persistence concerns out of domain logic.
- Prefer async, cancellation-aware I/O and structured logging.

## Steps
1. Detect repo style: Minimal APIs vs Controllers, EF Core usage, mediator/CQRS, test stack, auth stack, hosting model.
2. Read existing conventions before coding.
3. If APIs are new or greenfield, model route groups, request/response DTOs, validation, auth, rate limiting, and OpenAPI together.
4. If data changes are needed, inspect DbContext, mappings, migrations, indexes, and query shape.
5. Implement with narrow changes and explicit boundaries.
6. Verify with format/build/test and repo-specific checks.

## Mandatory checks
- `dotnet restore`
- `dotnet build`
- `dotnet test`
- repo lint/format if present

## Quality gates
- No blocking async-over-sync on hot paths
- No leaking EF entities directly across API boundaries unless repo already does so intentionally
- No business logic buried in endpoints/controllers
- No broad Include/ToList misuse when projection or pagination is more appropriate
- No secrets in appsettings.* committed to source
