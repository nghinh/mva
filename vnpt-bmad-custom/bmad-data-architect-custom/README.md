# BMAD Data Architecture Custom Workflow

This package adds a new BMAD-compatible workflow for **data architecture synthesis and scaffold preparation**.

## Workflow added
- `bmad-create-data-architecture`

## What this workflow does
It consumes:
- PRD
- architecture
- UX design
- project context
- UI concept source generated from `bmad-create-ui-design-concept`
- actual frontend/backend source tree structure

It then performs five strict phases:

1. **Artifact Intake and Gate**
   - Reads all required artifacts
   - Refuses to continue if no UI concept source exists

2. **Create Data Architecture Markdown Package**
   - Creates `docs/data-architecture/`
   - Generates area/page/module/feature-specific markdown files
   - Creates baseline files such as `README.md` and `00-shared-contracts.md`

3. **Verification and Normalization**
   - Completes shared contracts
   - Improves README ownership notes
   - Fixes structural mismatches and naming inconsistencies

4. **Backend and Frontend Integration Documents**
   - Creates `20-api-contract-checklist.md`
   - Creates `30-frontend-dto-query-mutation-mapping.md`
   - Normalizes names across all specs

5. **Source Skeleton Generation**
   - Generates frontend skeletons for api client/query keys/hooks/adapters
   - Generates `docs/data-architecture/openapi/openapi-draft.yaml`
   - Performs an anti-overloading pass for backend boundaries

## Install into a repo for OpenCode use
```bash
python /path/to/bmad-data-architect-custom/tools/install_workflow.py \
  --repo /path/to/your/repo \
  --package /path/to/bmad-data-architect-custom
```

## Optional BMAD registration
```bash
npx bmad-method@6.2.0 install
```

Then provide this package's `src/` directory as custom module content.

## Verify
```bash
python /path/to/bmad-data-architect-custom/tools/verify_workflow.py \
  /path/to/your/repo
```
