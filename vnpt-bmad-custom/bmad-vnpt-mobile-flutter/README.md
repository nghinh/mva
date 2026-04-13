# bmad-vnpt-mobile-flutter

BMAD custom package for Flutter mobile work.

Default stance:
- Flutter-first mobile implementation using official Flutter app architecture guidance
- Feature-first folders with MVVM/UDF-friendly layering
- `go_router` first for app routing unless the repo already uses another router
- Riverpod-first for scalable state orchestration in new code, but preserve existing repo conventions
- `flutter_lints` + strict analyzer settings
- `flutter_secure_storage` for secrets, shared preferences only for non-sensitive settings
- Unit + widget tests by default; `integration_test` for critical flows

Package contents:
- OpenCode command: `bmad-vnpt-mobile-flutter`
- Skill: `.opencode/skills/bmad-vnpt-mobile-flutter`
- Workflow registration under `src/workflows/`
- Templates, scripts, and a Flutter skeleton
