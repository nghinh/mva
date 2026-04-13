# VNPT OpenCode review/fix orchestrator

This bundle adds:
- `.opencode/agents/vnpt-review-orchestrator.md`
- `.opencode/agents/vnpt-review-auditor.md`
- `.opencode/agents/vnpt-fix-worker.md`
- `.opencode/commands/vnpt-review-loop.md`
- `opencode.jsonc.example`

## Recommended layout
Copy the `.opencode` folder into your project root.

## How to run
In OpenCode, run:

```text
/vnpt-review-loop src/
```

or for changed files only:

```text
/vnpt-review-loop
```

## What it does
1. Discover scope from command arguments or git diff.
2. Fan out parallel review subagents.
3. Merge only the latest current-pass findings into the live backlog.
4. Fan out parallel fix subagents.
5. Run validation/build/lint/test/typecheck as appropriate.
6. Fan out review subagents again as a fully fresh review.
7. Repeat until no actionable issues remain.
8. Run one extra fresh confirmation review before stopping.

## Important notes
- Re-review is intentionally defined as a brand-new review from the current workspace, not a replay of old findings.
- Old issues that are not reproduced in the latest fresh review must be closed.
- Review workers are read-only; fix workers can edit.
- If your environment asks for permission on `edit`, `bash`, or `task`, approve them for smoother execution.
- For frontend work, the prompts force loading `ui-ux-pro-max`.
