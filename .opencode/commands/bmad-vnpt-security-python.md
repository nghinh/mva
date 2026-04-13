---
description: Review Python services such as Django / FastAPI / Flask for authn/authz, settings hardening, template safety, deserialization, and background task risks.
---
Run `bmad-vnpt-security-python`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - Django/FastAPI/Flask route protection, dependency injection or decorator-based auth, CSRF/session/token handling, and host/header hardening
  - template rendering, unsafe mark_safe or equivalent, pickle/yaml/deserialization, subprocess/file/path handling, and SSRF
  - settings/config split, secret loading, debug mode, logging of PII/tokens, and admin/internal endpoint exposure
  - ORM/raw SQL usage, object-level authorization, Celery/background jobs, async task trust boundaries, and upload/download flows

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
