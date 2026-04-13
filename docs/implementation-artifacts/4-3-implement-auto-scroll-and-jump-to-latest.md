# Story 4.3: Implement auto-scroll and jump-to-latest

Status: ready-for-dev

## Story

As a user,
I want both lanes to auto-scroll to the latest entry, and if I scroll up to review history, I want a button to jump back to live,
so that I can review past content without losing track of the current conversation.

## Acceptance Criteria

1. **Given** a new entry appears in a lane
   **When** auto-scroll is enabled (default)
   **Then** the lane smoothly scrolls to show the latest entry.
2. **Given** the user manually scrolls up in a lane
   **When** they stop scrolling
   **Then** auto-scroll pauses for THAT lane only, and a floating "↓ Latest" pill button appears at the bottom of that lane.
3. **Given** the user taps the "↓ Latest" pill
   **When** tapped
   **Then** the lane scrolls to the bottom and auto-scroll re-enables.

## Tasks / Subtasks

- [ ] Implement auto-scroll logic per lane (AC: 1, 2)
  - [ ] Track `isAtBottom` state per lane via `onScroll` event.
  - [ ] Auto-scroll on new content only if `isAtBottom=true`.
  - [ ] Set `isAtBottom=false` when user scrolls up (scroll velocity < 0).
- [ ] Build "↓ Latest" floating pill (AC: 2, 3)
  - [ ] Position at bottom of the scrolled lane, centered horizontally.
  - [ ] Semi-transparent violet background, down arrow + "Latest" text.
  - [ ] Fade in when auto-scroll pauses, fade out when re-enabled.
  - [ ] `onPress`: scroll to end + set `isAtBottom=true`.

## Dev Notes

- Each lane manages its own scroll state independently. [Source: {UX_REF}#Scroll Behavior]
