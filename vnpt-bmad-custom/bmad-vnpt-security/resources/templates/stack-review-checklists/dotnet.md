# Checklist: dotnet

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- authentication/authorization middleware order, policy-based authorization, endpoint metadata, and fallback policies
- model binding, validation, file upload/download, SSRF, deserialization, Razor rendering, and logging of sensitive data
- Data Protection key management, cookie/JWT settings, secret loading, appsettings environment overrides, and antiforgery coverage
- EF Core query safety, background services, message handlers, outbound HTTP clients, and insecure redirect/open redirect paths

Hotspot checks:
- UseAuthentication/UseAuthorization ordering and endpoint RequireAuthorization gaps
- policy handlers, resource-based authorization, claims/scopes mapping, and DataProtection key persistence
- unsafe JsonSerializer settings, file path joins, temp file handling, and secret leakage in configuration

Evidence to collect:
- Exact files and line references for each finding
- Relevant config values and default behaviors
- Tool output only if it materially supports the finding

Output reminder:
- Severity
- Evidence
- Blast radius
- Fix recommendation
- Gaps / unknowns
