# bmad-vnpt-security-devsecops

## Purpose
Review CI/CD, dependencies, provenance, attestation, SBOM, signing, secret handling, and repository posture.

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
- CI workflows, permissions, untrusted code execution, third-party actions, token scope, OIDC use
- dependency freshness, vulnerable packages, lockfiles, transitive risk, and update process
- artifact provenance, attestations, signing, release workflow integrity, and environment protections
- secret distribution, masking, rotation, and build/runtime separation
- repository posture, Scorecard-style checks, branch protection, review gates, and security scanning coverage

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- CI workflows, permissions, untrusted code execution, third-party actions, token scope, OIDC use
- dependency freshness, vulnerable packages, lockfiles, transitive risk, and update process
- artifact provenance, attestations, signing, release workflow integrity, and environment protections
- secret distribution, masking, rotation, and build/runtime separation
- repository posture, Scorecard-style checks, branch protection, review gates, and security scanning coverage

### Phase 5 — Scripted and tool corroboration
Prioritize scan_dependencies.py, detect_secrets.py, check_compliance.py, and any Trivy/Scorecard/Cosign/SBOM artifacts.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure, focusing on build/release trust boundaries and supply-chain integrity.
