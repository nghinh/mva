---
description: Design or implement Java Spring Boot backend work using the bundled VNPT Spring Boot patterns and workflow.
---
Run `bmad-vnpt-java-springboot-custom`.

Important:
- Load the local bundled pack inside `.opencode/skills/bmad-vnpt-java-springboot-custom/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`

Then:
1. Parse the backend task and identify affected layers
2. Read relevant local architecture/API docs under `docs/` when they exist
3. Apply the Spring Boot patterns for controller, service, repository, DTO, validation, exception handling, observability, and production-safe defaults
4. Make the smallest safe backend change that solves the task
5. Validate the implementation against repository conventions and available checks

Do not declare completion until:
- the appropriate backend layers were updated consistently
- contract and validation impacts were considered
- relevant checks were run when available
