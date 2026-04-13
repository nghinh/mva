# BMAD VNPT Java Spring Boot Custom Workflow

This package externalizes the Spring Boot backend guidance that was previously bundled directly inside `bmad-dev-custom`.

## What's included
- `src/module.yaml`
- `src/workflows/bmad-vnpt-java-springboot/workflow.md`
- `extras/opencode-commands/bmad-vnpt-java-springboot.md`
- `extras/opencode-skills/bmad-vnpt-java-springboot/`
- `tools/install_workflow.py`
- `tools/verify_workflow.py`

## Purpose
Provide a dedicated Java/Spring Boot backend skill pack for BMAD/OpenCode so `bmm-dev` can explicitly load a separate backend skill instead of relying on an embedded local file.

## Install
```bash
python /path/to/bmad-vnpt-java-springboot/tools/install_workflow.py   --repo /path/to/your/repo   --package /path/to/bmad-vnpt-java-springboot
```

## Verify
```bash
python /path/to/bmad-vnpt-java-springboot/tools/verify_workflow.py   /path/to/your/repo
```
