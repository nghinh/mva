---
description: Map code, config, and process evidence to OWASP Top 10 2025, OWASP API Security Top 10 2023, ASVS 5.0, and SAMM-oriented gaps.
---
Run `bmad-vnpt-security-compliance`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Prioritize check_compliance.py and generate_security_report.py, but do not overclaim without source-backed proof.
- Focus especially on:
- direct evidence from source and config that supports or undermines control claims
- ASVS-style control areas, policy enforcement points, and testability
- SAMM/process maturity gaps visible from repo/workflow artifacts
- compliance evidence quality, repeatability, and missing guardrails in CI/CD
- clear separation between verified evidence, inferred posture, and missing evidence

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
