---
description: Review PHP / Laravel / Symfony code for input validation, templating, authz guards, session/cookie security, mass assignment, and unsafe file handling.
---
Run `bmad-vnpt-security-php`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - route/middleware/guard coverage, policy/gate enforcement, CSRF/session/cookie settings, and auth flow correctness
  - Blade/Twig escaping bypasses, raw PHP output, file upload/download, archive extraction, image processing, and SSRF
  - PDO/query builder/raw SQL usage, mass assignment, serialization, unsafe include/require paths, and command execution
  - secret loading, config caching, debug modes, error pages, and sensitive logging

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
