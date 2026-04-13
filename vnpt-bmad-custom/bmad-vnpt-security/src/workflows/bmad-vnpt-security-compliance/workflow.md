# bmad-vnpt-security-compliance

## Purpose
Map code, config, and process evidence to OWASP Top 10 2025, OWASP API Security Top 10 2023, ASVS 5.0, and SAMM-oriented gaps.

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
- direct evidence from source and config that supports or undermines control claims
- ASVS-style control areas, policy enforcement points, and testability
- SAMM/process maturity gaps visible from repo/workflow artifacts
- compliance evidence quality, repeatability, and missing guardrails in CI/CD
- clear separation between verified evidence, inferred posture, and missing evidence

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- direct evidence from source and config that supports or undermines control claims
- ASVS-style control areas, policy enforcement points, and testability
- SAMM/process maturity gaps visible from repo/workflow artifacts
- compliance evidence quality, repeatability, and missing guardrails in CI/CD
- clear separation between verified evidence, inferred posture, and missing evidence

### Phase 5 — Scripted and tool corroboration
Prioritize check_compliance.py and generate_security_report.py, but do not overclaim without source-backed proof.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure, with extra rigor in evidence grading and assurance mapping.
