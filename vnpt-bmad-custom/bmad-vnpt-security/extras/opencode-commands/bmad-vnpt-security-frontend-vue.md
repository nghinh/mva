---
description: Review Vue / Nuxt frontends for template safety, v-html misuse, route/meta guard gaps, token handling, SSR leaks, and third-party script exposure.
---
Run `bmad-vnpt-security-frontend-vue`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - untrusted templates, v-html, dynamic component rendering, URL building, and DOM-based XSS paths
  - router guards, token/session storage, SSR data exposure, and trust boundaries between client and server rendering
  - environment variables, CSP, third-party scripts, postMessage/origin checks, and iframe/WebView use
  - admin-only UI enforcement vs backend enforcement mismatches

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
