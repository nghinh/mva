# bmad-vnpt-security-python

## Purpose
Review Python services such as Django / FastAPI / Flask for authn/authz, settings hardening, template safety, deserialization, and background task risks.

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
- Django/FastAPI/Flask route protection, dependency injection or decorator-based auth, CSRF/session/token handling, and host/header hardening
- template rendering, unsafe mark_safe or equivalent, pickle/yaml/deserialization, subprocess/file/path handling, and SSRF
- settings/config split, secret loading, debug mode, logging of PII/tokens, and admin/internal endpoint exposure
- ORM/raw SQL usage, object-level authorization, Celery/background jobs, async task trust boundaries, and upload/download flows

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, framework wiring, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- Django ALLOWED_HOSTS, SecurityMiddleware, CSRF, CSP, signed cookies; FastAPI OAuth2/JWT and dependency guard coverage
- pickle.loads/yaml.load/subprocess shell usage, Jinja autoescape bypasses, and temp file / path traversal issues
- debug/test endpoints, settings overrides, secrets in .env or code, and permissive CORS

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
