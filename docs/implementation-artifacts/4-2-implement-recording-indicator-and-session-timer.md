# Story 4.2: Implement recording indicator and session timer

Status: ready-for-dev

## Story

As a user,
I want to see a pulsing red recording dot and elapsed time at the top of the meeting screen,
so that I know the app is actively listening.

## Acceptance Criteria

1. **Given** a meeting session is active
   **When** the top bar is visible
   **Then** a red dot with subtle pulse animation (0.5s cycle, opacity 0.6-1.0) is displayed alongside "Recording" text and elapsed timer (HH:MM:SS format).
2. **Given** the detected language changes
   **When** a new utterance is detected in a different language
   **Then** the language badge in the top bar updates (e.g., "EN" → "JA").

## Tasks / Subtasks

- [ ] Build top bar component (AC: 1, 2)
  - [ ] Left: pulsing red dot + "Recording" + elapsed timer.
  - [ ] Right: current detected language badge (LangBadge component).
  - [ ] Timer updates every second using setInterval.
- [ ] Implement pulse animation (AC: 1)
  - [ ] Use Reanimated or CSS animation for opacity pulse.
  - [ ] Respect `prefers-reduced-motion` — disable pulse if set.

## Dev Notes

- No connection status indicator needed — there is no server to connect to. [Source: {ARCH_REF}#ADR-001]
- Top bar should be fixed (not scroll with content). [Source: {UX_REF}#Meeting Screen]
