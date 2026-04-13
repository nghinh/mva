# Checklist: nodejs

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- middleware order, route guards, trust proxy, session/cookie settings, CSRF/CORS, and request body validation
- unsafe child_process, vm/eval, template engines, SSRF, file/path handling, archive extraction, and deserialization
- JWT/session handling, password hashing, secrets in env/config, and noisy logging of tokens or PII
- dependency exposure, package scripts, monorepo workspace trust boundaries, and server-side rendering sinks

Hotspot checks:
- helmet/cors/session config, express trust proxy, rate limiting, and route-level auth gaps
- dangerous sinks: eval, Function, exec/spawn, unserialize-like libs, path traversal, SSRF via axios/fetch/request
- package.json scripts, lockfiles, and secrets/config leakage

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
