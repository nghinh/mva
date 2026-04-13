# bmad-vnpt-deep-review

## Purpose
Perform a deep, review-only analysis of a codebase, module, flow, method, or suspected bug path using a **GitNexus-first** approach, then **Serena** for symbol-level clarification, then direct source verification.

This workflow is designed for:
- whole-codebase review
- targeted flow tracing
- debugging hidden bug paths
- side-effect analysis
- impact analysis before making changes
- identifying risky shared logic reused by multiple entry points

## Hard Rules
- **Do not edit code.**
- GitNexus must be used first when available.
- Source files must be read to verify the main findings.
- Do not stop at happy-path analysis.
- If any branch or behavior cannot be verified, say so explicitly.

## Required Inputs
- the user request defining the review scope
- the current source code tree
- GitNexus MCP if available
- Serena MCP if available
- relevant docs in `docs/` when they materially clarify business flow, contracts, or architecture
- applicable `AGENTS.md`

## Mandatory Review Sequence

### Phase 1 — Scope and Review Mode
Classify the task as one of:
- whole-codebase review
- module review
- flow/path review
- method/service review
- bug trace review
- change-impact review

Internally define:
- target scope
- likely modules involved
- likely cross-cutting concerns
- suspected integration or transaction boundaries

### Phase 2 — GitNexus-first structural mapping
Use GitNexus first to identify:
- entry points
- major flow/process chain
- callers/callees
- downstream impact
- shared paths reused by multiple flows
- clusters/modules/processes relevant to the requested scope
- likely blast-radius hotspots

#### GitNexus usage constraints
- Keep calls sequential.
- Prefer one focused tool call at a time.
- Avoid heavy parallel querying.
- If GitNexus is unavailable or unstable, record that immediately and fall back to Serena + direct source reading.

### Phase 3 — Serena symbol-level verification
Use Serena only where needed to confirm:
- exact ownership of symbols
- callers/callees of key methods
- dependency relationships
- cross-file references
- shared contracts or common utility paths

Keep Serena usage narrow. Do not replace source reading with Serena output.

### Phase 4 — Direct source verification
Read source files at the hotspots returned by GitNexus and Serena.
Verify:
- real control flow
- key branch conditions
- error handling
- transaction / save / commit boundaries
- concurrency / idempotency / duplicate request handling
- external API or messaging side effects
- rollback gaps and partial-failure states
- null/empty/invalid-state handling
- shared helper or service reuse across flows

### Phase 5 — Risk analysis
You must actively look for:
- hidden bug paths
- side effects not obvious from the happy path
- missing guard conditions
- duplicate external calls
- duplicate submit / retry hazards
- inconsistent state between DB and external systems
- transaction boundaries that do not cover side effects
- race conditions or multi-entry shared-path hazards
- stale cache / out-of-order update risk when relevant

### Phase 6 — Output
Return the result in the exact required format:

#### A. Call chain chính
- Entry points
- Các method/service/repository chính
- Điều kiện rẽ nhánh quan trọng
- External integration liên quan
- SaveChanges / transaction boundary nếu có

#### B. Các nhánh rủi ro / bug ẩn khả nghi
For each item include:
- Risk
- Root cause khả dĩ
- Evidence (file/method/line)
- Blast radius
- Severity (Low/Medium/High)
- Confidence (1-5)

#### C. Các trạng thái lỗi cần chú ý
- Nếu bước A thành công nhưng bước B thất bại thì sao
- Có khả năng duplicate create/submit/call external không
- Có nguy cơ lệch trạng thái DB và external system không
- Có khả năng race condition hoặc double submit không

#### D. Test cases cần bổ sung
- Unit test
- Integration test
- Regression test

#### E. Kết luận ngắn
- 3 rủi ro lớn nhất cần reviewer chú ý
- Điểm nào nên đọc tay thêm để xác minh sâu hơn

## Review Quality Standard
A good review must:
- map the main call chain before making claims
- identify reused/shared logic and blast radius
- verify at least the main hotspots from source code
- state uncertainty honestly
- distinguish verified facts from structural inference
- avoid recommendations that assume code changes were already made

## Optional escalation path
If the user later asks for fixes, treat that as a **new phase**. First finish the review cleanly, then switch into implementation mode only after the user requests changes.
