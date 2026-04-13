---
description: Review React Native / Expo mobile apps for secure storage, deep links, WebView/network posture, native bridge trust boundaries, and release hardening.
---
Run `bmad-vnpt-security-mobile-react`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - token/secret storage, keychain/keystore usage, AsyncStorage misuse, and local persistence of sensitive data
  - deep links, navigation guards, WebView/JS bridge, native modules, OTA/update posture, and backend auth flows
  - network security, ATS/cleartext allowances, certificate pinning, logging, crash telemetry, and release config
  - permissions, exported intents/URL schemes, file sharing, media handling, and clipboard exposure

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
