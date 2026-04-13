# Story 2.1: Start and stop meeting capture from the meeting screen

Status: ready-for-dev

## Story

As a user,
I want to start and stop a meeting session with a single tap,
so that I can control when the app listens without complex setup.

## Acceptance Criteria

1. **Given** the user is on the Home screen
   **When** they tap the "New Meeting" FAB button
   **Then** the Meeting screen opens with recording indicator (pulsing red dot + timer at 00:00:00) and the STT pipeline begins processing audio immediately.
2. **Given** a meeting session is active
   **When** the user taps "Stop Meeting"
   **Then** audio capture stops, STT pipeline is flushed, session data is saved to SQLite, and the user returns to Home screen.
3. **Given** recording is active
   **When** the app enters background
   **Then** audio capture continues (foreground service on Android, background audio mode on iOS).

## Tasks / Subtasks

- [ ] Implement "New Meeting" navigation flow (AC: 1)
  - [ ] Create session UUID and timestamp on tap.
  - [ ] Navigate to MeetingScreen with session context.
  - [ ] Initialize STT pipeline via react-native-sherpa-onnx.
  - [ ] Initialize on-device translator via NllbTranslatorModule.
- [ ] Implement "Stop Meeting" flow (AC: 2)
  - [ ] Stop audio capture and flush STT buffer.
  - [ ] Cancel any in-progress translation.
  - [ ] Persist final session state to SQLite.
  - [ ] Navigate back to Home with new session at top of list.
- [ ] Handle background/foreground transitions (AC: 3)
  - [ ] Android: foreground service with notification for active recording.
  - [ ] iOS: background audio entitlement + AVAudioSession category.

## Dev Notes

- No server connection needed. Session starts and stops entirely on-device. [Source: {ARCH_REF}#ADR-001]
- Session state managed by Zustand store, persisted to SQLite on stop. [Source: {ARCH_REF}#Local Storage]
