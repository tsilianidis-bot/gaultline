# FAULTLINE Intelligence Core — Phase 1.1 Evidence Readiness

**Date:** 2026-10-16

> **Decision: conditional GO for feature-flagged Phase 2 visual work; NO-GO for production activation.**
>
> The evidence contract, integrity gates, six-domain projection, bounded local persistence behavior, TypeScript check, full regression suite, and production build pass. Production activation remains blocked until Railway’s project token is available to the runtime for read-only verification of the existing service and database.

## Scope completed

Phase 1.1 stays inside the existing read-only Intelligence Evidence pipeline. It does **not** alter the Pressure Index, canonical MarketState calculations, trading tools, Daily Briefs, blogs, pricing, Stripe, authentication, the existing NOW layout, database schema, production data, credentials, or feature-flag state.

### Implemented repairs

1. **CoinGecko source time is now preserved.** `getGlobalStats()` maps `data.updated_at` to `GlobalStats.observedAt` (Unix milliseconds). `fetchedAt` remains only the local receipt time. A missing, invalid, or stale provider timestamp remains unavailable for a current-use claim.
2. **Yahoo observation timing is session-aware.** `classifyYahooObservation()` distinguishes:
   - `live` — only an explicitly undelayed, active-session provider observation in the live-use window;
   - `delayed` — an active-session delayed observation within the permitted window;
   - `completed_session` — historical context only, never a current claim;
   - `stale` and `unavailable` — fail closed.

   The existing Yahoo adapter marks Yahoo observations delayed, so it cannot silently call them live.
3. **A fixed six-domain projection is available.** The immutable evidence payload now projects validated observations into `equities`, `bonds_rates`, `credit`, `liquidity`, `volatility`, and `crypto`. This groups existing evidence only; it adds no score, relationship inference, recommendation, or synthetic neutral state.
4. **Append-only ledger behavior is covered locally.** The existing `marketMemory` table remains the storage surface. A local fake-DB regression validates the collection lease, duplicate rejection, append-only snapshot insert, and readback path. No migration was added and no production row was written.

## Verification results

| Check | Result | Evidence / limitation |
|---|---|---|
| TypeScript | **Pass** | `pnpm check` completed with exit code 0. |
| Focused evidence tests | **Pass — 24 tests / 6 files** | Covers CoinGecko timestamps, Yahoo timing, canonical Integrity Gate, source failure, stale/history handling, six domains, flags, and ledger readback. |
| Full regression suite | **Pass — 2,082 tests passed; 44 skipped / 202 files** | `pnpm test` completed with exit code 0. |
| Production build | **Pass** | `pnpm build` completed with exit code 0. |
| CoinGecko provider check | **Healthy locally** | `/global` supplied a provider timestamp, about 44 seconds old at verification. The collector classified crypto as healthy. |
| Yahoo provider check | **Historical after close** | SPY, QQQ, IWM, and VIX had provider timestamps but were classified `completed_session`, not current. |
| Local FRED configuration | **Unavailable locally** | `FRED_API_KEY` was absent; DGS10, DGS2, and BAMLH0A0HYM2 correctly returned unavailable rather than fallback values. |
| Production canonical endpoint | **Available** | `https://getfaultline.live/api/trpc/marketState.current` returned HTTP 200 with canonical source health. Its response reported FRED healthy; the endpoint remains on deployed commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875`, not this branch. |
| Production Railway / database diagnostics | **Blocked** | The enabled Railway connector contains an encrypted project-token binding, but `RAILWAY_PROJECT_TOKEN` is empty in the Sandbox runtime. Both normal and temporary token-replacement modes were tried without printing a secret. Therefore no Railway GraphQL scope, service, deployment, logs, environment-name, or live `marketMemory` read-only query could be made. |

## Current provider and persistence state

- **Canonical MarketState:** Production read endpoint is available. It reported a recent cache refresh and source metadata from the existing canonical state. Phase 1.1 does not write to or recompute it.
- **Yahoo Finance / configured Polygon fallback:** The local adapter supplied provider timestamps. At the observed time the U.S. session was closed, so the evidence layer correctly represented these as completed-session history rather than a current market condition.
- **CoinGecko:** A local `/global` response contained the provider’s `updated_at`, and the repaired adapter preserves it. Current-use eligibility is still governed by the Integrity Gate freshness window.
- **FRED:** The local development runtime has no FRED key. The production canonical endpoint reports its existing FRED source healthy, but direct production FRED configuration cannot be verified without Railway project access.
- **`marketMemory`:** The existing append-only table is used by the collector, with five-minute collection claims and fifteen-minute snapshot keys. Local insert/duplicate/readback behavior is tested. Production readback/write validation is intentionally deferred: it requires Railway access and separate approval before any production write.

## External blocker and exact owner action

The remaining external blocker is **not a code defect**: the existing enabled Railway API connector’s encrypted project token is not injected as a nonempty `RAILWAY_PROJECT_TOKEN` in this Sandbox.

**Required owner action (secure UI only; do not send a token in chat):** Open the existing **Railway API** connector in Manus, re-save the project token for the existing FAULTLINE production environment, and confirm the connector is enabled. If a replacement is needed, create it in Railway under the existing project’s **Settings → Tokens** with project/environment scope; paste it only into the connector’s secure credential field. No new Railway project, database, service, or billing change is needed.

Once that binding is available, the next read-only sequence is:

1. `projectToken { projectId environmentId }` scope query;
2. existing project/service/deployment/log/environment-variable-name inspection;
3. non-mutating database connectivity and `marketMemory` snapshot readback verification.

No production writes, schedule changes, deployments, or feature-flag activation are authorized by this report.

## Phase 2 readiness decision

**Safe to begin:** feature-flagged visual implementation against the six-domain response contract, with explicit `CURRENT`, `DEGRADED`, `UNAVAILABLE`, and `DISABLED` states; it must only consume the server’s validated response.

**Not safe to activate:** a production visual that claims live or current six-domain coverage. Activation remains blocked until the existing Railway service and `marketMemory` readback are verified, FRED’s production binding is confirmed by name/status, and the phase-specific feature flag receives approval.

## References

1. [Railway Public API documentation](https://docs.railway.com/integrations/api) — project-token scope query, error handling, and read-only GraphQL behavior.
2. [CoinGecko global market data endpoint](https://docs.coingecko.com/reference/crypto-global) — source field used for the provider update timestamp.
