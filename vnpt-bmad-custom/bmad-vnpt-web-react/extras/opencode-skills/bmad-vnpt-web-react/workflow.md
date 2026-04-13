# VNPT React Developer - Component Builder Workflow

## Overview

Tạo React Component với cấu trúc chuẩn, áp dụng **tất cả 47 Vercel React Best Practices** rules.

## Configuration

```
TS_MODE: strict
CSS_METHOD: tailwind
NAMING: kebab-case
FEATURES: [hooks, types, tests, barrel]
BEST_PRACTICES: 47 Vercel rules (skills/react/rules/)
```

## Workflow Trigger Conditions

Activates when user requests:
- "tạo component react"
- "create react component"
- "new component"
- "add component"
- Component name + props description

---

## Execution Steps

### Step 1: Parse Input

Extract from user input:
- Component name (convert to kebab-case for folder, PascalCase for exports)
- Props list with types
- Component description/functionality
- Any special requirements (children, refs, async operations, etc.)

### Step 2: Determine Target Location

Ask user for target directory if not clear:
- Current working directory
- `src/components/`
- Custom path

### Step 3: Generate File Structure

Create folder: `{component-name}/`

Generate files in order:
1. `types.ts` - TypeScript interfaces
2. `hooks.ts` - Custom hooks (if logic needed)
3. `index.tsx` - Main component
4. `index.ts` - Barrel exports
5. `{component-name}.test.tsx` - Unit tests

### Step 4: Apply Vercel Best Practices (CRITICAL)

Reference ALL rules from `rules/` directory based on component complexity:

#### 4.1 Eliminating Waterfalls (CRITICAL) - Priority 1

Apply when component has async operations:
- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

#### 4.2 Bundle Size Optimization (CRITICAL) - Priority 2

Apply for component with heavy imports:
- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

#### 4.3 Server-Side Performance (HIGH) - Priority 3

Apply for Server Components or API routes:
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-after-nonblocking` - Use after() for non-blocking operations

#### 4.4 Client-Side Data Fetching (MEDIUM-HIGH) - Priority 4

Apply when component fetches data:
- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners

#### 4.5 Re-render Optimization (MEDIUM) - Priority 5

ALWAYS apply for performance:
- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-functional-setState` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-transitions` - Use startTransition for non-urgent updates

#### 4.6 Rendering Performance (MEDIUM) - Priority 6

Apply for rendering-heavy components:
- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals

#### 4.7 JavaScript Performance (LOW-MEDIUM) - Priority 7

Apply for compute-heavy operations:
- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability

#### 4.8 Advanced Patterns (LOW) - Priority 8

Apply for complex scenarios:
- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-use-latest` - useLatest for stable callback refs

### Step 5: Write Files

Use Write tool for each file. Verify existing files don't conflict.

### Step 6: Validation

Run lint checks:
- TypeScript compilation check (if tsc available)
- Import statements validity
- Proper exports

---

## Component Generation Template

### Naming Convention

Input: `UserCard` or `user-card`
Folder: `user-card/`
Export: `UserCard`
Hook: `useUserCard`

### Props Detection Pattern

From natural language, extract:
- Prop name → camelCase
- Type → TypeScript type (string, number, boolean, custom interfaces)
- Required vs optional (?)
- Default values

Examples:
- "avatar string" → `avatar: string`
- "name optional" → `name?: string`
- "onClick function" → `onClick?: () => void`

### Tailwind Class Mapping

Common patterns:
- Container: `flex items-center gap-4 p-4 rounded-lg`
- Card: `bg-white shadow-md hover:shadow-lg transition-shadow`
- Button: `px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600`
- Text: `text-sm font-medium text-gray-700`

## Hooks Extraction Logic

Extract to custom hook when:
- State management is complex (>2 related states)
- Effect logic is non-trivial
- Callback needs memoization (apply `rerender-defer-reads`)
- Logic can be tested independently

**ALWAYS apply:**
- `rerender-functional-setState` for stable callbacks
- `rerender-dependencies` with primitive types
- `advanced-use-latest` for stable refs in callbacks

## Test Generation Pattern

Always include:
1. Basic render test
2. Props passing test
3. Interaction test (if applicable)
4. Edge case tests (optional props, null handling)
5. Performance test (if applies `rerender-*` rules)

---

## Output Confirmation

After generation, show:
```
✓ Created component: user-card/
  - index.tsx (main component with Vercel best practices)
  - types.ts (TypeScript interfaces)
  - hooks.ts (custom hooks with performance optimization)
  - index.ts (barrel exports)
  - user-card.test.tsx (unit tests)

Applied best practices:
  ✓ rerender-defer-reads - State subscription optimized
  ✓ rerender-functional-setState - Stable callbacks
  ✓ rendering-hoist-jsx - Static JSX extracted
  ✓ js-early-exit - Early returns implemented

Usage:
import { UserCard } from './user-card';
<UserCard avatar="..." name="..." />
```

---

## Quick Rules Reference

See individual rule files in `rules/` for detailed explanations:

### Critical (Must Apply)
- `rules/async-*.md` - 5 rules for eliminating waterfalls
- `rules/bundle-*.md` - 5 rules for bundle optimization

### High Priority
- `rules/server-*.md` - 5 rules for server performance
- `rules/client-*.md` - 2 rules for client data fetching

### Medium Priority (Always Consider)
- `rules/rerender-*.md` - 7 rules for re-render optimization
- `rules/rendering-*.md` - 7 rules for rendering performance

### Low Priority (When Needed)
- `rules/js-*.md` - 12 rules for JavaScript performance
- `rules/advanced-*.md` - 2 rules for advanced patterns

## Error Handling

- If folder exists: Ask to overwrite or skip
- If imports fail: Check project dependencies
- If TypeScript errors: Report and suggest fixes
- If best practices violated: Warn and suggest corrections
