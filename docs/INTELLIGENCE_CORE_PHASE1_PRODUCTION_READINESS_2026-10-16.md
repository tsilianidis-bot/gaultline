# Intelligence Core Phase 1 — Production-Readiness Report

**Branch:** `feature/intelligence-core-phase1-evidence-clean`
**Phase 1 evidence baseline:** `e34407c` (clean main-based implementation commit)
**Feature implementation commit:** `e34407c`
**Pull request:** [#90](https://github.com/tsilianidis-bot/gaultline/pull/90)

## Confirmed complete

Phase 1 is complete as an isolated, server-side evidence interface. The branch contains the Phase 0 Integrity Gate in `shared/intelligenceIntegrity.ts`, a canonical boundary adapter in `server/canonicalIntelligenceState.ts`, feature-gated collection, the authenticated `intelligenceEvidence.current` endpoint, and append-only snapshot/claim storage through existing `marketMemory` infrastructure.

The implementation does not alter Pressure Index scoring, canonical MarketState calculations, trading tools, Daily Briefs, blogs, pricing, Stripe, authentication, navigation, or database schema. There are no migrations in the branch.

The integrity boundary rejects invalid numbers, anonymous inputs, missing or invalid timestamps, unhealthy sources, stale observations used as current claims, and modeled outputs without a model version. When an earlier verified reading exists, it is preserved only as a timestamped historical value. The local collector showed this behavior after the equity session: expired Yahoo observations were returned as `stale`, did not support current claims, and the overall evidence interface returned `UNAVAILABLE` rather than inventing a market conclusion.

## Production separation and release state

The public production health endpoint reports deployed commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875`, built on 2026-10-14. That commit is an ancestor of the Phase 1 branch, but the Phase 1 branch head is **not deployed**. Production therefore has no Phase 1 collector or endpoint to activate, and no production flag can currently activate this feature.

No merge, deployment, feature-flag enablement, provider-credential change, database write, or production configuration mutation was performed in this review.

## Provider and persistence verification

| Surface | Result | Readiness implication |
|---|---|---|
| Yahoo Finance | A direct read returned finite SPY, QQQ, IWM, and VIX values with provider observation timestamps and `isDelayed: true`. At the later verification time, the final market-session timestamps were correctly classified as stale by the 20-minute current-use window. | Source timestamps and the stale-data fail-closed behavior are verified locally. A session-aware after-hours display policy is needed before treating end-of-session values as useful historical context. |
| Polygon fallback | `server/yahooProxy.fallback.test.ts` passed. The fallback labels proxies and fails closed when both providers fail. A live Polygon credential check was not possible because no local `POLYGON_API_KEY` is available. | Fallback behavior is tested; production credential validity remains unverified. |
| FRED | The local adapter reported `FRED_API_KEY not configured` for DGS10, DGS2, and high-yield OAS. The collector exposed each as unavailable and did not create a replacement value. | Production must have a valid existing `FRED_API_KEY` verified through Railway before Phase 1 activation. |
| CoinGecko global | The live `/global` response contained `data.updated_at`. CoinGecko’s official API schema documents `updated_at` as a required Unix last-updated time and a 10-minute endpoint update frequency. The existing FAULTLINE adapter currently discards that source timestamp and exposes only `fetchedAt`. | The current adapter correctly withholds the aggregate from current claims. A small, separately reviewed patch should propagate `updated_at` as a source observation time; it must not use fetch time. [1] |
| Canonical MarketState | Static integration is complete and tested. The local process had no `DATABASE_URL`, so it correctly returned canonical evidence as unavailable. | Production canonical-state readback remains unverified until Railway read-only diagnostics are enabled. |
| `marketMemory` persistence | The table has a unique `memoryKey`; the Phase 1 store inserts time-bucketed claims and immutable snapshot keys, then loads latest matching records. Isolated no-database checks returned `UNAVAILABLE` / `null` / `UNAVAILABLE` without a write attempt. | Append-only behavior is implemented and tested by code review; production database write/readback is not yet verified. |
| Feature flag | The flag is false unless exactly `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED=true`. The local runtime has the flag absent, and the public production build predates the branch. | Collection and endpoint exposure are disabled in both verifiable contexts. |

## Test evidence

- `pnpm check` — passed.
- Focused Integrity Gate, evidence, feature-gate, Yahoo fallback, and canonical-state tests — passed.
- Full regression suite — **192 files passed, 7 skipped; 2,073 tests passed, 44 skipped**.
- Production build — passed.
- Provider calls above are real local adapter checks, not fixture or mock results. They do not establish production provider credentials or Railway database health.

## Remaining blockers and exact access needed

The existing **Railway API** connector is configured with an encrypted `RAILWAY_PROJECT_TOKEN`, but it is **disabled** in this task. No Railway service, environment, deployment log, database, or usage query can be made while it remains disabled.

**Required owner action:** enable the existing **Railway API** connector for this task. This is a connector-access change only; it does not change the Railway project, variables, billing, database, deployment, or service. The first read-only query will be `projectToken { projectId environmentId }`, followed by service/deployment/variable-name/log and database-connectivity checks. Railway documents that a project token is scoped to one project environment and uses the `Project-Access-Token` header. [2]

If the encrypted project token is rejected after enabling the connector, replace it through the existing connector configuration with a Railway **project token scoped to the existing FAULTLINE production environment**. Do not provide a token in chat.

## GO / NO-GO

**GO — Phase 2 visual architecture and isolated implementation preparation.** The evidence contract, guardrails, branch isolation, tests, and source-state behavior are ready for UI work that remains feature-gated and consumes no new browser-side providers.

**NO-GO — production collection or visual activation.** Do not deploy or enable Phase 1 until Railway read-only diagnostics confirm: production service/deployment state; `DATABASE_URL` connectivity; append-only `marketMemory` write/readback; the actual presence and validity of FRED and Polygon credentials; and the disabled flag state. The CoinGecko `updated_at` adapter correction and an explicit after-hours freshness policy should also be reviewed before treating all six data domains as current.

## References

[1]: https://docs.coingecko.com/reference/crypto-global "CoinGecko Crypto Global Market Data"
[2]: https://docs.railway.com/integrations/api "Railway Public API"
