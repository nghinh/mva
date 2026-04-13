# bmad-vnpt-security-api

## Purpose
Review REST/GraphQL/gRPC/API gateway surface for OWASP API Security risks, abuse paths, and contract drift.

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
- public and internal API endpoints, schemas, object identifiers, and pagination/search surfaces
- BOLA/BFLA, mass assignment, excessive data exposure, unsafe defaults, shadow endpoints
- resource consumption, rate limiting, quotas, idempotency keys, replay/duplicate handling
- serialization, validation, API gateway/authn/authz enforcement, webhook verification
- versioning, backward compatibility, and mismatch between documented and actual behavior

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- public and internal API endpoints, schemas, object identifiers, and pagination/search surfaces
- BOLA/BFLA, mass assignment, excessive data exposure, unsafe defaults, shadow endpoints
- resource consumption, rate limiting, quotas, idempotency keys, replay/duplicate handling
- serialization, validation, API gateway/authn/authz enforcement, webhook verification
- versioning, backward compatibility, and mismatch between documented and actual behavior

### Phase 5 — Scripted and tool corroboration
Use appsec scripts plus any contract/gateway evidence; map explicitly to OWASP API Security Top 10 2023.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure, prioritizing API abuse scenarios and endpoint-level evidence.
