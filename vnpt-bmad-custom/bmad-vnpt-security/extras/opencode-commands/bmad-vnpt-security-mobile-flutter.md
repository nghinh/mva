---
description: Review Flutter mobile apps for secret storage, deep links, platform-channel trust boundaries, WebView usage, release hardening, and backend auth flow handling.
---
Run `bmad-vnpt-security-mobile-flutter`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - token and secret storage, biometrics/keychain/keystore usage, local persistence, and offline data protection
  - navigation/deep links, WebView/JS bridge, platform channels, FFI/native plugins, and trust boundaries to backend APIs
  - certificate pinning/TLS posture, debug flags, logging, crash reports, release signing, and obfuscation posture
  - sensitive permissions, exported Android/iOS components, file sharing, and content provider exposure

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
