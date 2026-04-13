# VNPT Dev Story Orchestrator

This package adds a story-first implementation orchestrator for BMAD 6.2.0 + OpenCode.

Installed files:
- `.opencode/commands/vnpt-dev-story-loop.md`
- `.opencode/agents/vnpt-dev-story-orchestrator.md`
- `.opencode/agents/vnpt-story-implementer.md`
- `.opencode/opencode.dev-story-orchestrator.jsonc.example`
- `docs/vnpt-dev-story-orchestrator.README.md`

Usage:

```text
/vnpt-dev-story-loop docs/stories/story-1.md
```

The command is designed to:
1. Treat `bmad-dev-story` as the mandatory implementation workflow.
2. Read the story and linked documents fully before coding.
3. Fan out multiple implementation subagents in parallel by bounded slice.
4. Merge, build, lint, test, and typecheck.
5. Run `/vnpt-review-loop` as a mandatory quality gate.
6. Only finish when the latest review pass reports zero actionable issues.
