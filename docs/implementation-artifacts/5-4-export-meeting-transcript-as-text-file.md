# Story 5.4: Export meeting transcript as text file

Status: ready-for-dev

## Story

As a user,
I want to export a meeting transcript as a shareable text file,
so that I can share meeting notes with colleagues.

## Acceptance Criteria

1. **Given** a completed session is open in Review screen
   **When** the user taps "Export Transcript"
   **Then** a `.txt` file is generated and the system share sheet opens.
2. **Given** the exported file
   **When** opened
   **Then** format is: `[HH:MM:SS] [LANG] Original text\n→ Vietnamese translation\n\n` for each utterance.

## Tasks / Subtasks

- [ ] Generate transcript text file (AC: 1, 2)
  - [ ] Header: "Meeting Voice Assistant - Meeting [date] [time]".
  - [ ] Body: chronological entries with timestamp, language, original, translation.
  - [ ] Footer: summary statistics.
- [ ] Trigger system share sheet (AC: 1)
  - [ ] Use `react-native-share` or `Share` API.
  - [ ] File name: `MVA-transcript-YYYY-MM-DD-HHMM.txt`.

## Dev Notes

- Export is local-only. File is generated on device and shared via system share sheet (AirDrop, email, etc.). No server upload. [Source: {PRD_REF}#FR-042]
