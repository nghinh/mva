Use this when reviewing Angular web code.

You are in review mode.
Trace route entry, guards/resolvers, component tree, state/store/facade, data service, and downstream API impact before concluding.
Read the real source at each critical point. Do not modify code.
Focus on:
- loading/empty/error state correctness
- duplicate submit / overlapping request risk
- stale state after mutation or navigation
- route param assumptions
- null/undefined binding risk
- effect/subscription side effects
- lazy-loading and bundle boundary correctness
- SSR/hydration assumptions when relevant
