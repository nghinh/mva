---
name: bmad-vnpt-security
description: Perform a full-spectrum security review across application, API, auth/authz, cloud/Kubernetes, DevSecOps, supply chain, and compliance.
---

# bmad-vnpt-security

Use this workflow when the user wants a **full security review**.

## Mission
Produce a high-confidence review by combining:
- **GitNexus** first for repo-level structure, entry points, trust boundaries, shared flows, and blast radius
- **Serena** second only where symbol-level ownership or callers/callees are still unclear
- **direct source reading** for final verification
- **bundled scripts** for repeatable evidence gathering
- **optional external tools** such as Semgrep, Gitleaks, Trivy, ZAP, Nuclei, Scorecard, CycloneDX/Syft, or Cosign where relevant

This workflow is **review-first**. Do not change code unless the user explicitly asks for fixes after the review.

## Specialization
Perform a full-spectrum security review across application, API, auth/authz, cloud/Kubernetes, DevSecOps, supply chain, and compliance.

Focus especially on:
- application code paths and trust boundaries
- authentication, authorization, session, token, and password flows
- API surface, object-level authorization, rate limiting, and abuse paths
- secrets, crypto, logging, and sensitive-data handling
- CI/CD, dependency, artifact integrity, SBOM, and signing posture
- containers, Kubernetes, IaC, runtime hardening, and namespace isolation
- compliance and assurance mapping to OWASP Top 10 2025, OWASP API Security Top 10 2023, ASVS 5.0, and SAMM


## Full-review orchestration
For a full review, first infer the likely stacks by using `.opencode/skills/bmad-vnpt-security/scripts/infer_security_stack.py` or by reading repo indicators directly. Then cover the relevant stack lenses in addition to the generic lanes:
- java-spring
- dotnet
- nodejs
- python
- go
- c-cpp
- php
- frontend-react
- frontend-vue
- frontend-angular
- mobile-flutter
- mobile-react

When multiple stacks coexist, produce one consolidated report but separate findings by lane when that improves clarity.

## Mandatory Review Order
1. Internally classify the request and keep the scope narrow enough to reason about.
2. Use **GitNexus first** when available to map entry points, policy boundaries, shared helpers, downstream impact, and likely abuse paths.
3. Use **Serena second** only where exact symbol ownership, callers/callees, contracts, or cross-file reuse remain unclear.
4. Read the actual source or config files at the identified hotspots to verify behavior.
5. Use bundled scripts and optional external tools only as corroboration or hotspot discovery.
6. Return the result in the required A–G format.

## Hard Rules
- Do not claim a vulnerability without source evidence, credible tool evidence, or both.
- Do not treat scanner output as final truth without checking source/config.
- Distinguish clearly between verified from source, corroborated by tooling, inferred from structure, and not yet verified.
- State clearly when GitNexus was unavailable and a fallback path was used.
- For active testing against running systems, assume authorization is required.

## Bundled Scripts
- `scan_owasp_top10.py`
- `scan_dependencies.py`
- `detect_secrets.py`
- `audit_authentication.py`
- `audit_authorization.py`
- `validate_input_sanitization.py`
- `validate_security_headers.py`
- `check_compliance.py`
- `generate_security_report.py`
- `create_remediation_plan.py`
- `run_security_workflow.py`

Use all relevant bundled scripts and any available external tools as corroborating evidence.

## Required Output Format
Return results in this exact structure:

### A. Bản đồ bề mặt tấn công chính
- Public entry points / external attack surface
- Auth/Authz boundaries
- Sensitive data paths
- External integrations / trust boundaries
- Save/commit/side-effect boundary nếu có

### B. Phát hiện / rủi ro bảo mật chính
For each item include:
- Risk
- Root cause khả dĩ
- Evidence (file/method/line or config/tool output)
- Exploit path / abuse scenario
- Blast radius
- Severity (Low/Medium/High/Critical)
- Confidence (1-5)

### C. Các trạng thái lỗi và abuse cases cần chú ý
- Bypass auth/authz như thế nào
- Duplicate/replay/race condition có xảy ra không
- Có nguy cơ lệch trạng thái giữa DB, cache, queue, external system không
- Có lộ dữ liệu nhạy cảm qua log, error, metrics, tracing không

### D. Test cases / security checks cần bổ sung
- Unit security tests
- Integration / API security tests
- Regression tests
- Pipeline / CI security gates

### E. Compliance / assurance mapping
- OWASP Top 10 mục nào liên quan
- OWASP API Security Top 10 mục nào liên quan nếu có API
- ASVS control area liên quan
- SAMM / process gap liên quan nếu thấy rõ
- Ghi rõ phần nào chỉ là định hướng, phần nào có evidence trực tiếp

### F. Remediation plan ngắn gọn
- Ưu tiên P0 / P1 / P2
- Fix nhanh nên làm trước
- Fix kiến trúc nên làm sau
- Guardrail/pipeline nên bổ sung

### G. Kết luận ngắn
- 3 rủi ro lớn nhất cần chú ý ngay
- Điểm nào cần đọc tay thêm để xác minh sâu hơn
- Nếu cần, nêu rõ bước tiếp theo: review code fix, hardening, hay test xác thực

## Completion Rule
Only claim high confidence when:
- GitNexus or a clearly stated fallback path was used
- source files were read to verify the main hotspots
- scanner output was interpreted carefully
- unresolved branches are explicitly marked as unverified
