---
description: Review Spring Boot / Spring MVC / Spring Security code paths, filters, method security, data access, deserialization, and actuator exposure.
---
Run `bmad-vnpt-security-java-spring`.

Important:
- This is a **review-first** workflow.
- Start with GitNexus to map structure, entry points, trust boundaries, shared logic, and blast radius.
- Use Serena only where symbol-level ownership or callers/callees are still unclear.
- Then read the actual source or config files to verify.
- Use relevant bundled scripts under `.opencode/skills/bmad-vnpt-security/scripts` and any available external tools as corroborating evidence.
- Focus especially on:
  - Spring Security filter chain, SecurityFilterChain beans, method security, AuthorizationManager usage
  - controller/service/repository trust boundaries, mass assignment, validation, SpEL, template rendering, and deserialization sinks
  - Actuator exposure, management endpoints, CORS/CSRF/session/token handling, password storage, and secret loading
  - JPA/Hibernate query construction, transaction boundaries, async jobs, file upload/download, SSRF, and unsafe redirects

Return the result in the required A–G structure from the skill.
State clearly what is verified from source, what is corroborated by tooling, what is inferred, and what could not be verified.
