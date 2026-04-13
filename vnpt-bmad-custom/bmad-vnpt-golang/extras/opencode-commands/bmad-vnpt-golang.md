---
description: Design or implement Go backend work using the bundled VNPT Go backend patterns, scripts, skeleton, and workflow.
---
Run `bmad-vnpt-golang`.

Important:
- Load the local bundled pack inside `.opencode/skills/bmad-vnpt-golang/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`

Then:
1. Parse the backend task and identify affected layers or Go packages
2. Read relevant local architecture/API docs under `docs/` when they exist
3. Apply the Go backend patterns for handlers, services, repositories, adapters, context propagation, error handling, concurrency safety, and production-safe defaults
4. Use the bundled scripts/skeleton when helpful, while still validating against the real repository structure
5. Make the smallest safe backend change that solves the task
6. Validate the implementation against repository conventions and available checks

Do not declare completion until:
- the appropriate backend layers were updated consistently
- contract, context, concurrency, and validation impacts were considered
- relevant checks were run when available
