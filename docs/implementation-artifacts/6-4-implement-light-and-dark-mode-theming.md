# Story 6.4: Implement light and dark mode theming

Status: ready-for-dev

## Story

As a user,
I want the app to support both light and dark mode following my system preference,
so that the screen is comfortable in any lighting condition.

## Acceptance Criteria

1. **Given** the system is set to dark mode
   **When** the app renders any screen
   **Then** dark background (#0A0A0F), light text (#E4E2EE), and themed components are used throughout.
2. **Given** the system is set to light mode
   **When** the app renders any screen
   **Then** light background (#FAFAFA), dark text (#1A1A2E), and themed components are used throughout.
3. **Given** the user switches system theme while the app is running
   **When** the change is detected
   **Then** the app re-renders with the new theme without restart.

## Tasks / Subtasks

- [ ] Create theme context with design tokens (AC: 1, 2)
  - [ ] Define all color tokens from UX spec for both modes.
  - [ ] Use `useColorScheme()` hook to detect system preference.
  - [ ] Wrap app in ThemeProvider.
- [ ] Apply theming to all screens (AC: 1, 2)
  - [ ] Home, Meeting, Review, Settings, ModelDownload screens.
  - [ ] All components: SessionCard, LangBadge, TranscriptLane, TranslationLane, etc.
- [ ] Handle dynamic theme switching (AC: 3)
  - [ ] Listen to `Appearance.addChangeListener()`.
  - [ ] Re-render affected components.

## Dev Notes

- Dark mode is the PRIMARY mode — design and test dark mode first, then verify light mode. [Source: {UX_REF}#Design Principles]
- All text must meet WCAG AA contrast ratio (4.5:1) in both modes. [Source: {UX_REF}#Accessibility]
