# bmad-vnpt-mobile-react local workflow

## Intake Summary Template
- Target: 
- Repo type: Expo Router / Expo / bare RN / mobile workspace
- Route entry: 
- Feature path: 
- API dependencies: 
- State split: TanStack Query / Zustand / local state
- Storage: SecureStore / AsyncStorage / none
- Templates selected: 
- Risks to inspect: 

## Implementation Sequence
1. Detect repo architecture.
2. Reuse repo conventions if present.
3. Pick the smallest feature structure that fits.
4. Keep screen UI thin.
5. Put network logic behind `api/` or `lib/http/` wrappers.
6. Put query logic into hooks.
7. Keep secrets out of AsyncStorage.
8. Validate loading, empty, error, and duplicate-submit paths.
9. Add tests or clearly explain why not.

## Review Sequence
1. Trace route entry and focus lifecycle.
2. Trace screen -> hook -> service -> storage/API flow.
3. Check cache keys and invalidation.
4. Check mutation idempotency / duplicate tap risks.
5. Check auth token flow and secure storage.
6. Check large-list and rerender hotspots.
7. Summarize confirmed risks vs. unverified assumptions.
