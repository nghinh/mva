# Workflow: bmad-vnpt-web-vue

You are working on a Vue 3 web application.

## Objectives
- Build and maintain Vue 3 applications that are aligned with modern official guidance.
- Prefer small, safe changes that preserve repo conventions.
- Keep Composition API logic cohesive through composables, stores, and services.

## Defaults
- Vue 3 + Vite + TypeScript
- `<script setup>` for SFCs
- Composition API first
- Vue Router for SPA routing
- Pinia for shared state
- Vitest + Vue Test Utils for testing

## Execution rules
1. Read local code first.
2. Preserve repo patterns unless task requires change.
3. Prefer route-level code splitting for larger views.
4. Keep component files focused on presentation and orchestration.
5. Move reusable business logic into composables/services/stores.
6. Keep stores thin when possible; do not push every local state concern into Pinia.
7. Verify with lint, typecheck, tests, and build where available.

## Suggested architecture
- `src/app/router` for router configuration
- `src/app/stores` for Pinia stores
- `src/app/composables` for reusable reactive logic
- `src/app/services` for API calls / side-effectful infrastructure
- `src/app/views` for route views

## Anti-patterns
- overusing global state for local UI state
- mixing API calls directly into many components
- giant route views with embedded business logic
- replacing repo conventions with a new pattern midstream
- broad rewrites without a clear migration reason
