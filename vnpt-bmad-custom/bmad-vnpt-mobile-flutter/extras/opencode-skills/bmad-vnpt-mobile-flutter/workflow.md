# VNPT Mobile Flutter Working Flow

## Step 1: Detect architecture
Identify:
- Flutter app/package/plugin
- router stack (`go_router`, Navigator 1.0/2.0, auto_route, etc.)
- state stack (Riverpod, Bloc, Provider, MobX, GetIt, custom)
- data access patterns and repository/service conventions
- analyzer/testing commands in the repo

## Step 2: Produce Artifact Intake Summary
Summarize:
- detected architecture
- existing conventions to preserve
- files likely affected
- risks and verification plan

## Step 3: Implement or review
Apply the smallest correct change.
Keep widgets/screens thin.
Prefer explicit async/error states.
Avoid architectural churn unless requested.

## Step 4: Verify
Default verification order:
1. `dart format .` or repo formatter
2. `flutter analyze`
3. targeted tests
4. broader `flutter test` when riskier changes were made

## Step 5: Report
Return:
- summary of change/review
- route/state/data decisions
- files changed/reviewed
- checks run
- residual risks / follow-ups
