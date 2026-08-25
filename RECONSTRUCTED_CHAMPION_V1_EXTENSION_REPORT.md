# Champion V1 Historical Coverage Extension — Phase 1B

## Executive Verdict

> **Champion validation verdict: INCONCLUSIVE.**

The Phase 1B reconstruction creates a materially broader, source-audited research window than the 36-month post-2023 verified ledger. It does **not** convert that window into point-in-time evidence. The study uses revised history for the exact high-yield spread and a disclosed official proxy for SOFR before April 2018; it therefore cannot support a claim that FAULTLINE actually warned investors or institutions in real time.

The reconstructed results offer **limited descriptive evidence** that the frozen 45–64 `ELEVATED RISK` bucket was followed by worse independent S&P 500 outcomes than the 0–44 buckets. However, the frozen model missed 16 of 26 pre-registered 10% drawdown events under the locked two-month warning rule, including the 2007 lead-in, 2011, 2015–16, Q4 2018, and 2020 shock. It never reached `HIGH STRESS` or `SYSTEMIC CRISIS` in the reconstruction. Accordingly, no Strong, Moderate, or Weak Champion claim is warranted.

## Dataset and Method

| Item | Result |
|---|---|
| Score coverage | 2000-01–2026-07; **318 complete** monthly scores and **one explicit incomplete month** (2018-03) |
| Formula | Unchanged frozen Champion V1; six original weights, original transforms, original thresholds, and static AI baseline of 65 |
| Credit input | Exact ICE BofA high-yield OAS series from a dated FRED archive plus current FRED continuation; no correlated substitute |
| Funding input | Official New York Fed primary-dealer Treasury GC repo survey proxy through 2018-02, then official SOFR; no Fed Funds substitution |
| Outcome basis | Independent S&P 500 **price** outcomes at 1/5/20/60/120/252 trading days; 1,886 complete daily-cadence-confirmed observations |
| Model changes | **None.** Live Champion, legacy history, public claims, and V3-H status were left unchanged. |

The data boundary is intentional. FRED currently states that the exact required ICE spread retains only three years of observations and points users to the source for more data.[1] The Federal Reserve’s historical-proxy note states that the New York Fed’s primary-dealer Treasury GC repo survey can be a reasonable proxy for SOFR for risk modeling, while documenting its different coverage and weighted-mean methodology.[2] These facts motivate a **reconstructed**, not verified point-in-time, dataset.

## Score Range and Regimes

| Statistic | Reconstructed result |
|---|---:|
| Minimum / median / maximum | 16 / 31 / 56 |
| Mean ± standard deviation | 31.7 ± 8.7 |
| LOW RISK (0–24) | 74 months |
| MODERATE RISK (25–44) | 221 months |
| ELEVATED RISK (45–64) | 23 months |
| HIGH STRESS (65–79) | 0 months |
| SYSTEMIC CRISIS (80–100) | 0 months |

The range is not sufficient to represent a full stress continuum. In particular, the absence of any 65+ outcome means the study cannot evaluate the frozen model’s two highest regimes.

## Event-Warning Evidence

The locked protocol registered 26 independent daily S&P 500 drawdown events of at least 10% from a local peak to a trough inside 60 trading days. Ten events had a prior two-month score at or above 45, yielding a **38.46%** warning rate. Sixteen events were missed, a **61.53%** miss rate. The protocol counted three false alarms among the 23 reconstructed 45+ score months; this is a narrow rule-specific count, not a broader trading-performance measure.

| Period | Selected reconstructed observations | Interpretation under locked rules |
|---|---|---|
| Dot-com decline | 46 in 2000-02; 56 in 2000-10; 51 in 2001-01 | The model entered `ELEVATED RISK` and warned several early drawdown events. It later fell below 45 and missed several 2002 events. |
| GFC lead-in | 38 in 2007-07; 35 in 2007-10 | Missed the 2007 lead-in under the 45 threshold. |
| GFC escalation | 45 in 2008-02; 46 in 2008-07; 47 in 2008-10 | Warned several 2008 drawdown events but never rose above `ELEVATED RISK`; it subsequently declined to 42 in 2008-11 and 36 in 2008-12. |
| 2011 | 36 in 2011-06 | Missed. |
| 2015–16 | 24 in 2015-06; 26 in 2015-10 | Missed. |
| Q4 2018 | 21 in 2018-09; 23 in 2018-10; 28 in 2018-12 | Missed. November/December increases occurred after the decline had begun. |
| COVID shock | 23 in 2020-02; 32 in 2020-03; 32 in 2020-04 | Missed at the frozen 45 threshold. |
| 2022 rates drawdown | 35 in 2022-06; 40 in 2022-09; 42 in 2022-12 | Elevated directionally but remained in `MODERATE RISK`; not a warning under the locked rule. |
| 2023 | 39 in 2023-03; 39 in 2023-10 | `MODERATE RISK`; no claim is made. |

## Forward Outcome Separation

| Frozen score bucket | Scores | Mean 20-day return | Mean 20-day max drawdown | Mean 60-day return | Mean 60-day max drawdown |
|---|---:|---:|---:|---:|---:|
| 0–24 | 74 | 0.84% | -3.21% | 2.09% | -6.49% |
| 25–44 | 221 | 0.84% | -4.18% | 2.55% | -7.34% |
| 45–64 | 23 | -2.74% | -8.02% | -7.63% | -15.72% |
| 65–79 | 0 | Not evaluable | Not evaluable | Not evaluable | Not evaluable |
| 80–100 | 0 | Not evaluable | Not evaluable | Not evaluable | Not evaluable |

The 45–64 bucket shows materially worse realized outcomes in this reconstruction, but the sample contains only 23 scores and is not point-in-time data. It is evidence of historical separation, not proof of deployable predictive efficacy.

## Stability, Dependence, and Ablation

The mean 60-month rolling one-month-lag score correlation is **0.899** (minimum 0.788), indicating substantial temporal persistence. This is descriptive stability, not out-of-sample predictive validation.

Vector correlations reveal material shared exposure: Liquidity Stress–Credit Contagion is **0.866**, Volatility Regime–Macro Sensitivity is **0.712**, and Credit Contagion–Market Breadth is **0.683**. These are double-counting risk indicators to study in a future challenger, not authorization to modify frozen Champion V1.

The largest mechanical leave-one-vector sensitivity is Macro Sensitivity, with a mean absolute score difference of **3.76 points** and a maximum of **10 points**. This ablation only reweights retained frozen vector outputs for descriptive sensitivity; it is neither optimization nor a Challenger test.

## Partition and Legacy Comparison

| Partition | Months | Mean score | Score range |
|---|---:|---:|---:|
| Development | 2000-01–2011-12 | 38.3 | 26–56 |
| Validation | 2012-01–2019-12 | 23.8 | 16–36 |
| Holdout | 2020-01–2026-07 | 29.3 | 19–42 |

For the 316 overlap months, the reconstructed score and immutable legacy series have a correlation of **-0.014**, an average reconstructed-minus-legacy difference of **-22.44 points**, and a maximum absolute difference of **46 points**. This is descriptive reconciliation evidence only. The legacy series was not used to select sources, change the formula, calibrate the reconstruction, or define success.

## Required Disclosures and Next Gate

No public historical-performance language should be strengthened from this work. Any internally shared result must use the following statement:

> **Retrospective reconstructed historical analysis applying the frozen FAULTLINE Champion methodology to revised and proxy-supported historical data. These scores were not generated live at the time and do not show that FAULTLINE warned anyone historically.**

V3-H remains shadow-only. A Challenger comparison, formula change, score rescaling, threshold change, or promotion is blocked pending a separately authorized redesign protocol that addresses source vintage quality, score-range compression, missed events, and vector dependence.

## References

[1] [FRED — ICE BofA US High Yield Index Option-Adjusted Spread](https://fred.stlouisfed.org/series/BAMLH0A0HYM2)

[2] [Federal Reserve — Historical Proxies for the Secured Overnight Financing Rate](https://www.federalreserve.gov/econres/notes/feds-notes/historical-proxies-for-the-secured-overnight-financing-rate-20190715.html)

[3] [New York Fed — Historical Repo Rate Data release](https://www.newyorkfed.org/markets/opolicy/operating_policy_180309)

[4] [Internet Archive CDX index — exact FRED CSV capture](https://web.archive.org/cdx/search/cdx?url=fred.stlouisfed.org%2Fgraph%2Ffredgraph.csv%3Fid%3DBAMLH0A0HYM2&output=json&filter=statuscode:200&collapse=digest&fl=timestamp,original,statuscode,mimetype,digest,length)
