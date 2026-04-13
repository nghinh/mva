# Go Standards Reference

## Error Handling
- Never ignore returned errors unless it is truly intentional and documented.
- Wrap errors with operation context using `%w`.
- Use typed/domain errors where they improve caller behavior.
- Do not return bare lower-layer errors without context.

Example:
```go
user, err := s.repo.FindByID(ctx, id)
if err != nil {
    return nil, fmt.Errorf("find user %s: %w", id, err)
}
```

## Context Propagation
- Accept `context.Context` from callers.
- Do not use `context.Background()` in request scope.
- Do not use `context.TODO()` in production code.
- Derive child contexts only when timeout or cancellation needs to narrow scope.

Allowed typical uses for `context.Background()`:
- `main()`
- package/bootstrap initialization
- independent long-lived background workers with documented lifecycle ownership

## Concurrency
- Prefer `errgroup` for scatter-gather work.
- Use bounded worker pools for fan-out workloads.
- Every goroutine must have a lifecycle and cancellation path.
- Use `select { case <-ctx.Done(): ... }` for blocking channel or long-running work.
- Sender closes channels.
- Avoid goroutine leaks and orphaned background tasks.

## Validation
- Validate request bind/unmarshal errors.
- Validate all externally supplied data at the boundary.
- Validate type assertions.
- Validate parse results from `strconv`, time parsing, IDs, and user-provided URLs.
- Handle empty, nil, zero, boundary, and timeout scenarios.

## JSON and Serialization
- Check marshal and unmarshal errors.
- For large responses, prefer streaming encoders where appropriate.
- Avoid silent fallback unless it is intentionally non-critical and logged.

## Logging
- Prefer the repository's structured logger when the repo defines one.
- Do not assume a fixed logger import path unless the current repo explicitly uses it.
- Use structured fields rather than format-only logging when supported.
- Never log secrets, passwords, tokens, or sensitive personal data.

## Security
- Use safe query APIs and parameterization.
- Avoid weak crypto like MD5 and SHA1.
- Validate user-controlled URLs to reduce SSRF risk.
- Avoid hardcoded secrets.
- Apply rate limiting for public endpoints when appropriate.
- Avoid `unsafe` unless absolutely necessary and justified.

## Performance
- Be mindful of allocations in hot paths.
- Avoid N+1 data access patterns.
- Use pointers selectively; not every struct must be heap-allocated.
- Avoid `defer` inside loops when resource release must happen per-iteration.

## File and Function Size
Recommended thresholds:
- file <= 500 LOC
- function <= 50 logical lines when practical

These are guidance thresholds, not absolute laws. Split when readability or maintainability suffers.

## Production Completeness
Do not leave:
- TODO
- FIXME
- HACK
- placeholder return values
- fake success stubs
- future implementation comments as a substitute for actual handling

If the requested scope cannot be safely completed because requirements are missing or the repository lacks required infrastructure, state the gap clearly and complete the maximum safe subset without pretending the remaining work is done.

