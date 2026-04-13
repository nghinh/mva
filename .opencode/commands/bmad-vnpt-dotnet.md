Use the `bmad-vnpt-dotnet` skill for .NET / ASP.NET Core work.

When this command is invoked, the agent must:
1. Detect whether the repo uses ASP.NET Core Minimal APIs or Controllers and follow the existing style.
2. Load and follow `.opencode/skills/bmad-vnpt-dotnet/SKILL.md`.
3. Prefer the workflow in `.opencode/skills/bmad-vnpt-dotnet/workflow.md`.
4. Apply .NET best practices for DI, Options, structured logging, EF Core efficiency, health checks, rate limiting, OpenAPI, and testing.
5. Run `dotnet build` and `dotnet test` when applicable before declaring completion.
