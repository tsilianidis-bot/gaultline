# Phase 1 — Historical Event, Discrimination, Lead, Stability, and Leakage Analysis

## Evidence Tier

All findings in this document use `RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY`. That tier is retrospective and contains revised historical inputs plus a documented pre-SOFR proxy. It can describe frozen-Champion behavior under the locked policy, but it cannot establish that FAULTLINE existed, observed conditions, or warned anyone at the historical date.

## Score Distribution and Risk Discrimination

The 318 complete reconstructed monthly scores have a mean of **31.72**, median **31**, standard deviation **8.71**, minimum **16**, and maximum **56**. They distribute as 74 Low Risk months, 221 Moderate Risk months, 23 Elevated Risk months, zero High Stress months, and zero Systemic Crisis months.

| Score bucket | Count | Mean 20-trading-day return | Mean 60-trading-day return | Mean 60-trading-day maximum drawdown | Interpretation |
|---|---:|---:|---:|---:|---|
| 0–24 | 74 | 0.84% | 2.09% | −6.49% | Retrospective calm bucket |
| 25–44 | 221 | 0.84% | 2.55% | −7.34% | Retrospective moderate bucket |
| 45–64 | 23 | −2.74% | −7.63% | −15.72% | Materially worse retrospective outcome bucket |
| 65–79 | 0 | N/A | N/A | N/A | No calibration evidence |
| 80–100 | 0 | N/A | N/A | N/A | No calibration evidence |

The 45–64 result is a **risk-discrimination finding**, not a validated early-warning claim. Its 23-score sample is small, outcomes overlap in time, and the same reconstructed policy produced no observations in the higher score ranges users would naturally associate with crisis warning.

## Registered Drawdown-Event Analysis

The locked event definition is a local 20-trading-day S&P 500 high followed by a closing drawdown of at least 10% within 60 trading days. Of **26** registered events in score coverage, the frozen composite reached the pre-registered `≥45` condition inside the two-calendar-month pre-event window for **10** and did not for **16**. The diagnostic composite warning rate is **38.46%**. The exact 60-trading-day false-alarm rule identified **3** elevated-score months with no registered event in the subsequent window.

| Event group | Composite result | Evidence-bound reading |
|---|---|---|
| 2000–2001 drawdowns | 6 of 6 reached the condition | The retrospective sequence contained elevated credit/liquidity conditions; this does not establish real-time detection |
| 2002 drawdowns | 0 of 3 | Liquidity and Credit components were elevated, but the composite remained below 45 |
| 2007 initial / 2011 / 2015–16 / 2018 / 2020 / 2021–22 / 2025 events | Multiple misses | Several had no elevated component; others had isolated component elevation that did not lift the composite to 45 |
| 2008 continuation events | 4 of 4 reached the condition | Composite was 45–47, never High Stress, despite large realized drawdowns |

The complete event-by-event result, including score months and component peaks, is preserved in `PHASE_1_EARLY_WARNING_DIAGNOSTICS.json`.

## Engine-versus-Composite Diagnostic

Among the **16 composite misses**, the number of events with at least one vector at or above 45 within the same pre-event window was: Liquidity 6, Credit 5, Market Breadth 4, Macro 3, AI/Speculation 2, and Volatility 0. This is an exploratory **divergence observation**, not a leading-indicator result. A component can be elevated because it shares inputs with other vectors, because a revised historical value changed, or because the threshold was selected after observing the event table. No component-specific event/horizon calibration, false-alarm rate, out-of-sample evaluation, or confirmation policy is registered.

> **Phase 1 conclusion:** underlying vector deterioration before some composite misses warrants research preservation, but it is insufficient to create, rank, or publish Early Warning candidates.

## Macro Sensitivity Four-to-Eight-Week Claim

The claim is **NOT SUBSTANTIATED**. The available reconstructed Champion observations are monthly and partly revised/proxy based. They cannot test an exact 4–8-week live information lead. There is also no locked macro event definition, decision timestamp release calendar, real-time vintage sample, calibration curve, or out-of-sample test tied to that horizon.

## Stability and Cross-Vector Dependence

The mean 60-month rolling one-month-lag score correlation is **0.899** (minimum **0.788**). This demonstrates a smooth / persistent reconstructed score process, not predictive stability. Important contemporaneous vector correlations include Liquidity–Credit **0.866**, Volatility–Macro **0.712**, Credit–Breadth **0.683**, and Liquidity–AI **0.669**. The correlation pattern supports the overlap concern identified in the input audit.

Mechanical ablation is descriptive: Macro Sensitivity had the largest mean absolute score effect (**3.76** points; maximum **10**), followed by Liquidity (**2.47**) and Credit (**2.39**). No ablation result is used to optimize the frozen Champion.

## Locked Partitions and Out-of-Sample Limits

The pre-registered score partitions are development through 2011-12 (144 months), validation from 2012-01 through 2019-12 (95), and holdout from 2020-01 onward (79). The reported artifact shows score distributions by partition but has not established independent out-of-sample **event** calibration by partition. The scoring formula itself was not selected or re-fit during this exercise; nevertheless, result interpretation must remain conservative because event/outcome comparisons were not separately powered in each partition.

## Look-Ahead Assessment

| Area | Assessment |
|---|---|
| Score construction | No recorded use of legacy score, forward outcome, event result, or requested crisis value; monthly timestamp and release-lag rules are locked |
| Input data | Revised historical values and a pre-SOFR proxy prevent a point-in-time claim |
| Outcome ledger | Metrics exclude early provider-downsampled observations and use daily-confirmed period queries only |
| Event design | Drawdown definition and window were pre-registered before the reported Phase 1B metric run; the new component diagnostic is explicitly post-baseline exploration |
| Consumer analog / pattern language | Several current live implementations use fixed outcome statements and must not be treated as historical validation |

## Required Repair Classification

| Finding | Severity | Repair class |
|---|---|---|
| Composite early-warning performance is insufficient for a historical warning claim | **CRITICAL** | MUST FIX BEFORE PHASE 2 through claim and evidence governance, not score optimization |
| Component divergence is exploratory and uncalibrated | **HIGH** | SHOULD FIX BEFORE EARLY WARNING DETECTION |
| Macro 4–8-week leading claim lacks evaluable evidence | **HIGH** | MUST FIX BEFORE PHASE 2 by containment / qualification |
| High-range score calibration is unavailable because no reconstructed 65+ scores exist | **HIGH** | SHOULD FIX BEFORE EARLY WARNING DETECTION |
| Vector overlap is material | **HIGH** | SHOULD FIX BEFORE EARLY WARNING DETECTION |

## Evidence

`RECONSTRUCTED_CHAMPION_V1_METRICS.json`, `PHASE_1_EARLY_WARNING_DIAGNOSTICS.json`, `RECONSTRUCTED_CHAMPION_V1_EVALUATION_PROTOCOL.md`, and `RECONSTRUCTED_CHAMPION_V1_DATA_POLICY.md`.
