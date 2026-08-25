# Phase 1 — Derived Logic, Probability, Analog, and Reproducibility Audit

## Regime Logic

The live Champion V1 regime map is deterministic and reproducible: `<25 LOW RISK`, `25–44 MODERATE RISK`, `45–64 ELEVATED RISK`, `65–79 HIGH STRESS`, and `≥80 SYSTEMIC CRISIS`. FMOS calls the same shared boundaries for its current label, then adds derived stability, boundary-distance confidence, alternative scenarios, and a heuristic 30-day transition probability.

The reconstructed research history never reaches High Stress or Systemic Crisis because its locked frozen-V1 monthly scores range from **16 to 56**. The absence is not a history claim: it means the current formula’s transforms, weights, static AI baseline, and approved reconstructed inputs do not produce scores at `65+` over that window. No data point supports raising or lowering a threshold in Phase 1.

## Trend, Acceleration, and Persistence Rules

| Derived feature | Current executable rule | Historical validation status |
|---|---|---|
| Daily direction | Rising if day-over-day score `≥ +3`; falling if `≤ −3`; otherwise stable | Defined; forward-only daily history is still too short for historical validation |
| Seven-day trend | Mean recent 7 daily readings minus preceding 7; rising / declining at `±5` points | Defined; no pre-existing long daily evidence base |
| Thirty-day context | Recent 7-day mean versus 30-day mean; material at `±8` points | Defined; no pre-existing long daily evidence base |
| Acceleration | Seven-day and thirty-day deltas both `≥ +5` | Defined; unvalidated as an early-warning model |
| Building pressure | Latest 10 readings nondecreasing in reverse-chronological storage | Defined; unvalidated as an early-warning model |
| Sustained elevated pattern | At least 8 of latest 10 daily readings `≥60` | Defined; unvalidated pattern rule |
| Threshold crossing pattern | Current crosses 70 or 80 after previous was below | Defined; not currently represented in reconstructed V1 history because it did not reach 65+ |

Several explanatory phrases in the pattern layer describe historical resolution rates or timing, but the executable pattern outcomes are static score-bucket heuristics. They lack a registered event, sample provenance, or external calibration ledger. They must not be interpreted as validated early-warning statistics.

## Analog Systems

| System | Similarity construction | Audit status |
|---|---|---|
| Live Pressure analogs | Hand-authored 4-vector fingerprints for 1973, 1998, 2000, 2008, 2020, 2022; normalized Euclidean distance | Explainable similarity score, but not a validated forecast model |
| FMOS analogs | Separate hardcoded 5-vector fingerprint database | Distinct derived model; must not be represented as the same score as the live Pressure analog |
| Unified historical analogs | `40%` overall-score similarity + `40%` five-subscore similarity + `20%` 10Y similarity, with defaults for missing data | Separate legacy-history model; uses unreconciled legacy values and neutral defaults |
| Daily Seismograph analogs | Score within ±15 plus regime-match bonus; fixed outcome labels and return figures by stress bucket | **HIGH** concern: displayed outcomes are not query-derived outcomes from the historical rows |

All active analog models can be used as *retrospective feature-set comparisons* only. No current analog score establishes the probability, timing, or magnitude of a future move.

## Probability Systems

There is no single calibrated probability model across the platform.

| Output | Current construction | Defined event / horizon? | Calibration status |
|---|---|---|---|
| FMOS bull / neutral / bear | Formula driven by Pressure, Credit, evidence diversity, contradiction count, shifts, and neutral shrinkage | No explicit market-outcome event or horizon in the output contract | **Uncalibrated heuristic** |
| FMOS transition probability | Boundary distance, rising-vector count, vector dispersion; scaled to “30 days” | Horizon named; event rule not registered with outcomes | **Uncalibrated heuristic** |
| Unified three-way and five-way probabilities | Score bands plus evidence-family adjustments; deterministic normalization | Scenario labels exist; outcome definitions/horizons not registered | **Uncalibrated heuristic** |
| Seismograph packet probabilities | Percentage of bullish/bearish evidence packets; neutral is residual | No event or outcome horizon | **Evidence composition**, not a validated forecast probability |
| Daily state transition probabilities | Base `70/15/10/5` values modified by score/direction/streak; sample size only affects confidence | No locked outcome event/horizon | **Uncalibrated heuristic** |

`bull`, `bear`, `crash`, `recession`, and transition values should be treated as **FAULTLINE scenario scores / derived distributions**, not likelihood estimates, until each is linked to an event definition, horizon, sample selection, calibration curve, and monitored out-of-sample record.

## Reproducibility and Versioning

The core historical research has strong versioning: frozen formula IDs/hashes, source registries, policy versions, dataset checksums, append-only outcomes, and validation-run records. Forward live Champion provenance also includes a formula hash.

The production synthesis stack is only partially versioned. `pressureRuns.engineVersion` is a manual string (`1.0.0`); FMOS has `FMOS_VERSION = 1.0.0`; canonical Seismograph payload has version `2.0`; and derived probability/analog/trend logic is not represented by a unified model version manifest. Therefore a full current-state replay may identify the core formula but not necessarily every downstream derived-output rule.

## Required Minimum Versioning Structure

Before Early Warning Intelligence, retain the existing Champion formula hash and add a minimal immutable manifest that links: `champion_formula_version`, `engine_logic_version`, `probability_model_version`, `analog_model_version`, `trend_pattern_version`, `canonical_state_version`, source availability state, and observation timestamp. This is a governance repair, not a request to build a major version-management system in Phase 1.

## Severity and Repair Classification

| Finding | Severity | Repair class |
|---|---|---|
| Scenario and transition percentages lack registered event/horizon/calibration contracts | **CRITICAL** | MUST FIX BEFORE PHASE 2 |
| Daily Seismograph analog and pattern outcome figures are fixed heuristics rather than query-derived historical outcomes | **CRITICAL** | MUST FIX BEFORE PHASE 2 |
| Multiple analog systems use non-equivalent similarity math but share consumer-facing vocabulary | **HIGH** | MUST FIX BEFORE PHASE 2 |
| Trend / persistence / acceleration criteria are defined but lack historical early-warning validation | **HIGH** | SHOULD FIX BEFORE EARLY WARNING DETECTION |
| Production derived-stack versioning is incomplete | **HIGH** | SHOULD FIX BEFORE EARLY WARNING DETECTION |

## Evidence

`server/fmos/engines/regime.ts`, `server/fmos/engines/probability.ts`, `server/fmos/utils.ts`, `server/seismographEngine.ts`, `server/seismographCore.ts`, `server/seismographUnified.ts`, `server/pressure/engine.ts`, and `RECONSTRUCTED_CHAMPION_V1_METRICS.json`.
