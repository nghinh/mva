# BMAD Dev Custom (multi-stack auto-skill loading) for BMAD 6.2.0

This package keeps `bmm-dev` usable as a compatibility layer, but BMAD 6.2.0 story implementation should now prefer `bmad-dev-story` via `vnpt-dev-story-loop`. The package still applies stack-aware guardrails and mandatory-skill policy when `bmm-dev` is involved.

## Supported mandatory skills

- `bmad-vnpt-c-cpp`
- `bmad-vnpt-dotnet`
- `bmad-vnpt-golang`
- `bmad-vnpt-java-springboot`
- `bmad-vnpt-nodejs`
- `bmad-vnpt-php`
- `bmad-vnpt-python`
- `bmad-vnpt-mobile-flutter`
- `bmad-vnpt-mobile-react`
- `bmad-vnpt-web-angular`
- `bmad-vnpt-web-react`
- `bmad-vnpt-web-vue`
- `ui-ux-pro-max` for frontend/UI work

## Behavior

- Detects the dominant stack from the repository, manifests, framework markers, task wording, and target files.
- Requires loading the matching skill before coding.
- Requires loading multiple skills for multi-stack tasks.
- Requires `ui-ux-pro-max` plus the framework-specific frontend skill for UI work.
- Extends the same mandatory-skill policy to every spawned sub-agent.

## Install

```bash
python tools/install_everything.py --repo /path/to/repo --package /path/to/this/package
```

Optional explicit package paths:

```bash
python tools/install_everything.py   --repo /path/to/repo   --package /path/to/this/package   --pkg-bmad-vnpt-nodejs /path/to/bmad-vnpt-nodejs   --pkg-bmad-vnpt-python /path/to/bmad-vnpt-python
```

Then inside the target repo:

1. `npx bmad-method@6.2.0 install`
2. Choose `Recompile Agents`
3. Restart OpenCode.
