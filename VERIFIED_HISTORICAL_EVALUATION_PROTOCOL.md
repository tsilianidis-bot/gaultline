# Verified Historical Validation V1 — Pre-Registered Evaluation Protocol

## Status

This protocol was completed and re-registered as `VERIFIED_CHAMPION_V1_PROTOCOL_20260819_R2` before the reported Champion V1 performance metrics. It applies only to the research-only `CHAMPION_V1_FROZEN_20260819` dataset. An earlier preliminary calculation is discarded and is not a reported result because it preceded the explicit warning, false-alarm, missed-event, stability, and ablation rules now stated below. This protocol does not alter the live Pressure Index, the legacy historical research series, V3-H status, or any public claim.

## Locked Sample and Partitions

| Partition | Score months | Permitted use |
|---|---|---|
| Development | 2023-08 through 2024-07 | Descriptive diagnostics only; no weight, threshold, transform, or source substitution changes are permitted. |
| Validation | 2024-08 through 2025-07 | Confirm fixed baseline diagnostics. |
| Holdout | 2025-08 through 2026-07 | Final untouched evaluation. Pending outcome horizons remain excluded from their relevant denominator. |

## Objective Event Definitions

> **Equity drawdown event:** A continuous S&P 500 Price Index (`^GSPC`) peak-to-trough episode whose first qualifying daily close is at least 10% below the preceding running peak within 60 trading days. Consecutive qualifying closes before recovery count as one event. The event onset is the first qualifying close; the preceding peak date and lowest close before recovery are retained as event fields.

The VIX-spike definition is intentionally pre-registered as **not evaluated**. It cannot be tested until an independent VIX source is separately persisted; no proxy or inference will be substituted.

Calm score dates are those outside the 60-trading-day pre-event window, active event interval, and 20-trading-day post-event recovery window.

## Locked Metrics

The program will calculate score and regime distributions; stress-versus-calm separation; independent 1/5/20/60-trading-day forward drawdown by pressure bucket; warning lead time; false alarms; missed events; temporal stability; vector correlations; ablation after the baseline is locked; and walk-forward evaluation across these partitions.

The warning threshold is fixed at **45** (ELEVATED RISK or above). A false alarm is a qualifying score with no registered drawdown-event onset in the next 60 trading days. A missed event is a registered drawdown-event onset with no qualifying score in the prior 60 trading days. Temporal stability is lag-1 Pearson autocorrelation of complete monthly scores, requiring at least 12 observations. Ablation is sensitivity-only: remove one vector, renormalize the remaining original frozen weights to one, and report correlation and mean absolute difference versus the frozen baseline. No ablation result may change Champion weights, thresholds, or live behavior.

All returns and drawdowns are independent S&P 500 observations and never enter the Champion score. The series currently has a `REVISED_HISTORICAL` overall quality because required BAMLH0A0HYM2 observations lack admissible ALFRED vintage evidence. This limitation carries into every result and verdict.
