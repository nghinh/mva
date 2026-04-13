# Checklist: php

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- route/middleware/guard coverage, policy/gate enforcement, CSRF/session/cookie settings, and auth flow correctness
- Blade/Twig escaping bypasses, raw PHP output, file upload/download, archive extraction, image processing, and SSRF
- PDO/query builder/raw SQL usage, mass assignment, serialization, unsafe include/require paths, and command execution
- secret loading, config caching, debug modes, error pages, and sensitive logging

Hotspot checks:
- prepared statements / ORM safety, password_hash/password_verify usage, and policy / gate object authorization
- dangerous eval/system/exec/passthru/shell_exec, unserialize, and path traversal patterns
- APP_DEBUG exposure, .env leakage, storage permissions, and insecure CORS / headers

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
