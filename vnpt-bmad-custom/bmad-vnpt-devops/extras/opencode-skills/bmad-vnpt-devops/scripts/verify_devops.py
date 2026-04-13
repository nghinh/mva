#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


def exists_any(root: Path, *patterns: str) -> bool:
    return any(root.glob(p) for p in patterns)


def print_check(ok: bool, title: str, detail: str = "") -> None:
    status = "OK" if ok else "WARN"
    suffix = f" - {detail}" if detail else ""
    print(f"[{status}] {title}{suffix}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Quick DevOps structural verifier")
    parser.add_argument("repo", nargs="?", default=".", help="Repository root")
    args = parser.parse_args()

    root = Path(args.repo).resolve()
    if not root.exists():
        raise FileNotFoundError(f"Repository not found: {root}")

    gh = (root / ".github" / "workflows").exists()
    dockerfile = exists_any(root, "Dockerfile", "Dockerfile.*", "**/Dockerfile", "**/Dockerfile.*")
    dockerignore = exists_any(root, ".dockerignore", "**/.dockerignore")
    k8s = exists_any(root, "k8s", "k8s/**/kustomization.yaml", "**/kustomization.yaml", "**/*.yaml", "**/*.yml")
    helm = exists_any(root, "charts/**/Chart.yaml", "**/Chart.yaml")
    argo = exists_any(root, "argocd/**/*.yaml", "argocd/**/*.yml", "**/*argocd*.yaml", "**/*argocd*.yml")
    tofu = exists_any(root, "terraform/**/*.tf", "opentofu/**/*.tf", "**/*.tf")
    prom = exists_any(root, "monitoring/**/*.yml", "monitoring/**/*.yaml", "**/*alert*.yml", "**/*alert*.yaml")
    sops = exists_any(root, ".sops.yaml", ".sops.yml", "**/.sops.yaml", "**/.sops.yml")

    print_check(gh, "CI workflows present", ".github/workflows")
    print_check(dockerfile, "Dockerfile present")
    print_check(dockerignore or not dockerfile, "Docker ignore present when Dockerfile exists")
    print_check(k8s, "Kubernetes or Kustomize manifests detected")
    print_check(helm, "Helm chart detected")
    print_check(argo, "Argo CD manifests detected")
    print_check(tofu, "Terraform/OpenTofu files detected")
    print_check(prom, "Monitoring or alert rules detected")
    print_check(sops, "SOPS config detected")

    recommended = []
    if dockerfile and not dockerignore:
        recommended.append("Add .dockerignore to reduce build context and accidental secret leakage.")
    if k8s and not (helm or exists_any(root, "**/kustomization.yaml")):
        recommended.append("Consider Kustomize or Helm structure for environment separation and validation.")
    if tofu and not exists_any(root, "**/versions.tf", "**/providers.tf"):
        recommended.append("Add versions.tf/providers.tf to pin required versions and providers.")
    if gh and not exists_any(root, ".github/workflows/*scan*.yml", ".github/workflows/*scan*.yaml"):
        recommended.append("Consider a scan job for images/IaC or dependencies before deploy.")

    if recommended:
        print("\nRecommendations:")
        for item in recommended:
            print(f"- {item}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
