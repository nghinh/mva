# bmad-vnpt-security-frontend-react

## Purpose
Review React / Next.js frontends for XSS, dangerous HTML rendering, auth token handling, route protection, SSR leaks, and build-time secret exposure.

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
- dangerouslySetInnerHTML, Markdown/HTML rendering, DOM sinks, URL construction, and client-side trust boundary violations
- auth state, token storage, route guards, server/client component boundaries, SSR/SSG data leakage, and API abuse paths
- environment variable exposure, source maps, CSP/nonces, postMessage/origin validation, and third-party script risks
- file upload/download UX flows, WebView/iframe embedding, and permission-sensitive features

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, framework wiring, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- dangerouslySetInnerHTML and untrusted HTML/Markdown pipelines
- token storage in localStorage/sessionStorage, XSS-to-account-takeover paths, and route guard bypasses
- Next.js middleware/edge/server actions exposure and env var leakage

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
