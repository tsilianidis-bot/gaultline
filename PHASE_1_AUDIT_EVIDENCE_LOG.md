# Phase 1 Core Algorithm Validation — Evidence Log

## Evidence Discipline

Only repository files, live database reads, reproducible scripts, focused tests, and prior source-cited research artifacts count as Phase 1 evidence. A parallel collection attempted on 2026-08-19 returned non-project paths and a false assertion that the repository was unavailable. **All eight parallel outputs are excluded as invalid evidence** and are not used in findings, scores, or repairs.

## Confirmed Baseline Findings

| ID | Status | Severity | Evidence |
|---|---|---|---|
| P1-E-001 | CONFIRMED | HIGH | `server/pressure/engine.ts` contains the live six-vector Champion/Pressure calculation. It uses fixed linear maps, named static constants, exact weights of 20% / 20% / 15% / 20% / 10% / 15%, deterministic rounding, and thresholds of 25 / 45 / 65 / 80. |
| P1-E-002 | CONFIRMED | HIGH | The live engine uses per-input fallback constants whenever an individual fetched FRED value is null (`hy=283`, `10Y=4.61`, `2Y=4.07`, `SOFR=3.53`, `CPI=3.4`, `PPI=2.8`, `Fed Funds=5.25`, `UNRATE=4.1`), even if a partial FRED response was classified as live. This differs from the no-fallback research policy and requires explicit production-impact assessment. |
| P1-E-003 | CONFIRMED | MEDIUM | The live AI/Speculation vector contains a static concentration score of 65 and reports a permanently `rising` trend. The static status is disclosed in the vector payload. |
| P1-E-004 | CONFIRMED | HIGH | `server/seismographUnified.ts` treats missing historical sub-scores stored as zero as a neutral 50 sentinel, and for the latest incomplete row replaces each missing family score with the preceding row. This is explicit but means `UNAVAILABLE`, `NEUTRAL`, and prior-value carry-forward are not fully distinct in downstream unified intelligence. |
| P1-E-005 | CONFIRMED | HIGH | The canonical scheduled output preferentially uses FMOS pressure/regime/analogs and fallback transition probabilities while the unified historical synthesis reads legacy `pressureHistory`. These are legitimate distinct models only if their provenance is surfaced consistently. `server/scheduledSeismograph.ts` lines 201–303. |
| P1-E-006 | CONFIRMED | HIGH | Unified Seismograph scenario probabilities are deterministic heuristic functions of score and evidence-family states, with hardcoded starting values and no demonstrated calibration contract. `server/seismographUnified.ts` lines 615–669. |
| P1-E-007 | CONFIRMED | MEDIUM | The live engine’s historical analogs use hand-authored fingerprints and normalized Euclidean distance; the unified historical analog model uses a separate score/sub-score/10Y similarity formula. Both are defined but must be labeled as distinct model types. |
| P1-E-008 | CONFIRMED | MEDIUM | Canonical MarketState is a consumer transformation of Unified Seismograph with cache/retry and explicit stale-if-error status. It does not independently recompute Pressure. `server/marketStateService.ts`. |
| P1-E-009 | OBSERVED | MEDIUM | The latest observed live run at `2026-08-20 16:08:08` was V1 `27 / MODERATE RISK` with all eight FRED series retrieved. Macro and breadth were appropriately marked delayed, and AI/Speculation was marked static. The persisted engine version was still the manual label `1.0.0`; its score provenance has a stronger formula-hash path separately. |

## Protected Findings

The existing `f430a9ab` reconstructed-history verdict remains **INCONCLUSIVE**. No Phase 1 evidence above changes that conclusion. Risk discrimination and historical early-warning performance remain separate claims.
