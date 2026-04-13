# Workflow: bmad-vnpt-nodejs

## Intent
Use this workflow for production-grade Node.js and TypeScript work in services, APIs, workers, libraries, monorepos, and tooling.

## Operating principles
- Prefer understanding the existing repository over forcing a fresh framework pattern.
- Preserve the repo's package manager, lockfile, runtime target, and module system unless the task explicitly requires migration.
- Prefer built-in Node capabilities when they are sufficient, but integrate ecosystem tools already used by the repo.
- Keep changes small, typed, testable, and operationally observable.

## Phase 1 - classify and map
1. Detect whether the repo is JS-only, TS-first, monorepo, service/API, library, worker, or CLI.
2. Identify package manager and lockfile: npm, pnpm, yarn, bun, or mixed artifacts.
3. Identify module mode and build mode:
   - `package.json` `type`
   - `exports`/`main`/`types`
   - `tsconfig*.json`
   - bundler/transpiler if present
4. Identify framework/runtime surface if any: Express, NestJS, Fastify, Next.js custom server, queue workers, cron jobs, scripts.

## Phase 2 - architecture reading
Read before changing:
- root `package.json`
- relevant package `package.json`
- `tsconfig*.json`
- framework bootstrap files
- config/env loading path
- test and lint configuration
- CI files if the task touches release quality

Use `scripts/analyze_repo_nodejs.py` when it helps summarize the repository shape.

## Phase 3 - implement with repository-fit patterns
Apply only the patterns that fit:
- package boundaries and exports discipline
- ESM/CJS compatibility that matches the current runtime target
- TypeScript strictness, path hygiene, and project references where useful
- clear HTTP/service/controller/repository boundaries
- schema validation at system boundaries
- async error handling and graceful shutdown
- event-loop safety and offloading CPU-heavy work
- logging, health checks, metrics hooks, and startup validation
- deterministic scripts for dev, build, test, lint, and verify

## Phase 4 - validate in layers
Prefer this order when available:
1. format or lint
2. typecheck
3. unit tests
4. integration or API tests
5. build/package checks
6. audit or dependency checks
7. runtime smoke check

## Phase 5 - final review gate
Do not finish until you have considered:
- package metadata correctness
- runtime version compatibility
- ESM/CJS interoperability risk
- configuration and secret loading safety
- blocking I/O or CPU hot path risks
- test and release confidence
