# Verified Champion V1 Validation Report

## Executive Verdict

> **CHAMPION VALIDATION: INCONCLUSIVE**

The frozen Champion V1 formula has been reproducibly executed on the currently defensible research dataset, but the available evidence cannot support a **STRONG**, **MODERATE**, or **WEAK** performance conclusion. The verified sample contains only 36 monthly observations from August 2023 through July 2026, every score is `REVISED_HISTORICAL` because the required BAML input lacks accepted ALFRED vintage evidence, and all 36 scores occupy one regime bucket. The sample does not contain the pre-2023 episodes requested for historical validation, and the independently defined VIX event test is not yet eligible.

This is a conclusion about the **validation evidence**, not a change to production methodology. The live Champion, legacy series, V3-H shadow status, and public copy remain unchanged.

## Frozen and Locked Basis

The reported run uses `CHAMPION_V1_FROZEN_20260819` and the completed pre-registered protocol `VERIFIED_CHAMPION_V1_PROTOCOL_20260819_R2`. The frozen weights, transformations, score rounding, static AI-concentration component, and regime boundaries were not changed. The protocol fixed the 10% S&P 500 drawdown-within-60-trading-days event definition, the 45-point warning threshold, 60-trading-day warning window, false-alarm and missed-event rules, partitions, stability measure, and sensitivity-only ablation method before this reported metric build.

| Evidence gate | Result |
|---|---|
| Verified score history | 36 complete monthly scores, 2023-08 through 2026-07 |
| Score quality | All 36 `REVISED_HISTORICAL` |
| Independent outcomes | 144 records: 140 complete and 4 pending |
| Locked partitions | 12 development, 12 validation, 12 holdout months |
| Major 2000–2022 event coverage | Not available; no score is reported for these dates |
| VIX event test | Pre-registered but not evaluated; no independent VIX history persisted |

## Distribution and Event Results

The verified scores ranged from **25** to **39**, with a mean of **29.50**. All 36 observations were `MODERATE RISK`; none were LOW RISK, ELEVATED RISK, HIGH STRESS, or SYSTEMIC CRISIS. This eliminates any meaningful multi-bucket separation test in the current dataset.

| Measure | Reported result | Interpretation boundary |
|---|---:|---|
| Event-window score count | 7 | Score dates in the pre-registered 60-day pre-event, active-event, or 20-day recovery window. |
| Calm score count | 29 | Score dates outside the registered event window. |
| Event-window mean score | 27.86 | Lower than the calm mean; this is descriptive only. |
| Calm mean score | 29.90 | Not evidence of prospective discrimination because all observations remain one regime. |
| Registered in-coverage drawdown events | 1 | 2025-03-13 onset, -18.90% peak-to-trough close decline. |
| Qualifying warnings at ≥45 | 0 | No ELEVATED RISK-or-higher signal in the dataset. |
| False alarms | 0 | Zero because there were zero qualifying warnings; this is not a success rate. |
| Missed events | 1 | The single in-coverage registered drawdown event had no qualifying preceding warning. |

The 2022 drawdown event is explicitly excluded from event counts because it predated the first verified score. It is retained in the raw event scan as an out-of-coverage observation only.

## Independent Outcome Summary

All completed outcomes in the dataset belong to the MODERATE RISK bucket. No return or drawdown result is attributable to a higher-pressure bucket because such scores do not exist in the verified sample.

| Horizon | Completed observations | Mean S&P 500 forward price return | Mean maximum drawdown |
|---:|---:|---:|---:|
| 1 trading day | 36 | 0.16% | -0.28% |
| 5 trading days | 36 | 0.07% | -1.62% |
| 20 trading days | 35 | 1.70% | -3.25% |
| 60 trading days | 33 | 4.85% | -6.12% |

These are independent price-index observations, not a synthetic model-success score and not a basis for inferring tradable performance.

## Stability, Correlation, Ablation, and Walk-Forward Checks

Lag-1 monthly score autocorrelation was **0.895** across 35 adjacent pairs. Several vector relationships are material within this small sample, including Credit Contagion versus AI/Speculation (**0.790**) and Liquidity Stress versus Credit Contagion (**0.750**). These statistics flag potential overlap for future redesign research; they do not authorize a production weight change.

Sensitivity-only ablation retained a high correlation to the frozen baseline for every removed vector. The largest mean absolute difference was **2.50** points when Credit Contagion was removed. This shows local sensitivity within the 2023–2026 dataset, not superiority or inferiority of an alternate model.

| Locked partition | Scores | Complete 60-day outcomes | Mean 60-day return | Mean 60-day maximum drawdown |
|---|---:|---:|---:|---:|
| Development | 12 | 12 | 6.97% | -5.41% |
| Validation | 12 | 12 | 3.64% | -7.06% |
| Holdout | 12 | 9 | 3.65% | -5.82% |

The partitions use fixed Champion parameters. Because each partition contains only MODERATE RISK readings, this is a stability description rather than a valid regime-discrimination or calibration test.

## Major Historical Events Requested

| Period | Verified Champion V1 score availability | Reason |
|---|---|---|
| 2000–2002 | Not available | Predates the current common source-retention boundary. |
| 2007 / 2008 | Not available | Predates the current common source-retention boundary. |
| 2011 | Not available | Predates the current common source-retention boundary. |
| 2015–2016 | Not available | Predates the current common source-retention boundary. |
| 2018 Q4 | Not available | Predates the current common source-retention boundary. |
| 2020 | Not available | Predates the current common source-retention boundary. |
| 2022 | Not available | Predates the first verified score month. |
| 2023 onward | Available from August 2023 | Scores range 25–39 and are all MODERATE RISK. |

## Required Next Evidence Before Reassessment

The conclusion can be reassessed only after the program obtains an independently retained, release-aware credit-spread source spanning multiple stress and calm regimes; grows verified history materially; persists an independent VIX source if volatility-event testing remains required; and reruns the same frozen protocol with no formula modifications. V3-H remains shadow-only and was not run as a Challenger in this program.

## Source and Compliance Disclosure

**Basis:** Frozen Champion V1 score calculations and independent S&P 500 price-return outcomes. **Time:** Validation reference date 2026-08-19; score coverage 2023-08 through 2026-07. **Assumptions:** Completed trading-day horizons only; pending outcomes excluded from their horizon denominator; no live fallback constants. **Sources and confidence:** FRED/ALFRED macro observations and Yahoo Finance `^GSPC` daily bars, subject to the explicit BAML revised-history limitation. **Compliance:** This is research and analysis only, not personalized financial advice.

## References

[1]: https://fred.stlouisfed.org/docs/api/fred/series_observations.html "FRED series observations API"
[2]: https://fred.stlouisfed.org/series/BAMLH0A0HYM2 "ICE BofA US High Yield Index Option-Adjusted Spread"
