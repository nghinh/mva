---
description: Review identity, authentication, authorization, tenant isolation, sessions, JWTs, MFA, and privilege transitions.
---
Run `bmad-vnpt-security-auth`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Prioritize audit_authentication.py and audit_authorization.py, then cross-check source paths manually.
- Focus especially on:
- login, logout, registration, password reset, MFA, device/session management
- session fixation, token issuance/validation, refresh/revocation, clock skew handling
- RBAC/ABAC/policy enforcement, object-level authorization, horizontal/vertical escalation
- tenant isolation, admin-only paths, unsafe defaults, policy bypass via alternate routes
- privileged flows, support/admin tooling, and audit logging of security events

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
