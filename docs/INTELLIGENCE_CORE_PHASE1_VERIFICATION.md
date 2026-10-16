# Intelligence Core Phase 1 — Verification Record

**Branch:** `feature/intelligence-core-phase1-data`
**Scope:** server-side verified evidence only; the feature flag remains disabled by default.

## Local adapter check — 2026-10-16

The provider diagnostic was run using the existing adapter modules. It did not use mock data and did not write a database record.

| Source | Result | Evidence handling |
|---|---|---|
| Yahoo Finance | **Available.** SPY returned a finite price and provider-supplied observation timestamp. | The collector admitted SPY, QQQ, IWM, and VIX quote observations as `verified` only where both values and source timestamps were valid. |
| CoinGecko global aggregate | **Returned an aggregate response**, but the existing adapter exposes only `fetchedAt`, not a provider observation timestamp. | Phase 1 intentionally returns this reading as `unavailable` with a null display value. The response does not convert fetch time into an observation time. |
| FRED | **Unavailable in this environment.** Existing adapter reported `FRED_API_KEY not configured` for DGS10, DGS2, and BAMLH0A0HYM2. | Each reading is explicitly `unavailable`; no neutral, fallback, or inferred credit/rates value is supplied. |
| Canonical MarketState | **Unavailable in the local diagnostic** because no `DATABASE_URL` was provided to the local process. | The collector reports the canonical provider as unavailable. This is a local validation state, not a claim about production. |
| Persistence | **In-memory only in the local diagnostic** because no database was attached. | The implementation reuses existing append-only `marketMemory` snapshots and claims when a production database is available; it adds no migration. |

The resulting local snapshot status was **DEGRADED**, driven by the verified Yahoo observations and explicit unavailable states for canonical, FRED, and CoinGecko. No unavailable source was represented as a calm or neutral market conclusion.

## Test record

- `pnpm exec tsc --noEmit`: passed.
- Focused evidence, Integrity Gate, feature-gate, and canonical-regression tests: **4 files / 34 tests passed**.
- Full regression suite: **273 files passed, 7 skipped; 3,515 tests passed, 44 skipped**.
- Production build: passed. Existing bundle-size warnings remain pre-existing build guidance only; Phase 1 adds no browser bundle or visual dependency.

## Required production actions before enabling

1. Provide `FRED_API_KEY` through the existing Railway environment-variable mechanism; do not add it to the repository or logs.
2. Verify `marketMemory` read/write access in the existing production database with this flag still disabled.
3. Decide whether to enhance the CoinGecko adapter with a provider observation timestamp; until then, keep its aggregate evidence unavailable for current claims.
4. Run the source-provider diagnostic in the production runtime and review source-health output.
5. Enable `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED=true` only in a separately approved release after the above checks. Enabling the flag starts collection; this branch does not enable the visual Core.
