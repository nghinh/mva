---
description: Review CI/CD, dependencies, provenance, attestation, SBOM, signing, secret handling, and repository posture.
---
Run `bmad-vnpt-security-devsecops`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Prioritize scan_dependencies.py, detect_secrets.py, check_compliance.py, and any Trivy/Scorecard/Cosign/SBOM artifacts.
- Focus especially on:
- CI workflows, permissions, untrusted code execution, third-party actions, token scope, OIDC use
- dependency freshness, vulnerable packages, lockfiles, transitive risk, and update process
- artifact provenance, attestations, signing, release workflow integrity, and environment protections
- secret distribution, masking, rotation, and build/runtime separation
- repository posture, Scorecard-style checks, branch protection, review gates, and security scanning coverage

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
