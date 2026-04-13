# bmad-vnpt-web-vue

## Purpose
Use this skill for Vue 3 web applications. It is optimized for Vite-based Vue projects and favors modern official Vue guidance.

## Core defaults
- Vue 3 + Vite + TypeScript
- Composition API with `<script setup>`
- Pinia for shared application state only
- Vue Router for SPA routing
- Vitest + Vue Test Utils for verification

## Decision rules
- Prefer `<script setup>` and Composition API for new or refactored Vue SFCs.
- Prefer TypeScript in new code.
- Prefer `createWebHistory()` unless deployment constraints require hash history.
- Prefer lazy-loaded route components for larger route views.
- Prefer composables for reusable reactive/business logic.
- Prefer Pinia for cross-route/shared state; keep local UI state inside components when practical.

## Component guidance
- Keep components small and focused.
- Push heavy data-fetching, caching, and orchestration out of deeply nested leaf components.
- Keep presentational components stateless where possible.
- Avoid overusing watchers when a computed value or explicit action flow is clearer.

## Router guidance
- Keep route definitions readable and feature-oriented.
- Use route meta and guards carefully; centralize auth/permission logic.
- Use route lazy loading for large views.

## Store guidance
- Define stores with `defineStore()`.
- Model stores around domain slices or stable app capabilities.
- Do not treat Pinia as a dumping ground for every reactive variable.
- Keep store actions explicit about side effects and error handling.

## Data / services guidance
- Put API access and transport details in services, not scattered across many components.
- Use composables to bind UI to services and stores.
- Keep error/loading state consistent.

## Testing guidance
- Prefer Vitest for unit tests.
- Prefer Vue Test Utils for component tests.
- Test public behavior over internals.
- Add regression tests for bug fixes.

## Quality gate
After non-trivial changes, prefer:
1. lint
2. typecheck
3. unit tests
4. build

## Deliverables
When finishing, summarize:
- what changed
- architecture or pattern impact
- what was verified
- any follow-up risks
