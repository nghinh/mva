# bmad-vnpt-mobile-react

## Purpose
Build or review React Native / Expo mobile features in a BMAD-aligned way using the bundled VNPT Mobile React guidance, templates, scripts, and skeleton.

## Default Technical Stance
- Prefer Expo for new apps unless the repository clearly requires bare React Native.
- Prefer Expo Router for Expo apps.
- Treat React Navigation patterns as the fallback for non-Expo-Router repositories.
- Prefer TypeScript and strict typing.
- Separate server state from client UI state.
- Prefer TanStack Query for server state.
- Prefer Zustand for local UI/workflow state.
- Use SecureStore for encrypted secrets and AsyncStorage only for non-sensitive preferences.
- Keep screens thin and move business logic into feature hooks/services.

## Required Inputs
- the user request or active task/story
- applicable docs in `docs/`
- applicable `AGENTS.md`
- repository conventions if already established
- the bundled local mobile skill pack files

## Required Local Files To Read
Before implementation, read and use:
- local `SKILL.md`
- local `workflow.md`
- relevant files under `templates/`
- relevant files under `scripts/`
- relevant files under `skeleton/` when scaffolding

## Artifact Intake Summary
Before writing files, restate:
- feature/screen/module name
- target platform scope (Expo / RN bare / shared)
- navigation entry and affected routes
- API/data dependencies
- persistent storage needs
- selected state strategy
- selected templates
- assumptions and unresolved questions

## Mandatory Processing Sequence

### Phase 1 — Detect Mobile Architecture
Identify whether the repo is:
1. Expo Router app
2. Expo app without Router
3. bare React Native app
4. monorepo with mobile workspace

Detect signals such as:
- `expo`, `expo-router`, `app.json`, `app.config.*`, `eas.json`
- `@react-navigation/*`
- `android/` and `ios/`
- `src/app/` or `app/` routes

### Phase 2 — Decide Feature Placement
Place code using repo conventions first; otherwise prefer:
- `src/app/` or `app/` for routes and layouts
- `src/features/<feature>/` for feature logic
- `src/lib/http/` for API client
- `src/lib/query/` for query configuration
- `src/lib/storage/` for storage wrappers
- `src/components/ui/` for shared UI primitives

### Phase 3 — Select Architecture Pattern
Choose the lightest architecture that fits the task:
- screen + hook + service for small features
- feature folder with api/hooks/store/types for medium features
- feature folder plus adapters/domain mapping for larger or riskier flows

### Phase 4 — Implement
By default, generate or update:
- route/screen file
- feature hook(s)
- API/service file when needed
- types/schema file when needed
- local store only when truly needed
- tests or test scaffolding

### Phase 5 — Review Mobile Risks
Always check:
- loading/empty/error states
- duplicate submit / double tap / re-entrancy
- offline or retry behavior for mutations
- stale cache and invalidation correctness
- auth token handling / secret storage
- navigation lifecycle side effects
- large list performance
- platform-specific assumptions

### Phase 6 — Validate
Validate:
- routing / navigation wiring
- type safety
- query key and invalidation consistency
- storage choice safety
- user-visible states
- tests or justified omission

### Phase 7 — Completion Summary
At the end, report:
- files changed
- routing approach used
- state approach used
- storage approach used
- key mobile risks checked
- tests added or missing
- follow-up work

## Review Mode
When the user requests review/debug only:
- do not modify code
- trace route entry, screen, hooks, services, storage, and API flow
- check auth, offline, duplicate submit, retry, cache, and lifecycle effects
- surface likely edge cases and test gaps

## Mandatory Mobile Guardrails
- Do not store tokens or other sensitive secrets in AsyncStorage.
- Do not put network-fetching state into ad-hoc local component state if TanStack Query is already the repo pattern.
- Do not introduce a global store when local state or query cache is enough.
- Do not block the UI thread with avoidable heavy synchronous work.
- Do not add a new navigation paradigm if the repo already has one.
- Keep screens thin; push logic into hooks/services.
