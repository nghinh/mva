# /bmad-vnpt-python

Use this workflow when the task or repository is primarily Python and falls into one or more of:
- AI / ML
- FastAPI / Django / Flask web
- PySide6 / tkinter desktop
- CLI, automation, scripts, or utilities

## Required behavior
- First classify the task into the correct Python sub-domain.
- Follow `bmad-vnpt-python` skill guidance.
- Prefer the smallest safe change.
- Do not force a framework migration unless explicitly requested.
- Verify with the narrowest useful checks first.

## Domain routing
- FastAPI for typed APIs and services
- Django for full-stack/admin-heavy apps
- PySide6 for rich desktop
- Typer for maintained CLIs
- argparse for tiny zero-dependency scripts
- scikit-learn pipelines for classical ML
- PyTorch for deep learning workloads
