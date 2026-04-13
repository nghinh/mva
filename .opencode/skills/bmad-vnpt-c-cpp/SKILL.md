---
name: bmad-vnpt-c-cpp
description: VNPT BMAD custom native C/C++ workflow and skill pack with modern CMake, safety checks, testing, and reusable skeleton.
---

# BMAD VNPT C/C++ Custom Skill Pack

This package wraps curated native engineering guidance into a BMAD/OpenCode-compatible custom workflow.

## What this pack optimizes for
- Production-grade C and C++ implementation work
- Repository-aware changes instead of generic scaffolding
- Strong defaults for build reproducibility, diagnostics, testability, safety, and maintainability
- Practical support for CLI tools, native SDKs, backend services/modules, utilities, desktop foundations, and performance-sensitive components

## Research-backed defaults used by this pack
1. Prefer modern CMake as the default cross-platform build system.
2. Prefer C++20 or C++17 for C++ code unless repository constraints require older standards.
3. Prefer C17 or C11 for C code unless repository constraints require otherwise.
4. Prefer explicit target-based CMake usage over global directory-wide flags.
5. Prefer reproducible dependency management with `vcpkg.json` manifest mode when the repo uses vcpkg.
6. Accept Conan 2 where the repo already uses Conan or needs package-centric binary workflows.
7. Enforce formatting with `clang-format` and static analysis with `clang-tidy`; augment with `cppcheck` when useful.
8. Use sanitizers in debug or CI builds when available, especially AddressSanitizer and UndefinedBehaviorSanitizer.
9. Prefer GoogleTest for mainstream C++ unit testing unless the repo already standardizes on Catch2 or another framework.
10. Favor RAII, ownership clarity, const-correctness, small interfaces, narrow contracts, and explicit error handling.

## Operational rules
- Load this skill before meaningful C/C++ implementation work.
- Inspect the real repository structure first. The bundled skeleton is a fallback accelerator, not a substitute for repo analysis.
- Preserve existing toolchain and ABI constraints unless the task explicitly allows changing them.
- Prefer the smallest safe change that fits the existing architecture.
- Never introduce silent ownership ambiguity, hidden global state, or thread-unsound behavior.
- For public APIs, think about ABI stability, exception boundaries, and header hygiene.

## Native engineering checklist
### 1) Build and dependency management
- Prefer target-based CMake commands such as `target_compile_features`, `target_link_libraries`, `target_include_directories`, and `target_compile_options`.
- Keep compile definitions and warning flags target-scoped.
- Use presets or clearly separated debug/release configurations when the repo supports them.
- If the project uses vcpkg, prefer manifest mode and commit `vcpkg.json`.
- If the project uses Conan, stay on Conan 2 conventions and keep dependency metadata explicit.

### 2) Memory and lifetime
- In C++, prefer RAII and standard library ownership types (`std::unique_ptr`, `std::shared_ptr` only where justified, references, `std::span`, `std::string_view` with lifetime awareness).
- Avoid raw owning pointers.
- In C, keep allocation and release responsibilities explicit, centralized, and easy to audit.
- Avoid returning references or views to ephemeral storage.
- Avoid hidden transfer of ownership.

### 3) API and ABI design
- Keep public headers small and stable.
- Minimize macro abuse.
- Prefer value semantics for small types and references/views for non-owning parameters where lifetime is clear.
- Use pimpl or internal translation-unit boundaries if ABI stability matters.
- Document exception strategy at module boundaries.

### 4) Error handling
- In C++, use exceptions only if the repository already embraces them and the boundary policy is clear.
- Otherwise prefer explicit status objects, error codes, or `std::expected`-style patterns if the codebase already uses them.
- In C, return clear status values and provide predictable cleanup paths.
- Never swallow system errors. Preserve enough context for diagnosis.

### 5) Concurrency and performance
- Identify shared state before editing.
- Respect cancellation, timeouts, and thread ownership when they exist.
- Avoid data races, detached-thread leaks, and ad hoc synchronization.
- Measure before applying micro-optimizations.
- Prefer algorithmic and allocation improvements over premature low-level tweaks.

### 6) Validation stack
Run the narrowest useful validation first:
- formatting: `clang-format --dry-run --Werror`
- static analysis: `clang-tidy`
- additional static analysis when appropriate: `cppcheck`
- tests: `ctest` or repo-native test commands
- runtime diagnostics: ASan/UBSan builds when available

## Required processing sequence
1. Read the full task/story.
2. Determine whether the work affects build system, headers/public API, core implementation, tests, packaging, or diagnostics/CI.
3. Read the local bundled `SKILL.md`.
4. Read the relevant local source files first.
5. Read relevant architecture/build/API docs in `docs/` when available.
6. Produce a short Native Intake Summary before editing.
7. Implement the smallest safe change.
8. Run the narrowest useful checks first, then broader checks if the change is shared or risky.
9. Use bundled validators when they fit the repository and task.

## Native Intake Summary
Before editing, restate:
- the native task
- whether it is C, C++, or mixed
- likely affected modules/targets
- target file(s) or package(s)
- build/API/ABI impact
- memory, ownership, and concurrency implications
- assumptions or missing information

## Suggested default stack for new repos
- Build: CMake
- Package manager: vcpkg manifest mode by default; Conan 2 when package workflows are already adopted
- Formatting: clang-format
- Static analysis: clang-tidy + cppcheck
- Testing: GoogleTest for C++
- Debug diagnostics: ASan + UBSan where supported

## Completion standard
Before declaring completion, confirm:
- build files and source files remain aligned
- API/ABI and ownership impacts were handled
- changes follow local conventions and modern native engineering patterns
- relevant checks or bundled validators were run when available
