# Story 5.5: Implement session deletion and data cleanup

Status: ready-for-dev

## Story

As a user,
I want to delete individual sessions or all session data,
so that I can manage my storage and privacy.

## Acceptance Criteria

1. **Given** the user deletes a session via swipe-to-delete
   **When** confirmed
   **Then** the session and all associated utterances + translations are permanently removed from SQLite.
2. **Given** Settings screen
   **When** user taps "Delete All Sessions"
   **Then** all session data is cleared after confirmation dialog.

## Tasks / Subtasks

- [ ] Implement cascade delete (AC: 1)
  - [ ] DELETE from translations WHERE utterance_id IN (SELECT id FROM utterances WHERE session_id = ?).
  - [ ] DELETE from utterances WHERE session_id = ?.
  - [ ] DELETE from sessions WHERE id = ?.
- [ ] Implement bulk delete (AC: 2)
  - [ ] DELETE all rows from translations, utterances, sessions.
  - [ ] Confirmation: "Delete all meeting data? This cannot be undone."

## Dev Notes

- Data is local-only. No server-side data to clean up. [Source: {ARCH_REF}#ADR-001]
