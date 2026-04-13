# Checklist: frontend-angular

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- sanitization boundaries, DomSanitizer bypasses, template injection, URL/resource contexts, and DOM sinks
- route guards, interceptor behavior, token storage, HttpClient trust boundaries, and API abuse paths
- Trusted Types/CSP posture, environment builds, source maps, third-party scripts, and postMessage/origin validation
- front-end-only authorization decisions and SSR/hydration exposure where applicable

Hotspot checks:
- bypassSecurityTrustHtml/Url/ResourceUrl usage and custom sanitizer wrappers
- guard/interceptor mismatch, token leakage, CORS assumptions, and API trust boundary confusion
- unsafe dynamic script loading and environment secret exposure

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
