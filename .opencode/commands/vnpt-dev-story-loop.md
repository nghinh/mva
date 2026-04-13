---
description: VNPT story-first implementation loop for BMAD 6.2.0 + OpenCode
argument-hint: [story-file-or-story-id-and-optional-scope]
---

You are executing the VNPT story-first delivery loop.

User input: `$ARGUMENTS`

Mandatory intent:
- Treat `bmad-dev-story` as the canonical BMAD implementation workflow for this run.
- Do not use legacy `bmm-dev` behavior as the implementation entrypoint.
- Spawn multiple subagents in parallel whenever the story can be decomposed into bounded slices.
- After implementation, run the VNPT review/fix loop via `/vnpt-review-loop` on the touched scope.
- Do not declare the story complete until the latest review pass returns zero actionable issues.

Required execution plan:
1. Resolve the target story file or story identifier from `$ARGUMENTS`.
2. Read the story fully and read linked architecture, UX, API, and operational documents that affect this story.
3. Determine the dominant stack and any cross-stack slices.
4. Create a concrete implementation plan and todo list.
5. Spawn multiple `vnpt-story-implementer` subagents in parallel for bounded slices where parallel work is safe.
6. Merge results, resolve conflicts, and run the appropriate validation commands.
7. Run `/vnpt-review-loop` for the touched scope.
8. If the review loop still reports actionable issues, continue fixing and re-running review until clean.
9. Only then summarize what changed, what was validated, and what files were affected.

Hard stop rules:
- Never stop after planning if coding is requested.
- Never stop after implementation if validation has not run.
- Never stop after validation if review has not run.
- Never mark the story done while the latest review pass still reports actionable issues.
