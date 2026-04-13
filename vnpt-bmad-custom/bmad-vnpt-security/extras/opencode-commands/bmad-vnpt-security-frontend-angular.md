---
description: Review Angular frontends for bypassSecurityTrust* misuse, sanitizer bypasses, route guards, token storage, and trusted types/CSP posture.
---
Run `bmad-vnpt-security-frontend-angular`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - sanitization boundaries, DomSanitizer bypasses, template injection, URL/resource contexts, and DOM sinks
  - route guards, interceptor behavior, token storage, HttpClient trust boundaries, and API abuse paths
  - Trusted Types/CSP posture, environment builds, source maps, third-party scripts, and postMessage/origin validation
  - front-end-only authorization decisions and SSR/hydration exposure where applicable

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
