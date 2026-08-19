# Historical Pressure Index Formula Inventory

## Scope and Evidence Status

This inventory records every distinct pressure-scoring implementation recovered from the active repository, reachable Git history, database schema, historical records, and reachable archival artifacts as of **2026-08-19**. It is a provenance document, not a production formula change.

> **Recovery conclusion:** The exact generator that created the 317-row `pressureHistory` batch has **not been recovered**. The historical score batch was inserted at one timestamp, its generating source is absent from the reachable repository and Git object set, and its results cannot be recreated with the current V1 formula.

| Formula ID | Scope | Status | Evidence | May be treated as historical generator? |
|---|---|---|---|---|
| `PRESSURE_V1_CURRENT` | Live Pressure Index | Recoverable | `server/pressure/engine.ts`, `server/pressure/championBaseline.ts` | **No.** It reproduces only 14 of 317 stored months. |
| `PRESSURE_V3H_SHADOW` | Shadow comparator | Recoverable | `server/pressure/shadowEngine.ts` | **No.** It was introduced after the historical batch and remains shadow-only. |
| `SEISMOGRAPH_BACKFILL_DERIVATION` | Downstream monthly-to-daily conversion | Recoverable | `server/seismographBackfill.ts` | **No.** It reads stored scores and derives display fields; it never generates them. |
| `TRACK_RECORD_HISTORICAL_BATCH_UNVERSIONED` | 317 monthly rows, 2000-01 through 2026-05 | Not recovered | `pressureHistory`; table introduced at `ab4fdc7` | **Unknown.** This is the only candidate responsible for the stored Track Record. |
| `REDESIGN_RESEARCH_CONTRACT` | Offline research only | Recoverable | `server/pressure/redesignResearch.ts` | **No.** It has no active score or weights. |

## Recovered Observed-V1 Audit Baseline

The observed-V1 audit baseline uses six vector inputs: liquidity stress, credit contagion, volatility regime, macro sensitivity, market breadth, and AI/speculation stress. It is a continuous weighted composite whose formula and formula hash are recorded by the forward-only provenance ledger. This auditable baseline is distinct from the unrecovered historical batch generator.

| Component | Current V1 weight | Historical batch column |
|---|---:|---|
| Liquidity stress | 0.20 | `liquidityStress` |
| Credit contagion | 0.20 | `creditContagion` |
| Volatility regime | 0.15 | `volatilityRegime` |
| Macro sensitivity | 0.20 | `macroSensitivity` |
| Market breadth | 0.10 | `marketBreadth` |
| AI/speculation stress | 0.15 | `aiBubble` |

## Historical Batch Recovery Evidence

The `pressureHistory` table was added in commit `ab4fdc7` on 2026-05-26. The migration creates the table but includes **no seed INSERT statements**. The original Track Record page reads rows through `trackRecord.getHistory`; it does not generate them. The searchable current source, reachable Git history, renamed/deleted paths, migrations, scripts, test fixtures, reflogs, and unreachable Git objects contain no recovered historical score generator or documented crisis-amplifier code.

All 317 rows share the same `createdAt` timestamp: **2026-05-26 06:15:48**. This demonstrates that they were inserted as one historical batch rather than accumulated by the live engine. It does not, on its own, establish whether the batch was generated manually, by an external script, or by an unavailable prior workspace.

The preserved task record states only: “Calibrate backfill scoring engine with crisis amplifier (max 82 in Oct 2008).” It does not preserve the formula, triggers, scaling, cap, source snapshot, or code location. It is therefore documentary evidence that an amplifier existed, not enough information to reconstruct it.

## Reconciliation Findings

| Test | Result | Interpretation |
|---|---:|---|
| Observed-V1 exact matches | 14 / 317 | The observed-V1 baseline is not the historical batch formula. |
| Maximum observed-V1 versus stored difference | 30 points | Material version or conditional-logic difference exists. |
| Stored score distribution | 148 months at 62; 34 at 72; 8 at 82 | Strong evidence of buckets, caps, thresholds, or a batch-specific rule. |
| Identical six-vector states with divergent score | 2022-07 = 53; 2022-09 = 51 | Stored vector buckets alone cannot reproduce all batch scores. |
| Historical batch creation | One timestamp for all 317 rows | No formula provenance exists in-row. |

The 2008 records confirm that `creditContagion = 100` and `liquidityStress = 95` were associated with the stored CRITICAL score of 82 in October through December 2008. March 2020 used a stored score of 72 under a distinct vector state. These are observed records, not sufficient evidence to infer an undocumented rule such as “credit plus liquidity above a given threshold equals 82.”

## Required Recovery Artifact

The historical formula can become recoverable only if at least one of the following artifacts is located or supplied:

1. The original external backfill script or notebook.
2. A database dump or staging database from before/at the 2026-05-26 batch insertion.
3. A source bundle or checkpoint archive outside the reachable Git object graph.
4. A documented scoring worksheet containing the amplifier thresholds, caps, and historical source transforms.
5. A formula manifest associated with the initial 317-row upload.

Until then, the required historical status is **`HISTORICAL_BATCH_UNVERSIONED_UNRECONCILED`**. No inferred formula may overwrite, relabel, or retroactively validate the original records.
