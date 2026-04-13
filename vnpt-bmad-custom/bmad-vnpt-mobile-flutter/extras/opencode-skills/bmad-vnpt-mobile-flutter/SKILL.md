---
name: bmad-vnpt-mobile-flutter
description: Build or review Flutter mobile code using VNPT mobile Flutter standards and modern Flutter best practices.
---

# bmad-vnpt-mobile-flutter

## Purpose
Use this skill for repositories using:
- Flutter apps
- Flutter package/plugin work that affects app behavior
- mobile monorepos containing one or more Flutter applications

## Distilled Technical Principles
1. **Feature-first architecture** over layer-only-by-type sprawl.
2. **MVVM/UDF-friendly design**: widgets stay thin, state flows down, events flow up.
3. **Official Flutter architecture first**: UI layer + logic/view-model layer + data layer, with domain/use-cases only when complexity truly justifies them.
4. **go_router first for new routing** unless the repo already standardizes on another router.
5. **Repo-convention-first state management**: preserve existing Riverpod/Bloc/Provider patterns. For new scalable work, prefer Riverpod because of compile-safety, linting, and testability.
6. **Repository + service split**: repositories orchestrate app-facing data; services speak to HTTP/storage/platform layers.
7. **Secure secrets storage**: tokens, refresh secrets, and sensitive identifiers must not be stored in plain preferences.
8. **Immutable models and explicit failure states**.
9. **Analyzer + tests are mandatory quality gates** for non-trivial work.
10. **No happy-path-only implementation**: always inspect loading, empty, error, retry, lifecycle, duplicate tap, and inconsistent-state paths.

## Architecture Defaults
Unless the repository already has a stronger convention, prefer this shape:

```text
lib/
  app/
    di/
    router/
  core/
    network/
    result/
    storage/
  features/
    <feature>/
      presentation/
        providers/
        screens/
      data/
        repositories/
        services/
      domain/
        models/
```

Notes:
- Keep `domain/` light or omit it when the feature is simple.
- Do not add use-case classes just for ceremony.

## Decision Rules

### Routing
- If the repo already uses `go_router`, stay on it.
- If the repo already uses another router, preserve that unless explicitly migrating.
- For new apps/features without a strong existing router, prefer `go_router`.

### State
- Preserve the existing repo stack first.
- For new scalable flows, prefer **Riverpod**.
- For tiny/simple local state, prefer widget state or a very local notifier.
- Do not introduce a second global state stack casually.

### Data
- Repositories expose app-facing methods.
- Services deal with HTTP/storage/platform APIs.
- View models/providers should not embed raw HTTP calls.

### Storage
- Use secure storage for secrets and sensitive identifiers.
- Use SharedPreferences (or equivalent harmless local persistence) only for non-sensitive flags/settings.
- Wrap persistence behind small adapters in `core/storage/`.

## Required Processing Order
1. Read local `SKILL.md`
2. Read local `workflow.md`
3. Read relevant files in `templates/`
4. Read relevant files in `scripts/`
5. Detect repo architecture and state stack
6. Produce an Artifact Intake Summary
7. Implement or review with the smallest suitable pattern
8. Validate routes, provider/state flow, storage, and user-visible behavior
9. Report risks, tests, and follow-up

## Mobile Risk Checklist
Always inspect these before completion:
- loading state
- empty state
- error state
- retry state
- duplicate tap / double submit
- stale state after navigation return
- provider disposal / listener leaks
- async updates after widget disposal
- deep link / route guard edge cases
- secrets stored insecurely
- offline / flaky network behavior where relevant
- large list rebuild/performance risk

## Analyzer & Test Defaults
Prefer:
- `flutter analyze`
- unit tests for pure logic, mapping, and repositories
- widget tests for screen state and interaction
- `integration_test` for auth, payment, submit, or other critical journeys

## Commands to Prefer
- `flutter pub get`
- `flutter analyze`
- `flutter test`
- `dart format .`
- project-specific build/run commands only when needed

## Included Assets
- `templates/feature-structure.md`
- `templates/screen-template.dart`
- `templates/provider-template.dart`
- `templates/repository-template.dart`
- `templates/service-template.dart`
- `templates/router-template.dart`
- `scripts/scaffold_flutter_feature.py`
- `scripts/audit_flutter_structure.py`
- `scripts/review_prompt.md`
- `skeleton/` Flutter reference structure

## Completion Standard
Before declaring completion:
- explain detected repo mode
- confirm routing/state choice and why
- list files changed or reviewed
- state which analyzer/tests were run
- state which risks were checked
- mention anything not fully verified
