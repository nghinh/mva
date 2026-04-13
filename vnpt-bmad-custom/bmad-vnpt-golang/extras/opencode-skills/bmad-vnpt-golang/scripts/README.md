# Senior Go Backend Developer - Scripts

This folder contains utility scripts to automate common Go backend development tasks following the Senior Go Backend Developer skill guidelines.

## Available Scripts

### 1. `scaffold_feature.py` (Recommended for Windows)
**Purpose:** Scaffold a complete feature module with all layers (models, repositories, services, controllers, adapters, routers).

```bash
# Usage
python scaffold_feature.py <feature_name>

# Example
python scaffold_feature.py notifications
python scaffold_feature.py user_preferences
```

**Output:** Creates a complete feature structure:
```
features/<feature_name>/
├── models/
│   ├── <feature>_model.go
│   └── errors.go
├── repositories/
│   ├── interface.go
│   └── mongo_repository.go
├── services/
│   ├── interface.go
│   └── service_impl.go
├── controllers/
│   └── http_controller.go
├── adapters/
│   └── external_adapter.go
└── routers/
    └── router.go
```

### 2. `scaffold_feature.sh` (Linux/macOS)
Same functionality as above but in Bash for Unix systems.

```bash
./scaffold_feature.sh notifications
```

---

### 3. `validate_production_ready.py` ⚠️ MANDATORY
**Purpose:** Validate that code is production-ready with NO TODOs, placeholders, or missing error handling.

**THIS SCRIPT MUST BE RUN BEFORE MARKING ANY TASK COMPLETE.**

```bash
# Validate a feature directory
python validate_production_ready.py features/notifications

# Strict mode (additional checks)
python validate_production_ready.py features/notifications --strict

# JSON output for CI/CD
python validate_production_ready.py features/notifications --json
```

**Checks performed:**
- 🚨 **CRITICAL**: TODOs, FIXMEs, XXX, HACK comments
- 🚨 **CRITICAL**: Placeholder/stub comments
- 🚨 **CRITICAL**: Empty function bodies
- 🚨 **CRITICAL**: context.Background() in request handlers
- ❌ **ERROR**: Ignored error return values (using `_`)
- ❌ **ERROR**: json.Marshal/Unmarshal errors ignored
- ❌ **ERROR**: Type assertion ok check ignored
- ❌ **ERROR**: strconv parse errors ignored
- ❌ **ERROR**: Resource lock release errors ignored
- ❌ **ERROR**: Unchecked `ctx.Bind()` calls
- ⚠️ **WARNING**: `panic()` usage
- ⚠️ **WARNING**: Very short function bodies
- ⚠️ **WARNING**: Bare error returns without wrapping

**Exit codes:**
- `0`: All checks passed
- `1`: Errors found
- `2`: Critical violations found (blocking)

---

### 4. `validate_context_propagation.py` 🆕
**Purpose:** Specialized validator for context propagation issues - the #1 issue from code reviews (~35% of critical issues).

```bash
# Validate controllers
python validate_context_propagation.py features/workflow/controllers

# Validate entire feature
python validate_context_propagation.py features/workflow

# JSON output
python validate_context_propagation.py features/workflow --json

# Detailed report with fix suggestions
python validate_context_propagation.py features/workflow --report
```

**Checks performed:**
- 🚨 **CRITICAL**: `context.Background()` in controllers/handlers
- ⚠️ **WARNING**: `context.Background()` in services (non-controller files)
- ⚠️ **WARNING**: `context.TODO()` that should be replaced
- ⚠️ **WARNING**: Goroutines started without context

**Excluded from checks:**
- `_test.go` files
- `main.go` files
- `cmd/` package files
- Code with `// intentionally` or `// Note:` comments

---

### 5. `validate_error_handling.py` 🆕
**Purpose:** Comprehensive validator for error handling issues - addresses ~40% of code review issues.

```bash
# Validate a feature
python validate_error_handling.py features/workflow

# Strict mode (includes bare error returns)
python validate_error_handling.py features/workflow --strict

# Filter by category
python validate_error_handling.py features/workflow --category json

# JSON output
python validate_error_handling.py features/workflow --json
```

**Categories checked:**
- **JSON Marshaling**: `json.Marshal`/`Unmarshal` errors ignored
- **Type Assertions**: `ctx.Get("key").(Type)` without ok check
- **String Conversion**: `strconv.Atoi`, `ParseFloat`, `ParseInt` errors
- **URL Parsing**: `url.Parse`, `ParseQuery` errors
- **Resource Lock**: `ReleaseLock`, `Unlock` errors ignored
- **Database Operation**: `Find`, `Insert`, `Update` errors ignored
- **File Operation**: `os.Stat`, file operation errors
- **Error Wrapping**: Bare `return err` without `fmt.Errorf("%w", err)` (strict mode)

---

### 6. `validate_context_todo.py` 🆕 ⛔ DEPLOYMENT BLOCKER
**Purpose:** Check for `context.TODO()` in production code - this is a DEPLOYMENT BLOCKER.

`context.TODO()` means "I'll fix this later" - but later never comes. It indicates incomplete refactoring.

```bash
# Validate a feature
python validate_context_todo.py features/workflow

# JSON output
python validate_context_todo.py features/workflow --json
```

**Checks performed:**
- ⛔ **BLOCKER**: `context.TODO()` in any production file

**Excluded from checks:**
- `_test.go` files (context.TODO() is acceptable in tests)

**Exit codes:**
- `0`: No context.TODO() found
- `2`: DEPLOYMENT BLOCKED - context.TODO() found in production code

---

### 7. `validate_function_size.py` 🆕
**Purpose:** Check for functions exceeding 50 lines and files exceeding 500 lines (~34% of code review warnings).

Large functions and files indicate poor separation of concerns and are hard to:
- Understand and maintain
- Test in isolation
- Review effectively

```bash
# Validate a feature
python validate_function_size.py features/workflow

# Custom thresholds
python validate_function_size.py features/workflow --max-func 60 --max-file 600

# JSON output
python validate_function_size.py features/workflow --json
```

**Checks performed:**
- 🔴 **CRITICAL**: Functions > 70 lines
- 🔶 **WARNING**: Functions > 50 lines (configurable with --max-func)
- 🔴 **CRITICAL**: Files > 700 lines
- 🔶 **WARNING**: Files > 500 lines (configurable with --max-file)

**Excluded from function checks:**
- `_test.go` files (test functions are allowed to be longer)

**Exit codes:**
- `0`: All within limits (may have warnings)
- `2`: Critical violations found (functions >70 lines or files >700 lines)

---

### 8. `analyze_code.py`
**Purpose:** Analyze Go source code for architecture compliance, code quality, and potential issues.

```bash
# Analyze a single file
python analyze_code.py features/notifications/services/service_impl.go

# Analyze a directory
python analyze_code.py features/notifications

# JSON output (for CI/CD)
python analyze_code.py features/ --json
```

**Checks performed:**
- Forbidden patterns (global state, direct driver imports in services, context.Background() misuse)
- Required patterns per file type (interfaces in services, context in repositories)
- Function complexity (warns if > 50 lines)
- Sensitive data logging (password, token, secret)

---

### 4. `generate_di_wiring.py`
**Purpose:** Generate the Dependency Injection wiring code needed to integrate a new feature into `routers/constant.go`.

```bash
python generate_di_wiring.py notifications

# Specify custom module path
python generate_di_wiring.py notifications --module "github.com/myorg/myapp"

# Save to file
python generate_di_wiring.py notifications -o wiring_snippet.txt
```

**Output:** Provides copy-paste ready code for:
- Import statements
- Variable declarations
- Initialization code
- Route registration

---

### 5. `generate_endpoints.py`
**Purpose:** Generate Echo handler stubs and route registration from endpoint definitions.

```bash
# Interactive mode
python generate_endpoints.py --feature notifications --interactive

# From JSON definition
python generate_endpoints.py --feature notifications --endpoints endpoints.json

# Save output
python generate_endpoints.py --feature notifications --interactive -o ./generated
```

**JSON definition format:**
```json
[
  {
    "method": "GET",
    "path": "/notifications",
    "summary": "List all notifications"
  },
  {
    "method": "POST",
    "path": "/notifications",
    "summary": "Create notification",
    "body": {"title": "string", "message": "string"}
  },
  {
    "method": "GET",
    "path": "/notifications/:id",
    "summary": "Get notification by ID"
  }
]
```

---

### 9. `validate_security.py` 🔒 SECURITY SCANNER
**Purpose:** Detect common security vulnerabilities in Go code following OWASP guidelines.

```bash
python validate_security.py features/workflow
python validate_security.py features/workflow --strict
python validate_security.py features/workflow --json
```

**Checks performed:**
- 🔴 **SQL Injection**: String concatenation in queries
- 🔴 **Hardcoded Secrets**: Passwords, API keys, tokens
- 🔴 **Command Injection**: `exec.Command` with user input
- 🟠 **Weak Cryptography**: MD5, SHA1, DES, RC4
- 🟠 **SSRF**: User-controlled URLs in HTTP requests
- 🟠 **Path Traversal**: Unsanitized file paths
- 🟡 **Insecure TLS**: TLS 1.0/1.1, InsecureSkipVerify
- 🟡 **Cookie Security**: Missing Secure/HttpOnly flags

---

### 10. `extract_api_contract.py` 📋 API EXTRACTOR
**Purpose:** Extract API contracts from Go code for frontend integration.

```bash
python extract_api_contract.py features/workflow
python extract_api_contract.py features/workflow --output openapi.json
python extract_api_contract.py features/workflow --typescript types.ts
```

**Outputs:**
- OpenAPI 3.0 specification (JSON/YAML)
- TypeScript interfaces
- API endpoint summary

---

### 11. `generate_quality_report.py` 📊 QUALITY REPORT
**Purpose:** Run ALL validation scripts and generate a comprehensive quality score.

```bash
python generate_quality_report.py features/workflow
python generate_quality_report.py features/workflow --html report.html
python generate_quality_report.py features/workflow --json
```

**Features:**
- Runs all validators automatically
- Calculates overall quality score (0-100)
- Generates HTML/JSON reports
- Perfect for CI/CD integration

---

### 12. `analyze_cyclomatic_complexity.py` 🧮 COMPLEXITY METRICS
**Purpose:** Measure cyclomatic complexity to identify overly complex functions.

```bash
python analyze_cyclomatic_complexity.py features/workflow
python analyze_cyclomatic_complexity.py features/workflow --threshold 10
python analyze_cyclomatic_complexity.py features/workflow --json
```

**Guidelines:**
- ≤ 10: ✅ Good
- 11-15: ⚠️ Consider refactoring
- > 15: 🔴 Must refactor

---

### 13. `detect_dead_code.py` 💀 DEAD CODE DETECTOR
**Purpose:** Find unused functions, variables, and types.

```bash
python detect_dead_code.py features/workflow
python detect_dead_code.py features/workflow --include-exports
python detect_dead_code.py features/workflow --json
```

**Detects:**
- Unexported functions never called
- Unused constants/variables
- Orphaned types

---

### 14. `analyze_dependencies.py` 🔗 DEPENDENCY ANALYZER
**Purpose:** Analyze package dependencies and detect architectural issues.

```bash
python analyze_dependencies.py features/
python analyze_dependencies.py features/ --graph deps.dot
python analyze_dependencies.py features/ --metrics
```

**Features:**
- Detect import cycles
- Calculate coupling metrics (Ce, Ca, Instability)
- Generate GraphViz visualization

---

### 15. `analyze_goroutines.py` 🔄 GOROUTINE ANALYZER
**Purpose:** Detect potential goroutine leaks and concurrency issues.

```bash
python analyze_goroutines.py features/workflow
python analyze_goroutines.py features/workflow --strict
python analyze_goroutines.py features/workflow --json
```

**Checks:**
- 🔴 Goroutines without context
- 🔴 Unbounded goroutine spawning
- ⚠️ Blocking channel operations
- ⚠️ Missing errgroup usage

---

### 16. `generate_unit_tests.py` 🧪 TEST GENERATOR
**Purpose:** Generate unit test stubs from function signatures.

```bash
python generate_unit_tests.py features/workflow/services/service.go
python generate_unit_tests.py features/workflow/services/service.go --mocks
python generate_unit_tests.py features/workflow --recursive
```

**Generates:**
- Table-driven test templates
- Mock implementations for interfaces
- testify/assert patterns

---

### 17. `validate_interface_contracts.py` 📝 INTERFACE VALIDATOR
**Purpose:** Verify structs properly implement interface contracts.

```bash
python validate_interface_contracts.py features/workflow
python validate_interface_contracts.py features/workflow --strict
python validate_interface_contracts.py features/workflow --json
```

**Checks:**
- All interface methods implemented
- Context as first parameter
- Error returns properly typed

---

## Quick Start Workflow

1. **Create a new feature:**
   ```bash
   cd c:\Developer\GitHub\av-platform
   python .claude/skills/expert-go-backend-developer/scripts/scaffold_feature.py my_feature
   ```

2. **Generate DI wiring:**
   ```bash
   python .claude/skills/expert-go-backend-developer/scripts/generate_di_wiring.py my_feature
   ```

3. **Add the wiring code** to `routers/constant.go` using the generated snippet.

4. **Implement your business logic** in the generated files.

5. **Run ALL validation scripts (MANDATORY):**
   ```bash
   # Step A: Production ready check (TODOs, placeholders, ignored errors)
   python .claude/skills/expert-go-backend-developer/scripts/validate_production_ready.py features/my_feature

   # Step B: Context propagation check (context.Background() misuse)
   python .claude/skills/expert-go-backend-developer/scripts/validate_context_propagation.py features/my_feature/controllers

   # Step C: Error handling check (JSON, type assertions, strconv)
   python .claude/skills/expert-go-backend-developer/scripts/validate_error_handling.py features/my_feature

   # Step D: context.TODO() blocker check (DEPLOYMENT BLOCKER)
   python .claude/skills/expert-go-backend-developer/scripts/validate_context_todo.py features/my_feature

   # Step E: Function/file size check (functions >50 lines, files >500 lines)
   python .claude/skills/expert-go-backend-developer/scripts/validate_function_size.py features/my_feature

   # Step F: Architecture compliance
   python .claude/skills/expert-go-backend-developer/scripts/analyze_code.py features/my_feature
   ```

6. **Build and verify:**
   ```bash
   go build ./...
   ```

---

## Requirements

- Python 3.8+ (No external dependencies required)
- Go 1.25.5+ (for building the generated code)

