# Checklist: c-cpp

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- ownership, lifetime, bounds, raw pointer aliasing, manual memory management, and unsafe string/buffer APIs
- parser/input handling, file/path/process creation, privilege boundaries, IPC/network framing, and deserialization
- thread safety, shared mutable state, TOCTOU, integer overflow/underflow, and error handling at trust boundaries
- build flags, sanitizers, third-party native dependencies, secret material handling, and logging of sensitive data

Hotspot checks:
- strcpy/sprintf/memcpy arithmetic, unchecked casts, custom allocators, and exception-safety / RAII gaps
- setuid/service privileges, shell invocation, file permissions, temp files, and config parsing boundaries
- ASan/UBSan/clang-tidy/cppcheck evidence when available

Evidence to collect:
- Exact files and line references for each finding
- Relevant config values and default behaviors
- Tool output only if it materially supports the finding

Output reminder:
- Severity
- Evidence
- Blast radius
- Fix recommendation
- Gaps / unknowns
