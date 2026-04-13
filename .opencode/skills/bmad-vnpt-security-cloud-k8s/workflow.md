# bmad-vnpt-security-cloud-k8s

## Purpose
Review Docker/Kubernetes/IaC/runtime hardening, identity boundaries, admission/policy, and secret/config exposure.

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
- container build/runtime settings, base images, privilege escalation, filesystem and user model
- Kubernetes workloads, service accounts, RBAC, NetworkPolicy, ingress exposure, and secret mounting
- Pod Security Standards / admission posture, namespace isolation, and workload separation
- Terraform/OpenTofu/Helm/Kustomize manifests, misconfigurations, and environment drift
- cloud identity federation, workload identity/OIDC, and data egress/external dependency exposure

Keep GitNexus usage sequential and narrow.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm exact ownership, callers/callees, references, or policy reuse.

### Phase 4 — Direct source/config verification
Read the returned hotspot files and verify actual behavior, especially around:
- container build/runtime settings, base images, privilege escalation, filesystem and user model
- Kubernetes workloads, service accounts, RBAC, NetworkPolicy, ingress exposure, and secret mounting
- Pod Security Standards / admission posture, namespace isolation, and workload separation
- Terraform/OpenTofu/Helm/Kustomize manifests, misconfigurations, and environment drift
- cloud identity federation, workload identity/OIDC, and data egress/external dependency exposure

### Phase 5 — Scripted and tool corroboration
Use dependency/secrets/compliance scripts where helpful and interpret Trivy/IaC/container findings carefully.
Treat tool output as corroboration, lead generation, or pipeline-gap evidence.

### Phase 6 — Risk analysis
Prioritize findings that have credible exploit paths, broad blast radius, privilege escalation potential, data exposure, integrity impact, or release/runtime trust impact.

### Phase 7 — Output
A–G structure, emphasizing deploy/runtime posture and blast radius across environments.
