# Story 5.3: Build session review detail screen

Status: ready-for-dev

## Story

As a user,
I want to tap a past session and see the full transcript with translations in chronological order,
so that I can review what was discussed in a meeting.

## Acceptance Criteria

1. **Given** the user taps a session card on the Home screen
   **When** the Review screen opens
   **Then** a summary card shows duration, language breakdown, and utterance count, followed by a chronological list of all utterances with their translations.
2. **Given** the chronological list
   **When** scrolling through
   **Then** each entry shows: timestamp, language badge, original text, and Vietnamese translation (in amber text below).

## Tasks / Subtasks

- [ ] Build ReviewScreen layout (AC: 1, 2)
  - [ ] Top bar: back arrow + "Meeting [date]" + export icon.
  - [ ] Summary card: duration, languages (with counts), total utterances.
  - [ ] Timeline: FlatList of entries sorted by timestamp.
  - [ ] Each entry: `[HH:MM:SS] [LANG] Original text` → `Vietnamese translation`.
- [ ] Query session data from SQLite (AC: 1)
  - [ ] Join utterances + translations for the given session_id.
  - [ ] Order by utterance timestamp ascending.

## Dev Notes

- Review screen uses unified timeline (not split lanes). Different from live meeting screen. [Source: {UX_REF}#Review Screen]
