# Phase 1 — Historical Dataset Reconciliation

## Determination

FAULTLINE has multiple historical datasets with materially different provenance. They must remain **physically and semantically separate**. The 317-row legacy Track Record is not a historical replay of the frozen Champion V1 model, and the 318-score reconstructed series is not evidence that FAULTLINE warned users at the time.

## Dataset Register

| Dataset | Coverage / count | Formula provenance | Data timing | Appropriate use | Prohibited use |
|---|---:|---|---|---|---|
| Legacy `pressureHistory` | 317 monthly rows, 2000-01–2026-05 | `HISTORICAL_BATCH_UNVERSIONED_UNRECONCILED`; original generator unavailable | Unknown source vintages / release timing | Legacy archive and retrospective reference context | Current Champion validation, point-in-time warning claims, calibration target |
| Verified historical ledger | 36 complete monthly scores, 2023-08–2026-07 | Frozen Champion V1 | Explicit source quality; BAML is revised history | Recent reproducible research and provenance checks | Broad historical inference or point-in-time claim |
| Reconstructed historical ledger | 318 complete scores, 2000-01–2026-07; 2018-03 incomplete | Exact frozen Champion V1 | Revised historical exact credit series plus documented official pre-SOFR proxy; conservative release lag | Retrospective model mechanics, score distribution, discrimination, ablation, descriptive outcomes | Claiming historical live detection, warning, or real-time prediction |
| Daily Seismograph readings / forward provenance | Forward-only operational observations | Current engine snapshot / formula hash where captured | Observed at runtime | Future verified track record, trend/persistence analysis | Historical backfill or retrospective event fabrication |

## Legacy 317-Row Finding

The original legacy batch is unreconciled. The forensic recovery audit found no source generator, seed, workbook, formula manifest, source-vintage manifest, or crisis-amplifier implementation. The only recoverable current V1 formula exactly matched **14 of 317** stored scores; the mean absolute error was **11.97** points and maximum absolute error **30** points. The legacy values are not deleted or rewritten because the evidence supports neither recovery nor correction of that historical process.

The legacy batch's concentrated `62`, `72`, and `82` values, including `82 / CRITICAL` in October 2008 and `72 / HIGH RISK` in March 2020, are preserved observations of an unrecovered historical method. They do not prove a real-time historical warning and must not be represented as current Champion V1 results.

## Reconstructed 318-Score Finding

The reconstructed dataset locks the current frozen V1 formula and applies it retrospectively under a separate policy. It contains one explicit gap: **2018-03**, because the approved primary-dealer repo proxy ended in February 2018 and official SOFR began in April 2018. This gap remains incomplete; it is not interpolated, carried forward, or populated with Fed Funds.

The reconstructed series has a maximum score of **56**, with no High Stress or Systemic Crisis months. This is a property of the frozen formula, its weights, and the locked historical source policy—not evidence that past crises were absent or that the legacy series was false. It explains why the reconstructed series cannot be silently substituted for the legacy archive in consumer-facing historical context.

## Look-Ahead and Outcome Boundaries

The reconstructed builder locks a monthly decision timestamp to the last U.S. business day and uses an explicit conservative lag for CPI, PPI, unemployment, and Fed Funds. It excludes missing inputs rather than using the live engine's runtime constants. Its score construction never uses future outcomes, legacy values, requested crisis values, or later observations.

Outcome analysis is separated from score construction. Only append-only S&P 500 outcome rows marked `DAILY_CONFIRMED_PERIOD_QUERY` may enter reported metrics. Earlier monthly-cadence outcome rows remain audit evidence but are non-evaluable. This design reduces known look-ahead and cadence risks, but cannot upgrade revised/proxy historical inputs into point-in-time evidence.

## Research Verdict Alignment

The protected `f430a9ab` and `RECONSTRUCTED_CHAMPION_V1_METRICS.json` conclusion remains **INCONCLUSIVE**. The reconstruction demonstrated a 45–64 bucket with worse mean forward S&P 500 outcomes, but it warned before only 10 of 26 registered 10% drawdown events under the locked event rule. Relative risk discrimination is not historical early-warning success.

## Evidence

| Evidence | Location |
|---|---|
| Legacy formula recovery / unreconciled status | `HISTORICAL_PRESSURE_INDEX_PROVENANCE_FORMULA_RECOVERY_AUDIT.md` |
| Separate reconstructed policy / source limits | `RECONSTRUCTED_CHAMPION_V1_DATA_POLICY.md` |
| Locked reconstruction metrics | `RECONSTRUCTED_CHAMPION_V1_METRICS.json` |
| Point-in-time research baseline | `VERIFIED_CHAMPION_V1_VALIDATION_REPORT.md` |
