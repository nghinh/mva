---
description: Create a React component using the bundled VNPT React Developer rules, templates, and best-practice workflow.
---
Run `bmad-vnpt-web-react`.

Important:
- This is **not** a minimal skill.
- Load the local bundled pack inside `.opencode/skills/bmad-vnpt-web-react/` first.
- Read:
  - `SKILL.md`
  - `workflow.md`
  - relevant files under `rules/`
  - relevant files under `templates/`

Then:
1. Parse the request and normalize names
2. Determine the safest target component path
3. Produce an Artifact Intake Summary
4. Generate:
   - `types.ts`
   - `hooks.ts`
   - `index.tsx`
   - `index.ts`
   - `<component-name>.test.tsx`
5. Validate imports, exports, TypeScript sanity, and tests
6. End with:
   - files created
   - rules applied
   - templates used
   - usage example
   - follow-up notes

After generation or modification, you must run the required two-layer quality gate:

### Mandatory automatic audit
Run:
`python tools/vnpt-react-audit/audit_react_skill.py --repo <repo-root>`

### Mandatory manual review
Then read:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`
- `tools/vnpt-react-audit/review_with_ai_prompt.md`
- changed files
- local `SKILL.md`, `workflow.md`, `rules/`, `templates/`

Do not declare completion until:
- automatic audit was completed
- manual review was completed
- findings were fixed or explicitly justified
- the two-layer quality gate passed


### Standard local audit commands
Use these commands by default after generation/refactoring:

```bash
python tools/vnpt-react-audit/audit_react_skill.py --repo .
```

Optional safe autofix:
```bash
python tools/vnpt-react-audit/autofix_react_skill.py --repo . --source src
```

For monorepos or non-standard frontend source roots, prefer:
```bash
python tools/vnpt-react-audit/audit_react_skill.py --repo . --source apps/web/src
python tools/vnpt-react-audit/autofix_react_skill.py --repo . --source apps/web/src
```

Then read:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`

Do not declare completion before the full two-layer quality gate passes.


### Agent execution requirement
If you are the AI agent performing the work, do not stop at code generation and do not ask the user to manually run the audit first.

You must execute:

```bash
python tools/vnpt-react-audit/enforce_quality_gate.py --repo . --source src
```

Then read:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`
- `reports/react-skill-audit/gate-result.md`

Then perform the mandatory manual review, fix issues, and rerun the enforced gate if code changed again.
