# FAULTLINE Champion V1 Frozen Specification

## Status and Scope

This document freezes the current production Champion implementation for the separate **Verified Historical Validation V1** research program. It is a research specification only. It does not modify the live Pressure Index, legacy historical research series, production regimes, public claims, or V3-H shadow status.

| Field | Frozen value |
|---|---|
| Formula version | `CHAMPION_V1_FROZEN_20260819` |
| Production source | `server/pressure/engine.ts` |
| Engine SHA-256 | `99391a5227d04f2b198abc59091f40ca32a0c5e9be0f2aaebada16b3bc871216` |
| Audit baseline source | `server/pressure/championBaseline.ts` |
| Baseline SHA-256 | `5ed4443ee44120ec7306b1c7e046395b9c756bcbd90226da980c78ef49ed1f14` |
| Repository revision at freeze | `3a2aa901f9a7dbb4b646e8209a3f2eb12bb0df8c` |
| Composite scale | 0–100, rounded once after the weighted sum |
| Score timestamp policy | Month-end observation date; use data released and observable by the defined month-end decision cutoff only |
| Legacy-series relationship | Separate descriptive research artifact; never a target for calibration or a source for formula inference |

## Formula

The frozen composite is the rounded weighted sum of six vector scores:

```text
Pressure Index = round(
  0.20 × Liquidity Stress +
  0.20 × Credit Contagion +
  0.15 × Volatility Regime +
  0.20 × Macro Sensitivity +
  0.10 × Market Breadth +
  0.15 × AI / Speculative Bubble
)
```

Each vector is clamped to the closed interval `[0, 100]`. The research program must preserve this formula exactly unless a separately versioned Challenger is authorized after the frozen Champion validation is complete.

## Inputs and Transformations

| Vector | Weight | Inputs | Frozen transformation summary | Source status requirement |
|---|---:|---|---|---|
| Liquidity Stress | 20% | HY spread, SOFR | HY 65%; SOFR 35%; linear maps 200–800 bps to 0–100 and 2–6% to 0–60 | Historical source and release status must be recorded |
| Credit Contagion | 20% | HY spread, 10Y Treasury, unemployment | 50% spread, 25% 10Y, 25% unemployment | Historical source and release status must be recorded |
| Volatility Regime | 15% | 10Y Treasury, 2Y Treasury | Yield-curve bucket score 60%; 10Y level score 40% | Historical source and release status must be recorded |
| Macro Sensitivity | 20% | CPI YoY, PPI YoY, Fed Funds | 35% CPI, 25% PPI, 40% Fed Funds | CPI/PPI publication lags must be enforced |
| Market Breadth | 10% | Unemployment, 10Y Treasury | 60% unemployment, 40% 10Y | The frozen proxy must be labelled as a proxy; no replacement is allowed in Champion V1 |
| AI / Speculative Bubble | 15% | 10Y Treasury, HY spread, static concentration baseline | 50% static concentration baseline of 65, 30% 10Y, 20% HY spread | Static source must be labelled `STATIC_MODEL_ESTIMATE` |

## Regime Thresholds

| Pressure Index | Frozen regime |
|---:|---|
| 0–24 | LOW RISK |
| 25–44 | MODERATE RISK |
| 45–64 | ELEVATED RISK |
| 65–79 | HIGH STRESS |
| 80–100 | SYSTEMIC CRISIS |

## Historical Input Rules

The verified historical series must never use runtime fallback constants, future revisions, post-cutoff releases, future percentile statistics, or later-normalization ranges. Each input must be classified as `POINT_IN_TIME_CONFIRMED`, `POINT_IN_TIME_APPROXIMATED`, `REVISED_HISTORICAL`, or `UNAVAILABLE`.

If a required input is unavailable, the run must follow the separately documented research missing-data policy and record the policy outcome. It must not silently substitute a live fallback value.

### Observed Coverage Boundary — 2026-08-19

On the validation reference date, the official FRED endpoint for required series `BAMLH0A0HYM2` returned its earliest currently retained observation as **2023-08-21**. The series also does not provide acceptable ALFRED point-in-time vintage evidence for this program. Therefore, the first defensible common monthly score is **2023-08**, and every verified Champion score relying on this required input is classified **`REVISED_HISTORICAL`**. Earlier months are not reconstructed, interpolated, or scored under this program.

This boundary is an observed source-retention constraint, not an assertion that the underlying index did not exist earlier. The build must re-probe the official source boundary on each future run because the provider currently retains a rolling historical window.

## Validation Boundaries

The frozen Champion must be evaluated separately from the legacy 317-row research series. No verified historical score will be selected, rescaled, or optimized to reproduce October 2008, March 2020, or any legacy value. No Champion V1 historical performance claim is permitted until the dataset manifest, provenance ledger, outcome ledger, and pre-registered evaluation gates are complete.
