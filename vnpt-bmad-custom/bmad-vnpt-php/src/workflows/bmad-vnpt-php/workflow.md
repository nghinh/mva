# bmad-vnpt-php workflow

## Mission
Use this workflow for PHP backend services, APIs, jobs, integrations, and modular monolith codebases that use Composer.

## Default stance
- Prefer repo conventions first.
- For new code, prefer modern PHP with strict types, PSR-4 layout, PSR-12 style, dependency injection, small services, and explicit boundaries.
- Default to PHPStan-friendly code and PHPUnit verification.
- Do not introduce a framework migration unless explicitly requested.

## Detection hints
Use this workflow when the repo or task includes signs such as:
- `composer.json`
- `src/`, `app/`, `bootstrap/`, `config/`, `routes/`
- `.php` files
- Laravel, Symfony, Slim, Laminas, Mezzio, API Platform, WordPress plugin/theme backend, or custom Composer PHP service

## Execution policy
1. Read the local codebase and composer configuration first.
2. Identify the framework/runtime style already in use.
3. Preserve repo conventions unless the task is explicitly greenfield.
4. Prefer typed DTO/value object/service boundaries over associative-array sprawl when adding new logic.
5. Keep HTTP/controller/action layers thin.
6. Keep domain/business logic out of transport and persistence glue when practical.
7. Prefer one clear persistence boundary per unit of work.
8. Add or update tests when behavior changes.
9. Run formatter/lint/static analysis/tests if available before completion.

## Quality gate
Preferred order:
1. formatter or code style check
2. static analysis (PHPStan/Psalm if configured)
3. unit tests
4. integration/feature tests
5. framework-specific smoke/build checks

## Security baseline
Always pay attention to:
- validation and normalization of input
- auth/authz boundaries
- output encoding where relevant
- duplicate side effects / idempotency for write endpoints/jobs
- transaction and persistence boundaries
- secrets storage and environment handling
- null/empty/invalid state handling
- downstream impact of shared traits/helpers/base classes
