# bmad-vnpt-web-angular

## Purpose
Build or review Angular web features in a BMAD-aligned way using the bundled VNPT Angular guidance, templates, scripts, and skeleton.

## Default Technical Stance
- Prefer standalone Angular APIs and standalone components.
- Prefer feature-oriented folders over giant type-based folders.
- Prefer signals for local synchronous UI state.
- Keep RxJS where async streams, HttpClient flows, router events, and interop naturally belong.
- Prefer route-level lazy loading and use deferrable views for expensive subtrees when it materially improves UX.
- Keep components thin and move business logic into feature stores/facades/services.
- Follow Angular style guide naming, structure, and readability guidance.
- Prefer strict typing, explicit interfaces/models, and narrow public APIs.

## Required Inputs
- the user request or active task/story
- applicable docs in `docs/`
- applicable `AGENTS.md`
- repository conventions if already established
- the bundled local Angular skill pack files

## Required Local Files To Read
Before implementation, read and use:
- local `SKILL.md`
- local `workflow.md`
- relevant files under `templates/`
- relevant files under `scripts/`
- relevant files under `skeleton/` when scaffolding

## Artifact Intake Summary
Before writing files, restate:
- feature/page/module name
- entry route(s) and guards/resolvers involved
- data source and async flow
- state strategy (signals / RxJS / existing store)
- selected templates
- assumptions and unresolved questions

## Mandatory Processing Sequence

### Phase 1 — Detect Angular Architecture
Identify whether the repo is:
1. standalone Angular app
2. legacy NgModule-heavy Angular app
3. Nx/monorepo Angular workspace
4. Angular SSR/hydration app

Detect signals such as:
- `angular.json`, `project.json`, `workspace.json`
- `app.config.ts`, `app.routes.ts`, standalone components
- `@angular/router`, `provideRouter`, `loadComponent`, `loadChildren`
- `server.ts`, hydration, SSR config
- `signals`, `computed`, `effect`, `toSignal`

### Phase 2 — Decide Feature Placement
Place code using repo conventions first; otherwise prefer:
- `src/app/core/` for truly app-wide infrastructure
- `src/app/shared/` for reusable UI primitives and utilities
- `src/app/features/<feature>/` for feature-specific pages, data, models, state, and routes

### Phase 3 — Select Architecture Pattern
Choose the lightest architecture that fits:
- page/component + service for small features
- feature folder with page/data/state/models for medium features
- add facades/adapters only when they reduce complexity, not by default
- do not introduce NgRx or another heavyweight store unless the repo already uses it or the problem genuinely demands it

### Phase 4 — Implement
By default, generate or update:
- route/page component
- feature data service or API service when needed
- signal-based state/facade when needed
- models/types
- tests or test scaffolding

### Phase 5 — Review Angular Risks
Always check:
- loading/empty/error states
- guard and resolver failure behavior
- duplicate submit / double click / in-flight request overlap
- stale state after mutation/navigation
- null/undefined/template binding safety
- route param / query param assumptions
- side effects in `effect()` or subscriptions
- unnecessary zone/change-detection churn
- SSR/hydration assumptions when relevant

### Phase 6 — Validate
Validate:
- route wiring and lazy-loading correctness
- signal vs RxJS responsibilities
- change detection safety
- user-visible states
- test coverage or justified omission

### Phase 7 — Completion Summary
At the end, report:
- files changed
- route/loading strategy used
- state strategy used
- key Angular risks checked
- tests added or missing
- follow-up work

## Review Mode
When the user requests review/debug only:
- do not modify code
- trace entry route, guards, resolvers, components, services, stores/facades, and API flow
- check error states, re-entrancy, stale state, null safety, and downstream impact
- surface likely edge cases and test gaps

## Mandatory Angular Guardrails
- Do not introduce NgModules into a standalone-first codebase unless the repo already requires them.
- Do not force signals everywhere; keep RxJS for async streams where it is the natural abstraction.
- Do not hide business logic in templates.
- Do not scatter direct HttpClient calls across many components.
- Do not introduce a global state library just to solve a local feature problem.
