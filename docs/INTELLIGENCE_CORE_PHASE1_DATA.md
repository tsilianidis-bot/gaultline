# Intelligence Core — Phase 1 Verified Data Integration

## Scope

This branch adds a **server-side, disabled-by-default evidence interface**. It does not render the animated Intelligence Core, node network, activity stream, automated commentary, event claims, or any new primary navigation. It does not modify the Pressure Index, canonical MarketState calculation, trading tools, Daily Briefs, pricing, Stripe, or database schema.

## Activation

`FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED=true` is the only activation path. When absent or any value other than `true`, the server starts no new collector and the authenticated tRPC interface returns `DISABLED`.

Do not enable the flag until production credentials, provider access, source freshness, persistence, and a separate release review have been verified.

## Evidence contract

`shared/intelligenceIntegrity.ts` is the Phase 0 gate. Every Phase 1 reading is evaluated before it reaches the interface. It requires:

- stable evidence and source identity;
- a finite value;
- source-observed and ingestion timestamps that are both valid and ordered;
- a declared freshness window;
- healthy source status; and
- a model version for modeled output.

`server/canonicalIntelligenceState.ts` maps canonical engine outputs to that same gate without mutating canonical state. Modeled outputs remain explicitly labeled **delayed / modeled**, never direct observations.

A stale or failed current reading cannot support a current claim. If a previously verified value is retained, it is exposed solely as `historicalValue` or `lastVerified`, with its original source timestamp and provider label.

## Current adapters and cadence

| Adapter | Existing controls reused | Phase 1 policy |
|---|---|---|
| Yahoo Finance with configured Polygon previous-close fallback | 60-second server cache, in-flight deduplication, source-provided observation timestamp | SPY, QQQ, IWM, and VIX proxy readings are eligible only with a valid provider timestamp; values are stale after 20 minutes. |
| FRED | 15-minute cache, in-flight deduplication, two bounded attempts, 4xx non-retryable | DGS10, DGS2, and high-yield OAS are released macro observations, not intraday data; values are stale after 96 hours. Missing credentials, 4xx/429, and empty releases remain unavailable. |
| CoinGecko global aggregate | 5-minute cache, in-flight deduplication, one bounded 429 retry | The existing global adapter returns a fetch time but no provider observation timestamp. Phase 1 deliberately withholds the aggregate from current use until the adapter can supply a source-observed time. |
| Canonical MarketState | Existing append-only manifest reader | Modeled engine outputs pass through the gate with their champion/model version and a 30-hour freshness policy. No canonical calculation is changed. |

Collection is single-flight per process, bounded by provider deadlines, and uses an append-only `marketMemory` claim/snapshot convention shared with existing platform state. No migrations are added. A deadline, error, rate limit, missing credential, malformed value, or missing timestamp produces a source-specific unavailable/degraded state; it never produces a synthetic “neutral” result.

## Interface

`tRPC: intelligenceEvidence.current` is authenticated through the existing `coreProcedure`. The result contains only source-labeled evidence, validation status, source-health records, original timestamps, provider limitations, and any explicitly historical prior reading.

No client component consumes this route in Phase 1.

## Operations checklist before any activation

1. Set and verify a valid `FRED_API_KEY` in the existing production environment; do not place it in code or logs.
2. Verify the existing Yahoo and configured Polygon fallback responses contain valid provider timestamps for the configured symbols.
3. Confirm CoinGecko has either a provider observation time or is intentionally withheld as it is in this phase.
4. Confirm `marketMemory` writes and readback in the existing production database without adding or running a migration.
5. Verify the environment flag remains absent until a separate authorized release window.
6. Review real provider-response evidence and the focused/full test record before enabling UI or event semantics.
