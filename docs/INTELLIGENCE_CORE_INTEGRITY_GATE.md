# FAULTLINE Real-Time Intelligence Core: Integrity Gate (Phase 0)

This change introduces a pure typed provenance validator, **not** a live market feed or a deployed engine.

## Invariants
- Observation timestamps must be source-observed timestamps, not fetch/cache timestamps.
- Numeric NaN/infinity, missing inputs, unidentified sources, and missing timestamps are unavailable.
- Provider failure and stale readings cannot support a **current** claim.
- Modeled outputs require model version and remain distinguishable from observed measurements.
- Failed sources may retain a historical value, clearly marked unavailable for current inference.
- The gate never recalculates or modifies the Pressure Index or existing MarketState.
- Never derive "100% online" or "intelligence active" from rendering status alone.

## Next integration steps (separate PRs)
1. Map real provider adapter observations into `IntelligenceEvidence` without replacing source timestamps.
2. Add server-side integrity validation and tests at the canonical MarketState boundary; verify field-level propagation.
3. Expose provenance and the last verified observation in the NOW Intelligence Core evidence drawer.
4. Build visual nodes with static graceful degradation, then connect to canonical state.
5. Implement event detection and deduplication based on verified changes; validate provider limits.
6. Add monitoring, event audit history and acceptance tests before enabling any production flag.

## Release guard
Remain on a feature branch until CI and runtime validation are complete. No merge or deploy authorization is implied.
