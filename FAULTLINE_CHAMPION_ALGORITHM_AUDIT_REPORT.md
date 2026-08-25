# FAULTLINE Champion Algorithm Audit Report

**Audit date:** 2026-08-18  
**Scope:** Production Champion system, stored historical Track Record, existing V3-H shadow Challenger, and readiness for any future Challenger comparison.  
**Audit standard:** Reproducibility, point-in-time integrity, separate outcome definitions, explainability, and production safety.  
**Production-score changes authorized:** **None.**

> **Conclusion:** FAULTLINE’s live Champion system is identifiable and auditable, but its stored monthly Track Record is not currently reproducible from the live Champion weights and does not contain the point-in-time source vintages or outcome data needed to support a valid Champion-versus-Challenger performance decision. The existing V3-H system must remain a shadow-only comparator. No weight, threshold, formula, historical record, or production behavior should be changed on the basis of the present historical record.

## 1. Executive Decision

The audit establishes a permanent **Champion Baseline** specification and an audit-only reproducibility harness. It also identifies three blocking gaps: the historical score process is not the current live V1 weighted composite, the stored history does not preserve source vintages or release-time availability, and the stored S&P 500 field is empty for every monthly record. Consequently, the requested false-alarm, warning-lead, calibration, drawdown, and Challenger-performance claims cannot yet be calculated defensibly.

| Decision | Status | Rationale |
|---|---|---|
| Preserve production Champion scoring | **Required** | The audit did not identify a validated replacement. |
| Preserve historical monthly records | **Required** | They are legitimate retrospective records but require version/provenance qualification. |
| Promote V3-H Challenger | **Not authorized** | Its observed run history is less than two days and no valid outcome comparison exists. |
| Tune weights or thresholds | **Not authorized** | The baseline and outcome set do not meet validation gates. |
| Build point-in-time data and outcome ledgers | **Recommended next control** | Required to make future validation possible. |

## 2. Champion System of Record

The live Champion is the V1 composite orchestrated by `calculateFaultlinePressure()` in `server/pressure/engine.ts`. It combines six 0–100 vectors using the following observed weights.

| Champion vector | Weight | Current implementation input structure |
|---|---:|---|
| Liquidity Stress | 20% | High-yield spread and SOFR |
| Credit Contagion | 20% | High-yield spread, 10-year yield, unemployment |
| Volatility Regime | 15% | Yield-curve state and 10-year yield proxy |
| Macro Sensitivity | 20% | CPI YoY, PPI YoY, Fed Funds |
| Market Breadth | 10% | Unemployment and 10-year yield proxy |
| AI / Speculative Bubble | 15% | Static concentration baseline, rates, and spread |

The live engine is then composed by FMOS and Scheduled Seismograph into regime, evidence, bull/neutral/bear distribution, analog, and decision layers. Those layers must not be conflated with a calibrated probability of a specific market event.

> **Important distinction:** The 0–100 Pressure Index is the Champion risk composite. FMOS distributions are separate modeled scenario outputs. Neither is established by this audit as a calibrated probability of a particular drawdown magnitude over a particular horizon.

## 3. Stored Historical Record and Reproducibility Result

The database contains 317 monthly `pressureHistory` records from 2000-01 through 2026-05. Each has an overall score, regime, six vector fields, and selected macro fields. It also contains 474 live `pressureRuns` from 2026-06-14 through 2026-08-18, 322 Seismograph readings, and 458 V3-H shadow readings from 2026-08-17 through 2026-08-18.

The audit recalculated each stored monthly composite using the **current** V1 vector weights. This is a reproducibility test, not a rewritten historical series.

| Reconciliation measure | Result | Interpretation |
|---|---:|---|
| Stored monthly records evaluated | 317 | All records include six stored vector fields. |
| Exact matches to current V1 weighted composite | 14 | Current V1 does not explain most stored historical overall scores. |
| Maximum absolute difference | 30 points | Historical and live-formula provenance must be reconciled before validation. |
| Stored records missing required raw fields | 14 | Even stored components are insufficient for a complete raw reconstruction in all months. |
| Missing source vintages / release snapshots | 317 | No record currently supports a true point-in-time replay. |

The largest divergences include stored critical scores of 82 in late 2008/early 2009 that recalculate near 52–54 under current V1 weights, and a stored March 2020 score of 72 that recalculates near 43. This does **not** prove either historical record or live V1 is invalid. It proves they are not presently the same documented formula/version.

The stored-score distribution is also concentrated: 148 of 317 scores are exactly 62, 34 are exactly 72, and 8 are exactly 82. That pattern is consistent with a historical process containing caps, buckets, thresholds, or version-specific logic that is absent from the current live V1 contract. The audit does not reverse-engineer or infer undocumented historical rules from those outputs.

## 4. Point-in-Time Integrity and Data Revision Risk

The current live engine retrieves current FRED observations. Historical stored records do not retain the corresponding FRED/ALFRED vintage date, original release date, actual availability date, PPI input, SOFR input, or source snapshot. Therefore, a score recreated today from current FRED data would be exposed to revision and hindsight leakage.

ALFRED is the appropriate official source for a future repair because it provides historical data releases available on a specific date, documents revision handling, and exposes release/vintage-date concepts.[1] [2] The FRED API documents series-vintage and release-date endpoints that can support a provenance ledger.[3]

> The existing Track Record must continue to use neutral language: **“Retrospective historical analysis applying FAULTLINE methodology to historical data. Results are reconstructed and were not generated live at the time.”** It must not say FAULTLINE warned any investor, desk, or user during historical events.

## 5. Observational Stability, Threshold Coverage, and Correlation Screen

The stored monthly series contains 42 high-or-critical months (`>=65`), including 8 critical months (`>=80`) and 9 starts of distinct high-or-critical episodes. Its mean absolute month-to-month score change is 2.21 points; the largest single monthly change is 35 points. These are descriptive properties of an unreconciled retrospective record, not evidence of predictive timing or calibration.

The stored `sp500` column is null for all 317 records. Accordingly, no stored 3-month or 6-month return, drawdown, false-alarm, warning-lead, Brier score, or calibration statistic can be responsibly computed from this table alone.

The stored vector screen shows structural overlap that should be reviewed only after formula-version reconciliation:

| Pair | Correlation | Audit interpretation |
|---|---:|---|
| Liquidity Stress / Credit Contagion | 0.877 | Strong overlap; both are spread-sensitive in the live implementation. |
| Credit Contagion / Market Breadth | 0.746 | Material overlap; stored breadth is a macro proxy, not direct breadth data. |
| Liquidity Stress / Market Breadth | 0.614 | Meaningful shared stress component. |
| Volatility Regime / Macro Sensitivity | 0.530 | Moderate co-movement. |
| Liquidity Stress / AI Bubble | -0.248 | Limited inverse relationship. |
| Credit Contagion / AI Bubble | -0.123 | Limited relationship. |
| Macro Sensitivity / AI Bubble | 0.111 | Limited relationship. |

These correlations identify a **double-counting review requirement**, not a reason to change current weights. Any adjustment would be optimization before the baseline is validated.

## 6. Challenger Governance

V3-H is already present as an isolated shadow model. It is not eligible for promotion: its observed reading history runs from 2026-08-17 to 2026-08-18 and has no mature independently recorded outcome sample. The complete no-go protocol is stored in `ALGORITHM_CHALLENGER_GOVERNANCE.md`.

No Challenger, including V3-H, may be selected, blended, tuned, or deployed until all of the following are complete:

1. A versioned Champion historical formula reproduces stored scores within documented tolerance.
2. Required raw source series are reconstructed from ALFRED-compatible date-aligned vintages and release availability.
3. Separate broad-market outcome records are appended to an outcome ledger; immutable original event records remain unchanged.
4. Stress outcome definitions are pre-registered, including drawdown threshold, horizon, false-alarm policy, warning window, and event class.
5. A locked out-of-sample holdout is evaluated without subsequent parameter tuning.
6. Any Challenger demonstrates improvement without material deterioration in stability, transition clarity, or explainability.

## 7. Required Remediation Sequence

The valid next engineering work is data provenance, not scoring optimization.

| Priority | Required control | Completion test |
|---|---|---|
| 1 | Add `algorithmVersion`, formula hash, weights, thresholds, source IDs, observation timestamps, release timestamps, and vintage timestamps to new daily score records | A live score can be reproduced from its persisted payload. |
| 2 | Build an ALFRED-backed point-in-time reconstruction pipeline for each required FRED series | A sampled historical month is reconstructed using only values released by its declared cutoff. |
| 3 | Preserve a separate `marketOutcome` ledger with broad-market returns, realized drawdowns, volatility, and rates at pre-defined horizons | Outcomes append after an event and never mutate the original score. |
| 4 | Locate or formally retire the undocumented historical formula version through a provenance migration | All 317 legacy rows have a declared status: versioned/reproduced, legacy-unreconciled, or source-unavailable. |
| 5 | Pre-register a Champion-versus-Challenger evaluation plan and holdout | Tests run unchanged against a lockbox period. |

## 8. Production Recommendation

**Do not change the live Pressure Index formula, thresholds, vector weights, regime boundaries, or V3-H status.** The responsible production action is to add provenance and outcome collection around future live observations while preserving historical records as immutable retrospective evidence with their current limitations clearly labeled.

## References

[1] [ALFRED — Archival Federal Reserve Economic Data](https://alfred.stlouisfed.org/)

[2] [ALFRED Help — Vintage data, revisions, and release dates](https://alfred.stlouisfed.org/help)

[3] [FRED API Documentation — Series observations, vintages, and release dates](https://fred.stlouisfed.org/docs/api/fred/)
