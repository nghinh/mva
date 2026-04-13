# bmad-vnpt-python

BMAD custom package for Python work across:
- AI / ML
- Web APIs and web apps
- Desktop applications
- CLI tools, automation scripts, and utilities

## Design principles
- pyproject.toml first
- type hints first
- Ruff + pytest + mypy as the default quality baseline
- prefer uv or venv based isolated environments
- choose framework by problem shape:
  - FastAPI for typed APIs and services
  - Django for admin-heavy / full-stack web
  - PySide6 for rich desktop apps
  - Typer for user-facing CLIs
  - stdlib argparse for tiny zero-dependency scripts
  - scikit-learn pipelines for classical ML
  - PyTorch for deep learning / training-heavy workloads

## Installation targets
- command: `.opencode/commands/bmad-vnpt-python.md`
- skill: `.opencode/skills/bmad-vnpt-python/`
- workflow: `.opencode/skills/bmad-vnpt-python/workflow.md`
