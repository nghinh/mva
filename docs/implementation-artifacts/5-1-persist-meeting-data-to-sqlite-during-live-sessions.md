# Story 5.1: Persist meeting data to SQLite during live sessions

Status: ready-for-dev

## Story

As a user,
I want my meeting data saved automatically during the session,
so that nothing is lost even if the app crashes.

## Acceptance Criteria

1. **Given** a meeting is active
   **When** a final utterance + translation is produced
   **Then** both are written to SQLite within 100ms.
2. **Given** the app crashes during a meeting
   **When** the user reopens the app
   **Then** the partial session is recoverable from SQLite with all utterances saved before the crash.

## Tasks / Subtasks

- [ ] Define SQLite schema (AC: 1)
  - [ ] `sessions`: id, started_at, ended_at, status.
  - [ ] `utterances`: id, session_id, text, lang, is_final, timestamp.
  - [ ] `translations`: id, utterance_id, text, latency_ms, created_at.
- [ ] Implement write-on-finalize pattern (AC: 1, 2)
  - [ ] On STT final: insert utterance row.
  - [ ] On translation complete: insert translation row linked to utterance.
  - [ ] Use WAL mode for concurrent read/write safety.
- [ ] Implement crash recovery (AC: 2)
  - [ ] On app launch: check for sessions with `status='active'` and `ended_at=null`.
  - [ ] Mark as `status='interrupted'`. Show in session list with warning badge.

## Dev Notes

- Use `op-sqlite` or `expo-sqlite` for React Native SQLite access. [Source: {ARCH_REF}#Local Storage]
- All data is local-only. No sync, no server backup. [Source: {ARCH_REF}#ADR-001]
