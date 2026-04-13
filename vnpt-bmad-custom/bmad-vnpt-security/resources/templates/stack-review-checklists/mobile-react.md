# Checklist: mobile-react

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- token/secret storage, keychain/keystore usage, AsyncStorage misuse, and local persistence of sensitive data
- deep links, navigation guards, WebView/JS bridge, native modules, OTA/update posture, and backend auth flows
- network security, ATS/cleartext allowances, certificate pinning, logging, crash telemetry, and release config
- permissions, exported intents/URL schemes, file sharing, media handling, and clipboard exposure

Hotspot checks:
- AsyncStorage for secrets, hardcoded API keys, debug menus, and insecure env/config bundling
- WebView source/origin checks, postMessage validation, ATS/cleartext exceptions, and insecure HTTP use
- linking config, auth guard bypasses, and sensitive permission overreach

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
