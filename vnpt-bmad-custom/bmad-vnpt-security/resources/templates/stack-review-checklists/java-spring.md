# Checklist: java-spring

Scope:
- What entry points and trust boundaries are in scope?
- What identities, roles, tokens, secrets, and sensitive data exist?

Primary review lanes:
- Spring Security filter chain, SecurityFilterChain beans, method security, AuthorizationManager usage
- controller/service/repository trust boundaries, mass assignment, validation, SpEL, template rendering, and deserialization sinks
- Actuator exposure, management endpoints, CORS/CSRF/session/token handling, password storage, and secret loading
- JPA/Hibernate query construction, transaction boundaries, async jobs, file upload/download, SSRF, and unsafe redirects

Hotspot checks:
- SecurityFilterChain, WebSecurityConfigurerAdapter legacy remnants, permitAll/requestMatchers mismatches
- @PreAuthorize/@PostAuthorize/@Secured coverage and object-level authorization enforcement
- Jackson polymorphic typing, file/path handling, RestTemplate/WebClient outbound calls, actuator/management config

Evidence to collect:
- Exact files and line references for each finding
- Relevant config values and default behaviors
- Tool output only if it materially supports the finding

Output reminder:
- Severity
- Evidence
- Blast radius
- Fix recommendation
- Gaps / unknowns
