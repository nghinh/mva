---
description: Review ASP.NET Core / .NET services for authn/authz middleware order, model binding, minimal APIs, data protection, and secret handling.
---
Run `bmad-vnpt-security-dotnet`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - authentication/authorization middleware order, policy-based authorization, endpoint metadata, and fallback policies
  - model binding, validation, file upload/download, SSRF, deserialization, Razor rendering, and logging of sensitive data
  - Data Protection key management, cookie/JWT settings, secret loading, appsettings environment overrides, and antiforgery coverage
  - EF Core query safety, background services, message handlers, outbound HTTP clients, and insecure redirect/open redirect paths

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
