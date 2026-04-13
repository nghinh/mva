# BMAD UI Design Concept Workflow (BMAD 6.2.0)

This package contains only the new workflow `bmad-create-ui-design-concept`.

## What is included
- `src/module.yaml` for BMAD custom module installation
- `src/workflows/bmad-create-ui-design-concept/workflow.md`
- OpenCode command fallback
- install + verify scripts

## Install
1. Optional BMAD registration:
   - Run `npx bmad-method@6.2.0 install`
   - When prompted for custom module path, point to `src/`
2. OpenCode install:
   - `python tools/install_workflow.py --repo /path/to/repo --package /path/to/this/package`
3. Restart OpenCode.


## R2 improvements
This revision tightens the workflow so it behaves more like a BMAD planning workflow:
- explicitly reads `docs/ux-design.md`
- explicitly reads `docs/project-context.md` when present
- explicitly locates and reads PRD artifacts
- explicitly locates and reads architecture artifacts
- requires an Artifact Intake Summary before generating HTML
- requires a completion quality gate so the workflow cannot silently skip core BMAD artifacts
