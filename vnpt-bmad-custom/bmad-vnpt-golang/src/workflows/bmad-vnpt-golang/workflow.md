# bmad-vnpt-golang

## Purpose
Provide a disciplined Go backend workflow for BMAD/OpenCode tasks so Go services stay aligned with project architecture, production-readiness, concurrency safety, context propagation, and clean backend layering.

## Required Inputs
- the active story/task description
- relevant architecture/API documents in `docs/` when they exist
- applicable `AGENTS.md` files
- the local bundled Go skill pack in `.opencode/skills/bmad-vnpt-golang/`

## Mandatory Rules
- Always load and use `bmad-vnpt-golang` before producing significant Go backend changes.
- Always inspect the local codebase first to understand the real handler/service/repository/module structure.
- Prefer the smallest safe change that fits the existing repository conventions.
- Preserve API contracts unless the task explicitly requires changing them.
- Consider context propagation, error handling, validation, observability, concurrency, idempotency, transaction boundaries, and production-safe defaults.
- Use the bundled scripts and skeleton when they improve speed or confidence, but never bypass reading the real repository code.

## Required Processing Sequence
1. Read the full task/story.
2. Determine whether the work affects handlers/controllers, services/use-cases, repositories/data access, middleware, adapters/integrations, background workers, goroutines, events, or API contracts.
3. Read the bundled local `SKILL.md`.
4. Read the relevant local source files first.
5. Read relevant architecture/API docs in `docs/` when available.
6. Produce a short Go Backend Intake Summary before editing.
7. Implement the smallest safe change.
8. Run the narrowest useful checks first, then broader checks if the change is shared or risky.
9. Use bundled validators when they fit the repository and task.

## Go Backend Intake Summary
Before editing, restate:
- the backend task
- the likely affected layers/modules
- the target file(s) or package(s)
- API/model/event impact
- context/concurrency/error-handling implications
- assumptions or missing information

## Recommended Validation Focus
- context propagation
- error handling and wrapping
- function/file size when maintainability is at risk
- route/controller alignment
- dead code or middleware misuse
- goroutine safety and cancellation boundaries

## Completion Standard
Before declaring completion, confirm:
- the correct backend layers were updated
- API/model/validation impacts were handled
- changes follow local conventions and Go backend patterns
- relevant checks or bundled validators were run when available
