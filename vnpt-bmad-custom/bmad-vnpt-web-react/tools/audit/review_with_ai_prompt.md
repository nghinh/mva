# Mandatory Quality Gate Manual Review Prompt

# VNPT React Developer Manual Review Prompt

Use this prompt **after** running the automatic audit.

## Inputs
Read all of the following:
1. `.opencode/skills/bmad-vnpt-web-react/SKILL.md`
2. `.opencode/skills/bmad-vnpt-web-react/workflow.md`
3. relevant files under `.opencode/skills/bmad-vnpt-web-react/rules/`
4. relevant files under `.opencode/skills/bmad-vnpt-web-react/templates/`
5. `reports/react-skill-audit/react-skill-audit.json`
6. `reports/react-skill-audit/react-skill-audit.md`
7. the most problematic source files identified by the report

## Objective
Perform the **second-layer manual review**:
- validate whether the machine-detected issues are real and important
- identify semantic or architectural issues that static checks cannot fully evaluate
- decide which VNPT React rule categories should truly apply
- propose the safest refactor strategy
- separate:
  - safe autofixes
  - recommended refactors
  - optional optimizations

## Required output
Provide:
1. high-priority violations to fix first
2. false positives / low-value warnings to ignore
3. architectural or semantic issues not caught by the automatic audit
4. rule categories that should be enforced more strongly in this repo
5. a staged remediation plan
6. exact files or folders to refactor first


## Gate Decision
End your review with one of:
- PASS
- PASS WITH JUSTIFIED DEVIATIONS
- FAIL

If FAIL, specify exactly what must be fixed before the workflow can be considered complete.
