# FAULTLINE Champion Baseline — Initial Production Inventory

> **Status:** Initial source-of-truth inventory. This document records observed implementation facts only. It does not authorize a scoring, threshold, weight, historical-record, or production-behavior change.

## Production Scoring Path

The base **Champion** calculation is `calculateFaultlinePressure()` in `server/pressure/engine.ts`. It fetches eight FRED series, transforms selected macro series, scores six 0–100 vectors, and computes a weighted composite. The engine is called directly by `runFMOSPipeline()` and by `runSeismographPipeline()`.

| Stage | Observed implementation | Source-of-truth file |
|---|---|---|
| Raw inputs | HY spread, 10Y/2Y Treasury yields, SOFR, CPI, PPI, Fed Funds, unemployment | `server/pressure/engine.ts` |
| Transformations | HY decimal-to-basis-point conversion; CPI/PPI year-over-year change calculated from a 12-observation offset | `server/pressure/engine.ts` |
| Vector scoring | Liquidity, credit contagion, volatility regime, macro sensitivity, market breadth, AI/speculative bubble | `server/pressure/engine.ts` |
| Composite | Weighted sum of six vector scores | `server/pressure/engine.ts` |
| Classification | Low, Moderate, Elevated, High, Critical at 25/45/65/80 score boundaries | `server/pressure/engine.ts` |
| Canonical distribution | FMOS wraps Champion score with regime, evidence, bull/neutral/bear distribution, confidence, analogs, and decision layers | `server/fmos/pipeline.ts` |
| Cross-surface synthesis | Scheduled Seismograph assembles and stores canonical market state for ASHA, dashboard, alerts, stock pages, and reports | `server/scheduledSeismograph.ts`, `server/seismographCore.ts` |

## Observed Champion Vector Contract

| Vector | Weight | Inputs | Current scoring structure | Data quality note |
|---|---:|---|---|---|
| Liquidity Stress | 0.20 | HY spread, SOFR | 65% HY + 35% SOFR | Uses numeric fallback if a source is absent |
| Credit Contagion | 0.20 | HY spread, 10Y, unemployment | 50% HY + 25% rate + 25% labor | Shares HY and rate inputs with other vectors |
| Volatility Regime | 0.15 | 10Y, 2Y | Yield-curve state plus 10Y level | Yield curve is a macro proxy, not observed equity implied volatility |
| Macro Sensitivity | 0.20 | CPI YoY, PPI YoY, Fed Funds | 35% CPI + 25% PPI + 40% policy rate | Monthly release cadence and revision risk apply |
| Market Breadth | 0.10 | unemployment, 10Y | 60% labor + 40% rate | Uses macro proxies, not a direct breadth feed |
| AI / Speculative Bubble | 0.15 | 10Y, HY spread plus static concentration baseline | 50% static baseline + 30% rate + 20% spread | Static concentration baseline is explicitly labelled by the engine |

## Stored Records and Historical Dependencies

| Record | Purpose | Observed coverage / limitation |
|---|---|---|
| `pressureHistory` | Monthly backfilled historical Pressure score, six vector subscores, selected macro fields, and S&P 500 | One unique `YYYY-MM` record per month; source code identifies it as a FRED-based backfill |
| `pressureRuns` | Append-only per-execution audit record | Live-run audit trail; not a historical point-in-time reconstruction |
| `seismographReadings` / state tables | Daily canonical observations, patterns, transitions, memory | Downstream regime/pattern analytics; distinct from monthly Track Record history |
| `shadowModelReadings` / `shadowForwardOutcomes` | Existing non-blocking V3-H Challenger comparison | V3-H includes STLFSI4 plus different structural/acute weighting; marked no-tuning through 2026-11-07 |

## Immediate Audit Gates

1. **Champion reproducibility is not yet established.** Stored monthly `pressureHistory` must be compared with an independently recreated monthly Champion path before any optimization claim.
2. **Point-in-time availability is not yet established.** Existing production fetches latest revised FRED series. Release-date/vintage alignment requires explicit reconstruction or a stated limitation.
3. **Fallback values are a production integrity concern.** The base engine currently computes numeric fallback inputs when fresh data are unavailable; the audit must determine whether historical and live reports consistently disclose this state.
4. **Probability layers are separate from the 0–100 Pressure Index.** FMOS bull/neutral/bear outputs are model distributions derived from Champion pressure and evidence. They must not be represented as calibrated event probabilities until separately validated.
5. **V3-H is already a Challenger.** It must be evaluated side by side without tuning or replacing Champion behavior during its declared shadow period.

## Verified Record Coverage — 2026-08-18 Audit Query

| Dataset | Observed count | Observed coverage | Audit implication |
|---|---:|---|---|
| `pressureHistory` | 317 | 2000-01 through 2026-05; score range 7–82; mean 54.20 | This is the only long-span Champion history currently available for monthly reconstruction and episode/false-alarm study. |
| `pressureRuns` | 474 | 2026-06-14 through 2026-08-18 | This is live execution audit history, not long-span historical validation. |
| `seismographReadings` | 322 | 2000-01-15 through 2026-08-18 | Contains historical/daily-style state records; provenance and construction must be reconciled before using it for predictive claims. |
| `shadowModelReadings` | 458 | 2026-08-17 through 2026-08-18; V3-H range 23–25 | Insufficient realized forward history for a Champion-versus-V3-H performance decision. It supports only operational divergence monitoring at this stage. |

> The audit must not infer a validated Challenger win from the current V3-H sample. Its observed time span is less than two days and forward outcomes are not yet mature.

## First Reconciliation Result — Stored Monthly History vs Current V1 Composite

The audit ran a direct stored-vector reconciliation using the current V1 production weights: liquidity 20%, credit 20%, volatility 15%, macro 20%, breadth 10%, and AI/speculation 15%.

| Measure | Verified result | Interpretation |
|---|---:|---|
| Monthly stored records evaluated | 317 | All monthly records contain the six stored vector columns. |
| Exact current-weight composite matches | 14 | Only 14 records reproduce their stored overall score from current V1 weights. |
| Largest absolute score difference | 30 points | Current V1 weights do not recreate the stored historical composite for many episodes. |
| Months with any stored raw-field gap | 14 | Even complete stored vectors do not establish raw point-in-time recreation. |

> **Audit gate failure:** The stored historical Track Record does **not** currently reproduce from the live V1 vector weights. This establishes a formula/version reconciliation requirement, not evidence that either path is invalid. No historical result has been deleted, revised, relabelled, or used to select a Challenger.

The largest observed divergences include stored critical values of 82 during late 2008/early 2009 versus current-weight recreations near 52–54, and a stored March 2020 score of 72 versus a current-weight recreation of 43. The next audit step is to identify the versioned historical formula and its documented transformations before any performance or Challenger comparison.

The stored monthly score distribution is also highly concentrated: 148 of 317 records are exactly 62, 34 are exactly 72, and 8 are exactly 82. This is consistent with a historical process containing thresholding, caps, or score buckets that is not encoded in the current V1 composite. The audit will treat this as a provenance finding, not infer undocumented historical rules from the output values.

## Point-in-Time Source Requirement

The current production engine fetches the latest FRED observations and does not retain source vintages or release calendars beside every historical stored score. Consequently, the monthly history cannot currently support a claim that it used only the values available at the original decision date.

ALFRED is the appropriate official archival source for this remediation because it provides data releases available on a specified past date and maintains real-time vintage periods. The FRED API also exposes vintage-date and release-date endpoints. A future point-in-time reconstruction must query the required vintage and align it to the relevant release availability date, not simply reuse current revised observations.

**Audit disposition:** Historical records remain preserved and useful as reconstructed retrospective evidence, but are **not yet validated as point-in-time Champion backtest outputs**.

## External Source Record

| Source | Audit relevance |
|---|---|
| [ALFRED — Archival FRED](https://alfred.stlouisfed.org/) | Official historical economic-data vintages available on specific dates. |
| [ALFRED Help](https://alfred.stlouisfed.org/help) | Documents revisions, vintage data, source release dates, and limitations. |
| [FRED API Documentation](https://fred.stlouisfed.org/docs/api/fred/) | Documents series observations, release dates, and vintage-date endpoints. |

## Observational Stability and Outcome Coverage — Current Stored Record

| Measure | Verified result | Audit interpretation |
|---|---:|---|
| High-or-critical monthly readings (`>=65`) | 42 | These are historical stored states, not validated live alerts. |
| Critical monthly readings (`>=80`) | 8 | Historical stored states only. |
| Distinct high-or-critical episode starts | 9 | A preliminary threshold episode count; it does not establish warning timeliness. |
| Mean absolute monthly score change | 2.21 points | Stored-series stability statistic, not a calibration result. |
| Largest monthly score change | 35 points | The record contains material step changes that require formula/version provenance. |
| Stored monthly S&P 500 values | 0 of 317 | The schema field exists but is empty in every stored monthly record. No forward-return analysis can be calculated from this table alone. |

> **Outcome gate failure:** The current stored `pressureHistory` record does not contain a usable S&P 500 outcome series. It therefore cannot support the requested false-alarm, drawdown, warning-lead, or calibration analysis without an independently sourced, date-aligned outcome dataset. Any future outcome dataset must be stored separately from the immutable original pressure records.

## Stored-Vector Correlation Screen

The following correlations are descriptive calculations on the stored monthly vectors. They are not evidence for weight changes because the historical composite itself has not been reconciled to the live Champion formula.

| Pair | Correlation | Structural interpretation |
|---|---:|---|
| Liquidity Stress / Credit Contagion | 0.877 | Strong overlap; both vectors are spread-sensitive in the current implementation. |
| Credit Contagion / Market Breadth | 0.746 | Material overlap; stored historical breadth is a macro proxy rather than direct equity breadth. |
| Liquidity Stress / Market Breadth | 0.614 | Meaningful shared stress component. |
| Volatility Regime / Macro Sensitivity | 0.530 | Moderate co-movement. |
| Liquidity Stress / AI Bubble | -0.248 | Limited inverse relationship in this stored record. |
| Credit Contagion / AI Bubble | -0.123 | Limited relationship in this stored record. |
| Macro Sensitivity / AI Bubble | 0.111 | Limited relationship in this stored record. |

> **Audit implication:** Credit, liquidity, and the historical breadth proxy require an explicit double-counting review before any future weight or transformation decision. This is an observation, not a recommendation to alter the current Champion.

## No-Change Commitment

No Champion weights, thresholds, vector formulas, historical score records, or production scoring behavior have been altered by this audit inventory.
