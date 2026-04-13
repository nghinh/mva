# Story 5.2: Build session history list on home screen

Status: ready-for-dev

## Story

As a user,
I want to see a list of my past meeting sessions on the home screen,
so that I can quickly find and review previous meetings.

## Acceptance Criteria

1. **Given** 5 past sessions exist in SQLite
   **When** the Home screen loads
   **Then** all 5 sessions are displayed as cards with: date/time, duration, language badges, utterance count, last translation preview.
2. **Given** no sessions exist
   **When** the Home screen loads
   **Then** an empty state illustration is shown with "Start your first meeting" text and arrow pointing to the FAB.
3. **Given** a session card
   **When** the user swipes left
   **Then** a delete option appears with confirmation dialog.

## Tasks / Subtasks

- [ ] Build SessionCard component (AC: 1)
  - [ ] Date + time range (e.g., "Apr 12 • 14:30-15:45").
  - [ ] Duration badge (e.g., "1h 15m").
  - [ ] Language pills: colored badges for detected languages.
  - [ ] Utterance count.
  - [ ] Last translation preview (truncated to 1 line).
- [ ] Query sessions from SQLite (AC: 1)
  - [ ] `SELECT * FROM sessions ORDER BY started_at DESC`.
  - [ ] Join with utterances for language breakdown and count.
- [ ] Build empty state (AC: 2)
- [ ] Implement swipe-to-delete (AC: 3)
  - [ ] Confirmation dialog: "Delete this session? This cannot be undone."
  - [ ] Delete session + all linked utterances + translations from SQLite.

## Dev Notes

- Home screen is the app's main landing. FAB "New Meeting" button is the primary CTA. [Source: {UX_REF}#Home Screen]
