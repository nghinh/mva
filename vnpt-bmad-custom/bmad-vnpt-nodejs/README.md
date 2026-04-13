# BMAD VNPT Node.js

This package adds a BMAD/OpenCode custom workflow named `bmad-vnpt-nodejs` for production-grade Node.js and TypeScript development.

## What is inside
- `src/module.yaml`
- `src/workflows/bmad-vnpt-nodejs/workflow.md`
- `extras/opencode-commands/bmad-vnpt-nodejs.md`
- `extras/opencode-skills/bmad-vnpt-nodejs/`
  - `SKILL.md`
  - `scripts/verify_nodejs.py`
  - `scripts/analyze_repo_nodejs.py`
  - `scripts/scaffold_feature.py`
  - `scripts/generate_quality_report.py`
  - `skeleton/express-ts-app/` reference template
- `tools/install_workflow.py`
- `tools/verify_workflow.py`

## Design goals
- Work well for Node.js APIs, workers, CLI tools, services, monorepos, and TypeScript-first backends.
- Prefer a repository-aware approach over template dumping.
- Encourage modern package metadata, clean module boundaries, safer async behavior, fast feedback loops, and production readiness.
- Use the smallest practical toolchain: Node built-ins where they fit, and ecosystem tools only where they clearly add value.

## Curated research basis
This pack was intentionally aligned with reputable sources:
- Node.js official docs for packages, the built-in test runner, worker threads, diagnostics, and event loop guidance
- npm official docs for `package.json`, workspaces, lockfiles, and `npm audit`
- TypeScript official docs for project references and module/moduleResolution choices
- ESLint official docs for flat config
- Express official docs for production security, performance, health checks, and operational hardening
