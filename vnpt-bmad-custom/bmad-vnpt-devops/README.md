# BMAD VNPT DevOps

This package adds a BMAD/OpenCode custom workflow named `bmad-vnpt-devops` for production-oriented DevOps work across CI/CD, containers, Kubernetes, Helm, GitOps, IaC, secrets, security, and observability.

## What is inside
- `src/module.yaml`
- `src/workflows/bmad-vnpt-devops/workflow.md`
- `extras/opencode-commands/bmad-vnpt-devops.md`
- `extras/opencode-skills/bmad-vnpt-devops/`
  - `SKILL.md`
  - `scripts/verify_devops.py`
  - `skeleton/`
    - GitHub Actions CI example
    - Docker + Kubernetes base/overlay example
    - Helm chart example
    - OpenTofu module example
    - Argo CD application example
    - Prometheus alerts example
    - SOPS config example
- `tools/install_workflow.py`
- `tools/verify_workflow.py`

## Design goals
- Work well for real delivery pipelines instead of abstract DevOps advice.
- Default to reproducibility, security, least privilege, and environment separation.
- Encourage repository-aware changes rather than template dumping.
- Cover common VNPT-style needs: CI/CD, container build/release, Kubernetes deployment, IaC, GitOps, and operational checks.

## Curated research basis
This pack was intentionally aligned with reputable sources, especially official documentation:
- Docker docs on multi-stage builds, build best practices, and cache usage
- Kubernetes docs on Deployments, probes, resource requests/limits, and Kustomize
- Helm chart best practices
- GitHub Actions workflow syntax and workflow control docs
- Argo CD best practices and declarative setup docs
- Terraform style guide / OpenTofu docs for module structure and state handling
- Prometheus alerting and Alertmanager docs
- OWASP CI/CD, Docker, secrets management, IaC, and software supply chain guidance
- Trivy docs and Hadolint official repository docs
- SOPS official docs

## Install
```bash
python /path/to/bmad-vnpt-devops/tools/install_workflow.py --repo /path/to/your/repo --package /path/to/bmad-vnpt-devops
```

## Verify
```bash
python /path/to/bmad-vnpt-devops/tools/verify_workflow.py /path/to/your/repo
```
