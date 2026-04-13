# Story 4.4: Implement stop meeting and session save flow

Status: ready-for-dev

## Story

As a user,
I want to tap "Stop Meeting" to end the session and save all data,
so that I can review the meeting later.

## Acceptance Criteria

1. **Given** a meeting is active
   **When** the user taps "Stop Meeting"
   **Then** audio capture stops, any in-progress translation completes or cancels, and all data is saved to SQLite.
2. **Given** the meeting is stopped
   **When** the save completes
   **Then** the user is navigated to the Home screen with the new session at the top of the session list.

## Tasks / Subtasks

- [ ] Build "Stop Meeting" button (AC: 1)
  - [ ] Full-width outlined red button at bottom of meeting screen.
  - [ ] Square stop icon + "Stop Meeting" text.
- [ ] Implement stop flow (AC: 1, 2)
  - [ ] Stop audio capture via sherpa-onnx.
  - [ ] Flush any pending STT results.
  - [ ] Cancel or await any in-progress translation.
  - [ ] Update session record: set `ended_at`, `status='ended'`.
  - [ ] Navigate to Home.

## Dev Notes

- Session data saved locally to SQLite. No server sync needed. [Source: {ARCH_REF}#Local Storage]
