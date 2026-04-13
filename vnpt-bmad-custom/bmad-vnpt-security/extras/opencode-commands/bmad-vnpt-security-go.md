---
description: Review Go services for net/http handler chains, context propagation, unsafe template use, path handling, crypto misuse, and dependency vulnerabilities.
---
Run `bmad-vnpt-security-go`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - middleware/handler chain authz coverage, context propagation, identity binding, and object-level authorization
  - html/template vs text/template, command execution, archive extraction, file/path joins, and SSRF via HTTP clients
  - JWT/session/token parsing, secret/config loading, logging/redaction, and crypto/rand usage
  - database query construction, goroutine races around authz/state, and dependency posture with govulncheck

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
