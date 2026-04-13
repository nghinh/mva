---
name: bmad-vnpt-security-c-cpp
description: Review C/C++ services, agents, and libraries for memory safety, bounds/lifetime issues, unsafe parsing, command execution, and crypto/storage misuse.
---

# bmad-vnpt-security-c-cpp

Use this workflow when the user wants a **deep stack-specific security review** for **c-cpp**.

## Mission
Produce a high-confidence review by combining:
- **GitNexus** first for repo-level structure, entry points, trust boundaries, shared flows, and blast radius
- **Serena** second only where symbol-level ownership or callers/callees are still unclear
- **direct source reading** for final verification
- **bundled scripts** for repeatable evidence gathering
- **optional external tools** such as Semgrep, Gitleaks, Trivy, ZAP, Nuclei, Scorecard, CycloneDX/Syft, or Cosign where relevant

This workflow is **review-first**. Do not change code unless the user explicitly asks for fixes after the review.

## Specialization
Review C/C++ services, agents, and libraries for memory safety, bounds/lifetime issues, unsafe parsing, command execution, and crypto/storage misuse.

Focus especially on:
- ownership, lifetime, bounds, raw pointer aliasing, manual memory management, and unsafe string/buffer APIs
- parser/input handling, file/path/process creation, privilege boundaries, IPC/network framing, and deserialization
- thread safety, shared mutable state, TOCTOU, integer overflow/underflow, and error handling at trust boundaries
- build flags, sanitizers, third-party native dependencies, secret material handling, and logging of sensitive data

High-priority hotspot checks:
- strcpy/sprintf/memcpy arithmetic, unchecked casts, custom allocators, and exception-safety / RAII gaps
- setuid/service privileges, shell invocation, file permissions, temp files, and config parsing boundaries
- ASan/UBSan/clang-tidy/cppcheck evidence when available

Use the stack checklist at `resources/templates/stack-review-checklists/{stack}.md` when you need a systematic pass.

## Mandatory Review Order
1. Internally classify the request and confirm the stack scope.
2. Use **GitNexus first** when available to map entry points, trust boundaries, shared helpers, outbound calls, and blast radius.
3. Use **Serena second** only where exact symbol ownership, callers/callees, contracts, or framework wiring remain unclear.
4. Read the actual source or config files at the identified hotspots to verify behavior.
5. Use bundled scripts from `.opencode/skills/bmad-vnpt-security/scripts` and external tools only as corroboration or hotspot discovery.
6. Return the result in the required A–G format.

## Hard Rules
- Do not claim a vulnerability without source evidence, credible tool evidence, or both.
- Do not treat scanner output as final truth without checking source/config.
- Distinguish clearly between verified from source, corroborated by tooling, inferred from structure, and not yet verified.
- State clearly when GitNexus was unavailable and a fallback path was used.
- For active testing against running systems, assume authorization is required unless the user clearly states permission.

## Required Output Format
A. Scope and assumptions
B. Architecture / trust-boundary map
C. Findings by severity with evidence
D. Exploitation notes / blast radius
E. Stack-specific remediation plan
F. Evidence used (files, scripts, external tool outputs)
G. Gaps / unknowns / what still needs manual verification
