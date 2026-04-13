# Checklist: frontend-vue

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- untrusted templates, v-html, dynamic component rendering, URL building, and DOM-based XSS paths
- router guards, token/session storage, SSR data exposure, and trust boundaries between client and server rendering
- environment variables, CSP, third-party scripts, postMessage/origin checks, and iframe/WebView use
- admin-only UI enforcement vs backend enforcement mismatches

Hotspot checks:
- v-html and dynamic template/render-function usage with untrusted data
- Nuxt server routes / SSR payload leaks, route guard bypasses, and persisted auth tokens
- front-end-only authorization decisions and API trust assumptions

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
