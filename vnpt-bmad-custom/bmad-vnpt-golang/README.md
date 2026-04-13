# BMAD VNPT Golang

This package converts the legacy `expert-go-backend-developer` skill into a BMAD/OpenCode custom workflow named `bmad-vnpt-golang`.

## Included
- `src/module.yaml`
- `src/workflows/bmad-vnpt-golang/workflow.md`
- `extras/opencode-commands/bmad-vnpt-golang.md`
- `extras/opencode-skills/bmad-vnpt-golang/`
  - normalized `SKILL.md`
  - original `scripts/`
  - original `skeleton/`
  - original `skill.py`
- `tools/install_workflow.py`
- `tools/verify_workflow.py`

## Purpose
Provide a dedicated Go backend skill pack for BMAD/OpenCode so Go implementation work can be routed explicitly to a production-grade Go workflow with reusable validators, code generators, and skeletons.

## Install
```bash
python /path/to/bmad-vnpt-golang/tools/install_workflow.py --repo /path/to/your/repo --package /path/to/bmad-vnpt-golang
```

## Verify
```bash
python /path/to/bmad-vnpt-golang/tools/verify_workflow.py /path/to/your/repo
```
