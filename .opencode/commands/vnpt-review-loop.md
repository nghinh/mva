---
description: Run VNPT parallel review -> fix -> fresh re-review loop until clean
agent: vnpt-review-orchestrator
model: minimax/MiniMax-M2.7
---
Target scope from user arguments:
$ARGUMENTS

Current git status:
!`git status --short || true`

Currently changed files (staged and unstaged):
!`(git diff --name-only --cached; git diff --name-only; git diff --name-only HEAD~1..HEAD) 2>/dev/null | sort -u || true`

Top-level project files:
!`(ls -la; echo; find . -maxdepth 2 -type f | sed 's#^./##' | sort | head -300) 2>/dev/null || true`

Execute the full VNPT review/fix orchestration loop now.

Requirements:
- Interpret `$ARGUMENTS` as the preferred target scope; if empty, use the changed files above.
- Start by discovering scope and creating a todo list for the loop.
- MUST spawn multiple `vnpt-review-auditor` subagents in parallel for the first review pass.
- MUST merge all findings into one deduplicated CURRENT-PASS findings set and reconcile the live backlog from that latest pass.
- If any actionable issues exist in the latest pass, MUST spawn multiple `vnpt-fix-worker` subagents in parallel to fix them.
- After fixing, MUST run the most relevant validation/build/lint/test/typecheck commands for the touched stack.
- MUST then spawn multiple `vnpt-review-auditor` subagents again for a completely fresh review from the current workspace.
- Every re-review must be a brand-new first-pass style review, not a replay of previously found issues.
- If an old issue is not reproduced in the newest fresh review, it must be closed and must not be reported again.
- MUST repeat review -> fix -> validate -> fresh review until the newest fresh review returns zero actionable issues.
- After the first zero-issue pass, MUST run one more fresh confirmation review before stopping.
- MUST NOT stop after only one review pass.
- MUST NOT return raw review findings early unless blocked.
- Final answer must include: passes executed, issues found/closed/waived, validation results, remaining risks, and concise file summary.
