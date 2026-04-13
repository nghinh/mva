# Checklist: mobile-flutter

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- token and secret storage, biometrics/keychain/keystore usage, local persistence, and offline data protection
- navigation/deep links, WebView/JS bridge, platform channels, FFI/native plugins, and trust boundaries to backend APIs
- certificate pinning/TLS posture, debug flags, logging, crash reports, release signing, and obfuscation posture
- sensitive permissions, exported Android/iOS components, file sharing, and content provider exposure

Hotspot checks:
- plain-text local storage, insecure shared prefs/files, and token leakage via logs or analytics
- deep-link/open-redirect abuse, WebView JS interfaces, and untrusted content rendering
- debug/dev endpoints, signing config, symbol exposure, and sensitive permissions

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
