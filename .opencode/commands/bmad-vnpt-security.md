---
description: Perform a full-spectrum security review across application, API, auth/authz, cloud/Kubernetes, DevSecOps, supply chain, and compliance.
---
Run `bmad-vnpt-security`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use all relevant bundled scripts and any available external tools as corroborating evidence.
- Focus especially on:
- application code paths and trust boundaries
- authentication, authorization, session, token, and password flows
- API surface, object-level authorization, rate limiting, and abuse paths
- secrets, crypto, logging, and sensitive-data handling
- CI/CD, dependency, artifact integrity, SBOM, and signing posture
- containers, Kubernetes, IaC, runtime hardening, and namespace isolation
- compliance and assurance mapping to OWASP Top 10 2025, OWASP API Security Top 10 2023, ASVS 5.0, and SAMM

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.

For full reviews, infer the likely stacks first and then cover the relevant stack-specific lenses: java-spring, dotnet, nodejs, python, go, c-cpp, php, frontend-react, frontend-vue, frontend-angular, mobile-flutter, and mobile-react.
