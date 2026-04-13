# bmad-vnpt-security-php

## Purpose
Review PHP / Laravel / Symfony code for input validation, templating, authz guards, session/cookie security, mass assignment, and unsafe file handling.

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
- route/middleware/guard coverage, policy/gate enforcement, CSRF/session/cookie settings, and auth flow correctness
- Blade/Twig escaping bypasses, raw PHP output, file upload/download, archive extraction, image processing, and SSRF
- PDO/query builder/raw SQL usage, mass assignment, serialization, unsafe include/require paths, and command execution
- secret loading, config caching, debug modes, error pages, and sensitive logging

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, framework wiring, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- prepared statements / ORM safety, password_hash/password_verify usage, and policy / gate object authorization
- dangerous eval/system/exec/passthru/shell_exec, unserialize, and path traversal patterns
- APP_DEBUG exposure, .env leakage, storage permissions, and insecure CORS / headers

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
