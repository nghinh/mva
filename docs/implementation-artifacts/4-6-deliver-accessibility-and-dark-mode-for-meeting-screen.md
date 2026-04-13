# Story 4.6: Deliver accessibility and dark mode for meeting screen

Status: ready-for-dev

## Story

As a user,
I want the meeting screen accessible and readable in both dark and light mode,
so that the app works in any meeting room lighting condition.

## Acceptance Criteria

1. **Given** the system is set to dark mode
   **When** the meeting screen renders
   **Then** dark background (#0A0A0F), light text (#E4E2EE), and colored lane borders are correctly themed.
2. **Given** a screen reader is active
   **When** new transcript/translation entries appear
   **Then** they are announced with appropriate labels ("New transcript in English: ...", "Translation: ...").
3. **Given** the user has enabled `prefers-reduced-motion`
   **When** the meeting screen renders
   **Then** recording pulse animation is disabled and all transitions are instant.

## Tasks / Subtasks

- [ ] Implement dark/light mode theming (AC: 1)
  - [ ] Use design tokens from UX spec for all colors.
  - [ ] Lane borders: blue (#3B82F6) and amber (#F59E0B) in both modes.
  - [ ] Test contrast ratios: all text meets WCAG AA (4.5:1).
- [ ] Add accessibility labels (AC: 2)
  - [ ] All interactive elements have `accessibilityLabel`.
  - [ ] New entries announced via `accessibilityLiveRegion="polite"`.
- [ ] Respect reduced motion (AC: 3)
  - [ ] Check `AccessibilityInfo.isReduceMotionEnabled()`.
  - [ ] Disable pulse animation and use instant transitions.

## Dev Notes

- Dark mode first: most meeting rooms are dimly lit. [Source: {UX_REF}#Design Principles]
- Color independence: lane distinction via left border position + header label, not color alone. [Source: {UX_REF}#Accessibility]
