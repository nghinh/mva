# Story 4.5: Build waiting state before speech detected

Status: ready-for-dev

## Story

As a user,
I want to see a calm "Listening..." state when the meeting starts but before anyone speaks,
so that I know the app is ready and not frozen.

## Acceptance Criteria

1. **Given** the meeting just started and no speech has been detected
   **When** the meeting screen is displayed
   **Then** a subtle sound wave animation appears with "Listening..." text and "Speak in EN, JA, or KO" hint.
2. **Given** the waiting state is shown
   **When** the first speech is detected
   **Then** the waiting animation fades out and the first transcript entry appears in the Transcript Lane.

## Tasks / Subtasks

- [ ] Build WaitingState component (AC: 1)
  - [ ] Centered: subtle sound wave lines (violet, 30% opacity, gentle animation).
  - [ ] "Listening..." text (18px, secondary color).
  - [ ] "Speak in EN, JA, or KO" hint (14px, tertiary color).
  - [ ] Empty lane headers visible below: "ORIGINAL" and "BẢN DỊCH".
- [ ] Transition from waiting to active (AC: 2)
  - [ ] On first `stt_partial` event: fade out WaitingState (200ms).
  - [ ] Show first entry in Transcript Lane.

## Dev Notes

- Waiting state should feel calm and anticipatory, not busy or loading. [Source: {UX_REF}#Meeting Screen Waiting State]
