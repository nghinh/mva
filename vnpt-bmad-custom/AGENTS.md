## Mission

You are operating in a fullstack codebase with OpenCode, BMAD, Context7, and Serena available.

Your job is to:
- solve the requested task correctly
- minimize unnecessary code changes
- avoid unnecessary token/tool usage
- verify your work before declaring completion
- MUST Strictly follow the agent's instructions.

Always prefer the smallest safe change that fully solves the task.

---

## Markdown Reading Policy

When reading any `.md` file for requirements, instructions, specs, workflows, checklists, runbooks, or contextual guidance, full-file reading is mandatory.

Required process:
1. Always check the total line count of the markdown file first.
2. Then read the file from line 0 through EOF.
3. Do not read only a partial range, excerpt, or top section when the markdown file may contain task-relevant instructions later in the file.
4. Treat the whole markdown file as context unless the user explicitly asks for a partial read of a known section.
5. Before acting on a markdown-based instruction set, ensure the full file has been read so decisions are based on complete context rather than an incomplete fragment.

Default rule:
- `.md` files must be read completely from 0-EOF before summarizing, planning, implementing, or verifying work derived from them.

---

## 1. Plan Mode Default
Enter plan mode for ANY non-trivial task (3+ steps or architecture)
- Define BOTH execution + verification steps
- If something breaks → STOP and re-plan
- Write detailed specs to remove ambiguity

## 2. Subagent Strategy
Always Use subagents everytime you can, even for small tasks
- Split tasks: research, execution, analysis
- Regularly spawn multiple sub-agents to execute whenever possible
- One task per agent for clarity
- Parallelize thinking, not just execution

## 3. Self-Improvement Loop
- After ANY mistake → log it in gotchas.md
- Convert mistakes into rules
- Re-run past lessons before starting
- Iterate until error rate drops

## 4. Verification Before Done
Never mark done without proof
- Run tests, check logs, simulate real usage
- Compare vs actual behavior
- Ask: "Would a senior engineer approve this?"

## 5. Simplicity and Maintainability

- Prefer the smallest correct change that fully solves the task.
- Do not introduce new abstractions unless they are clearly required.
- Do not create extra files, wrappers, or helpers for a simple local fix.
- If multiple valid solutions exist, prefer the one that best matches the current codebase and is easiest to maintain.
- Avoid workaround-style fixes unless explicitly requested.

## 6. Skill Usage Policy

- Use a skill only when it materially improves quality, consistency, or speed.
- Prefer project-defined skills for standardized workflows such as story implementation, code review, UI review, or stack-specific development.
- Do not load unrelated skills for simple local fixes.
- If a task clearly matches an available project skill, use that skill before improvising a custom workflow.
- When a skill is used, follow its required verification or review steps unless explicitly overridden.

## 7. Autonomous Bug Fixing

- Investigate the real error before editing code.
- Prefer fixing root causes over masking symptoms.
- For debugging, use direct reading, search, and test/build output first.
- Use Serena for debugging only when tracing references, ownership, or cross-file logic is necessary.
- Rerun the relevant verification after applying a fix.

## 8. File and Repository Structure Awareness

- Prefer existing repository structure over inventing a new one.
- Place new files only in locations that match the project’s established layout.
- Do not create reference, script, or template files unless clearly needed.
- Favor clear file names and predictable locations.
- Avoid duplicate documentation or duplicate sources of truth.

## 9. Adaptive Execution

- Follow mandatory safety, verification, and tool-routing rules strictly.
- Adapt planning depth to the size and risk of the task.
- Do not over-plan simple local fixes.
- Do not over-explore the repository when the edit location is already clear.
- For complex or cross-file tasks, increase planning, tracing, and verification depth as needed.

## 10. Review/Fix Loop Policy
- When running /vnpt-review-loop, never stop after the first, second, third,... review pass.
- If any actionable issue exists, continue into fix.
- After any fix, always re-run review.
- Finish only when the latest review pass returns zero actionable issues.

---

## Task Management
1. Plan first = write tasks with checklist  
2. Verify before execution  
3. Track progress continuously  
4. Explain changes at each step  
5. Document results clearly  
6. Capture lessons after completion  

---

## Core Principles
- Simplicity First → minimal, clean solutions  
- Systems > Prompts  
- Iteration > Generation  
- Planning > Perfection  
- No Lazy Fixes → solve root cause

---

## General Working Style

- Prefer precise execution over broad exploration.
- Do not over-analyze simple local changes.
- Do not over-read the repository when the edit location is already clear.
- Preserve the existing architecture, conventions, and project style unless the task explicitly requires changing them.
- Avoid unrelated refactors.
- If the codebase already has an established pattern, follow it.

---

## Model Usage Policy

Use stronger reasoning only when needed:
- architecture or implementation planning
- debugging non-obvious behavior
- cross-file refactors
- shared contract, schema, interface, or type changes
- risky logic changes
- final review of non-trivial work

Do not spend excessive reasoning on:
- obvious local fixes
- small formatting or lint issues
- tiny UI copy changes
- clearly scoped edits in one known file

---

## Tool Routing Policy

Always choose the cheapest reliable path first.

Preferred order:
1. direct file reading
2. normal text search / grep
3. inspect build, lint, typecheck, and test output
4. use Serena only if structural understanding is actually needed or debugging is required
5. use Context7 only if external version-accurate documentation is needed

Do not use expensive tools by default.

---

## Serena Usage Policy

Use Serena only when structural code intelligence is actually needed.

Always try cheaper methods first:
- read the relevant file directly
- use normal text search / grep
- inspect build, lint, typecheck, and test errors
- make local fixes when the target file is already clear

Use Serena only if at least one of these is true:
- the correct file or symbol is still unclear
- the change may affect multiple files
- callers, references, or dependencies must be identified
- logic must be traced across layers
- the task involves refactor, rename, interface/type/contract change, or impact analysis
- the repository is large or monorepo and text search is too noisy

Do NOT use Serena for:
- single-file edits with clear location
- small UI/text/style changes
- lint/format/import/syntax fixes
- obvious local patches
- trivial test updates

When using Serena:
- keep the scope narrow
- ask only for the exact symbol/reference/dependency information needed
- stop using Serena once the correct edit locations are identified
- do not dump excessive structural context into the model

Quick heuristic:
- single-file, obvious, local fix -> do not use Serena
- multi-file, unclear ownership, shared type/contract impact -> use Serena
- tracing frontend -> backend -> shared code flow -> use Serena if normal reading/search is insufficient

---

## Context7 Usage Policy

Use Context7 when version-accurate external documentation is needed, especially for:
- framework APIs
- library configuration
- package setup and migration details
- official examples and best practices
- uncertain syntax or behavioral differences across versions

Do not use Context7 when:
- the task is fully determined by the local codebase
- the answer is already clear from project patterns
- the task is a simple implementation that does not depend on external docs

When using Context7:
- retrieve only the docs needed for the current task
- prefer official and version-relevant sources
- avoid bringing in large irrelevant documentation blocks
- use docs to support implementation, not replace reading the local codebase

Quick heuristic:
- framework/library behavior unclear or version-sensitive -> use Context7
- local bug fix or pattern already obvious from repo -> do not use Context7

---

## Change Strategy

Before editing:
1. Understand the request precisely.
2. Identify the likely target file(s) with direct reading and normal search first.
3. Escalate to Serena only if the task is cross-file or structurally unclear.
4. Use Context7 only if external documentation is required.
5. Prefer the minimum viable implementation that fits the codebase.

During editing:
1. Make minimal localized changes first.
2. Keep naming, structure, and style consistent with the repo.
3. Avoid speculative edits across unrelated files.
4. If changing a shared contract, verify all affected layers.

After editing:
1. Run the narrowest useful verification first.
2. Then run broader checks if the change is shared or risky.
3. Fix the actual cause of failures rather than masking symptoms.
4. Do not claim success without checking available verification tools.

---

## Verification Policy

After code changes, prefer this order when applicable:
1. format
2. lint
3. typecheck
4. unit tests
5. integration tests or e2e smoke tests
6. build

For small local changes:
- run the narrowest checks that prove correctness

For shared or risky changes:
- run broader checks before declaring completion

Do not skip verification for non-trivial work if the project provides verification commands.

---

## Quality Gate Policy

Treat verification as a required gate, not a suggestion.

If project scripts exist, use them.
Prefer project-defined scripts over inventing new commands.

Typical gate order:
- format
- lint
- typecheck
- test
- build

If browser automation or smoke tests are available for UI flows, use them when the change affects user-facing behavior.

If a verification step fails:
- inspect the real error
- fix the actual problem
- rerun the relevant check
- do not silence errors without justification

---

## Frontend Policy

For frontend changes:
- prefer existing components, patterns, tokens, hooks, and utilities
- avoid unnecessary visual or behavioral regressions
- keep state management patterns consistent with the codebase
- verify user-facing flows when feasible
- use browser automation only when it adds real validation value

For UI-only changes:
- do not invoke Serena unless ownership or impact is genuinely unclear

---

## Backend Policy

For backend changes:
- preserve API contracts unless explicitly asked to change them
- validate input/output changes carefully
- trace DTO, schema, service, repository, and controller impact before broad changes
- update tests when behavior changes
- keep error handling aligned with project conventions

For local handler/service fixes:
- do not invoke Serena if the edit location is already clear

---

## Fullstack Policy

For changes spanning frontend and backend:
- confirm the contract shape first
- trace request and response flow across layers
- use Serena only if the flow or ownership is unclear
- verify both static correctness and runtime behavior
- ensure frontend assumptions match backend responses

---

## Anti-Patterns To Avoid

Do not:
- use Serena by default on every task
- use Context7 for facts already obvious from the repository
- perform broad exploratory scans for simple fixes
- edit many files when one or two would solve the problem
- skip verification after non-trivial changes
- make speculative fixes without reading the real error output
- introduce a new pattern when an existing project pattern already fits
- refactor unrelated code just because it looks imperfect

---

## Decision Heuristics

Use this routing logic:

- Single-file, obvious, local fix -> direct read/edit
- Multi-file, unclear ownership, shared type/contract impact -> Serena
- Framework/library usage unclear or version-sensitive -> Context7
- Clear implementation in known files -> execute directly
- Risky refactor or unclear bug -> spend more reasoning before editing

---

## Completion Standard

A task is only considered complete when:
- the requested change is implemented
- the change is consistent with the codebase
- the relevant checks have been run when available
- no unnecessary unrelated changes were introduced

When reporting completion:
- summarize what changed
- mention verification that was run
- mention any known limitations or follow-up risks if they remain