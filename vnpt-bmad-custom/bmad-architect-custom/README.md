# BMAD Architect Agency Customization (r3)

This package customizes `bmm-architect` for BMAD 6.2.0 by preserving most of the reasoning model from `agency-agents` `engineering-software-architect.md` while removing parts that would conflict with BMAD's default architect workflow and deliverable structure.

This revision also makes LikeC4 architecture-as-code mandatory in architecture outputs and requires the written architecture markdown to link to those LikeC4 sources for reference and usage:
- `docs/architecture/likec4/context.likec4`
- `docs/architecture/likec4/container.likec4`
- `docs/architecture/likec4/component.likec4`

## Install

```bash
python tools/install_architect_customization.py --repo /path/to/repo --package /path/to/bmad-architect-agency-custom-r3
```

Then run:

```bash
npx bmad-method@6.2.0 install
```

and choose **Recompile Agents**.

## Verify

```bash
python tools/verify_architect_customization.py /path/to/repo
```
