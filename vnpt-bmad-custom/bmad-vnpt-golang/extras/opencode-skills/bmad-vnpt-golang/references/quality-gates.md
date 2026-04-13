# Quality Gates Reference

## Goal
Use the smallest validation set that gives high confidence for the current change, then broaden only when risk justifies it.

## Baseline Completion Criteria
Before considering a Go task complete:
- architecture preserved
- no placeholder or stub logic
- no ignored errors without justification
- context propagation preserved
- relevant validators run
- `go build ./...` passes

## Recommended Validation Strategy

### Fast path: small low-risk change
Run only the validators directly relevant to the modified area, then build.

### Standard path: typical feature work
1. targeted validators
2. one-stop quality report if available
3. `go build ./...`

### High-risk path
Use broader validation for:
- controllers and request lifecycle changes
- concurrency/goroutine changes
- security-sensitive flows
- architectural refactors
- shared infrastructure code

## Mandatory-by-change-type Guidance

### Controller / handler changes
Prefer running:
- `validate_context_propagation.py`
- `validate_error_handling.py`
- `go build ./...`

### Service / repository changes
Prefer running:
- `validate_error_handling.py`
- `validate_function_size.py`
- `analyze_code.py`
- `go build ./...`

### Concurrency changes
Prefer running:
- `analyze_goroutines.py`
- `validate_context_todo.py`
- `validate_error_handling.py`
- `go build ./...`

### Security-sensitive changes
Prefer running:
- `validate_security.py`
- `validate_error_handling.py`
- `go build ./...`

### Broad or uncertain changes
Prefer running:
- `generate_quality_report.py`
- `go build ./...`

## Pre-Completion Checklist
- No TODO, FIXME, XXX, HACK introduced
- No silent JSON / parse / assertion failures
- No unsafe context usage in request paths
- No flattening or package naming regression
- No obviously oversized monolithic additions without reason
- Build passes

## Quality Score Policy
If a repo provides a one-stop quality score script, use it as a decision aid, not a substitute for engineering judgment. A low score must be investigated. A high score does not excuse obvious design regressions.

