# bmad-vnpt-security-dotnet

## Purpose
Review ASP.NET Core / .NET services for authn/authz middleware order, model binding, minimal APIs, data protection, and secret handling.

## Required Inputs
- the user request defining the audit scope
- the current source tree and relevant config/deployment files
- GitNexus MCP if available
- Serena MCP if available
- relevant framework docs/configs/architecture notes if they materially clarify behavior
- optional artifacts from Semgrep, Gitleaks, Trivy, govulncheck, ZAP, Nuclei, Scorecard, SBOM, or CI runs if available

## Hard Rules
- Prefer review first.
- GitNexus must be used first when available.
- Source or config files must be read to verify the main findings.
- Scanner output is supporting evidence, not the only evidence.
- If any behavior or environment assumption cannot be verified, say so explicitly.

## Mandatory Review Sequence
### Phase 1 — Stack scoping and likely assets
Internally define:
- target scope
- likely sensitive assets
- likely public entry points
- likely trust boundaries
- likely privileged flows
- likely external systems and side effects

### Phase 2 — GitNexus-first structural mapping
Use GitNexus first to identify:
- authentication/authorization middleware order, policy-based authorization, endpoint metadata, and fallback policies
- model binding, validation, file upload/download, SSRF, deserialization, Razor rendering, and logging of sensitive data
- Data Protection key management, cookie/JWT settings, secret loading, appsettings environment overrides, and antiforgery coverage
- EF Core query safety, background services, message handlers, outbound HTTP clients, and insecure redirect/open redirect paths

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, framework wiring, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- UseAuthentication/UseAuthorization ordering and endpoint RequireAuthorization gaps
- policy handlers, resource-based authorization, claims/scopes mapping, and DataProtection key persistence
- unsafe JsonSerializer settings, file path joins, temp file handling, and secret leakage in configuration

### Phase 5 — Corroborating evidence
Use bundled scripts and optional external tools where relevant, for example:
- detect_secrets.py
- scan_dependencies.py
- check_compliance.py
- validate_input_sanitization.py
- validate_security_headers.py
- infer_security_stack.py
- run_security_full_matrix.py

## Required Output Structure
A. Scope and assumptions
B. Architecture / trust-boundary map
C. Findings by severity with evidence
D. Exploitation notes / blast radius
E. Stack-specific remediation plan
F. Evidence used (files, scripts, external tool outputs)
G. Gaps / unknowns / what still needs manual verification
