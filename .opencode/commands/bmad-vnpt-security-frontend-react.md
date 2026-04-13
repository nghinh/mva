---
description: Review React / Next.js frontends for XSS, dangerous HTML rendering, auth token handling, route protection, SSR leaks, and build-time secret exposure.
---
Run `bmad-vnpt-security-frontend-react`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - dangerouslySetInnerHTML, Markdown/HTML rendering, DOM sinks, URL construction, and client-side trust boundary violations
  - auth state, token storage, route guards, server/client component boundaries, SSR/SSG data leakage, and API abuse paths
  - environment variable exposure, source maps, CSP/nonces, postMessage/origin validation, and third-party script risks
  - file upload/download UX flows, WebView/iframe embedding, and permission-sensitive features

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
