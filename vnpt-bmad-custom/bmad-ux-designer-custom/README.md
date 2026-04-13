# BMAD UX Designer Customize for BMAD 6.2.0

This package contains only the `bmm-ux-designer` customization.

## Behavior
- Keeps the standard `bmad-create-ux-design` workflow.
- Makes `ui-ux-pro-max` mandatory for UX design work.
- Persists/refines UX outputs under `docs/`, especially `docs/ux-design.md`.

## Install
1. `python tools/install_everything.py --repo /path/to/repo --package /path/to/this/package`
2. In the repo, run `npx bmad-method@6.2.0 install`
3. Choose `Recompile Agents`
4. Restart OpenCode.
