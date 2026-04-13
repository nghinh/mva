# Scripts Reference

## Purpose
This file describes how to use bundled scripts without making the skill brittle.

## General Rules
1. Before invoking a script, verify the script exists in the current repo.
2. If the script is absent, fall back to the documented manual checklist for the same concern.
3. Prefer the smallest useful script set for the task.
4. Use a one-stop quality report when broad coverage is needed.

## Common Script Catalog
These names are derived from the original skill pack and may or may not all exist in a given repository:

### Scaffolding and generation
- `scaffold_feature.py`
- `generate_di_wiring.py`
- `generate_endpoints.py`
- `generate_unit_tests.py`
- `extract_api_contract.py`

### Validation
- `validate_production_ready.py`
- `validate_context_propagation.py`
- `validate_context_todo.py`
- `validate_error_handling.py`
- `validate_function_size.py`
- `validate_security.py`
- `validate_interface_contracts.py`

### Analysis
- `analyze_code.py`
- `analyze_cyclomatic_complexity.py`
- `analyze_dependencies.py`
- `analyze_goroutines.py`
- `detect_dead_code.py`

### Reporting / workflow
- `generate_quality_report.py`
- `update_progress.py`

## Suggested Usage

### New feature
- `scaffold_feature.py`
- `generate_di_wiring.py`
- targeted validators
- `generate_quality_report.py` if available
- `go build ./...`

### Existing feature change
- only validators relevant to the touched layers
- `go build ./...`

### Completion
If available, `generate_quality_report.py` is the preferred broad validation entry point. Use individual validators when you need focused feedback or when the report script does not exist.

## Manual Fallbacks
If a script is missing, use manual checks:
- production readiness → grep for TODO/FIXME/HACK + inspect placeholders
- context propagation → search for `context.Background()` and `context.TODO()` in production paths
- error handling → search for ignored `_` errors, unchecked `json.Marshal`, unchecked assertions, unchecked parsing
- function size → inspect files/functions that became hard to scan
- security → review query construction, secrets, weak crypto, SSRF entry points

