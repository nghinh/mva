# bmad-create-data-architecture

## Purpose
Create a rigorous, implementation-ready data architecture package that bridges BMAD planning artifacts, architecture decisions, UX artifacts, UI concept source, backend contract design, frontend data integration design, and initial source skeletons.

This workflow is intentionally strict and sequential.

## Prerequisites
This workflow must only run **after** the project already has:
- a PRD artifact in `docs/`
- an architecture artifact in `docs/`
- a UX design artifact in `docs/`
- a generated UI concept source artifact from the `bmad-create-ui-design-concept` workflow

## Required Inputs
The workflow must discover and read all of the following before continuing:

### Planning / design artifacts
- the primary PRD artifact in `docs/`
- the primary architecture artifact in `docs/`
- the primary UX design artifact in `docs/`
- `docs/project-context.md` if present
- applicable `AGENTS.md` files

### Mandatory UI concept source
At least one generated UI concept source must exist. Prefer this order:
1. `docs/ui-design/product-concept.html`
2. another canonical HTML concept artifact under `docs/ui-design/`
3. another explicitly approved UI concept source path if the repo clearly documents it

If no UI concept source exists, **stop immediately** and tell the user to run `bmad-create-ui-design-concept` first.

### Source tree inputs
The workflow must inspect the real project source tree to understand current frontend/backend structure before generating integration specs or code skeletons.

## Output Locations
All data-architecture markdown artifacts must live under:

- `docs/data-architecture/`

Implementation-facing generated artifacts should use these default locations unless the repository already has a stronger convention:
- OpenAPI draft: `docs/data-architecture/openapi/openapi-draft.yaml`
- frontend skeleton code: under the detected frontend source tree
- backend OpenAPI-compatible artifacts: under the detected backend/docs or api-spec area if present

## Sequential Workflow Contract
You must perform the following phases **fully and in order**. Do not skip or reorder them.

---

## Phase 1 — Mandatory Artifact Intake and Gate

### Step 1.1 — Discover required artifacts
Locate and identify:
- PRD source used
- architecture source used
- UX design source used
- project context source used or missing
- UI concept source used
- frontend source root
- backend source root

### Step 1.2 — Read all required artifacts
Read fully:
1. UI concept source
2. PRD artifact
3. architecture artifact
4. UX design artifact
5. project context artifact if present
6. applicable `AGENTS.md`
7. the relevant frontend and backend source tree structure

### Step 1.3 — Hard gate
If the UI concept source is missing, stop and state clearly:
- this workflow cannot proceed
- `bmad-create-ui-design-concept` must be run first
- which expected UI concept path(s) were checked

### Step 1.4 — Artifact Intake Summary
Before generating anything, provide a short intake summary covering:
- artifact paths used
- product scope and goals
- main domains/modules/pages/features inferred
- UX constraints and navigation/information architecture cues
- technical constraints from architecture
- frontend/backend structure discovered
- unresolved ambiguities

---

## Phase 2 — Create Data Architecture Markdown Package

### Step 2.1 — Create the folder package
Ensure `docs/data-architecture/` exists.

### Step 2.2 — Derive page/module/feature breakdown
Using the PRD, architecture, UX design, and UI concept source together, derive a normalized breakdown of:
- pages
- modules / subsystems
- major features
- integration boundaries
- key entities / aggregates / DTO families
- ownership boundaries between frontend and backend

### Step 2.3 — Create markdown files per page/module/feature
Create a coherent set of markdown files under `docs/data-architecture/` so that each page, module, feature, or bounded area has a dedicated design artifact.

These files must make the data architecture explicit and well thought through.

Each area file should include, where applicable:
- purpose and scope
- owning page/module/feature
- user journey touchpoints
- source of truth entities
- write model and read model
- required DTOs
- filters/query params/sort/search needs
- mutation commands and expected responses
- validation constraints
- state transitions
- derived/computed fields
- pagination needs
- caching expectations
- realtime or notification needs
- auditability / observability needs
- security / authorization considerations
- error cases and empty states
- integration touchpoints with other areas
- open questions / assumptions

### Step 2.4 — Required baseline files
At minimum, the workflow must create or update:
- `docs/data-architecture/README.md`
- `docs/data-architecture/00-shared-contracts.md`

And enough additional markdown files to cover the actual pages/modules/features discovered from the artifacts and UI concept.

Recommended numbering pattern:
- `00-shared-contracts.md`
- `01-domain-map-and-ownership.md`
- `10-<area>.md`
- `11-<area>.md`
- `12-<area>.md`
- etc.

---

## Phase 3 — Verification and Normalization

After the initial markdown package is created, verify and strengthen it.

### Step 3.1 — Mandatory shared contracts completion
`docs/data-architecture/00-shared-contracts.md` must explicitly define and/or finalize:
- base path `/api/v1`
- response envelope
- pagination meta
- filter/query model
- auth payload
- notification DTO
- realtime event envelope
- shared registry enums

### Step 3.2 — README completion
`docs/data-architecture/README.md` must:
- explain the package purpose
- list all generated files
- state the ownership boundaries currently assumed
- call out any real routes/endpoints/features that are not yet fully routed/owned
- reduce the chance that backend implements duplicate or conflicting contracts

### Step 3.3 — Structural verification
Reread all generated data-architecture markdown files and correct:
- structural mismatches
- data shape inconsistencies
- naming inconsistencies
- mismatched ownership
- unrealistic coupling between frontend and backend
- contradictions against architecture or UI concept

---

## Phase 4 — Backend and Frontend Integration Documents

### Step 4.1 — API contract checklist
Create:
- `docs/data-architecture/20-api-contract-checklist.md`

This file must define endpoint-by-endpoint implementation guidance for backend, including:
- endpoint path
- method
- purpose
- owning module
- auth requirement
- request DTO
- response DTO
- pagination/filter/search/sort rules
- validation rules
- error contract expectations
- realtime/event implications if any
- dependencies on shared contracts

### Step 4.2 — Frontend DTO / query / mutation mapping spec
Create:
- `docs/data-architecture/30-frontend-dto-query-mutation-mapping.md`

And, if helpful, additional page-specific mapping files under `docs/data-architecture/frontend-mapping/`.

This specification must map each page to:
- screen or route
- API contract(s) consumed
- frontend DTO shape(s)
- query keys
- query parameter structure
- mutation payloads
- optimistic update expectations
- cache invalidation rules
- adapter/transform needs
- view-model mapping needs
- error/loading/empty state data handling

### Step 4.3 — Global naming normalization
Reread all markdown outputs and normalize:
- field names
- enum names
- DTO names
- query parameter names
- mutation names

Remove duplicate meanings expressed with different names.

---

## Phase 5 — Source Skeleton Generation

This phase is mandatory.

### Step 5.1 — Frontend skeleton generation
Using the project’s actual frontend source structure, generate a minimal but usable skeleton for:
- API client organization
- query keys
- hooks
- adapters / mappers

The skeleton must align with the specs created in Phase 4 and respect the existing frontend architecture.

Do not over-implement business logic. Generate structure and contracts, not full feature completion.

### Step 5.2 — OpenAPI-style draft generation
Using `docs/data-architecture/20-api-contract-checklist.md`, generate:
- `docs/data-architecture/openapi/openapi-draft.yaml`

This should be an OpenAPI-style draft artifact representing the current API contract direction.

### Step 5.3 — Backend overloading prevention pass
Do one more review pass and improve the draft if needed to avoid backend overloading or poor initial boundary design, for example:
- too many responsibilities on a single endpoint
- inconsistent aggregate ownership
- excessive chatty endpoints
- poor separation between command/read concerns
- ambiguous auth or payload semantics

---

## Best-Practice Additions
You may add reasonable best-practice details if they improve the deliverable, but you must not skip or weaken the mandatory phases above.

Examples of acceptable additions:
- a domain map file
- a route ownership matrix
- a contract versioning note
- a frontend data ownership matrix
- an eventing/realtime appendix
- a naming glossary

---

## Mandatory Quality Gate Before Completion
Before declaring completion, explicitly confirm:
- the UI concept source was found and read
- PRD, architecture, and UX design were read
- data-architecture markdown files were created under `docs/data-architecture/`
- `00-shared-contracts.md` was completed
- `README.md` was completed
- API contract checklist was created
- frontend DTO/query/mutation mapping spec was created
- frontend skeleton code was generated
- OpenAPI-style YAML draft was generated
- naming normalization and structural verification were completed

## Completion Note
End with:
- the files created or updated
- any blockers or assumptions
- any follow-up decisions recommended before full implementation begins
