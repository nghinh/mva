# Checklist: python

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- Django/FastAPI/Flask route protection, dependency injection or decorator-based auth, CSRF/session/token handling, and host/header hardening
- template rendering, unsafe mark_safe or equivalent, pickle/yaml/deserialization, subprocess/file/path handling, and SSRF
- settings/config split, secret loading, debug mode, logging of PII/tokens, and admin/internal endpoint exposure
- ORM/raw SQL usage, object-level authorization, Celery/background jobs, async task trust boundaries, and upload/download flows

Hotspot checks:
- Django ALLOWED_HOSTS, SecurityMiddleware, CSRF, CSP, signed cookies; FastAPI OAuth2/JWT and dependency guard coverage
- pickle.loads/yaml.load/subprocess shell usage, Jinja autoescape bypasses, and temp file / path traversal issues
- debug/test endpoints, settings overrides, secrets in .env or code, and permissive CORS

Evidence to collect:
- Exact files and line references for each finding
- Relevant config values and default behaviors
- Tool output only if it materially supports the finding

Output reminder:
- Severity
- Evidence
- Blast radius
- Fix recommendation
- Gaps / unknowns
