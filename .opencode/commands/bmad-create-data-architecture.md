---
description: Create a full data architecture package from BMAD artifacts, UI concept source, and project source structure.
---
Run the strict BMAD-aligned data architecture workflow.

Required artifact intake:
1. Find and read the UI concept source first
2. Find and read the primary PRD artifact in `docs/`
3. Find and read the primary architecture artifact in `docs/`
4. Find and read the primary UX design artifact in `docs/`
5. Read `docs/project-context.md` if present
6. Read applicable `AGENTS.md`
7. Inspect the actual frontend and backend source tree structure

Hard gate:
- If no UI concept source exists, stop and tell the user to run `bmad-create-ui-design-concept` first.

Then execute all phases in order:
1. Artifact Intake and Gate
2. Create `docs/data-architecture/` markdown package for pages/modules/features
3. Verify and complete:
   - `docs/data-architecture/00-shared-contracts.md`
   - `docs/data-architecture/README.md`
4. Create:
   - `docs/data-architecture/20-api-contract-checklist.md`
   - `docs/data-architecture/30-frontend-dto-query-mutation-mapping.md`
5. Generate:
   - frontend skeleton for api client + query keys + hooks + adapters
   - `docs/data-architecture/openapi/openapi-draft.yaml`

Before completion, explicitly confirm each mandatory phase was completed.
