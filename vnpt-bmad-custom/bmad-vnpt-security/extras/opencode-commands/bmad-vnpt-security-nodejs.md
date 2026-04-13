---
description: Review Node.js / Express / Nest / Next backend code for middleware ordering, validation, SSRF, templating, prototype pollution, and supply-chain risks.
---
Run `bmad-vnpt-security-nodejs`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - middleware order, route guards, trust proxy, session/cookie settings, CSRF/CORS, and request body validation
  - unsafe child_process, vm/eval, template engines, SSRF, file/path handling, archive extraction, and deserialization
  - JWT/session handling, password hashing, secrets in env/config, and noisy logging of tokens or PII
  - dependency exposure, package scripts, monorepo workspace trust boundaries, and server-side rendering sinks

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
