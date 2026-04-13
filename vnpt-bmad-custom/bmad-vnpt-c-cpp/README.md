# BMAD VNPT C/C++

This package adds a BMAD/OpenCode custom workflow named `bmad-vnpt-c-cpp` for production-grade native development in C and C++.

## What is inside
- `src/module.yaml`
- `src/workflows/bmad-vnpt-c-cpp/workflow.md`
- `extras/opencode-commands/bmad-vnpt-c-cpp.md`
- `extras/opencode-skills/bmad-vnpt-c-cpp/`
  - `SKILL.md`
  - `scripts/verify_c_cpp.py`
  - `skeleton/cmake-app/` reference template
- `tools/install_workflow.py`
- `tools/verify_workflow.py`

## Design goals
- Work well for backend native modules, system utilities, CLI tools, desktop foundations, SDKs, and performance-critical components.
- Default to modern CMake, compiler warnings, clang-format, clang-tidy, sanitizers, and repeatable dependency management.
- Encourage repository-aware changes rather than template dumping.

## Curated research basis
This pack was intentionally aligned with reputable sources:
- C++ Core Guidelines (modern C++ design and safety)
- Clang/LLVM documentation for clang-tidy, clang-format, AddressSanitizer, and UBSan
- CMake official documentation
- vcpkg manifest mode documentation and Conan 2 documentation
- GoogleTest official documentation
- Cppcheck official documentation

## Install
```bash
python /path/to/bmad-vnpt-c-cpp/tools/install_workflow.py --repo /path/to/your/repo --package /path/to/bmad-vnpt-c-cpp
```

## Verify
```bash
python /path/to/bmad-vnpt-c-cpp/tools/verify_workflow.py /path/to/your/repo
```
