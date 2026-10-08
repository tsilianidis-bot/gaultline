# FAULTLINE Hypothesis Ledger — Foundation Contract
Date: 2026-10-08
Status: Design contract; not deployed

## Purpose
Create an append-only, independently evaluable record of market hypotheses. This layer must not alter Champion V1 Pressure Index, regime confirmation, Daily Brief, blog, market tools, pricing, or production routes.

## Immutable original hypothesis
Every hypothesis receives a UUID, versioned rule identifier, creation timestamp (UTC), as-of timestamp of each input, asset/universe, event definition, observation frequency, horizon/deadline, baseline/reference value, outcome threshold, source snapshot IDs, data freshness, rationale, confirmation criteria, invalidation criteria, and status CREATED.

The prediction must be operationally falsifiable: e.g. 'S&P 500 experiences a peak-to-trough drawdown >=7% within the next 30 calendar days' with a pre-specified reference high, price series, corporate-action convention, market calendar, and evaluation procedure. Do not conflate endpoint return with maximum drawdown.

## Append-only events
CREATED, EVIDENCE_ADDED, EVIDENCE_CONTRADICTED, DATA_GAP, RULE_REVISION_PROPOSED, SUPERSEDED, OUTCOME_EVALUATED, OUTCOME_CORRECTED. No event may overwrite the original thesis. Each event includes timestamp, source IDs, actor/version, and reason. Corrections append new records referencing the superseded evaluation.

## Lifecycle
DRAFT -> ACTIVE -> CONFIRMED / INVALIDATED / EXPIRED / INCONCLUSIVE.
CONFIRMED means the pre-registered event criterion occurred, not that the reasoning was correct. INVALIDATED means the pre-registered invalidation condition occurred. EXPIRED means the window closed without the predicted event. INCONCLUSIVE means evidence is insufficient to adjudicate. Do not count inconclusive cases as successes.

## Initial hypothesis families
1. Equity drawdown threshold within a fixed window.
2. Volatility expansion threshold within a fixed window.
3. Governed regime transition within a fixed window.

## Measurement
Publish denominators, event hit rate, false alarms, misses, lead time, coverage, data gaps, and outcome definitions. Compare against predeclared naive/historical baselines using strictly forward-only, out-of-sample evaluation. No numeric confidence or probability until calibrated and validated. Keep reasoning quality separate from event accuracy.

## Data integrity and guardrails
- Snapshot source timestamps, observed timestamps, ingestion timestamps, revisions, freshness, and immutable source references.
- Prevent lookahead leakage: only inputs available at the creation time are eligible for the original prediction.
- Use idempotent ingestion keys, UTC timestamps, atomic writes, and retention policy.
- Exclude synthetic/demo data from live performance claims.
- Backfill is marked retrospective and excluded from prospective performance.
- No automatic public-facing performance claims or trading directives.
- Feature-flagged and isolated from canonical scoring.
- Require unit tests for threshold boundary, time expiry, missing data, revised data, duplicates, and no-lookahead.
- First release is a shadow ledger only, without user-facing surfaces.

## Acceptance criteria for implementation PR
1. Migration and types implement immutable originals and append-only events.
2. Deterministic evaluation tests pass, including missing data and late corrections.
3. Existing scoring, Five Questions, Daily Brief, blog, and trading tools unchanged.
4. No production deploy without separate explicit approval.
