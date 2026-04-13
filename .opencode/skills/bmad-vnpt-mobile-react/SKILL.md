---
name: bmad-vnpt-mobile-react
description: Build or review React Native / Expo mobile code using VNPT mobile standards and modern React Native best practices.
---

# bmad-vnpt-mobile-react

## Purpose
Use this skill for mobile work in repositories using:
- Expo
- Expo Router
- React Native
- React Native with TypeScript
- mobile monorepos containing an Expo or React Native workspace

## Core Technical Principles
1. **Expo-first** for new apps and standard product delivery unless the repo clearly requires bare React Native.
2. **Expo Router first** in Expo apps that use file-based routing.
3. **TypeScript-first** and strict-friendly code.
4. **Server state != UI state**.
5. **TanStack Query** for server state, caching, invalidation, background refetching, retries, and optimistic patterns where appropriate.
6. **Zustand** only for lightweight client-side UI/workflow/session state that should not live in React Query.
7. **SecureStore for secrets**, AsyncStorage only for non-sensitive data such as preferences and harmless cache fragments.
8. **Thin screens, rich hooks/services**.
9. **Performance-aware defaults** for lists, rerenders, image loading, and navigation lifecycle.
10. **Test the state machine**, not just the happy path.

## Architecture Defaults
Unless the repository already has a stronger convention, prefer this shape:

```text
src/
  app/                       # Expo Router routes/layouts when applicable
  components/ui/             # shared UI primitives
  features/
    <feature>/
      api/
      hooks/
      screens/
      store/
      types.ts
  lib/
    http/
    query/
    storage/
  test/
```

## Decision Rules

### Routing
- If the repo uses `expo-router`, stay on that model.
- If the repo uses `@react-navigation/*`, stay on that model.
- Do not mix paradigms casually.

### State
Use **TanStack Query** when the data:
- comes from an API
- needs cache/invalidation
- has loading/error/retry state
- can benefit from stale/fresh semantics

Use **Zustand** when the data is:
- local UI state across screens/components
- temporary workflow state
- wizard/filter/sheet/tab selection state
- not the canonical source of truth from the backend

Use local component state when the state is:
- tightly scoped to a single component
- simple and ephemeral

### Storage
- Use **SecureStore** for tokens, secrets, refresh credentials, and sensitive identifiers.
- Use **AsyncStorage** for theme, onboarding flags, harmless drafts, and other non-sensitive preferences.
- Wrap storage behind `src/lib/storage/` helpers rather than scattering calls.

## Required Processing Order
1. Read local `SKILL.md`
2. Read local `workflow.md`
3. Read relevant files in `templates/`
4. Read relevant files in `scripts/`
5. Detect repo architecture
6. Produce an Artifact Intake Summary
7. Implement or review using the smallest suitable pattern
8. Validate route, query, storage, and user-visible state behavior
9. Report risks, tests, and follow-up

## Mobile Risk Checklist
Always inspect these before completion:
- loading state
- empty state
- error state
- duplicate tap / double submit
- concurrent mutation race
- stale data after mutation
- wrong query invalidation scope
- missing cancellation / unmount safety
- navigation side effects on focus/blur
- secrets stored insecurely
- large list performance
- offline / retry behavior where relevant

## Performance Defaults
- Prefer Hermes defaults and avoid undoing them.
- For large lists, prefer FlatList/SectionList with tuned props and stable keys.
- Avoid expensive re-renders from oversized inline objects/functions in hot paths.
- Keep screen components composition-friendly and memoize only when it actually reduces churn.

## Testing Defaults
Prefer:
- unit tests for pure logic and mapping
- component tests for screen states and interactions
- integration-ish tests for hooks/services/query flows
- E2E tests for auth, checkout, submit, or other business-critical flows

## Templates Included
This skill includes starter templates for:
- feature structure
- screen component
- query hook
- Zustand store
- API service

## Scripts Included
This skill includes helper scripts for:
- scaffolding a mobile feature folder
- auditing basic mobile architecture conventions
- review prompt support

## Completion Standard
A mobile task is not complete until you can state:
- what routing pattern was used
- what server state pattern was used
- what local state pattern was used
- what storage choice was used and why
- what risky edge cases were checked
- what tests were added or are still missing
