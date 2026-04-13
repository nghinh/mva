# BMAD VNPT Deep Review

This package adds a dedicated **review-only** BMAD/OpenCode workflow for deep source-code analysis.

It is optimized for:
- whole-codebase review
- tracing risky flows and hidden bugs
- impact analysis before changes
- side-effect and downstream-risk analysis
- review tasks where **code must not be changed**

## Core review strategy
1. Use **GitNexus first** for codebase-level map, entry points, call chain, shared paths, and downstream impact.
2. Use **Serena second** only where symbol ownership, callers/callees, or cross-file structure is still unclear.
3. Read the actual source files at the returned hotspots to verify.
4. Review not only happy paths, but also error paths, transaction boundaries, concurrency, duplicate requests, state inconsistency, and guard conditions.
5. Do **not** edit code in this workflow.

## Included assets
- `src/module.yaml`
- `src/workflows/bmad-vnpt-deep-review/workflow.md`
- `extras/opencode-commands/bmad-vnpt-deep-review.md`
- `extras/opencode-skills/bmad-vnpt-deep-review/SKILL.md`
- `tools/install_workflow.py`
- `tools/verify_workflow.py`

## Install
```bash
python /path/to/bmad-vnpt-deep-review/tools/install_workflow.py   --repo /path/to/your/repo   --package /path/to/bmad-vnpt-deep-review
```

## Verify
```bash
python /path/to/bmad-vnpt-deep-review/tools/verify_workflow.py /path/to/your/repo
```
