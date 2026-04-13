---
name: bmad-vnpt-nodejs
description: VNPT BMAD custom Node.js skill pack for production-grade Node.js and TypeScript services, workers, libraries, and CLI tools.
---
# BMAD VNPT Node.js Skill

## When to use
Use this skill for:
- Node.js APIs and backend services
- TypeScript backends and libraries
- queue workers and schedulers
- CLI tools and automation utilities
- monorepos with npm/pnpm/yarn workspaces
- refactors or quality gates in existing Node.js repositories

## Core engineering stance
- Prefer Node.js LTS-friendly, repository-aware changes.
- Keep the current package manager and lockfile unless there is a strong reason to change.
- Treat package boundaries, module format, and runtime boot behavior as first-class design concerns.
- Prefer explicit schemas and narrow interfaces at boundaries.
- Avoid blocking the event loop on hot paths.
- Prefer graceful startup and graceful shutdown over ad hoc process behavior.
- Use scripts as evidence helpers, not as substitutes for reading the code.

## Preferred patterns

### 1) Package and module hygiene
- Keep `package.json` authoritative and minimal.
- Use `exports` deliberately for libraries and shared internal packages.
- Match TypeScript `module` and `moduleResolution` to the runtime/bundler model actually used by the repo.
- Avoid mixing ESM and CJS haphazardly; isolate bridges when needed.
- Preserve lockfiles and workspace metadata.

### 2) Project structure
Typical service layout:
- `src/app` or `src/bootstrap`
- `src/routes` or `src/controllers`
- `src/services`
- `src/repositories`
- `src/domain`
- `src/lib`
- `src/config`
- `test`

For libraries, keep public API small and explicit.
For monorepos, keep package responsibilities narrow and avoid circular local dependencies.

### 3) TypeScript defaults
Prefer:
- `strict: true`
- separated `typecheck` and `build`
- `noEmit` for pure typecheck scripts when bundling/transpiling is handled elsewhere
- project references only when the repo is large enough to benefit

### 4) HTTP/API service guidance
- Validate untrusted input at the edge.
- Centralize error serialization.
- Add health/readiness endpoints when the service is deployed.
- Keep request IDs / correlation hooks and structured logging where the repo supports them.
- Use timeouts, abort signals, and bounded retries for outbound calls.

### 5) Async and runtime safety
- Do not block the event loop with synchronous filesystem work on hot paths.
- Avoid expensive regex or CPU-heavy parsing on request threads.
- Offload CPU-bound work to worker threads or another execution path when justified.
- Use `Promise.allSettled` / controlled concurrency when failure isolation matters.
- Support graceful shutdown for HTTP servers, workers, and background loops.

### 6) Testing and quality
Prefer this stack when the repo does not already standardize differently:
- ESLint flat config
- TypeScript `tsc --noEmit` for typecheck
- Node built-in `node --test` when sufficient
- framework-specific test layers only when needed
- `npm audit` or the repo's dependency-check mechanism as an advisory signal

## Scripts in this pack
- `scripts/verify_nodejs.py` - fast local quality gate and repo shape checks
- `scripts/analyze_repo_nodejs.py` - summarize package manager, module mode, scripts, and test/lint surface
- `scripts/scaffold_feature.py` - scaffold a minimal feature slice when a repo-compatible folder structure exists
- `scripts/generate_quality_report.py` - aggregate quick evidence from package metadata and source layout

## Skeleton
`./skeleton/express-ts-app` is only a reference baseline. Use it selectively.

## Completion checklist
Before declaring the task done, confirm:
- module format compatibility was preserved
- package metadata and scripts still make sense
- typecheck/lint/tests relevant to the change were considered
- env/config handling is explicit and safe
- operational behavior at startup/shutdown/error boundaries is acceptable
