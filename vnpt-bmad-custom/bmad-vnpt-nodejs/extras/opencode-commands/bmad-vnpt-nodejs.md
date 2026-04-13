---
description: Design or implement Node.js/TypeScript work using the bundled VNPT Node.js workflow, validators, and skeleton.
---
Run `bmad-vnpt-nodejs`.

Important:
- Load the local bundled pack inside `.opencode/skills/bmad-vnpt-nodejs/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`

Then:
1. Classify the task: API/service, worker/queue, CLI/tool, library/package, monorepo package, or mixed Node.js app
2. Read the real repository layout, package manager, runtime version target, and build/test scripts before proposing changes
3. Apply the bundled Node.js patterns for package boundaries, ESM/CJS compatibility, TypeScript structure, async/event-loop safety, configuration, validation, observability, and release hygiene
4. Reuse bundled scripts and the skeleton only when they fit the real repository shape
5. Make the smallest safe code or config change that solves the task
6. Validate from narrow to broad: typecheck/lint/unit first, then integration/build/runtime checks when the change is shared or risky

Do not declare completion until:
- module format and package boundary impact were considered
- runtime/config/env handling and error-path behavior were considered
- blocking/event-loop risk and concurrency impact were considered when relevant
- relevant lint, typecheck, test, audit, and startup checks were run when available
