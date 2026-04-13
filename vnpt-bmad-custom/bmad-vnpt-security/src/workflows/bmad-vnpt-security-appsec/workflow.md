# bmad-vnpt-security-appsec

## Purpose
Review server-side code, web flows, templates, sinks, and trust boundaries for common and framework-specific AppSec weaknesses.

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
- entry points, controllers, handlers, background jobs, and risky helpers
- injection sinks, SSRF, file/path handling, deserialization, template rendering
- XSS, CSRF, clickjacking, CORS, CSP, security headers, and sensitive logging
- transaction boundaries, idempotency, race conditions, and inconsistent state
- shared middleware/utilities that amplify blast radius

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- entry points, controllers, handlers, background jobs, and risky helpers
- injection sinks, SSRF, file/path handling, deserialization, template rendering
- XSS, CSRF, clickjacking, CORS, CSP, security headers, and sensitive logging
- transaction boundaries, idempotency, race conditions, and inconsistent state
- shared middleware/utilities that amplify blast radius

### Phase 5 — Scripted and tool corroboration
Prioritize scan_owasp_top10.py, validate_input_sanitization.py, validate_security_headers.py, detect_secrets.py.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure, but keep emphasis on application-layer flaws and source-verified sinks.
