# FAULTLINE Challenger Governance — Current No-Go Decision

> **Decision date:** 2026-08-18  
> **Decision:** **NO PRODUCTION CHALLENGER COMPARISON OR DEPLOYMENT AUTHORIZED**

## Decision Basis

The Champion Baseline audit found three blocking conditions:

| Gate | Current result | Consequence |
|---|---|---|
| Live-versus-stored formula reconciliation | Only 14 of 317 stored monthly scores equal the current V1 weighted composite; maximum difference is 30 points | No valid Champion baseline exists for an A/B performance claim. |
| Point-in-time source integrity | Historical records do not retain FRED/ALFRED source vintages, release dates, SOFR, PPI, or source snapshots | Historical outcomes cannot yet be attributed to information available at the time. |
| Outcome coverage | Stored monthly `sp500` is null for all 317 rows | No false-alarm, drawdown, calibration, or warning-lead comparison can be computed from the stored Track Record alone. |

## V3-H Status

V3-H remains a **shadow-only operational comparator**. Its observed reading history spans 2026-08-17 through 2026-08-18, which is insufficient for forward-outcome performance evaluation. No V3-H weights, thresholds, transformations, or outputs may replace, blend with, or tune Champion behavior under this audit.

## Required Gates Before Any Challenger Test

1. Store a versioned historical Champion formula and reproduce every historical score within a documented tolerance.
2. Retrieve and persist date-aligned ALFRED vintages and release availability for required macro series.
3. Append a separately sourced, date-aligned broad-market outcome series to a new outcome ledger; do not overwrite `pressureHistory`.
4. Define stress outcomes before evaluation, including drawdown horizon, false-alarm policy, warning lead window, and crisis/risk-off classification.
5. Lock a holdout period and run Challenger analysis without subsequent tuning on that holdout.
6. Require no material degradation in stability, explanation quality, transition clarity, or execution reliability before a production recommendation.

## Production Guardrail

No production scoring change is recommended or authorized by the current audit. The next valid implementation is **data provenance and outcome-ledger remediation**, not a Challenger formula change.
