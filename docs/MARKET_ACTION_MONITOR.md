# Market Action Monitor

**Method version:** `market-action-v1-2026-10-15`
**Scope:** source-backed, short-horizon market-condition monitoring.
**Not a replacement for:** the Pressure Index, its methodology, or the governed five-question canonical market state.

## Purpose

Market Action preserves the distinction between:

1. **what is observed** in available market sources;
2. **what changed** versus the preceding saved observation; and
3. **what condition is worth monitoring** under explicit thresholds.

It does not infer a causal explanation from a price move, forecast an outcome, or generate a trade instruction.

## Collection and persistence

- The application starts a single in-process collector after the HTTP server binds.
- It uses an append-only five-minute database claim so concurrent instances do not duplicate a collection window.
- It polls source adapters every five minutes and persists a verified snapshot at most once per fifteen-minute bucket.
- Page requests read only the latest persisted snapshot. They do not poll providers or construct a reading from page traffic.
- Material detections are separately written to the existing institutional event ledger, using an idempotent event key capped at one event per detector/severity/ET day.

The collector resumes after process restart. A platform-level scheduler is still recommended for a durable out-of-process liveness check; it is not silently enabled by this release.

## Source coverage and freshness

| Evidence area | Current adapter | Display policy |
|---|---|---|
| Major equity conditions | Yahoo Finance ETF proxies: SPY, QQQ, IWM | **Delayed**; proxy labels remain explicit. |
| Sector participation | Yahoo Finance sector ETFs | **Delayed**; 11 configured sector proxies are counted. |
| Volatility | Yahoo Finance `^VIX` | **Delayed**. |
| Crypto | Yahoo Finance BTC-USD plus CoinGecko global market data | BTC is **delayed**; global cryptocurrency data is **continuous** only to the extent reported by CoinGecko. |
| Treasury yields | FRED DGS10 and DGS2 | **Daily**. |
| Credit | FRED ICE BofA US High Yield OAS | **Daily**. |

Every rendered snapshot reports its source coverage, the most recent source observation timestamp, the collector timestamp, and the provider-specific freshness class. A missing source is shown as **unavailable**, never converted to a neutral or calm conclusion.

## Material-condition policy

The pure detector has explicit coverage requirements and uses current, source-labeled inputs only:

- **Broad equity selloff:** at least two of SPY, QQQ, and IWM must be at or below the published move threshold.
- **Sector rotation / dispersion:** at least four sector proxies must be available; breadth of declines and dispersion must both be present.
- **Volatility shock:** VIX must be available and satisfy the published threshold.
- **Crypto disruption:** BTC and/or total crypto market capitalization must be available and satisfy the published threshold.
- **Accelerating equity loss:** two saved, verified snapshots with sufficient major-equity coverage are required.
- **Cross-market stress:** two independent condition families are required.

A detected condition includes: source-based evidence, a plain-language description of what was observed, watch conditions, and a decision boundary. It says explicitly that the condition is **not evidence of a specific cause**. It never makes a market prediction.

## Relationship to the five questions

The same persisted Market Action evidence card is rendered inside existing **NOW, WHY, OUTLOOK, WATCH, and ACT** pages and in the mobile Pulse experience. Each page changes only the decision lens:

- NOW: observed condition;
- WHY: verified inputs, not an invented cause;
- OUTLOOK: what would confirm or weaken the condition;
- WATCH: conditions and source coverage;
- ACT: a decision boundary, never a trade instruction.

No primary navigation item is added.

## AI boundary

Market Action collection and condition detection are deterministic and source-first. They do **not** make automatic LLM calls. This protects the monitor from provider quota outages and prevents AI-generated commentary from being presented when source coverage is incomplete.

AI interpretation may be added later only after a separate capacity review confirms an authorized provider, an explicit per-event budget, and a source-constrained output contract. No automated market narrative should consume the interactive PLATO quota.

## Operational acceptance checks

1. Verify the database accepts a new `market-action:*` snapshot and a corresponding claim key.
2. Verify the latest snapshot is served through `marketAction.current` without triggering provider polling.
3. Verify at least one unavailable source is rendered as unavailable when credentials are absent.
4. Verify duplicate collector instances share the same five-minute claim and do not create duplicate snapshots.
5. Verify the normal release health check and current API state remain unchanged; no Pressure Index methodology is invoked or modified.
