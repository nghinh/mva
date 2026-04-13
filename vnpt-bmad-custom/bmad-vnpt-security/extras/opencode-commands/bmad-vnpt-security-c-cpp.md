---
description: Review C/C++ services, agents, and libraries for memory safety, bounds/lifetime issues, unsafe parsing, command execution, and crypto/storage misuse.
---
Run `bmad-vnpt-security-c-cpp`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - ownership, lifetime, bounds, raw pointer aliasing, manual memory management, and unsafe string/buffer APIs
  - parser/input handling, file/path/process creation, privilege boundaries, IPC/network framing, and deserialization
  - thread safety, shared mutable state, TOCTOU, integer overflow/underflow, and error handling at trust boundaries
  - build flags, sanitizers, third-party native dependencies, secret material handling, and logging of sensitive data

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
