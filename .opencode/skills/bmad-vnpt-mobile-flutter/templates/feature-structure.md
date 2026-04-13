# Recommended Flutter feature structure

```text
lib/features/<feature>/
  presentation/
    providers/
    screens/
  data/
    repositories/
    services/
  domain/
    models/
```

Keep widgets/screens thin.
Keep provider/view-model code focused on orchestration and UI state.
Keep repositories app-facing and services transport-facing.
