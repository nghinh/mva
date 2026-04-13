---
name: bmad-vnpt-security-go
description: Review Go services for net/http handler chains, context propagation, unsafe template use, path handling, crypto misuse, and dependency vulnerabilities.
---

# bmad-vnpt-security-go

Use this workflow when the user wants a **deep stack-specific security review** for **go**.

## Mission
Produce a high-confidence review by combining:
- **GitNexus** first for repo-level structure, entry points, trust boundaries, shared flows, and blast radius
- **Serena** second only where symbol-level ownership or callers/callees are still unclear
- **direct source reading** for final verification
- **bundled scripts** for repeatable evidence gathering
- **optional external tools** such as Semgrep, Gitleaks, Trivy, ZAP, Nuclei, Scorecard, CycloneDX/Syft, or Cosign where relevant

This workflow is **review-first**. Do not change code unless the user explicitly asks for fixes after the review.

## Specialization
Review Go services for net/http handler chains, context propagation, unsafe template use, path handling, crypto misuse, and dependency vulnerabilities.

Focus especially on:
- middleware/handler chain authz coverage, context propagation, identity binding, and object-level authorization
- html/template vs text/template, command execution, archive extraction, file/path joins, and SSRF via HTTP clients
- JWT/session/token parsing, secret/config loading, logging/redaction, and crypto/rand usage
- database query construction, goroutine races around authz/state, and dependency posture with govulncheck

High-priority hotspot checks:
- router-level auth wrappers, public endpoints, internal admin/debug endpoints, and health/metrics exposure
- dangerous os/exec, ioutil/filepath traversal, template choice, and insecure TLS or http.Client defaults
- govulncheck-relevant hotspots and secrets/config sprawl

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
