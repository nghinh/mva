---
description: Build or review React Native / Expo mobile features using the bundled VNPT Mobile React workflow.
---
Run `bmad-vnpt-mobile-react`.

Important:
- Load the local skill pack inside `.opencode/skills/bmad-vnpt-mobile-react/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`
  - relevant files in `templates/`
  - relevant files in `scripts/`
  - relevant files in `skeleton/` when scaffolding a new feature

Then:
1. Detect whether the repo is Expo Router, Expo without Router, or bare React Native.
2. Produce an Artifact Intake Summary.
3. Use the smallest architecture that fits.
4. Keep screens thin.
5. Prefer TanStack Query for server state and Zustand only for local UI/workflow state.
6. Use SecureStore for encrypted secrets and AsyncStorage only for non-sensitive values.
7. Validate loading, empty, error, duplicate submit, retry, and offline-sensitive paths.
8. End with files changed, risks checked, and tests added/missing.
