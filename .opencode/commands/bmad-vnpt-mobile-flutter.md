---
description: Build or review Flutter mobile features using the bundled VNPT Mobile Flutter workflow.
---
Run `bmad-vnpt-mobile-flutter`.

Important:
- Load the local skill pack inside `.opencode/skills/bmad-vnpt-mobile-flutter/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`
  - relevant files in `templates/`
  - relevant files in `scripts/`
  - relevant files in `skeleton/` when scaffolding a new feature

Then:
1. Detect whether the repo already uses Riverpod, Bloc, Provider, GetIt, or another established stack.
2. Preserve existing conventions unless the task explicitly authorizes architectural migration.
3. Prefer feature-first folders, thin widgets, explicit state/error handling, and repo/service separation.
4. Use `go_router` for new routing only when no stronger existing router convention is present.
5. Use secure storage for sensitive values, not plain shared preferences.
6. Validate loading, empty, error, retry, duplicate tap, lifecycle, and navigation-sensitive paths.
7. End with files changed, risks checked, and tests added/missing.
