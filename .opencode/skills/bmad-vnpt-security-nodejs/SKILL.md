---
name: bmad-vnpt-security-nodejs
description: Review Node.js / Express / Nest / Next backend code for middleware ordering, validation, SSRF, templating, prototype pollution, and supply-chain risks.
---

# bmad-vnpt-security-nodejs

Use this workflow when the user wants a **deep stack-specific security review** for **nodejs**.

## Mission
Produce a high-confidence review by combining:
- **GitNexus** first for repo-level structure, entry points, trust boundaries, shared flows, and blast radius
- **Serena** second only where symbol-level ownership or callers/callees are still unclear
- **direct source reading** for final verification
- **bundled scripts** for repeatable evidence gathering
- **optional external tools** such as Semgrep, Gitleaks, Trivy, ZAP, Nuclei, Scorecard, CycloneDX/Syft, or Cosign where relevant

This workflow is **review-first**. Do not change code unless the user explicitly asks for fixes after the review.

## Specialization
Review Node.js / Express / Nest / Next backend code for middleware ordering, validation, SSRF, templating, prototype pollution, and supply-chain risks.

Focus especially on:
- middleware order, route guards, trust proxy, session/cookie settings, CSRF/CORS, and request body validation
- unsafe child_process, vm/eval, template engines, SSRF, file/path handling, archive extraction, and deserialization
- JWT/session handling, password hashing, secrets in env/config, and noisy logging of tokens or PII
- dependency exposure, package scripts, monorepo workspace trust boundaries, and server-side rendering sinks

High-priority hotspot checks:
- helmet/cors/session config, express trust proxy, rate limiting, and route-level auth gaps
- dangerous sinks: eval, Function, exec/spawn, unserialize-like libs, path traversal, SSRF via axios/fetch/request
- package.json scripts, lockfiles, and secrets/config leakage

Use the stack checklist at `resources/templates/stack-review-checklists/{stack}.md` when you need a systematic pass.

## Mandatory Review Order
1. Internally classify the request and confirm the stack scope.
2. Use **GitNexus first** when available to map entry points, trust boundaries, shared helpers, outbound calls, and blast radius.
3. Use **Serena second** only where exact symbol ownership, callers/callees, contracts, or framework wiring remain unclear.
4. Read the actual source or config files at the identified hotspots to verify behavior.
5. Use bundled scripts from `.opencode/skills/bmad-vnpt-security/scripts` and external tools only as corroboration or hotspot discovery.
6. Return the result in the required A–G format.

## Hard Rules
- Do not claim a vulnerability without source evidence, credible tool evidence, or both.
- Do not treat scanner output as final truth without checking source/config.
- Distinguish clearly between verified from source, corroborated by tooling, inferred from structure, and not yet verified.
- State clearly when GitNexus was unavailable and a fallback path was used.
- For active testing against running systems, assume authorization is required unless the user clearly states permission.

## Required Output Format
A. Scope and assumptions
B. Architecture / trust-boundary map
C. Findings by severity with evidence
D. Exploitation notes / blast radius
E. Stack-specific remediation plan
F. Evidence used (files, scripts, external tool outputs)
G. Gaps / unknowns / what still needs manual verification
