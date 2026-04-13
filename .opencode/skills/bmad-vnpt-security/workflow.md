# bmad-vnpt-security

## Purpose
Perform a full-spectrum security review across application, API, auth/authz, cloud/Kubernetes, DevSecOps, supply chain, and compliance.

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
### Phase 1 — Scope, stack detection, and likely assets
First infer the likely stacks by using `infer_security_stack.py` or by reading repo indicators directly. Then internally define:
- target scope
- likely sensitive assets
- likely public entry points
- likely trust boundaries
- likely privileged flows
- likely external systems and side effects

### Phase 2 — GitNexus-first structural mapping
Use GitNexus first to identify:
- application code paths and trust boundaries
- authentication, authorization, session, token, and password flows
- API surface, object-level authorization, rate limiting, and abuse paths
- secrets, crypto, logging, and sensitive-data handling
- CI/CD, dependency, artifact integrity, SBOM, and signing posture
- containers, Kubernetes, IaC, runtime hardening, and namespace isolation
- compliance and assurance mapping to OWASP Top 10 2025, OWASP API Security Top 10 2023, ASVS 5.0, and SAMM

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- application code paths and trust boundaries
- authentication, authorization, session, token, and password flows
- API surface, object-level authorization, rate limiting, and abuse paths
- secrets, crypto, logging, and sensitive-data handling
- CI/CD, dependency, artifact integrity, SBOM, and signing posture
- containers, Kubernetes, IaC, runtime hardening, and namespace isolation
- compliance and assurance mapping to OWASP Top 10 2025, OWASP API Security Top 10 2023, ASVS 5.0, and SAMM

### Phase 5 — Full-stack lanes
If relevant, run focused passes for the detected stacks:
- java-spring
- dotnet
- nodejs
- python
- go
- c-cpp
- php
- frontend-react
- frontend-vue
- frontend-angular
- mobile-flutter
- mobile-react

Use `run_security_full_matrix.py` to summarize which lanes should be covered.

### Phase 6 — Scripted and tool corroboration
Use all relevant bundled scripts and any available external tools as corroborating evidence.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure from the skill, with cross-domain prioritization.
