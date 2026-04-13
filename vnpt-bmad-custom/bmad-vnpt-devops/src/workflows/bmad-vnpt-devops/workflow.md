# Workflow: bmad-vnpt-devops

## Purpose
Route DevOps work through a repeatable workflow that balances delivery speed, reproducibility, security, observability, and rollback safety.

## When to use
- CI/CD pipeline design or repair
- Dockerfile/buildx/image release work
- Kubernetes, Kustomize, or Helm deployment changes
- GitOps setup with Argo CD
- Terraform/OpenTofu infrastructure changes
- Secrets, policy, scanning, and supply-chain hardening
- Prometheus alerting or basic operability improvements

## Workflow
1. Identify task type
   - CI only
   - CD or release only
   - container build
   - Kubernetes deployment
   - Helm or Kustomize packaging
   - GitOps / Argo CD
   - IaC / OpenTofu / Terraform
   - security / secrets / policy
   - observability / alerts
2. Read local repo conventions
   - `.github/workflows/`, `Dockerfile*`, `.dockerignore`, `charts/`, `k8s/`, `argocd/`, `terraform/`, `opentofu/`, `monitoring/`, `docs/`
3. Emit a DevOps Intake Summary
4. Implement the smallest safe change
5. Validate in layers
   - syntax / lint / render
   - build or plan
   - security scans
   - rollout checks
   - smoke or health checks
6. Summarize outcomes, risks, rollback notes, and follow-up constraints

## Preferred implementation heuristics
- Prefer reusable workflows and scoped permissions in CI.
- Prefer multi-stage images, small contexts, and deterministic builds.
- Prefer controllers instead of naked Pods in Kubernetes.
- Prefer probes, resource requests/limits, and explicit rollout strategy.
- Prefer environment overlays or values separation instead of copy-paste manifests.
- Prefer declarative GitOps and reviewable changes over click-ops.
- Prefer remote/shared state handling for IaC and never hardcode secrets.
- Prefer alerting on symptoms and actionable conditions.

## Bundled helpers
- `scripts/verify_devops.py`: quick structural and hygiene checks for common DevOps repos
- `skeleton/`: starter references for CI, Docker, Kubernetes, Helm, IaC, GitOps, alerts, and secrets handling

## Definition of done
- The change is structurally consistent with the repo delivery model
- Validation commands appropriate to the task have been executed when available
- Rollout, rollback, security, and secret-handling implications were considered
- Environment separation, operability, and ownership are clear
