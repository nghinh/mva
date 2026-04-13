# Feature Structure Template

```text
src/features/<feature>/
  api/
    <feature>-service.ts
  hooks/
    use-<feature>-query.ts
    use-<feature>-actions.ts
  screens/
    <feature>-screen.tsx
  store/
    use-<feature>-store.ts
  types.ts
```

Notes:
- omit `store/` unless there is real cross-component UI/workflow state
- keep route-specific layout under `src/app/` or `app/`
