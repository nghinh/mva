---
description: Review server-side code, web flows, templates, sinks, and trust boundaries for common and framework-specific AppSec weaknesses.
---
Run `bmad-vnpt-security-appsec`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Prioritize scan_owasp_top10.py, validate_input_sanitization.py, validate_security_headers.py, detect_secrets.py.
- Focus especially on:
- entry points, controllers, handlers, background jobs, and risky helpers
- injection sinks, SSRF, file/path handling, deserialization, template rendering
- XSS, CSRF, clickjacking, CORS, CSP, security headers, and sensitive logging
- transaction boundaries, idempotency, race conditions, and inconsistent state
- shared middleware/utilities that amplify blast radius

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
