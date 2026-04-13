---
description: Review Docker/Kubernetes/IaC/runtime hardening, identity boundaries, admission/policy, and secret/config exposure.
---
Run `bmad-vnpt-security-cloud-k8s`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use dependency/secrets/compliance scripts where helpful and interpret Trivy/IaC/container findings carefully.
- Focus especially on:
- container build/runtime settings, base images, privilege escalation, filesystem and user model
- Kubernetes workloads, service accounts, RBAC, NetworkPolicy, ingress exposure, and secret mounting
- Pod Security Standards / admission posture, namespace isolation, and workload separation
- Terraform/OpenTofu/Helm/Kustomize manifests, misconfigurations, and environment drift
- cloud identity federation, workload identity/OIDC, and data egress/external dependency exposure

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
