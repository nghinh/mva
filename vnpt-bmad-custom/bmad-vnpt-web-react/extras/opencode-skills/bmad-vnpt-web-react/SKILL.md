---
name: bmad-vnpt-web-react
description: Bundled VNPT React Developer skill pack and BMAD/OpenCode entrypoint.
---

# bmad-vnpt-web-react

This skill folder has been normalized to use a single `SKILL.md` entrypoint.
The original `skill.md` content has been merged below so the package no longer relies on two similarly named files.

## Entry Behavior
Use this skill as the canonical entrypoint for the VNPT React Developer pack.

## Original Pack Content

## Wrapper Guidance

---
name: bmad-vnpt-web-react
description: Create React components using the bundled VNPT React Developer rules, templates, and workflow pack.
---

# bmad-vnpt-web-react

## Purpose
Create React components in a BMAD-aligned way using the bundled VNPT React Developer rule pack.

## Bundled Assets In This Skill Folder
This skill folder intentionally includes:
- `skill.md`
- `workflow.md`
- `rules/`
- `templates/`
- `metadata.json`
- `lint.json`

You must actively read and use those local files before generating code.

## Required Processing Order
1. Read local `skill.md`
2. Read local `workflow.md`
3. Read relevant files under local `rules/`
4. Read relevant files under local `templates/`
5. Parse the user's component/task request
6. Produce an Artifact Intake Summary
7. Generate the component package
8. Validate imports, exports, typing, and tests
9. End with a completion summary

## Artifact Intake Summary
Before writing files, restate:
- component or feature name
- target location
- inferred props and types
- behavior and states
- async/data requirements
- rule categories selected from the VNPT React pack
- templates selected
- assumptions or missing information

## Default Output Package
Unless the repository has a stronger convention, generate:
- `index.tsx`
- `types.ts`
- `hooks.ts`
- `<component-name>.test.tsx`
- `index.ts`

## Mandatory Rules
- Use the bundled local `rules/` and `templates/`.
- Use TypeScript strict-friendly types.
- Respect repo conventions if they are clear.
- Include or explicitly justify omission of tests, hooks, and barrel exports.
- Report which rule categories were applied and why.


## Original `skill.md` Content

---
name: vnpt-react-developer
description: Tạo React Component với cấu trúc chuẩn, TypeScript strict mode, Tailwind CSS. Áp dụng TẤT CẢ 47 Vercel React Best Practices rules. Tự động tạo folder structure với types, hooks, tests, và barrel exports.
---

# VNPT React Developer

Workflow tạo React Component chuyên nghiệp với **tất cả 47 Vercel React Best Practices** được áp dụng tự động.

## Tính năng

- **TypeScript Strict Mode**: Full type safety với proper interfaces
- **Tailwind CSS**: Utility-first styling
- **Kebab-case naming**: component-name/ folder structure
- **Custom Hooks**: Tự động tách logic phức tạp thành custom hooks
- **Unit Tests**: Vitest/Jest compatible test setup
- **Barrel Exports**: Clean imports qua index.ts
- **47 Vercel Best Practices**: Tự động áp dụng tất cả rules từ `rules/`

## 47 Best Practices Rules

### Critical Priority (10 rules)
- **Eliminating Waterfalls** (5): `async-defer-await`, `async-parallel`, `async-dependencies`, `async-api-routes`, `async-suspense-boundaries`
- **Bundle Size Optimization** (5): `bundle-barrel-imports`, `bundle-dynamic-imports`, `bundle-defer-third-party`, `bundle-conditional`, `bundle-preload`

### High Priority (7 rules)
- **Server-Side Performance** (5): `server-cache-react`, `server-cache-lru`, `server-serialization`, `server-parallel-fetching`, `server-after-nonblocking`
- **Client-Side Data Fetching** (2): `client-swr-dedup`, `client-event-listeners`

### Medium Priority (14 rules)
- **Re-render Optimization** (7): `rerender-defer-reads`, `rerender-memo`, `rerender-dependencies`, `rerender-derived-state`, `rerender-functional-setState`, `rerender-lazy-state-init`, `rerender-transitions`
- **Rendering Performance** (7): `rendering-animate-svg-wrapper`, `rendering-content-visibility`, `rendering-hoist-jsx`, `rendering-svg-precision`, `rendering-hydration-no-flicker`, `rendering-activity`, `rendering-conditional-render`

### Low Priority (14 rules)
- **JavaScript Performance** (12): `js-batch-dom-css`, `js-index-maps`, `js-cache-property-access`, `js-cache-function-results`, `js-cache-storage`, `js-combine-iterations`, `js-length-check-first`, `js-early-exit`, `js-hoist-regexp`, `js-min-max-loop`, `js-set-map-lookups`, `js-tosorted-immutable`
- **Advanced Patterns** (2): `advanced-event-handler-refs`, `advanced-use-latest`

## Cấu trúc output

```
component-name/
├── index.tsx                # Main component với best practices
├── types.ts                 # TypeScript interfaces/types
├── hooks.ts                 # Custom hooks (optimized)
├── component-name.test.tsx  # Unit tests
└── index.ts                 # Barrel exports
```

## Cách sử dụng

Gọi workflow với:
1. Tên component (kebab-case hoặc PascalCase sẽ tự động convert)
2. Mô tả props và chức năng component
3. Workflow sẽ tự động detect và apply appropriate rules

Ví dụ:
```
"tạo user-card component với avatar, name, email props và hover effect"
"create async-data-table component với columns prop và server-side sorting"
```

## Rules Reference

Xem chi tiết từng rule trong thư mục `rules/`:
```
rules/
├── async-*.md       # Waterfall elimination
├── bundle-*.md      # Bundle optimization
├── server-*.md      # Server performance
├── client-*.md      # Client data fetching
├── rerender-*.md    # Re-render optimization
├── rendering-*.md   # Rendering performance
├── js-*.md          # JavaScript performance
└── advanced-*.md    # Advanced patterns
```

## Automatic Audit Support
This package also includes an automatic audit layer under `tools/audit/` in the package source.

Recommended two-layer usage for existing codebases:
1. run the automatic audit script
2. review the generated reports
3. perform the deeper manual review using this skill pack

This skill pack should therefore be used for both:
- generation / implementation
- second-layer manual audit after machine-generated findings

## Required Quality Gate
When this skill is used for generation or refactoring, the workflow must not stop after code generation.

It must always execute a two-layer quality gate:
1. automatic audit using `tools/vnpt-react-audit/audit_react_skill.py`
2. manual AI review using the generated audit reports plus this skill pack

Completion is only valid after:
- automatic audit results are reviewed
- manual review is completed
- findings are fixed or explicitly justified


## Standard Local Commands
When installed into a repository using the standard installer, use these commands for the required quality gate:

```bash
python tools/vnpt-react-audit/audit_react_skill.py --repo .
```

Optional safe autofix:
```bash
python tools/vnpt-react-audit/autofix_react_skill.py --repo . --source src
```

For monorepos or non-standard frontend roots, use a more specific source path such as:
```bash
python tools/vnpt-react-audit/audit_react_skill.py --repo . --source apps/web/src
python tools/vnpt-react-audit/autofix_react_skill.py --repo . --source apps/web/src
```

Then review:
- `reports/react-skill-audit/react-skill-audit.json`
- `reports/react-skill-audit/react-skill-audit.md`
- `tools/vnpt-react-audit/review_with_ai_prompt.md`


## Agent Must Run The Gate
When an AI agent uses this skill to generate or refactor code, the agent must itself run:

```bash
python tools/vnpt-react-audit/enforce_quality_gate.py --repo . --source src
```

For monorepos or other layouts, use the correct source path such as `apps/web/src`.

The agent must then read the generated reports, perform the manual review, apply fixes, and rerun the gate if needed.
