# bmad-vnpt-java-springboot

## Purpose
Provide a disciplined Java/Spring Boot backend workflow for BMAD/OpenCode tasks so backend implementation stays aligned with project architecture, API contracts, and production-grade Spring Boot patterns.

## Required Inputs
- the active story/task description
- relevant architecture/API documents in `docs/` when they exist
- applicable `AGENTS.md` files
- the local bundled Spring Boot skill pack in `.opencode/skills/bmad-vnpt-java-springboot/`

## Mandatory Rules
- Always load and use `bmad-vnpt-java-springboot` before producing significant Java/Spring Boot backend changes.
- Always inspect the local codebase first to understand the real controller/service/repository/DTO structure.
- Always read relevant architecture or API documents in `docs/` when they exist.
- Prefer the smallest safe change that fits the existing repository conventions.
- Preserve API contracts unless the task explicitly requires changing them.
- Consider validation, exception handling, observability, transaction boundaries, and production-safe defaults.

## Required Processing Sequence
1. Read the full task/story.
2. Determine whether the work affects controller, service, repository, DTO, validation, integration, persistence, async, cache, or scheduler logic.
3. Read the bundled local `SKILL.md`.
4. Read the relevant local source files first.
5. Read relevant architecture/API docs in `docs/` when available.
6. Produce a short Backend Intake Summary before editing.
7. Implement the smallest safe change.
8. Run the narrowest useful checks first, then broader checks if the change is shared or risky.

## Backend Intake Summary
Before editing, restate:
- the backend task
- the likely affected layers
- the target file(s) or module(s)
- API/DTO/entity impact
- validation/exception/security implications
- assumptions or missing information

## Completion Standard
Before declaring completion, confirm:
- the correct backend layers were updated
- API/DTO/validation impacts were handled
- changes follow local conventions and Spring Boot patterns
- relevant checks were run when available
