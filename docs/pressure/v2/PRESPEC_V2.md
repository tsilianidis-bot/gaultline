# PRE-SPECIFICATION — Pressure Index v2 research candidate ("FL-PI-v2-research-0")
Written BEFORE any v2 historical score or outcome was computed. Locked by SHA-256 recorded in PRESPEC_V2.sha256 (written at lock time).
Author: Grok Bot executor (independent research). Status: RESEARCH ONLY — not a production change.

## Honesty disclosure
The designer knows market history 2000–2026 (hindsight-informed design). No parameter below was fitted or tuned to the data; all are round-number priors fixed here. This is still NOT a true out-of-sample test; the only untouched holdout remains the forward ledger (FL-HV-2026-10-04-001 C2, 2026-09-15 onward), which this study does not use: all v2 outcome windows end on or before 2026-09-14.

## Observation grid
Weekly, every Friday close (or prior trading day), 2000-01-07 .. 2026-09-11 (last base with complete 63-session forward window evaluated only if window closes ≤ 2026-09-14).
Point-in-time rule: a value is used on date D only if its observation date ≤ D minus publication lag (daily market series: ≤ D; weekly claims: release Thursday for week ending prior Saturday → use obs ≤ D−6; UNRATE: ALFRED vintage as-of D).

## Pillars (one underlying variable family each; no variable reused)
| Pillar | Indicator | Source | Transform (raw) |
|---|---|---|---|
| P1 Credit | Moody's Baa corporate yield minus 10Y Treasury (BAA10Y), daily | FRED (not revised) | level |
| P2 Funding/Liquidity | TED spread (TEDRATE) through 2022-01-21; thereafter UNAVAILABLE (FRED discontinued; no free LIBOR-OIS/FRA-OIS) | FRED | level |
| P3 Volatility | VIX close (VIXCLS) | FRED/CBOE | level |
| P4 Market deterioration | S&P 500 drawdown from trailing 252-session closing high (positive number, %) | Yahoo ^GSPC | level |
| P5 Macro deterioration | Real-time Sahm-type gap: 3-month avg UNRATE minus min of 3-month avgs over prior 12 months, from ALFRED vintage as-of D | ALFRED | level |
| P6 Contagion | NOT INCLUDED in v2-research-0 (no free point-in-time cross-asset correlation dataset assembled). Gap. | — | — |

## Normalization
For each pillar, p_i(D) = expanding-window empirical percentile of today's raw value versus all of that indicator's own point-in-time values from its series start (≥1986 BAA10Y/TED, 1990 VIX, 1990 GSPC, 1990 UNRATE vintages) through D. Minimum 5 years of history, else pillar UNAVAILABLE.
Pillar score s_i = 100 × clip((p_i − 50)/50, 0, 1)  (only above-median stress contributes; median-or-calmer = 0).

## Composite
v2(D) = mean of available s_i (equal weights, an a-priori uninformative prior). Requires ≥3 of the pillars, else UNAVAILABLE (fail closed). No fallback constants.
Bands: keep the existing labels and cut-points 0–24/25–44/45–64/65–79/80–100 unchanged for comparability. 80+ requires the mean available pillar to sit ≥ the 90th percentile of its own history — attainable, by construction, only under broad co-extreme stress.

## Event definitions (identical to repo's locked reconstruction protocol, reused rather than re-chosen)
E = S&P 500 (^GSPC) closing-basis peak-to-trough decline ≥10% within 60 trading days; earliest start; dedupe by advancing past trough. 2000-01-01 .. 2026-09-14.
Warning (v2 and every benchmark): signal ≥ its "Elevated" threshold on any weekly date in the 8 weeks ending on/before event start (peak). Coincident detection: first date ≥ threshold between start and trough (lag in sessions from start).
Thresholds: v2 = 45; VIX = 25 (conventional); BAA10Y = 3.0 (the prereg's B06 proxy threshold); NFCI > 0 (Chicago Fed convention); Trend = close below 200-session SMA; EW-z composite = 1.0 (mean z of the 5 raw pillars, expanding-window z, ≥ +1).
False alarm: a weekly first-crossing (signal goes from below to ≥ threshold) with no event start in the following 60 trading days and not inside an ongoing event.

## Predictive test (rank-based, no fitted parameters)
Target Y(D) = 1 if the max drawdown of ^GSPC closes over the next 63 sessions, measured from close at D, is ≥10%.
Metric: AUC of each signal for Y, full sample and split 2000–2012 / 2013–2026-06. Incremental-information check: AUC of v2 within the subset where VIX < 25 and within subset VIX ≥ 25; Spearman correlation between v2 and each benchmark. Block bootstrap (26-week blocks, 1000 draws, fixed seed 20261012) for AUC intervals; overlap of forward windows makes naive SEs invalid.
Also report mean forward 63-session return and max drawdown by v2 band.

## Known contamination
NFCI is revised every week; only the current vintage was downloaded → NFCI benchmark is revised-data (look-ahead) contaminated; labelled as such. BAA10Y, VIX, TED, DGS*, GSPC are not revised. ICSA not used. HY OAS not used (pre-2023 restricted).
