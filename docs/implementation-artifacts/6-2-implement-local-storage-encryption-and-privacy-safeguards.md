# Story 6.2: Implement local storage encryption and privacy safeguards

Status: ready-for-dev

## Story

As a user,
I want my meeting data encrypted on device,
so that my confidential meeting content is protected even if the phone is compromised.

## Acceptance Criteria

1. **Given** session data is stored in SQLite
   **When** the database file is inspected on a rooted/jailbroken device
   **Then** the data is encrypted and unreadable without the device keychain key.
2. **Given** the app is uninstalled
   **When** storage is inspected
   **Then** no meeting data remnants remain on the device.

## Tasks / Subtasks

- [ ] Implement SQLite encryption (AC: 1)
  - [ ] Use SQLCipher or platform keychain-derived encryption key.
  - [ ] Key stored in iOS Keychain / Android Keystore (hardware-backed).
- [ ] Verify data cleanup on uninstall (AC: 2)
  - [ ] Models stored in app-private directory (auto-deleted on uninstall).
  - [ ] SQLite database in app-private directory.
  - [ ] No data written to external storage or shared directories.

## Dev Notes

- Privacy is absolute: no audio stored, no text transmitted, no telemetry. [Source: {PRD_REF}#NFR-010 through NFR-013]
