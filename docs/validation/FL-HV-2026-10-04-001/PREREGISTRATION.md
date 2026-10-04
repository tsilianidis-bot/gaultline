# FAULTLINE historical validation — pre-registration FL-HV-2026-10-04-001

**STATUS = PROPOSED, awaiting James's approval; no historical result has been computed.**

Pre-registration version 1.0.0, frozen 2026-10-04 (America/New_York). The engine binding, methodology hash and file hashes are in `prereg-manifest.json` and `SHA256SUMS`. Every rule below is defined in machine-readable form in `methodology.json`. If this text and the JSON disagree, the JSON wins.

## 1. What is bound

- **Engine:** commit `1cfa1299f6644a7eb9a60246330c7b9a13ccc433`, Railway deploy `e180e966-26a2-4064-81b1-66998b25cdf5`, created 2026-10-04 1:06 PM ET.
- **formulaHash** `3cb3d49af3ee69…8186`: matches the 12-character prefix on all 21 prod provenance rows.
- **Git blob SHAs:** recorded for every engine file involved in `version-ids.json`.
- **Baseline live state as reported by James:** 34/100, MODERATE RISK, 83rd percentile, post-deploy QA PASS. This pre-registration did not re-read it.
- **Change rule:** any change to scoring code, weights, thresholds, inputs, horizons, outcomes, benchmarks or verdict rules requires a new test ID. This test ID is never re-used.

## 2. What FAULTLINE actually computes (verified in code at 1cfa129)

**Pressure Index (PI)**
- PI = round(Σ vector score × weight). Weights: liquidity 0.20, credit 0.20, "volatility" 0.15, macro 0.20, "breadth" 0.10, AI 0.15.
- Regime bands: ≥80 SYSTEMIC CRISIS, ≥65 HIGH STRESS, ≥45 ELEVATED RISK, ≥25 MODERATE RISK, otherwise LOW RISK.
- Inputs are 8 FRED series: HY OAS, SOFR, DGS10, DGS2, CPI, PPI, FEDFUNDS and UNRATE. **There is no market price or VIX input.**

**Vectors whose names are misleading**
- "Volatility" is the 10Y−2Y curve plus the 10Y level.
- "Breadth" is unemployment plus the 10Y.
- "AI bubble" uses a **documented static constant** (concentration 65). It is reproduced exactly as the engine does and labelled DOCUMENTED_CONSTANT, never as a historical measurement. It adds a uniform 4.875 points to every PI.

**Out of confirmatory scope** (see `data-requirements.json → notReconstructable`)
- The systemic-regime HMM is in-sample. Prod was trained on 2016-10-25 → 2026-09-25.
- Signal convergence depends on LLM/FMOS engines.
- Bull/neutral/bear figures are evidence-vote shares, not probabilities, with no event definition or horizon.
- Transition probabilities are static defaults.
- Trading signals are per ticker and LLM-dependent.

## 3. Frozen periods / evaluation sets

| Set | Window | Label | Role |
|---|---|---|---|
| **C1** | 2023-10-04 → 2026-09-14 (738 sessions) | RETROSPECTIVE_RECONSTRUCTION (not a validated backtest) | Faithful inputs only (ALFRED vintages, no proxies, no fallback constants). In-sample-contaminated because the engine was designed in 2026; diagnostic only, and **cannot alone produce PASS**. |
| **C2** | 2026-09-15 onward | FORWARD_LIVE | **The only untouched holdout.** QLS states: the scheduled 18:00 UTC cron, generatedAt in [18:00, 18:30) UTC, XNYS session, earliest per ET date. Sensitivity: states with codeVersion 1cfa129 only (first possible 2026-10-05). The verdict is computed once, when ≥630 states have matured 21-day outcomes (about 2029). |
| E1 | 2001-01-02 → 2023-10-03 (5,724 sessions) | EXPLORATORY_PROXY | Needs its own pre-registration (FL-HV-2026-10-04-002) before it is run. HY proxy = OLS map from BAA10Y fitted on input data from 2023-10 → 2026-09. SOFR proxy = DFF before 2018-04. No verdict weight here. |

**Why C1 starts in October 2023:** HY OAS (BAMLH0A0HYM2) is available on FRED/ALFRED only from 2023-10-03, because FRED keeps a rolling 3-year window of the licensed ICE data. That window **moves forward every day**, so the vintages must be snapshotted soon or C1 shrinks.

## 4. State generation and timing

- **One designated state per XNYS session**, at 18:00:00 UTC. That is 2:00 PM ET under EDT and 1:00 PM ET under EST, mirroring the prod cron `0 18 * * *`. Railway cron is assumed to run in UTC (UNVERIFIED).
- **No states on non-sessions.** Holidays and unscheduled closures are skipped.
- **Reruns never replace** a designated state.
- **Input availability (primary rule):** a FRED value is usable on date D only if its vintage realtime_start is before D, i.e. the day after release.
  - Sensitivity SAME_DAY_RELEASE: HY OAS, SOFR and VIX may use realtime_start = D.
  - Market inputs use the previous completed close.
- **Completed bars only:** a close is completed at the scheduled close (16:00 ET, or 13:00 on early-close days) plus 60 minutes. This follows the PR #61 v2 design. PR #61 is OPEN and not in 1cfa129, so the evaluation harness enforces the rule, not prod code.
  - A bar is an input only if it completed before the state.
  - **The base is the first completed close not known at the state.** For a normal state that is the same day's close.
- **Engine quirks are reproduced:**
  - limit-2 "." handling
  - CPI/PPI YoY computed against obs[12] by position
  - HY ×100 conversion
- **Missing inputs:** in C1 a missing input makes the state INPUT_UNAVAILABLE (counted, not imputed). Sensitivity FALLBACK_AS_PRODUCTION uses the engine's fallback constants instead.
- **State record:** every evaluated state stores stateId, runId, evalTime (UTC), engine SHA, formulaHash, methodology hash, input snapshot ID (sha256 of the vintage set), per-series realtime_start and set label.
- **observedAt:** it is null in prod. Historically it is set to the state evalTime, and per-input availability comes from ALFRED realtime_start. Nothing is back-filled into prod.

## 5. Horizons and outcomes

- **Horizons:** 1, 5, 10, 21, 63, 126 and 252 XNYS sessions after the base. The primary horizon is 21; the secondary confirmatory horizon is 63.
- **Asset:** S&P 500 total return (^SP500TR). Sensitivities: ^GSPC price return and SPY.

**Outcomes per horizon**
- Forward return.
- Path max drawdown from the base (close-to-close).
- Realized volatility: √252 × the sample standard deviation of log returns. Computed for h ≥ 5 only.
- **Major downside event:** max drawdown within the horizon ≤ −10% (−20% for h ≥ 63 as a secondary threshold).
- Regime-transition frequency (band changes and upward band changes h sessions later), where the PI path exists. Exploratory.

**Missing or incomplete bars**
- A missing base or target bar **delays the outcome; it never shifts it.** The bar is re-fetched for 10 sessions, then marked MISSING_BAR, excluded and counted.
- Outcomes that have not matured yet are PENDING.
- A bar whose completion time is after the moment of use is treated as non-existent.

**Event list** (`event-list.json`)
- Computed mechanically from ^GSPC closes. It contains no FAULTLINE information.
- Rule A: episodes measured from the all-time high.
- Rule B: episodes measured from the rolling 252-session high, with onset at −10% and the end when the drawdown recovers above −2%. Rule B onsets are the H4 events.
- Rule B onsets in C1: only 2023-10-27 and 2025-03-13. There is no bear market in C1.
- NBER recession dates (verified at nber.org) are descriptive labels only.

## 6. Benchmarks

All thresholds are fixed now from conventional levels; none were fitted. See `benchmarks.json`.

- **B00** unconditional history
- **B01** buy-and-hold SPY
- **B02** 200-day moving average
- **B03** 10-month moving average
- **B04** VIX ≥ 25
- **B05** VIX percentile ≥ 80th
- **B06** credit-spread regime: HY OAS ≥ 500 bps, or BAA10Y ≥ 3.0% in proxy windows
- **B07** 10Y−2Y curve < 0
- **B08** real-time Sahm ≥ 0.50, computed from UNRATE vintages
- **B09** trailing 21-day volatility ≥ 20%
- **B10** MACD 12/26/9 below its signal line
- **B11** equal-weight expanding z-score composite of FAULTLINE's 8 raw inputs
- **B12** randomized classification null: FAULTLINE labels with identical class frequencies, either circularly shifted or stationary-block-shuffled. 10,000 draws, seed 20261004.

The FAULTLINE alarm is PI ≥ 45, the frozen ELEVATED threshold.

## 7. Hypotheses, metrics and inference

**Hypotheses**
- **H1:** higher PI precedes deeper drawdowns and higher realized volatility.
- **H2:** the regime bands are ordered.
- **H3:** PI and upward transitions add information beyond trailing return and volatility.
- **H4:** stress is flagged before or during deterioration.

**Primary metrics**
- **PM1:** Spearman correlation ρ(PI, MDD₂₁).
- **PM2:** Jonckheere–Terpstra test of MDD₂₁ across bands. Bands with fewer than 60 states are merged toward MODERATE; if fewer than 2 bands remain, H2 is untestable.
- **PM3:** HAC Wald test for {PI_z, UpTrans5}, plus incremental R².
- **PM4:** Δρ against B11 and against the best single benchmark among B02–B10.

**Secondary and exploratory**
- Secondary: results for volatility, returns and the 63-day horizon, event frequencies with Wilson CIs, and H4 recall/lead/precision.
- Everything else is exploratory.

**Inference**
- Stationary block bootstrap with mean block length max(2h, 21), 10,000 resamples.
- Newey–West regressions with lag ⌈1.5h⌉.
- 95% CIs throughout.
- Holm–Bonferroni across PM1–PM4 within each set, α = 0.05 one-sided.
- N, matured N, N_eff = N/h and event counts are always reported.

## 8. Verdict scale — PASS / MIXED-INCONCLUSIVE / FAIL

The economic thresholds are:
- |ρ| ≥ 0.10
- MDD₂₁ for PI ≥ 45 at least 2.0 percentage points deeper than for PI < 45
- realized-volatility gap ≥ 3 points
- incremental R² ≥ 0.01
- Δρ ≥ 0.05 against benchmarks

**PASS** requires all of the following in **both C2 and C1**, with N_eff ≥ 30 in each:
- PM1, PM2 and PM3 significant after Holm in the predicted direction, and each meets its economic threshold.
- PM4 Δρ ≥ 0.05 against B11 and against the best single benchmark, with the 95% CI excluding 0.
- FAULTLINE beats the B12 null at p < 0.05.

**FAIL** applies in any set with N_eff ≥ 30 if any of these holds:
- (a) PM1 or PM2 is significant in the wrong direction.
- (b) The CI for ρ(PI, MDD₂₁) lies entirely above −0.10 and FAULTLINE does not beat the null.
- (c) The Δρ CI against B11 or against the best benchmark lies entirely below 0.

**MIXED-INCONCLUSIVE** covers everything else, including:
- underpowered sets
- H2 untestable
- results that are significant but not economically significant
- C1 holds but C2 does not
- FAULTLINE beats the null but not the benchmarks

## 9. Contamination and exclusion rules (`exclusions.json`)

**Only designated scheduled states enter the evaluation.** Rows written by page reads, QA, manual or ad-hoc runs, redeploys or cache misses are **excluded but preserved**, each with its provenance and reason. Nothing was deleted or modified. Later exclusions are appended as new versioned files.

**QA shadow writes on 2026-10-04**
- These came from post-deploy QA, via calculateFaultlinePressure → runV3HShadow (engine.ts:711, shadowEngine.ts:96-131).
- shadowModelReadings:
  - **317** at 17:17:47Z (1:17:47 PM ET)
  - **318** at 17:22:33Z (1:22:33 PM ET)
  - **319** at 17:22:48Z (1:22:48 PM ET)
- shadowForwardOutcomes **949–957**: three per reading, horizons 1d/5d/20d.
- The DB timestamps differ by a few seconds from the times the parent reported (~17:17:54, 17:22:36 and 17:22:56Z).

**Non-scheduled forward states**
- Manifests 1, 2, 3, 7, 10 and 11. No new ones have appeared since INVENTORY.md.
- Their algorithmScoreProvenance rows are 1, 2 and 5.

**Scheduled runs on non-sessions**
- Manifests 9, 12, 18, 19, 25 and 26. The cron runs daily, including weekends.

**v1 outcomes**
- All **32** v1 algorithmOutcomeObservations rows are excluded.
- 27 have intraday target bars.
- The other 5 are complete but still use v1 conventions: either the base close falls before the state, or the base was a same-day in-progress bar.
- All 32 are day-keyed and price-only, and use the old horizon set.

**Whole tables**
- The whole V3-H shadow table is excluded: it is a separate experimental engine.
- HMM readings are excluded.

**Admitted at freeze**
- 14 C2 states: manifests 4, 5, 6, 8, 13–17 and 20–24.
- All are provenance tier LEGACY because the run trigger was not recorded.
- All except the last were produced by score-equivalent earlier builds; the numeric logic has been unchanged since 6dc9e4b.

## 10. Blindness statement

Before freezing, I did NOT examine any historical FAULTLINE performance, reconstructed scores, metric files or HMM validation artifacts. Files avoided: reconstructedChampion*, VERIFIED_*_METRICS, PHASE_1_HISTORICAL_*, and quant/systemic-regime/artifacts reports and OOS paths.

Incidental exposure, disclosed: while checking the formulaHash prefix I saw live forward-ledger PI values of 28–33 (MODERATE RISK) for 2026-09-14 → 10-01. Those are live values, not historical ones.

The prod DB lookups were read-only: TRANSACTION READ ONLY, rolled back, no score columns selected, no credentials printed. The scripts are in `probe/`.

## 11. Material data limitations and status

**Recommendation: BLOCKED** for any multi-decade faithful historical validation.

**Inputs without point-in-time history for most of the period**
- **HY OAS** drives about 26% of composite weight: 65% of liquidity, 50% of credit and 20% of AI. It has no point-in-time history on FRED before 2023-10-03.
- SOFR exists only from about 2018-04 (UNVERIFIED), with vintages from 2019-03-29.
- DGS10 and DGS2 vintages start in 2005-06.

**Consequences for the sets**
- C1 can be run, but it is short and in-sample-contaminated.
  - N_eff = 35 at 21 days, 11 at 63 days and 2 at 252 days.
  - It contains only 2 correction onsets and no bear market.
- A real PASS can only come from C2 after years of forward data, or from licensed ICE history under a new test ID.

**Other limitations**
- The HMM was retrained in prod on 2026-09-28. The repo artifact differs from the prod bundle, and the prod bundle hash was not captured.
- Box access to the FRED API is blocked (403), so no vintages have been snapshotted yet.

## 12. Open decisions for James

1. Approve or amend this pre-registration (C1 + C2 confirmatory, E1 exploratory under a separate ID).
2. License ICE BofA HY OAS history and vintages from ICE, or accept C1/C2 only.
3. Snapshot the ALFRED vintages now, from a host with FRED access, before the HY window rolls forward.
4. Freeze the HMM. Confirm that the train-once service will not be redeployed, since a redeploy retrains it, and record the prod bundle hash.
5. Merge PR #61 (completed-bar v2) or keep the rule enforced only in the harness.
6. Approve the benchmark thresholds (VIX 25, HY 500 bps, BAA10Y 3.0%, volatility 20%) and the C2 verdict checkpoint (630 matured states).

## 13. UNVERIFIED items

- FRED observation start dates for the long series, and the SOFR start on FRED.
- That Railway cron runs in UTC.
- Whether ICE restates HY OAS.
- Whether Yahoo restates index closes.
- The pinned XNYS calendar version.
- SAHMREALTIME vintage coverage.
- How the client Signals map the regime score.
- The prod HMM bundle hash.
- The VIX pre-2010 history source.
- That BAA10Y and DGS series before vintages are unrevised.
