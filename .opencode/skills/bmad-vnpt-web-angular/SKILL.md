---
name: bmad-vnpt-web-angular
description: Build or review Angular web code using VNPT Angular standards and modern Angular best practices.
---

# bmad-vnpt-web-angular

## Purpose
Use this skill for web work in repositories using:
- Angular standalone APIs
- Angular CLI / angular.json workspaces
- Nx Angular workspaces
- Angular SSR / hydration setups
- legacy Angular repositories being incrementally modernized

## Core Technical Principles
1. **Standalone-first** for new Angular work.
2. **Feature-first structure** over giant shared dumping grounds.
3. **Signals-first for local synchronous UI state**.
4. **RxJS stays first-class for async/evented flows** such as HttpClient streams, router events, websocket streams, and cancellation-aware compositions.
5. **Use signal/RxJS interop intentionally**, not gratuitously.
6. **Route-level lazy loading by default** for feature pages when appropriate.
7. **Use deferrable views selectively** for heavy below-the-fold or secondary UI.
8. **Thin components, richer services/facades/stores**.
9. **Testing-first** with unit/component/integration/E2E layering.
10. **Read the source after tracing the flow**; do not rely on architecture assumptions alone.

## Architecture Defaults
Unless the repository already has a stronger convention, prefer this shape:

```text
src/
  app/
    app.config.ts
    app.routes.ts
    core/
    shared/
    features/
      <feature>/
        data/
        models/
        pages/
        state/
        <feature>.routes.ts
```

## Decision Rules

### Standalone vs NgModule
- If the repo is already standalone, stay standalone.
- If the repo is NgModule-based, do not start a disruptive migration unless the task explicitly requires it.
- Prefer incremental modernization at feature boundaries.

### State
Use **signals** when the state is:
- local view state
- derived UI state
- synchronous feature state with clear ownership

Use **RxJS** when the flow is:
- HttpClient-driven
- evented or cancellable
- multi-source async composition
- router/form stream composition

Use an existing store library only when the repo already standardizes on it or the feature truly has cross-cutting complexity.

### Routing and Performance
- Prefer route-level lazy loading for feature pages.
- Use `loadComponent` / `loadChildren` patterns consistent with the repo.
- Consider deferrable views for expensive secondary content, not for every component.

### Templates and Components
- Keep templates readable and shallow.
- Move imperative logic out of templates.
- Prefer small, cohesive standalone components.
- Be explicit about loading, empty, and error states.

## Required Processing Order
1. Read local `SKILL.md`
2. Read local `workflow.md`
3. Read relevant files in `templates/`
4. Read relevant files in `scripts/`
5. Detect repo architecture
6. Produce an Artifact Intake Summary
7. Implement or review using the smallest suitable pattern
8. Validate route, state, and user-visible behavior
9. Report risks, tests, and follow-up

## Angular Risk Checklist
Always inspect these before completion:
- loading state
- empty state
- error state
- duplicate click / double submit
- overlapping or stale requests
- missing unsubscribe / uncontrolled effect side effects
- null or undefined template bindings
- route param assumptions
- guard/resolver failure behavior
- SSR/hydration mismatch risk when relevant
- accidental heavy bundle growth from eager imports

## Performance Defaults
- Prefer route-based lazy loading for feature boundaries.
- Prefer deferrable views for expensive secondary sections when worthwhile.
- Avoid unnecessary broad effects or subscriptions.
- Keep change-detection work narrow and predictable.
- Avoid over-abstracting simple template/view logic into heavy frameworks.

## Testing Defaults
Prefer:
- unit tests for pure functions, mapping, guards, and lightweight state
- component tests for page/component states and interactions
- HTTP tests for data services
- integration/E2E coverage for auth, checkout, submit, or other business-critical flows

## Templates Included
This skill includes:
- standalone component template
- feature route template
- data service template
- signal state/facade template
- feature structure reference

## Review Mode
In review/debug mode:
- trace route -> guard/resolver -> component -> state/service -> API
- verify with source reads after flow tracing
- check non-happy-path behavior first
- identify blast radius and missing tests
