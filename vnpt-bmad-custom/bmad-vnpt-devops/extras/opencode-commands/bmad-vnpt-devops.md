---
description: Design or implement DevOps work using the bundled VNPT DevOps workflow, validators, and reference skeletons.
---
Run `bmad-vnpt-devops`.

Important:
- Load the local bundled pack inside `.opencode/skills/bmad-vnpt-devops/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`

Then:
1. Classify the task: CI/CD, container, Kubernetes, Helm/Kustomize, GitOps, IaC, secrets/security, or observability
2. Read the real repository layout and current delivery flow before suggesting changes
3. Apply the bundled DevOps patterns for reproducible builds, safer deployments, environment separation, least privilege, secret handling, and operability
4. Reuse the bundled scripts and skeletons only when they fit the actual repository structure
5. Make the smallest safe infrastructure or pipeline change that solves the task
6. Validate in layers: lint/render/plan/build first, then cluster/deploy checks where appropriate

Do not declare completion until:
- rollout and rollback implications were considered
- secret exposure and least-privilege impact were considered
- environment separation and configuration strategy were considered
- relevant linting, rendering, validation, plan, scan, and smoke checks were run when available
