# bmad-vnpt-dotnet

## Mission
Use this skill for modern .NET / ASP.NET Core work, especially backend APIs and services.

## Technology defaults
- Runtime: modern .NET / ASP.NET Core
- API style: Minimal APIs by default for new APIs; keep controllers when the repo already uses them heavily
- Data access: EF Core with projection-first and query-efficiency awareness
- Testing: xUnit-first, plus ASP.NET Core integration tests for request flows
- Observability: structured logging, health checks, metrics/tracing-friendly code

## Design rules
1. Follow the repo's existing style first.
2. Keep boundaries explicit:
   - Api: transport, auth, route composition, contracts
   - Application: orchestration, use cases, validation, transactions
   - Domain: core rules and invariants
   - Infrastructure: EF Core, external systems, file/storage adapters
3. Keep endpoints/controllers thin.
4. Prefer DI and Options over static/global state.
5. Prefer async all the way for I/O.
6. Always accept and pass `CancellationToken` for I/O-heavy request flows.
7. Use structured logging with meaningful properties.
8. Prefer OpenAPI-enabled endpoints for HTTP APIs.
9. Add health checks for app dependencies where appropriate.
10. Use rate limiting for public or abuse-sensitive endpoints where appropriate.

## API guidance
- Prefer Minimal APIs for new APIs unless repo conventions say otherwise.
- Group endpoints by feature/route group, not by giant `Program.cs`.
- Use typed request/response DTOs.
- Validate input close to the boundary.
- Keep mapping explicit; avoid leaking persistence models to API contracts.
- Favor pagination for large collections.

## EF Core guidance
- Project only needed columns.
- Avoid unbounded `ToListAsync()` on large sets.
- Be intentional with `Include`; prefer projection for API payloads.
- Think about indexes when adding filters/sorts.
- Treat `SaveChangesAsync` as a boundary and reason clearly about retries, side effects, and external calls around it.
- Avoid accidental N+1 patterns.

## Configuration and DI
- Use Options pattern for strongly typed config.
- Register service lifetimes intentionally.
- Avoid service locator patterns.
- Keep services small and testable.

## Observability and resiliency
- Use `ILogger<T>` structured logging.
- Surface health checks for app + dependencies as appropriate.
- Prefer clear exception-to-problem-details handling for APIs.
- Make external calls idempotency-aware where flows can retry or double-submit.

## Testing policy
- Unit test business logic and pure services.
- Integration test important request flows, persistence integration, auth-sensitive endpoints, and failure paths.
- Add regression tests for fixed bugs.

## Review checklist
- Is the HTTP boundary thin and explicit?
- Are domain/application concerns separated from infrastructure?
- Are async + cancellation respected?
- Are EF Core queries projection-first and bounded?
- Are auth/validation/error paths covered?
- Are logs, health checks, and config patterns production-friendly?
- Did we run `dotnet build` and `dotnet test`?
