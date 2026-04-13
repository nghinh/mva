# BMAD VNPT React Developer Custom Workflow

This package now supports **two-layer review** for existing React codebases:

1. **Automatic audit layer**
2. **Manual AI review layer**

It also still supports normal component generation.

## What's included

### Workflow and skill
- `src/module.yaml`
- `src/workflows/bmad-vnpt-web-react/workflow.md`
- `extras/opencode-commands/bmad-vnpt-web-react.md`
- `extras/opencode-skills/bmad-vnpt-web-react/`
- `extras/opencode-skills/vnpt-react-developer/`

### Audit tooling
- `tools/audit/audit_react_skill.py`
- `tools/audit/autofix_react_skill.py`
- `tools/audit/rules_manifest.json`
- `tools/audit/review_with_ai_prompt.md`

## Two-layer review model

### Layer 1 — Automatic audit
Run the machine-checkable audit:
```bash
python /path/to/repo/tools/vnpt-react-audit/audit_react_skill.py --repo /path/to/repo
```

This generates:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`

### Layer 2 — Manual AI review
Then use the generated report with the bundled skill pack to perform deeper manual review:
- rule selection trade-offs
- semantic/architectural issues
- false positives
- refactor prioritization

## Safe autofix
```bash
python /path/to/repo/tools/vnpt-react-audit/autofix_react_skill.py --repo /path/to/repo --source src
```

## Install
```bash
python /path/to/bmad-vnpt-web-react-r4/tools/install_workflow.py \
  --repo /path/to/your/repo \
  --package /path/to/bmad-vnpt-web-react-r4
```

The installer will also place the audit scripts into:
- `tools/vnpt-react-audit/`

## Verify
```bash
python /path/to/bmad-vnpt-web-react-r4/tools/verify_workflow.py \
  /path/to/your/repo
```


## r5 update — mandatory quality gate
This revision upgrades the two-layer review from an optional review mode into a **required workflow quality gate**.

That means:
- after generation/refactoring, the workflow must run the automatic audit
- then it must run manual AI review
- only after both layers are complete can the task be considered done

### Quality gate sequence
1. Generate or modify React code
2. Run:
   `python /path/to/repo/tools/vnpt-react-audit/audit_react_skill.py --repo /path/to/repo`
3. Review:
   - `reports/react-skill-audit/react-skill-audit.json`
   - `reports/react-skill-audit/react-skill-audit.md`
   - `tools/vnpt-react-audit/review_with_ai_prompt.md`
4. Fix findings or justify accepted deviations
5. Declare completion only if the quality gate passes


## r6 update — explicit local command flow
This revision makes the workflow and skill more operational by embedding the standard local command flow directly into the package.

### New convenience runner
A helper script is now installed into the repo:

```bash
python tools/vnpt-react-audit/run_quality_gate.py --repo . --source src
```

For monorepos:
```bash
python tools/vnpt-react-audit/run_quality_gate.py --repo . --source apps/web/src
```

This runner:
1. runs the automatic audit
2. optionally runs the safe autofix
3. tells you exactly which files must be used for mandatory manual review

### Recommended gate flow after code generation
```bash
python tools/vnpt-react-audit/run_quality_gate.py --repo . --source src
```

Then perform the manual review using:
- `.opencode/skills/bmad-vnpt-web-react/SKILL.md`
- `.opencode/skills/bmad-vnpt-web-react/workflow.md`
- `rules/`
- `templates/`
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`
- `tools/vnpt-react-audit/review_with_ai_prompt.md`


## r7 update — agent must execute the gate itself
This revision removes the ambiguity around who runs the review scripts.

The intended behavior is now explicit:
- after generating or modifying code, the **AI agent itself** must run the gate script
- the agent must read the generated reports
- the agent must perform manual review
- the agent must apply fixes
- the agent must rerun the gate if further code changes were made

### Required command for agent-driven work
```bash
python tools/vnpt-react-audit/enforce_quality_gate.py --repo . --source src
```

For monorepos:
```bash
python tools/vnpt-react-audit/enforce_quality_gate.py --repo . --source apps/web/src
```

### What `enforce_quality_gate.py` does
1. runs the automatic audit
2. optionally runs safe autofix
3. reruns the audit after autofix
4. writes `reports/react-skill-audit/gate-result.md`
5. tells the agent that manual review is still mandatory

### Completion rule
The workflow is not complete until the agent:
- runs the enforced gate script
- reviews the generated reports
- performs manual review
- applies fixes or explicitly justifies deviations
- reruns the gate if code changed again
