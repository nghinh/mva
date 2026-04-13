# Workflow: bmad-vnpt-c-cpp

## Purpose
Route native C/C++ work through a repeatable workflow that balances correctness, maintainability, diagnostics, and portability.

## When to use
- C libraries or system utilities
- C++ libraries, services, SDKs, tools, desktop foundations
- Native extensions or performance-critical modules
- Build-system refactors for C/C++ repositories

## Workflow
1. Identify task type
   - C only
   - C++ only
   - mixed C/C++
   - build or packaging only
2. Read local repo conventions
   - `CMakeLists.txt`, presets, toolchain files, package manifests, CI checks
   - relevant headers, source files, tests, docs
3. Emit a Native Intake Summary
4. Implement the smallest safe change
5. Validate in layers
   - formatting
   - compile or configure
   - static analysis
   - tests
   - sanitizer builds if available
6. Summarize outcomes, risks, and any follow-up constraints

## Preferred implementation heuristics
- Prefer target-scoped CMake changes.
- Keep public headers disciplined.
- Keep ownership obvious.
- Preserve portability unless the task is explicitly platform-specific.
- Add or update tests when behavior changes.
- Avoid template or macro complexity unless justified.

## Bundled helpers
- `scripts/verify_c_cpp.py`: quick structural and hygiene checks for common native repos
- `skeleton/cmake-app/`: starter reference for a small CMake native application/library layout

## Definition of done
- The change builds or is structurally consistent with the repo build flow
- Validation commands appropriate to the task have been executed when available
- Memory/resource lifetime concerns have been considered
- API, ABI, portability, and concurrency implications have been addressed where relevant
