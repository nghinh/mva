---
name: bmad-vnpt-deep-review
description: Deep review workflow for GitNexus-first flow tracing, Serena verification, and source-backed risk analysis without code changes.
---

# bmad-vnpt-deep-review

Use this workflow when the user wants **deep review**, **whole-codebase analysis**, **bug tracing**, **impact analysis**, or **risk review** without modifying code.

## Mission
Produce a high-confidence review by combining:
- **GitNexus** for repo-level structure, entry points, processes, cross-module flow, and downstream impact
- **Serena** for targeted symbol-level ownership, callers/callees, references, and dependency tracing
- **direct source reading** for final verification

This workflow is **review-only**.
Do **not** edit code unless the user explicitly changes the task.

## Mandatory Review Order
1. Clarify the requested scope internally: whole codebase, module, flow, method, bug trace, or change-impact review.
2. Start with **GitNexus** to identify:
   - entry points
   - call chain
   - callers/callees
   - downstream impact
   - shared paths and reused logic
   - related flows that pass through the same core methods/services/modules
3. Use **Serena** only where structure is still unclear or when exact symbol-level tracing is needed.
4. Read the actual source files returned by GitNexus/Serena to verify behavior.
5. Analyze both happy path and non-happy-path behavior.
6. Return the review in the required A–E format.

## GitNexus Rules
- GitNexus must be used first when available.
- Keep GitNexus usage **sequential** and **narrow**.
- Do not spam GitNexus with parallel or bursty heavy calls.
- Prefer one focused GitNexus question at a time.
- If GitNexus disconnects or becomes unstable, state that clearly and continue with Serena plus direct source reading.

## Serena Rules
Use Serena after GitNexus when:
- symbol ownership is still unclear
- callers/callees need confirmation
- a shared method or contract needs blast-radius validation
- the codebase is cross-file and normal reading is too noisy

Do not use Serena broadly for the whole review if GitNexus already identified the hotspots.
Keep Serena scope narrow.

## Review Focus Areas
You must actively inspect for:
- hidden bug paths
- non-happy paths
- side effects
- missing guard conditions
- null/empty/invalid state handling
- transaction boundaries
- save/flush/commit timing
- duplicate external API calls
- duplicate submit / double click / retry / concurrency issues
- inconsistent state between database and external systems
- shared logic reused by multiple entry points
- downstream impact and blast radius
- risky branches that may appear safe in the happy path but fail under partial or retried execution

## Evidence Standard
- Prefer file + method + approximate line ranges when possible.
- If exact line numbers are not available, cite file + class/method/symbol.
- Distinguish clearly between:
  - verified from source
  - inferred from structure
  - not yet verified

## Required Output Format
Return results in this exact structure:

### A. Call chain chính
- Entry points
- Các method/service/repository chính
- Điều kiện rẽ nhánh quan trọng
- External integration liên quan
- SaveChanges / transaction boundary nếu có

### B. Các nhánh rủi ro / bug ẩn khả nghi
For each risk include:
- Risk
- Root cause khả dĩ
- Evidence (file/method/line)
- Blast radius
- Severity (Low/Medium/High)
- Confidence (1-5)

### C. Các trạng thái lỗi cần chú ý
- Nếu bước A thành công nhưng bước B thất bại thì sao
- Có khả năng duplicate create/submit/call external không
- Có nguy cơ lệch trạng thái DB và external system không
- Có khả năng race condition hoặc double submit không

### D. Test cases cần bổ sung
- Unit test
- Integration test
- Regression test

### E. Kết luận ngắn
- 3 rủi ro lớn nhất cần reviewer chú ý
- Điểm nào nên đọc tay thêm để xác minh sâu hơn

## Completion Rule
Do not claim high confidence unless:
- GitNexus or a clearly stated fallback path was used
- source files were read to verify the main hotspots
- unresolved branches are explicitly marked as unverified
- no code was changed
