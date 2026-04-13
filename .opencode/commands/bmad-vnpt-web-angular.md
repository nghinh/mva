---
description: Build or review Angular web features using the bundled VNPT Angular workflow.
---
Run `bmad-vnpt-web-angular`.

Important:
- Load the local skill pack inside `.opencode/skills/bmad-vnpt-web-angular/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`
  - relevant files in `templates/`
  - relevant files in `scripts/`
  - relevant files in `skeleton/` when scaffolding a new feature

Then:
1. Detect whether the repo is standalone Angular, legacy NgModule Angular, Nx/monorepo Angular, or SSR/hydration Angular.
2. Produce an Artifact Intake Summary.
3. Use the smallest architecture that fits.
4. Keep components thin and move logic into services/stores/facades.
5. Prefer signals for local UI state and keep RxJS for async streams and HttpClient flows.
6. Validate loading, empty, error, duplicate submit, stale state, null safety, and lazy-loading behavior.
7. End with files changed, risks checked, and tests added/missing.
