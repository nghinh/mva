# Story 4.1: Build meeting screen with two-lane layout

Status: ready-for-dev

## Story

As a user,
I want a meeting screen with two vertically stacked lanes — Original Transcript and Vietnamese Translation,
so that I can glance at both the original speech and its translation during the meeting.

## Acceptance Criteria

1. **Given** the meeting screen is active
   **When** speech is being transcribed and translated
   **Then** two lanes are visible: Transcript Lane (blue left border) at top ~50%, Translation Lane (amber left border) at bottom ~50%.
2. **Given** both lanes contain content
   **When** the user scrolls one lane
   **Then** the other lane is unaffected — each scrolls independently.
3. **Given** the meeting screen layout
   **When** rendered on different screen sizes
   **Then** lanes adapt proportionally (45/55 on small phones, 50/50 on standard, side-by-side on tablet).

## Tasks / Subtasks

- [ ] Build MeetingScreen layout (AC: 1, 3)
  - [ ] Two FlashList/FlatList components stacked vertically.
  - [ ] Transcript Lane: header "ORIGINAL", 2px blue (#3B82F6) left border.
  - [ ] Translation Lane: header "BẢN DỊCH", 2px amber (#F59E0B) left border.
  - [ ] Thin divider (1px, 10% opacity) between lanes.
- [ ] Implement independent scrolling (AC: 2)
  - [ ] Each lane has its own scroll state.
  - [ ] Scrolling one lane does not affect the other.
  - [ ] Use `nestedScrollEnabled` on Android if needed.
- [ ] Connect to Zustand conversation store (AC: 1)
  - [ ] TranscriptLane subscribes to `utterances[]` for original text.
  - [ ] TranslationLane subscribes to `utterances[].translation` for Vietnamese text.
  - [ ] Use selectors to minimize re-renders.

## Dev Notes

- This is a 2-lane layout. There is NO third lane for AI suggestions — that feature was removed. [Source: {PRD_REF}#What This Product Is NOT]
- Dark mode first: meeting rooms are dim, screen should not draw attention. [Source: {UX_REF}#Design Principles]
- Use Reanimated for any layout animations. Keep rendering at 60fps during active transcription. [Source: {UX_REF}#Screen Specifications]
