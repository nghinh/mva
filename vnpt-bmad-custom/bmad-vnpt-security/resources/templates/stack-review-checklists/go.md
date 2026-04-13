# Checklist: go

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- middleware/handler chain authz coverage, context propagation, identity binding, and object-level authorization
- html/template vs text/template, command execution, archive extraction, file/path joins, and SSRF via HTTP clients
- JWT/session/token parsing, secret/config loading, logging/redaction, and crypto/rand usage
- database query construction, goroutine races around authz/state, and dependency posture with govulncheck

Hotspot checks:
- router-level auth wrappers, public endpoints, internal admin/debug endpoints, and health/metrics exposure
- dangerous os/exec, ioutil/filepath traversal, template choice, and insecure TLS or http.Client defaults
- govulncheck-relevant hotspots and secrets/config sprawl

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
