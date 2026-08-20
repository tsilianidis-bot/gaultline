# Phase 1 — Input, Mathematics, and Data-Quality Audit

## Scope

This is an audit of the **current live Champion / Pressure V1 implementation** and the separate research-only historical policies. No weight, threshold, transform, live runtime behavior, historical row, or V3-H status is changed by this document.

## Exact Live Composite

Let the six vector scores be `L`, `C`, `V`, `M`, `B`, and `A`. The live implementation computes:

> `Pressure = round(0.20L + 0.20C + 0.15V + 0.20M + 0.10B + 0.15A)`

All component transforms are clamped linear maps or explicit conditional thresholds in `server/pressure/engine.ts`. Higher output always means more modeled stress. The aggregate is then mapped to the five fixed thresholds documented in `CHAMPION_V1_FROZEN_SPECIFICATION.md`.

| Vector | Exact internal composition | Input cadence/status | Directionality review |
|---|---|---|---|
| Liquidity `L` | `round(0.65 × map(HY,200,800→0,100) + 0.35 × map(SOFR,2,6→0,60))` | HY and SOFR | Higher spread / higher SOFR increase stress; consistent |
| Credit `C` | `round(0.50 × map(HY,200,700→0,80) + 0.25 × map(10Y,2,6→0,50) + 0.25 × map(UNRATE,3.5,7→0,60))` | HY, 10Y daily; unemployment delayed | Higher values increase stress; consistent with encoded model interpretation |
| Volatility `V` | `round(0.60 × curveScore(10Y−2Y) + 0.40 × map(10Y,2.5,6→0,50))` | 10Y / 2Y daily | More inversion and higher rate level increase stress; consistent with encoded proxy interpretation |
| Macro `M` | `round(0.35 × map(CPI YoY,1.5,7→0,80) + 0.25 × map(PPI YoY,0,10→0,70) + 0.40 × map(Fed Funds,1,6→0,80))` | Monthly, delayed | Higher inflation / policy rate increase stress; consistent |
| Breadth `B` | `round(0.60 × map(UNRATE,3.5,7→0,80) + 0.40 × map(10Y,2,6→0,60))` | Unemployment delayed; 10Y daily | Higher unemployment / rates increase stress; consistent with encoded proxy interpretation |
| AI / Speculation `A` | `round(0.50 × 65 + 0.30 × map(10Y,2,6→0,40) + 0.20 × map(HY,200,600→0,30))` | Static concentration baseline plus live 10Y/HY | Higher rates/spreads increase stress; permanently static baseline is disclosed |

## Frequency Alignment and Transformation Findings

The engine fetches eight FRED series. CPI and PPI are transformed to 12-month percentage changes using the latest observation and the observation at index 12. The direct daily series are fetched with a two-observation request, while CPI/PPI use fourteen observations. The engine labels Macro and Breadth as delayed on successful retrieval.

The engine converts the high-yield series from percent-style values to basis points with `HY × 100` when the raw value is not already greater than 20. The current live source observation recorded on 2026-08-20 was `273` basis points after this transformation.

## Repeated Exposure / Double-Counting Map

| Raw driver | Core vectors affected | Aggregate weight exposed | Audit conclusion |
|---|---|---:|---|
| HY credit spread | Liquidity, Credit, AI/Speculation | 55% | **HIGH** overlapping credit exposure; historical vector correlation was 0.866 between Liquidity and Credit and 0.669 between Liquidity and AI |
| 10Y Treasury yield | Credit, Volatility, Breadth, AI/Speculation | 60% | **HIGH** overlapping rate-level exposure; not independently orthogonal |
| Unemployment | Credit, Breadth | 30% | **MEDIUM** duplicated labor exposure |
| SOFR | Liquidity | 20% | Unique within V1 |
| 2Y Treasury yield | Volatility | 15% | Unique within V1 |
| CPI, PPI, Fed Funds | Macro | 20% | Distinct policy/inflation group |

The Phase 1B ablation results describe material but bounded score sensitivity: macro sensitivity had a 3.76-point mean absolute ablation effect and 10-point maximum, while Liquidity and Credit each had approximately 2.4–2.5 points mean absolute effect. These are **descriptive diagnostics**, not a basis for reweighting.

## Missing and Stale Data Behavior

| Layer | Current behavior | Audit classification |
|---|---|---|
| Live engine: total FRED failure | Serves fresh in-memory last-live snapshot for 30 minutes; otherwise calculates using hardcoded fallback inputs | Intended continuity control, but fallback state must remain unmistakable |
| Live engine: partial FRED response | Sets global `dataSource = live` if at least one series returns, then substitutes hardcoded fallback values for each absent input | **HIGH** provenance precision issue: a partially synthetic reading can be labeled live/delayed at vector level |
| Live engine: static AI baseline | Explicitly labeled `static` with a reason | Properly surfaced limitation |
| Unified Seismograph historical subscore zero | Converts zero/missing to `50` sentinel and can carry prior actual family value into latest incomplete record | **HIGH** historical/consumer synthesis issue: unavailable, neutral, and carried-forward values are not a single unambiguous state |
| Canonical MarketState | Retries once and serves stale-if-error cache with warning | Properly explicit consumer cache behavior |
| Verified / reconstructed research builders | Do not use live runtime fallback constants; incomplete values yield INCOMPLETE/EXCLUDED rather than manufactured scores | Correct research-only control |

## Severity-Ranked Phase 1 Findings

| Finding | Severity | Required repair class |
|---|---|---|
| Partial FRED responses can use fixed replacement values while the aggregate result is marked live | **HIGH** | MUST FIX BEFORE PHASE 2 |
| Unified historical synthesis converts missing/zero sub-scores to a neutral sentinel and can carry forward prior values | **HIGH** | MUST FIX BEFORE PHASE 2 |
| HY and 10Y inputs are repeatedly represented across the majority of total weight | **HIGH** | SHOULD FIX BEFORE EARLY WARNING DETECTION; no reweighting in Phase 1 |
| AI/Speculation concentration baseline is static and always labels trend rising | **MEDIUM** | SHOULD FIX BEFORE EARLY WARNING DETECTION |
| `pressureRuns.engineVersion` is manual `1.0.0`, although forward provenance also has a formula hash | **MEDIUM** | SHOULD FIX BEFORE EARLY WARNING DETECTION |

## Evidence

The formulas and fallback logic are in `server/pressure/engine.ts`. The latest data-quality observation is recorded in `PHASE_1_AUDIT_EVIDENCE_LOG.md`. The separate historical restrictions are in `CHAMPION_V1_FROZEN_SPECIFICATION.md`, `RECONSTRUCTED_CHAMPION_V1_DATA_POLICY.md`, and `RECONSTRUCTED_CHAMPION_V1_METRICS.json`.
