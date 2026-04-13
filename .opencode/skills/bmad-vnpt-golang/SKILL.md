---
name: bmad-vnpt-golang
description: VNPT BMAD custom Go backend skill pack for production-grade Go services with clean architecture, context-safe concurrency, validation, and quality gates.
---

# BMAD VNPT Golang Skill

## Purpose
Load this skill for Go backend work that affects architecture, handlers, services, repositories, adapters, routing, concurrency, validation, or cross-cutting quality concerns.

This skill is optimized for BMAD/OpenCode execution. It keeps the core instructions in this file short and moves detailed standards into reference files so the agent can ingest quickly and then open only the references needed for the current task.

## Execution Model
1. Read this `SKILL.md` completely before making significant changes.
2. Scan the workspace and confirm the current repository structure before proposing edits.
3. Open only the relevant reference files for the task:
   - Architecture or layering change → `references/architecture.md`
   - Go implementation quality → `references/go-standards.md`
   - Router work → `references/router-conventions.md`
   - Validation / completion / reports → `references/quality-gates.md`
   - Script usage → `references/scripts.md`
   - Repo-specific overrides → `references/project-overrides-template.md` or local repo override file
   - Examples of what to avoid → `references/anti-patterns.md`
4. Make the smallest safe change that fits the repository architecture.
5. Run the narrowest useful validation first, then broader validation for risky or shared changes.
6. Before completion, run the required quality gates and verify the build.

## Non-Negotiable Rules

### 1) Verify repository reality
Treat prior context, previous turns, logs, and assumptions as advisory only. Before changing code, verify repository-critical facts directly from the current workspace.

### 2) Preserve architecture
Do not flatten feature folders or move files out of their architectural layer just to fix imports. Keep feature-based clean architecture intact.

### 3) Use feature package naming plus import aliases
Within a feature, subfolders use the feature package name, not the folder name. When importing sibling layers, alias imports using `<feature>_<layer>`.

### 4) Propagate context correctly
Do not use `context.Background()` or `context.TODO()` in production request paths. Accept context from callers and propagate it through services, repositories, adapters, and goroutines.

### 5) Handle errors explicitly
Do not ignore errors. Wrap errors with operation context. Validate JSON, parsing, type assertions, locking, and external calls.

### 6) Prefer production-ready changes within confirmed scope
Do not leave TODOs, placeholders, or stub logic in production code. If safe completion is blocked by missing requirements or repository constraints, explicitly state the blocking gap and implement the maximum safe subset without fake completeness.

### 7) Respect project conventions
Use repo-specific logger, wiring entry points, skeletons, and stack choices only when they are actually present in the current repository. Do not hardcode project-specific assumptions into generic changes.

### 8) Keep code maintainable
Avoid oversized files and functions. Split by responsibility when needed. Prefer focused handlers, services, repositories, and internal helper files over monoliths.

### 9) Validate before completion
Run the appropriate validators for the change type. Compilation and relevant quality checks must pass before considering the task complete.

## Default Working Conventions
- Prefer constructor injection and interface-first design.
- Validate request inputs at the boundary.
- Keep services free of framework-specific concerns when possible.
- Wrap third-party integrations in adapters.
- Respect tenant isolation where applicable.
- Prefer structured logging and avoid logging secrets.
- Prefer `errgroup` or bounded concurrency patterns over unmanaged goroutines.

## Required References
- `references/architecture.md`
- `references/go-standards.md`
- `references/quality-gates.md`
- `references/scripts.md`

## Conditional References
- `references/router-conventions.md` for router/controller work
- `references/project-overrides-template.md` for repo-specific wiring and logger rules
- `references/anti-patterns.md` when diagnosing quality issues or code review regressions

## Quick Start

### New feature
1. Use `scaffold_feature.py` if available.
2. Use `generate_di_wiring.py` if the repo follows that convention.
3. Implement business logic following architecture and Go standards.
4. Run targeted validators, then the quality report if available.
5. Run `go build ./...`.

### Existing feature change
1. Inspect current feature structure and conventions.
2. Make the smallest safe change.
3. Run only the validators relevant to the risk profile.
4. Run `go build ./...`.

### Router change
1. Open `references/router-conventions.md`.
2. Use descriptive controller variable names.
3. Keep route registration organized and consistent.
4. Validate context propagation and error handling.

## Completion Checklist
- No TODO, FIXME, HACK, stub, or placeholder logic added.
- No ignored errors without explicit justification.
- Context propagation preserved.
- Architecture preserved.
- Appropriate validators run.
- `go build ./...` passes.

## File Layout
- `SKILL.md`: core operational rules
- `references/architecture.md`: architecture and package/import policy
- `references/go-standards.md`: implementation quality standards
- `references/router-conventions.md`: router/controller conventions
- `references/quality-gates.md`: completion and validation rules
- `references/scripts.md`: script catalog and execution strategy
- `references/project-overrides-template.md`: repo-specific override template
- `references/anti-patterns.md`: concise anti-pattern catalog
- `CHANGELOG.md`: what changed from the original monolithic version

