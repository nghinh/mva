# bmad-vnpt-python

## Mission
Handle Python work across AI/ML, Web, Desktop, and Scripts/Utilities using the best-fitting Python patterns and a strong verification baseline.

## Core defaults
- `pyproject.toml` first
- isolated environment first
- Python type hints by default in new code
- Ruff for lint/format baseline
- pytest for tests
- mypy where type coverage is meaningful
- preserve local project conventions unless the task asks for modernization

## Domain-specific guidance

### 1) Web APIs and services
Prefer **FastAPI** for new typed APIs and services.
Use:
- dependency injection via FastAPI dependencies
- Pydantic / pydantic-settings for configuration and validation
- modular app structure for bigger apps
- explicit response models for public APIs

If the repository is already Django or Flask:
- stay within the existing framework
- do not introduce FastAPI unless explicitly requested

#### FastAPI implementation rules
- keep route handlers thin
- move business logic to services/use-cases
- isolate external clients
- validate request/response schemas
- centralize settings through pydantic-settings
- prefer async only when the stack is truly async end-to-end

### 2) Full-stack/admin-heavy web
Prefer **Django** when the project clearly benefits from:
- server-rendered pages
- built-in admin
- ORM + forms + auth batteries-included workflow

Django rules:
- keep business logic out of views where possible
- test with Django test tools / client
- avoid fat models and fat views at the same time; extract services when complexity grows
- preserve migration discipline

### 3) Scripts / CLI / Utilities
For a maintained CLI:
- prefer **Typer**
- expose entry points with `[project.scripts]`
- keep commands composable and typed

For tiny zero-dependency scripts:
- `argparse` is acceptable
- still keep a `main()` and `if __name__ == "__main__":` entrypoint

CLI rules:
- deterministic output
- explicit exit codes
- no hidden side effects
- separate I/O from core logic for testability

### 4) Desktop apps
Prefer **PySide6** for rich desktop applications.
Use:
- clear separation between UI state and domain/service logic
- signals/slots for UI interactions
- background work off the UI thread
- keep packaging considerations in mind from the start

Use **tkinter** only when:
- the app is simple
- minimal dependencies are preferred
- native look-and-feel sophistication is not a priority

### 5) AI / ML
For tabular/classical ML:
- prefer **scikit-learn**
- keep preprocessing + model inside a Pipeline
- avoid train/serve skew by reusing the same pipeline
- make train/validation split and metrics explicit

For deep learning:
- prefer **PyTorch**
- make device placement explicit
- separate training, evaluation, and inference
- make checkpointing and reproducibility strategy explicit
- document what is and is not reproducible across hardware/releases

## Structure preferences

### Default package/app layout
- `pyproject.toml`
- `src/`
- `tests/`
- optional domain folders by sub-system
- config in one place
- no random scripts at repository root unless intentionally tiny

### Preferred quality gate
1. `ruff format`
2. `ruff check`
3. `mypy` or targeted typing checks
4. `pytest`
5. framework-specific checks/build/package step when relevant

## Anti-patterns
- mixing notebook-style experimentation directly into production modules
- fat web handlers with database + business logic + HTTP translation in one place
- hard-coded secrets
- ad-hoc global mutable state
- silently swallowing exceptions
- packaging desktop apps as an afterthought
- CLI code with no testable core logic
- ML preprocessing duplicated between training and inference

## Output expectations
When solving a task:
- identify Python sub-domain first
- explain the selected pattern briefly
- implement minimal changes
- list verification performed
- call out remaining risks / assumptions
