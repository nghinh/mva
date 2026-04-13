---
name: bmad-vnpt-security-dotnet
description: Review ASP.NET Core / .NET services for authn/authz middleware order, model binding, minimal APIs, data protection, and secret handling.
---

# bmad-vnpt-security-dotnet

Use this workflow when the user wants a **deep stack-specific security review** for **dotnet**.

## Mission
Produce a high-confidence review by combining:
- **GitNexus** first for repo-level structure, entry points, trust boundaries, shared flows, and blast radius
- **Serena** second only where symbol-level ownership or callers/callees are still unclear
- **direct source reading** for final verification
- **bundled scripts** for repeatable evidence gathering
- **optional external tools** such as Semgrep, Gitleaks, Trivy, ZAP, Nuclei, Scorecard, CycloneDX/Syft, or Cosign where relevant

This workflow is **review-first**. Do not change code unless the user explicitly asks for fixes after the review.

## Specialization
Review ASP.NET Core / .NET services for authn/authz middleware order, model binding, minimal APIs, data protection, and secret handling.

Focus especially on:
- authentication/authorization middleware order, policy-based authorization, endpoint metadata, and fallback policies
- model binding, validation, file upload/download, SSRF, deserialization, Razor rendering, and logging of sensitive data
- Data Protection key management, cookie/JWT settings, secret loading, appsettings environment overrides, and antiforgery coverage
- EF Core query safety, background services, message handlers, outbound HTTP clients, and insecure redirect/open redirect paths

High-priority hotspot checks:
- UseAuthentication/UseAuthorization ordering and endpoint RequireAuthorization gaps
- policy handlers, resource-based authorization, claims/scopes mapping, and DataProtection key persistence
- unsafe JsonSerializer settings, file path joins, temp file handling, and secret leakage in configuration

Use the stack checklist at `resources/templates/stack-review-checklists/{stack}.md` when you need a systematic pass.

## Mandatory Review Order
1. Internally classify the request and confirm the stack scope.
2. Use **GitNexus first** when available to map entry points, trust boundaries, shared helpers, outbound calls, and blast radius.
3. Use **Serena second** only where exact symbol ownership, callers/callees, contracts, or framework wiring remain unclear.
4. Read the actual source or config files at the identified hotspots to verify behavior.
5. Use bundled scripts from `.opencode/skills/bmad-vnpt-security/scripts` and external tools only as corroboration or hotspot discovery.
6. Return the result in the required A–G format.

## Hard Rules
- Do not claim a vulnerability without source evidence, credible tool evidence, or both.
- Do not treat scanner output as final truth without checking source/config.
- Distinguish clearly between verified from source, corroborated by tooling, inferred from structure, and not yet verified.
- State clearly when GitNexus was unavailable and a fallback path was used.
- For active testing against running systems, assume authorization is required unless the user clearly states permission.

## Required Output Format
A. Scope and assumptions
B. Architecture / trust-boundary map
C. Findings by severity with evidence
D. Exploitation notes / blast radius
E. Stack-specific remediation plan
F. Evidence used (files, scripts, external tool outputs)
G. Gaps / unknowns / what still needs manual verification
