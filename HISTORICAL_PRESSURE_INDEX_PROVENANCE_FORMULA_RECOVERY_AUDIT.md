# Historical Pressure Index Provenance and Formula Recovery Audit

**Author:** Manus AI  
**Audit date:** 2026-08-19  
**Scope:** 317 monthly `pressureHistory` records from 2000-01 through 2026-05  
**Production decision:** **NO CHANGE**

## Executive Determination

The formula that generated FAULTLINE’s original 317-month historical Pressure Index batch has **not been recovered** from all available repository, Git, migration, script, test, document, reachable checkpoint, reflog, and unreachable-object artifacts.

The available evidence does establish that the stored Track Record is not reproducible by the recovered live V1 weighted composite. It also establishes that a “crisis amplifier” was documented as part of the historical backfill work, but the amplifier’s formula, trigger conditions, cap behavior, source snapshot, and code location are not present in recoverable artifacts.

> The historical batch must remain classified as **`HISTORICAL_BATCH_UNVERSIONED_UNRECONCILED`**. No inferred formula may be represented as recovered, and no historical record, current weight, regime threshold, probability, or production score was changed by this audit.

## Forensic Scope

The audit searched the active repository; all reachable Git commits; renamed and deleted paths; migrations; scripts; tests; Markdown and safe-task archives; track-record components; database helpers; reflogs; unreachable Git objects; sandbox archives; and the actual production database metadata. The search included explicit terms for historical pressure generation, seeding, backfill, crisis amplification, conditional weights, thresholds, October 2008, and score `82`.

| Artifact class | Finding | Formula-recovery implication |
|---|---|---|
| `pressureHistory` migration | Table created in commit `ab4fdc7` | Creates schema only; contains no seed data or formula. |
| Original Track Record page | Reads `trackRecord.getHistory` and `trackRecord.getStats` | Display-only; does not calculate historical scores. |
| Database helper | Returns stored rows unchanged | Confirms data consumption, not generation. |
| Seismograph backfill | Converts monthly rows into daily display records | Downstream derivation; does not generate `overallPressure`. |
| Current V1 engine | Recoverable six-vector weighted composite | Not the historical batch formula. |
| V3-H | Recoverable shadow comparator | Post-dates the historical batch; cannot be its generator. |
| Preserved task record | “Calibrate backfill scoring engine with crisis amplifier (max 82 in Oct 2008)” | Confirms an amplifier existed but does not preserve its logic. |
| Git/reflog/unreachable search | No original historical generator, seed, workbook, or formula manifest recovered | Exact batch formula remains unavailable. |

## Formula Version Inventory

| Formula ID | Date / scope | Vectors or behavior | Status | Relationship to historical batch |
|---|---|---|---|---|
| `PRESSURE_V1_CURRENT` | Current live engine / observed audit baseline | Six-vector continuous weighted composite | Recoverable | Does not reproduce the batch. |
| `TRACK_RECORD_HISTORICAL_BATCH_UNVERSIONED` | 2000-01 to 2026-05 monthly batch | Six stored vector columns plus unstored generation behavior | Not recovered | Only candidate responsible for the 317 rows. |
| `SEISMOGRAPH_BACKFILL_DERIVATION` | Later display backfill | Reads stored score, derives presentation fields | Recoverable | Not a score generator. |
| `PRESSURE_V3H_SHADOW` | Current research comparator | Shadow-only alternative | Recoverable | Post-dates batch. |
| `REDESIGN_RESEARCH_CONTRACT` | Current offline research | No active weights or output | Recoverable | Cannot generate legacy rows. |

### Recovered V1 Formula

The recoverable observed-V1 baseline is:

```text
round(
  0.20 × liquidityStress +
  0.20 × creditContagion +
  0.15 × volatilityRegime +
  0.20 × macroSensitivity +
  0.10 × marketBreadth +
  0.15 × aiBubble
)
```

Its regime boundaries are `>=80` Systemic Crisis, `>=65` High Stress, `>=45` Elevated Risk, `>=25` Moderate Risk, and otherwise Low Risk. These recovered V1 labels are not assumed to be the labels or thresholds used by the unrecovered historical batch.

## Historical Batch Provenance

All **317** monthly `pressureHistory` rows share a single database insertion timestamp: **2026-05-26 06:15:48**. This is consistent with one batch import. It proves neither manual entry nor a particular external script, but it confirms that the records were not accumulated by the current daily live engine.

The batch retains six derived vector scores and selected raw macro fields. It does not retain:

| Missing provenance field | Consequence |
|---|---|
| Historical formula version / hash | Cannot select a unique score computation. |
| Weight manifest | Cannot determine whether historical weights differ from V1. |
| Amplifier trigger and scale | Cannot recreate the documented 2008 amplification. |
| Threshold and cap manifest | Cannot determine whether 62/72/82 values are buckets, caps, or rounded outputs. |
| Source vintages / release timestamps | Cannot establish what was known at each historical month-end. |
| SOFR and PPI inputs | Cannot replay the current raw-input engine. |
| Market outcome series | Cannot evaluate warnings, calibration, false alarms, or lead time. |

## Reconciliation Results

The only fully recoverable formula, observed V1, was recalculated against all 317 stored rows from the six stored vector values.

| Metric | Result |
|---|---:|
| Records tested | 317 |
| Exact score matches | 14 |
| Within 1 point | 82 |
| Within 2 points | 115 |
| Within 5 points | 126 |
| Mean absolute error | 11.97 points |
| Maximum absolute error | 30 points |
| Raw-input-defensible monthly replays | 0 |
| Regime-agreement metric | Not meaningful without recovered historical thresholds and labels |

The stored score distribution is concentrated: **148** rows are exactly `62`, **34** are exactly `72`, and **8** are exactly `82`. This is consistent with thresholding, bucket assignment, caps, conditional amplification, or a batch-specific method absent from V1. It is not evidence for a particular inferred rule.

## Crisis-Episode Evidence

The following records are retained observations from the historical batch:

| Month | Stored score / regime | Liquidity | Credit | Volatility | Macro | Breadth | AI/speculation | Finding |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 2008-10 | 82 / CRITICAL | 95 | 100 | 14 | 40 | 72 | 20 | First stored 82 CRITICAL observation. |
| 2008-11 | 82 / CRITICAL | 95 | 100 | 14 | 5 | 72 | 20 | Same score despite a materially changed macro vector. |
| 2008-12 | 82 / CRITICAL | 95 | 100 | 28 | 5 | 72 | 20 | Same score despite changed volatility vector. |
| 2020-03 | 72 / HIGH RISK | 85 | 88 | 14 | 5 | 22 | 20 | Different crisis state, lower stored bucket. |

The preserved task record’s “crisis amplifier” note is consistent with the 82 ceiling, but no recovered source defines the rule. The audit therefore does **not** infer that credit at 100 plus liquidity at 95 mechanically produces 82.

The historical vector table is also not entirely sufficient by itself: July 2022 and September 2022 share identical six stored vector scores (`50`, `55`, `60`, `82`, `8`, `20`) but have stored overall scores of **53** and **51**, respectively. Their raw macro values differ. This shows that either unstored/raw inputs, non-vector logic, time-sensitive transforms, rounding behavior, or batch-generation logic affected the output. It rejects any claim that the six stored vector buckets alone uniquely reproduce every historical score.

## Formula Change and Gap Explanation

| Observed gap | Evidence-bound explanation | What cannot be claimed |
|---|---|---|
| V1 fails to reproduce 303 monthly scores exactly | V1 is a different version from the historical batch formula or method | That the batch is erroneous or fabricated. |
| 82 CRITICAL 2008 values | A documented-but-unrecovered crisis amplifier or cap may have operated | Exact trigger, multiplier, cap, or source transform. |
| 62 / 72 / 82 score concentration | Thresholding, bucketization, caps, or manual batch rules may have existed | Which of those mechanisms actually applied. |
| Identical vector state with 53 vs 51 score | Additional raw inputs or time-sensitive behavior influenced results | A unique formula from the vector table alone. |
| No point-in-time vintages | Historical observations may use revised data | That the Track Record is a point-in-time backtest. |

## Required Recovery Path

The formula-recovery effort can advance only with an original artifact: an external generator/notebook, pre-import database dump, lost source bundle, formula worksheet, archived checkpoint outside the reachable Git object graph, or a manifest associated with the 2026-05-26 import.

If an artifact becomes available, the next audit must lock the recovered formula as `HISTORICAL_TRACK_RECORD_Vx`, run all 317 months with exact/tolerance/error/regime metrics, compare 2008/2020 episode outputs, capture source-vintage availability, and append—never overwrite—a reconciliation record for every original row.

## Production Recommendation

No production model change is justified by this recovery audit. The live Champion, V3-H shadow, historical Track Record rows, regime labels, and public probability logic remain unchanged. Historical language must continue to identify the batch as retrospective and unreconciled to the current formula.
