# Workflow: bmad-vnpt-python

## Purpose
Deliver or review Python solutions using domain-appropriate patterns instead of forcing one stack onto every Python task.

## Routing
1. Detect the Python sub-domain:
   - **Web API / service** -> prefer FastAPI unless the repository is already Django/Flask based.
   - **Full-stack web / admin-heavy app** -> prefer Django if the repository or task clearly fits.
   - **Desktop GUI** -> prefer PySide6 for rich desktop apps; tkinter only for tiny built-in tooling.
   - **CLI / script / utility** -> prefer Typer for maintained CLIs; argparse for tiny zero-dependency scripts.
   - **Classical ML / tabular ML** -> prefer scikit-learn pipelines.
   - **Deep learning / training / inference pipeline** -> prefer PyTorch.
2. Read local project conventions first.
3. Keep changes minimal and aligned with the existing architecture unless explicitly asked to modernize.

## Mandatory quality baseline
- Keep a `pyproject.toml` centered toolchain.
- Prefer isolated environments.
- Use type hints in new code.
- Run Ruff, pytest, and mypy where available.
- For web apps, verify framework-specific checks.
- For desktop/CLI packaging, verify the runnable entry point.

## Deliverables
- clear architecture choice
- concise implementation plan
- minimal code change set
- verification evidence
- follow-up risks / TODOs if any
