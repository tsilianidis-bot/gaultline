# Reconstructed Champion V1 Evaluation Protocol

## Status

This protocol is locked before calculating Phase 1B metrics. It applies only to `RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY`. The study is retrospective, uses revised and proxy-supported inputs, and cannot establish that FAULTLINE generated warnings in real time.

## Included Dataset

| Field | Locked definition |
|---|---|
| Score source | `reconstructedHistoricalScores` with `scoreStatus = COMPLETE` and policy version `RECONSTRUCTED_CHAMPION_V1_POLICY_20260819` |
| Outcome source | Latest append-only `reconstructedHistoricalOutcomes` observation for each score/horizon with `dataCadence = DAILY_CONFIRMED_PERIOD_QUERY` |
| Calendar window | 2000-01 through 2026-07, excluding the explicitly incomplete 2018-03 score month |
| Formula | Exact `CHAMPION_V1_FROZEN_20260819`; no optimization, reweighting, rescaling, or threshold adjustment |
| Independent instrument | S&P 500 Price Index (`^GSPC`); price return, not total return |

## Pre-Registered Event and Decision Rules

| Rule | Locked definition |
|---|---|
| Equity drawdown event | A peak-to-trough decline of at least **10%** within **60 trading days**, identified from the independent daily S&P 500 bars. The event start is the first peak date and event trough is the lowest close inside its 60-day window. Overlapping events are deduplicated by retaining the earliest start and then advancing beyond its trough. |
| Stress score | Frozen monthly Champion score **≥45** (`ELEVATED RISK`, `HIGH STRESS`, or `SYSTEMIC CRISIS`). |
| Warning | At least one qualifying stress score observed during the two completed monthly decision dates ending on or before the event start. |
| False alarm | A qualifying stress score for which no registered drawdown event begins within the next 60 trading days. |
| Missed event | A registered drawdown event with no qualifying stress score in its defined two-month warning window. |
| Calm comparison | Complete score dates not in an event warning window and not within 60 trading days after a registered event start. |
| Outcome buckets | Fixed frozen bands: 0–24, 25–44, 45–64, 65–79, and 80–100. No data-driven rebucketing. |
| Temporal stability | Correlation of adjacent 60-month rolling score windows when at least two overlapping windows can be formed; reported as descriptive, not a predictive statistic. |
| Vector dependence | Pearson correlations among the six stored frozen vector scores. |
| Ablation | Mechanical one-at-a-time contribution removal using frozen stored vector scores and renormalized remaining weights. This is descriptive sensitivity only, not a challenger. |

## Locked Partitions

| Partition | Months | Permitted use |
|---|---|---|
| Development | 2000-01–2011-12 | Descriptive reconstruction check only. No parameter selection. |
| Validation | 2012-01–2019-12 | Out-of-period descriptive metric reporting. |
| Holdout | 2020-01–2026-07 | Final descriptive reporting. No methodology changes based on results. |

## Decision Standard

The results can be classified only as **DESCRIPTIVE EVIDENCE**, **LIMITED SUPPORT**, or **INCONCLUSIVE**. A Strong/Moderate/Weak Champion claim is prohibited because the study uses reconstructed rather than point-in-time source history, includes an approved SOFR proxy, and lacks a pre-2023 archived vintage for the required credit-spread input.
