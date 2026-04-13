# bmad-vnpt-security-auth

## Purpose
Review identity, authentication, authorization, tenant isolation, sessions, JWTs, MFA, and privilege transitions.

## Required Inputs
- the user request defining the audit scope
- the current source tree and relevant config/deployment files
- GitNexus MCP if available
- Serena MCP if available
- architecture/threat-model/data-classification docs if they materially clarify behavior
- optional artifacts from Semgrep, Gitleaks, Trivy, ZAP, Nuclei, Scorecard, SBOM, or CI runs if available

## Hard Rules
- Prefer review first.
- GitNexus must be used first when available.
- Source or config files must be read to verify the main findings.
- Scanner output is supporting evidence, not the only evidence.
- If any behavior or environment assumption cannot be verified, say so explicitly.

## Mandatory Review Sequence
### Phase 1 — Scope and likely assets
Internally define:
- target scope
- likely sensitive assets
- likely public entry points
- likely trust boundaries
- likely privileged flows
- likely external systems and side effects

### Phase 2 — GitNexus-first structural mapping
Use GitNexus first to identify:
- login, logout, registration, password reset, MFA, device/session management
- session fixation, token issuance/validation, refresh/revocation, clock skew handling
- RBAC/ABAC/policy enforcement, object-level authorization, horizontal/vertical escalation
- tenant isolation, admin-only paths, unsafe defaults, policy bypass via alternate routes
- privileged flows, support/admin tooling, and audit logging of security events

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- login, logout, registration, password reset, MFA, device/session management
- session fixation, token issuance/validation, refresh/revocation, clock skew handling
- RBAC/ABAC/policy enforcement, object-level authorization, horizontal/vertical escalation
- tenant isolation, admin-only paths, unsafe defaults, policy bypass via alternate routes
- privileged flows, support/admin tooling, and audit logging of security events

### Phase 5 — Scripted and tool corroboration
Prioritize audit_authentication.py and audit_authorization.py, then cross-check source paths manually.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure, emphasizing identity and access control failures.
