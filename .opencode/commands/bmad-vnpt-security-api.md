---
description: Review REST/GraphQL/gRPC/API gateway surface for OWASP API Security risks, abuse paths, and contract drift.
---
Run `bmad-vnpt-security-api`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use appsec scripts plus any contract/gateway evidence; map explicitly to OWASP API Security Top 10 2023.
- Focus especially on:
- public and internal API endpoints, schemas, object identifiers, and pagination/search surfaces
- BOLA/BFLA, mass assignment, excessive data exposure, unsafe defaults, shadow endpoints
- resource consumption, rate limiting, quotas, idempotency keys, replay/duplicate handling
- serialization, validation, API gateway/authn/authz enforcement, webhook verification
- versioning, backward compatibility, and mismatch between documented and actual behavior

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
