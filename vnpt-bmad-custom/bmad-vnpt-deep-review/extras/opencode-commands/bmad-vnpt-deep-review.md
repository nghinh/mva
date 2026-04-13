---
description: Perform a deep review using GitNexus first, Serena second, then source verification. Review-only, no code changes.
---
Run `bmad-vnpt-deep-review`.

Important:
- This is a **review-only** workflow.
- Do **not** change code.
- Start with GitNexus to map:
  - entry points
  - call chain
  - callers/callees
  - shared paths
  - downstream impact
- Then use Serena only where symbol-level tracing is still unclear.
- Then read the actual source files at the identified hotspots to verify.
- Do not stop at happy-path analysis.
- Focus especially on:
  - error paths
  - transaction/save/commit boundaries
  - concurrency / duplicate request / double click
  - duplicate external API calls
  - inconsistent state between DB and external system
  - null/empty/invalid states
  - missing guard conditions
  - shared logic reused across multiple entry points

Return the result in the required A–E structure from the skill.
If any branch could not be verified from source, state that explicitly.
