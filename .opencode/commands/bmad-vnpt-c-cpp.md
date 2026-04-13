---
description: Design or implement native C/C++ work using the bundled VNPT C/C++ workflow, validators, and skeleton.
---
Run `bmad-vnpt-c-cpp`.

Important:
- Load the local bundled pack inside `.opencode/skills/bmad-vnpt-c-cpp/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`

Then:
1. Parse whether the task is C, C++, or mixed native code
2. Read relevant local architecture/API/build docs under `docs/` when they exist
3. Apply the bundled native engineering patterns for build system design, API boundaries, memory ownership, RAII, error handling, portability, concurrency, testing, and diagnostics
4. Reuse the bundled scripts and skeleton only when they fit the actual repository structure
5. Make the smallest safe native code change that solves the task
6. Validate with the narrowest meaningful checks first, then broader checks when the change is shared or risky

Do not declare completion until:
- build, ABI or API impact was considered
- memory/resource lifetime and concurrency impact were considered
- relevant formatting, static analysis, test, and sanitizer checks were run when available
