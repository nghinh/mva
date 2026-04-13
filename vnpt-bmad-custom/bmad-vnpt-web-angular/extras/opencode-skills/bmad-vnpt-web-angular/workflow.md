# Workflow for bmad-vnpt-web-angular

1. Detect Angular architecture and repo conventions.
2. Decide whether the task is implementation, review, or modernization.
3. Pick the smallest architecture pattern that fits the task.
4. Prefer standalone, feature-first placement, and thin components where compatible with the repo.
5. Keep signals for local state and RxJS for async streams.
6. Validate lazy-loading, loading/error/empty states, null safety, and downstream impact.
7. Summarize files changed, tests added, risks checked, and follow-up.
