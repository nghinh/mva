# bmad-vnpt-php

## Purpose
This skill guides modern PHP backend work across plain Composer apps and common frameworks.

## Preferred defaults for new code
- `declare(strict_types=1);`
- PSR-4 autoloaded `src/` structure
- PSR-12 style
- constructor injection / container-managed dependencies
- small controllers/actions/handlers
- DTO/value object/service separation where helpful
- explicit repository or query/service boundaries when persistence is non-trivial
- PHPStan configuration committed to repo
- PHPUnit tests committed with behavior changes

## Repo-convention-first policy
If the existing repo already uses Laravel, Symfony, Slim, Laminas, or a custom pattern, follow that pattern unless asked to modernize.

## Coding rules
- Prefer explicit types and return types.
- Avoid hidden array contracts for complex flows.
- Avoid static state unless required by framework/runtime constraints.
- Prefer immutable value objects for shared payload semantics where practical.
- Keep transport, domain, and persistence concerns separate enough to test.
- Avoid fat controllers and fat Eloquent/ORM entities doing everything.
- Keep validation near boundaries; keep business rules in services/domain objects.
- Be careful with transactions, retries, duplicate submissions, and external side effects.

## Verification rules
Use whatever the repo already has. Typical order:
- `composer validate`
- formatter or style check
- `phpstan analyse` or project static analysis command
- `phpunit` or project test command

## Framework notes
### Laravel
- Prefer Form Requests / dedicated validation objects
- Prefer service classes/actions for multi-step logic
- Be careful with queued jobs, retries, and idempotency
- Keep Eloquent usage explicit; avoid N+1 and hidden side effects in model events

### Symfony
- Keep controllers thin
- Use services, DTOs, validators, and message handlers deliberately
- Prefer autowiring/autoconfiguration conventions already in repo

### Plain Composer / custom services
- Use PSR-4 structure and small modules
- Keep interfaces where they help seams/testing, not as cargo cult
- Use adapters for external integrations
