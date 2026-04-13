# bmad-vnpt-web-react

## Purpose
Create React components in a BMAD-aligned way using the **VNPT React Developer** rule pack, templates, and best-practice guidance.

## Workflow Contract
This workflow is a focused frontend implementation workflow. It consumes:
- the active task or story requirement
- applicable BMAD artifacts in `docs/`
- applicable `AGENTS.md`
- the bundled `vnpt-react-developer` rule pack

## Required Local Skill Pack Usage
Before generating anything, you must load the bundled local React pack. Read and use:
- local `SKILL.md`
- local `workflow.md`
- relevant files under local `rules/`
- relevant files under local `templates/`

Do not treat this as a minimal skill. The local subdirectories and files are part of the workflow.

## Required Inputs
- the user request or active task describing the component or frontend change
- applicable story/task requirements if present
- relevant frontend architecture or UI guidance in `docs/` if present
- applicable `AGENTS.md`

## Artifact Intake Summary
Before writing files, restate:
- component name
- target path
- inferred props and types
- expected behavior
- state/effect complexity
- selected rule categories
- selected templates
- assumptions or missing information

## Mandatory Processing Sequence

### Phase 1 — Parse and Normalize Input
1. Extract the component name or feature target.
2. Normalize naming:
   - folder name in kebab-case
   - exported component name in PascalCase
   - hook names in `useXxx` form
3. Extract:
   - props
   - behavior
   - special requirements
   - async/data-fetching needs
   - interaction requirements
   - rendering/performance considerations

### Phase 2 — Determine Target Location
Determine the most appropriate target location using:
1. explicit user path if provided
2. repo convention if obvious
3. likely frontend component location such as `src/components/`

### Phase 3 — Apply the VNPT React Rule Pack
Use the local rule pack categories proportionally to the component’s complexity, such as:
- async / waterfall elimination rules
- bundle optimization rules
- server/client performance rules when relevant
- rerender optimization rules
- rendering performance rules
- JavaScript performance rules
- advanced patterns

Explicitly list which rule categories were selected and why.

### Phase 4 — Generate Component Package
Generate files in this order:
1. `types.ts`
2. `hooks.ts`
3. `index.tsx`
4. `index.ts`
5. `<component-name>.test.tsx`

Use the local templates as the starting point whenever applicable.

### Phase 5 — Validation
Validate:
- import paths
- export shape
- TypeScript typing sanity
- naming consistency
- test scaffolding sanity
- consistency with the selected rules

### Phase 6 — Completion Summary
At the end, report:
- files created
- rules applied
- templates used
- any rules intentionally not applied
- usage example
- follow-up recommendations
- automatic audit summary
- manual review summary
- whether the two-layer quality gate passed

## Quality Gate Before Completion
Before declaring completion, explicitly confirm:
- the bundled local VNPT React Developer pack was loaded
- the single local `SKILL.md` entrypoint was used
- relevant local `rules/` were selected
- local `templates/` were used or deliberately adapted
- component package files were generated
- types, tests, and exports were included or explicitly justified
- the output follows repo conventions or clearly states assumptions

## Two-Layer Review Mode
This workflow also supports auditing an existing React codebase against the VNPT React Developer skill pack.

### Layer 1 — Automatic audit
When the user asks to review an existing React source tree for compliance:
1. run the automatic audit script if it is available:
   - `tools/audit/audit_react_skill.py`
2. generate:
   - `reports/react-skill-audit/react-skill-audit.json`
   - `reports/react-skill-audit/react-skill-audit.md`
3. optionally run:
   - `tools/audit/autofix_react_skill.py`
   for safe, low-risk autofixes only

### Layer 2 — Manual AI review
After the automatic audit:
1. read the generated audit reports
2. read the most severe or ambiguous source files
3. perform a manual review using:
   - local `SKILL.md`
   - local `workflow.md`
   - relevant local `rules/`
   - relevant local `templates/`
   - `tools/audit/review_with_ai_prompt.md`
4. distinguish between:
   - machine-detectable convention issues
   - semantic / architectural issues
   - false positives
   - refactors that should be staged carefully

### Review Deliverables
When used in review mode, report:
- automatic audit summary
- critical violations
- likely false positives
- architecture or semantics issues not caught automatically
- safe autofixes applied or recommended
- prioritized remediation plan

## Mandatory Post-Generation Quality Gate
This workflow now has a **required two-layer quality gate** after any code generation or modification step.

This is mandatory whenever the workflow:
- creates a new component
- modifies an existing component
- refactors an existing React module
- updates hooks, adapters, tests, or exports

### Quality Gate Contract
After code is generated or modified, you must **always** run both layers:

#### Layer 1 — Automatic audit (mandatory)
Run the automatic audit script against the relevant source tree:
- `tools/vnpt-react-audit/audit_react_skill.py`

This must generate:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`

If the audit reports severe issues, do not claim completion until they are either:
- fixed
- deliberately accepted with explicit justification
- marked as likely false positives pending manual review

#### Layer 2 — Manual AI review (mandatory)
After the automatic audit, perform a manual review using:
- local `SKILL.md`
- local `workflow.md`
- relevant local `rules/`
- relevant local `templates/`
- `tools/vnpt-react-audit/review_with_ai_prompt.md`
- the generated audit reports
- the changed source files

This review must decide:
- which automatic findings are real defects
- which are false positives or low-priority warnings
- which semantic or architectural issues were not caught automatically
- what remediation is required before completion

### Required Review Deliverables
Before completion, provide:
1. automatic audit summary
2. list of changed/generated files
3. critical findings from the automatic audit
4. false positives or accepted deviations
5. semantic / architectural issues found in manual review
6. fixes applied after review
7. remaining follow-up items if any

### Completion Gate
Do **not** declare the workflow complete until:
- the agent executed the enforced quality gate script itself
- the automatic audit was executed
- the manual review was executed
- findings were either fixed or explicitly justified
- the final code is reported as passing the two-layer quality gate


## Standard Audit Command Execution
When used inside a repository where this package has been installed, assume the default local audit tool path is:

- `tools/vnpt-react-audit/audit_react_skill.py`
- `tools/vnpt-react-audit/autofix_react_skill.py`
- `tools/vnpt-react-audit/review_with_ai_prompt.md`

### Default command sequence
Use this command sequence unless the repository clearly documents a different source root:

#### Automatic audit
```bash
python tools/vnpt-react-audit/audit_react_skill.py --repo .
```

#### Safe autofix (optional, low-risk only)
```bash
python tools/vnpt-react-audit/autofix_react_skill.py --repo . --source src
```

If the repo is a monorepo or has a non-standard frontend location, prefer the most likely source root such as:
- `apps/web/src`
- `frontend/src`
- `src`

Examples:
```bash
python tools/vnpt-react-audit/audit_react_skill.py --repo . --source apps/web/src
python tools/vnpt-react-audit/autofix_react_skill.py --repo . --source apps/web/src
```

### Required post-command interpretation
After the audit command runs, you must read:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`

Then perform the required manual review and only declare completion after the full quality gate passes.


## Agent Execution Requirement
When this workflow is used by an AI agent for generation, refactoring, or modification, the agent itself must execute the quality-gate scripts.

The agent must not merely recommend that the user run them later.

### Required agent-run command
After code changes are made, the agent must execute:

```bash
python tools/vnpt-react-audit/enforce_quality_gate.py --repo . --source src
```

For monorepos or non-standard layouts, use the correct source root, for example:

```bash
python tools/vnpt-react-audit/enforce_quality_gate.py --repo . --source apps/web/src
```

### Mandatory follow-up
After running the enforced gate script, the agent must:
1. read `reports/react-skill-audit/react-skill-audit.json`
2. read `reports/react-skill-audit/react-skill-audit.md`
3. read `reports/react-skill-audit/gate-result.md`
4. perform the manual review using `tools/vnpt-react-audit/review_with_ai_prompt.md`
5. apply fixes directly where appropriate
6. rerun `enforce_quality_gate.py` if code changes were made during review
7. only declare completion once the final gate state is acceptable and remaining deviations are explicitly justified
