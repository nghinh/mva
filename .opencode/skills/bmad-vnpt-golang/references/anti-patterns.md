# Anti-Patterns Reference

## Architecture
- Flattening `models/`, `services/`, or `repositories/` into the feature root to avoid aliasing
- Renaming packages to folder names when the feature package convention is established
- Putting transport logic into repositories or persistence logic into controllers

## Context
- `context.Background()` in request handlers or downstream request-scoped code
- `context.TODO()` in production code
- goroutines without cancellation or lifecycle ownership

## Error Handling
- `result, _ := ...`
- unchecked `json.Marshal` / `json.Unmarshal`
- unchecked type assertions
- unchecked `strconv` / parsing
- returning bare lower-layer errors without context

## Logging
- hardcoding a logger path in generic code without verifying repo usage
- logging secrets or sensitive data
- using ad-hoc printf logs when the repo provides structured logging

## Routing
- generic variable names like `controller`
- single-letter controller variables in production router code
- giant route registration files that mix unrelated resources

## Completeness
- TODO/FIXME/HACK in production paths
- fake success placeholders
- comments that defer essential implementation as a substitute for handling it now

