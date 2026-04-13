# Story 6.3: Implement developer mode metrics overlay

Status: ready-for-dev

## Story

As a developer,
I want a metrics overlay on the meeting screen showing real-time STT and translation latency,
so that I can monitor performance during testing.

## Acceptance Criteria

1. **Given** developer mode is enabled in Settings
   **When** a meeting is active
   **Then** a small metrics bar appears below the Stop button showing: STT latency (ms), Translation latency (ms), RAM usage (MB).
2. **Given** developer mode is disabled
   **When** a meeting is active
   **Then** no metrics are visible.

## Tasks / Subtasks

- [ ] Build MetricsOverlay component (AC: 1)
  - [ ] Tiny monospace text: "STT: 180ms • Trans: 920ms • RAM: 1.1GB".
  - [ ] Update on each STT/translation event.
  - [ ] Position below Stop button, secondary color.
- [ ] Track latency metrics (AC: 1)
  - [ ] STT latency: time from audio chunk to text emission.
  - [ ] Translation latency: time from translate() call to result.
  - [ ] RAM: use platform APIs (Android: ActivityManager, iOS: task_info).
- [ ] Toggle via settings (AC: 2)
  - [ ] Read `devMode` from settings store. Conditionally render overlay.

## Dev Notes

- Dev mode is for internal testing only. Not shown to end users by default. [Source: {PRD_REF}#FR-062]
