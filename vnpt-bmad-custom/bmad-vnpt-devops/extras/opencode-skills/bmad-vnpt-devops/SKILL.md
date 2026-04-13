---
name: bmad-vnpt-devops
description: VNPT BMAD custom DevOps workflow and skill pack with CI/CD, Docker, Kubernetes, GitOps, IaC, security, and observability defaults.
---

# BMAD VNPT DevOps Custom Skill Pack

This package wraps curated DevOps engineering guidance into a BMAD/OpenCode-compatible custom workflow.

## What this pack optimizes for
- Production-grade CI/CD and release engineering
- Safer containerization and Kubernetes delivery
- GitOps and IaC with reviewable, declarative changes
- Strong defaults for least privilege, secret hygiene, scanning, and rollback readiness
- Practical support for web, backend, data, platform, and multi-service repositories

## Research-backed defaults used by this pack
1. Prefer reviewable, declarative changes over ad hoc console operations.
2. Prefer CI workflows with explicit triggers, concurrency control, caching, and least-privilege permissions.
3. Prefer multi-stage Docker builds, small build contexts, and stable build inputs.
4. Prefer Kubernetes controllers instead of naked Pods for production workloads.
5. Prefer liveness/readiness/startup probes and explicit CPU/memory requests/limits.
6. Prefer environment separation through Kustomize overlays or Helm values files rather than duplicated manifests.
7. Prefer Helm chart structure and naming conventions aligned with official chart best practices.
8. Prefer Argo CD declarative setup and GitOps separation between app source and deployment config when practical.
9. Prefer Terraform/OpenTofu modules with clean file organization, explicit versions, and remote/shared state strategy.
10. Never commit plaintext secrets. Prefer SOPS or platform secret managers, and keep CI credentials short-lived and least-privileged.
11. Run security and quality gates early: Hadolint for Dockerfiles, Trivy for images/filesystem/Kubernetes when relevant, and IaC validation before apply.
12. Prefer actionable Prometheus alerts focused on symptoms, with routing handled by Alertmanager.

## Operational rules
- Load this skill before meaningful DevOps implementation work.
- Inspect the real repository structure first. The bundled skeleton is a fallback accelerator, not a substitute for repo analysis.
- Preserve existing platform constraints unless the task explicitly allows changing them.
- Prefer the smallest safe pipeline or infrastructure change.
- Never introduce hidden secret sprawl, privileged defaults, or fragile manual rollout steps.
- Every deployment-facing change should consider rollback, blast radius, and operator visibility.

## DevOps engineering checklist
### 1) CI/CD workflow design
- Scope workflow triggers narrowly enough to avoid unnecessary runs.
- Use concurrency control when overlapping runs can corrupt releases or environments.
- Keep permissions explicit and minimal.
- Prefer reusable actions/workflows and pinned major versions or stronger pinning where policy requires it.
- Separate build, test, package, scan, and deploy concerns into understandable jobs.
- Cache dependencies deliberately, not blindly.

### 2) Docker and image build
- Use multi-stage builds where possible.
- Keep `.dockerignore` tight to reduce context size.
- Prefer deterministic package installation and minimal runtime images.
- Avoid baking secrets into layers, build args, or copied files.
- Scan images and important filesystems before release.
- Lint Dockerfiles and shell usage in `RUN` steps.

### 3) Kubernetes delivery
- Prefer `Deployment`, `StatefulSet`, `DaemonSet`, `Job`, or `CronJob` as appropriate instead of naked Pods.
- Define probes intentionally.
- Set resource requests/limits when appropriate for the environment.
- Keep labels/selectors consistent and stable.
- Use `ConfigMap` and `Secret` appropriately; avoid stuffing config into container images.
- Keep rollout strategy and disruption implications visible.

### 4) Helm and Kustomize
- Use Helm for reusable, parameterized packaging when the repo already follows chart workflows.
- Use Kustomize overlays for environment-specific Kubernetes configuration without templating overhead.
- Avoid value/overlay sprawl; keep environment diffs readable.
- Render templates locally in CI before deployment.

### 5) GitOps and Argo CD
- Prefer declarative Argo CD resources.
- Keep deployment config reviewable in Git.
- Separate application source and environment/deployment config when it improves ownership and release hygiene.
- Be explicit about sync policy, target revision, and namespace ownership.

### 6) IaC with Terraform/OpenTofu
- Keep module file layout predictable.
- Pin required versions and providers.
- Validate and format before planning.
- Use remote/shared state and locking strategy appropriate to the platform.
- Never hardcode credentials or long-lived secrets.
- Keep environment inputs explicit and reviewable.

### 7) Security and secrets
- Follow least privilege for CI tokens, cloud credentials, and Kubernetes service accounts.
- Use secret managers or encrypted files, not plaintext in Git.
- Add pipeline scanning appropriate to the artifact type.
- Treat supply-chain risk as part of delivery design, not an afterthought.

### 8) Observability and alerts
- Add basic health and operational signals before increasing automation.
- Prefer simple, actionable alerts on symptoms.
- Route, group, and silence alerts deliberately.
- Keep dashboards and runbooks discoverable when possible.

## Required processing sequence
1. Read the full task/story.
2. Determine whether the work affects CI, CD, Docker, Kubernetes, Helm/Kustomize, GitOps, IaC, secrets/security, or observability.
3. Read the local bundled `SKILL.md`.
4. Read the relevant local files first.
5. Read relevant docs in `docs/` when available.
6. Produce a short DevOps Intake Summary before editing.
7. Implement the smallest safe change.
8. Run the narrowest useful checks first, then broader checks if the change is shared or risky.
9. Use bundled validators when they fit the repository and task.

## DevOps Intake Summary
Before editing, restate:
- the DevOps task
- affected layer(s): CI/CD, Docker, Kubernetes, Helm/Kustomize, GitOps, IaC, secrets/security, observability
- target files/directories
- rollout and rollback impact
- secret/credential implications
- environment and tenancy implications
- assumptions or missing information

## Suggested default stack for new repos
- CI/CD: GitHub Actions or the repo-native CI system with explicit permissions and concurrency
- Container build: Docker BuildKit/buildx, multi-stage Dockerfiles, `.dockerignore`, Hadolint
- Kubernetes packaging: Kustomize for overlays and/or Helm for reusable charts
- GitOps: Argo CD for declarative sync when Kubernetes delivery is used
- IaC: OpenTofu or Terraform modules with fmt/validate/plan gates
- Security scanning: Trivy plus repo-native scanners and secret hygiene checks
- Secrets: SOPS or platform secret manager integration
- Observability: Prometheus rules and Alertmanager routing

## Completion standard
Before declaring completion, confirm:
- build/deploy and rollback paths remain aligned
- secrets and least-privilege impacts were handled
- changes follow local platform conventions and official tool guidance
- relevant checks or bundled validators were run when available
