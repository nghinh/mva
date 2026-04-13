# Story 1.5: Establish offline-only configuration and security baseline

Status: ready-for-dev

## Story

As a developer,
I want secure, offline-only configuration with no network assumptions,
so that the app enforces privacy by design and passes security review.

## Acceptance Criteria

1. **Given** the app is installed and configured
   **When** running in airplane mode with no WiFi/cellular
   **Then** all features (STT, translation, session management) work identically to online mode.
2. **Given** a security review of the app binary
   **When** inspected
   **Then** no API keys, no server URLs, no analytics SDKs, no crash reporting services are found.
3. **Given** the app stores session data locally
   **When** data at rest is inspected
   **Then** all session data is encrypted using platform keychain (iOS Keychain / Android Keystore).

## Tasks / Subtasks

- [ ] Audit and remove any network-dependent code paths (AC: 1)
  - [ ] Verify no fetch/XMLHttpRequest/WebSocket calls exist outside model download flow.
  - [ ] Ensure model download is the ONLY network operation and is clearly separated.
- [ ] Establish security baseline (AC: 2)
  - [ ] No third-party SDKs with network access (no Firebase, no Sentry, no analytics).
  - [ ] No hardcoded secrets or API keys.
  - [ ] ProGuard/R8 (Android) and bitcode stripping (iOS) configured.
- [ ] Implement local storage encryption (AC: 3)
  - [ ] Encrypt SQLite database using SQLCipher or platform keychain-derived key.
  - [ ] Ensure model files are stored in app-private directory (not world-readable).
- [ ] Add offline verification test (AC: 1)
  - [ ] Automated test: enable airplane mode, run full meeting session, verify all features work.

## Dev Notes

- Zero telemetry, zero analytics, zero crash reporting. App is fully private by design. [Source: {PRD_REF}#NFR-010 through NFR-013]
- No audio is ever stored to disk or transmitted. Audio exists only in native memory buffer during STT processing. [Source: {PRD_REF}#FR-003]
