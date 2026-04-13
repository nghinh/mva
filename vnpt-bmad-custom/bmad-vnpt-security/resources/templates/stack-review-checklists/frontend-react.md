# Checklist: frontend-react

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- dangerouslySetInnerHTML, Markdown/HTML rendering, DOM sinks, URL construction, and client-side trust boundary violations
- auth state, token storage, route guards, server/client component boundaries, SSR/SSG data leakage, and API abuse paths
- environment variable exposure, source maps, CSP/nonces, postMessage/origin validation, and third-party script risks
- file upload/download UX flows, WebView/iframe embedding, and permission-sensitive features

Hotspot checks:
- dangerouslySetInnerHTML and untrusted HTML/Markdown pipelines
- token storage in localStorage/sessionStorage, XSS-to-account-takeover paths, and route guard bypasses
- Next.js middleware/edge/server actions exposure and env var leakage

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
