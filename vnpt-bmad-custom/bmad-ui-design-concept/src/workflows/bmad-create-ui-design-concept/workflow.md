# bmad-create-ui-design-concept

## Purpose
Create a single, stakeholder-reviewable HTML concept for the product UI while staying aligned with BMAD planning and solutioning artifacts.

## Required Inputs
- `docs/ux-design.md`
- `docs/project-context.md` if present
- PRD document(s) in `docs/` (for example `docs/PRD.md`, `docs/prd.md`, or `docs/prd/`)
- architecture document(s) in `docs/` (for example `docs/architecture.md`, `docs/architecture/`, or equivalent)
- applicable `AGENTS.md` files
- installed `ui-ux-pro-max` skill in OpenCode

## Output
- Exactly one file: `docs/ui-design/product-concept.html`

## Workflow Contract
This workflow is a BMAD-aligned planning/synthesis workflow. It does **not** replace:
- `bmad-create-ux-design`
- `bmad-create-architecture`

Instead, it consumes their artifacts and produces a review artifact for UI concept approval.

## Mandatory Rules
- Always load and use `ui-ux-pro-max` before producing the concept.
- Always read `docs/ux-design.md` fully.
- Always read `docs/project-context.md` if it exists.
- Always locate and read the primary PRD artifact in `docs/`.
- Always locate and read the primary architecture artifact in `docs/`.
- If PRD, UX design, or architecture artifacts are missing, say so explicitly before generating anything.
- Do not generate implementation code, component code, or production-ready frontend code.
- The concept must stay product-wide, approval-oriented, and constrained by documented architecture and UX decisions.
- The final HTML must be self-contained and easy for stakeholders to review.

## Artifact Discovery Rules
1. Start with exact files if they exist:
   - `docs/project-context.md`
   - `docs/ux-design.md`
   - `docs/PRD.md`
   - `docs/prd.md`
   - `docs/architecture.md`
2. If exact files are not present, search under `docs/` for the most relevant PRD and architecture documents or shard indexes.
3. Prefer the most canonical artifact for each category:
   - PRD / requirements artifact
   - architecture / solutioning artifact
   - project-context artifact
   - UX design artifact
4. If multiple candidates exist, pick the one that is clearly the main artifact and state which file you chose.
5. If an artifact category is missing, record it under “Missing Inputs” and proceed conservatively.

## Required Processing Sequence
1. Read `docs/ux-design.md`.
2. Read `docs/project-context.md` if present.
3. Read the main PRD artifact in `docs/`.
4. Read the main architecture artifact in `docs/`.
5. Read applicable `AGENTS.md` files.
6. Load `ui-ux-pro-max`.
7. Produce an **Artifact Intake Summary** before drafting the concept.

## Artifact Intake Summary (must appear before drafting)
Summarize:
- PRD source used
- architecture source used
- UX design source used
- project context source used (or “missing”)
- key product goals
- target users / user segments
- primary user journeys
- UX direction and usability constraints
- technical / architectural constraints that affect UI
- missing inputs or unresolved ambiguities

## HTML Concept Requirements
Create `docs/ui-design/product-concept.html` with these sections:
1. Product concept overview
2. Primary user segments and key journeys
3. Information architecture / navigation model
4. Screen/page/section concepts
5. Interaction intent and behavioral notes
6. Visual direction notes
7. Responsive intent
8. Accessibility intent
9. Design-system direction
10. Architecture-aware feasibility notes
11. Open questions / approval notes

## Quality Gate Before Completion
Before declaring completion, explicitly confirm:
- The PRD was read and reflected
- The architecture was read and reflected
- The UX design was read and reflected
- `ui-ux-pro-max` was used
- Only one HTML file was produced
- The artifact is approval-oriented, not implementation code

## Completion Note
End with:
- the generated file path
- a short approval summary
- any missing inputs or follow-up decisions needed
