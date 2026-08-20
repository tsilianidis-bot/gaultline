# FAULTLINE Phase 1B — Gate Remediation and Acceptance Closure

**Baseline preserved:** `f430a9ab` reconstructed-research program and `33149d16` Phase 1 audit.  
**Acceptance result:** `ACCEPTED_WITH_PHASE2_BLOCK`.  
**Phase 2 status:** **BLOCKED.**

## Purpose and Boundary

Phase 1B remedied the governance blockers identified by the Phase 1 Core Algorithm Validation audit. It did not recalibrate, redesign, optimize, or promote any model. Frozen Champion V1 remains the canonical pressure calculation; the immutable legacy history remains unchanged; reconstructed history remains separate and research-only; the 26 registered drawdown events and 10-met / 16-missed result remain unchanged; and V3-H remains shadow-only.

## Remediation Delivered

| Gate area | Phase 1B implementation | Evidence |
|---|---|---|
| Numerical claim governance | Added append-only `governedIntelligenceClaims` records and a shared contract distinguishing model probability, historical frequency, analog similarity, evidence confidence, derived scenario score, component, and unsupported value | `PHASE_1B_GOVERNED_CLAIM_CONTRACT.md`; live governance ledger |
| Probability containment | All captured Seismograph bull/neutral/bear and transition values are `UNVERIFIED` derived values with `SUPPRESS_PREDICTIVE_PRESENTATION`; no captured governed claim is predictive-eligible | Acceptance gate; governed claim records |
| Analog governance | Analog similarity remains displayable only with qualification; pattern-outcome values are suppressed from predictive interpretation until immutable original observation and later resolution records exist | Governed claim records; research ledger schema |
| Original versus later outcome separation | Added append-only `governedResearchObservations` and `governedResearchResolutions` tables with a restrictive foreign key | Migration `0062_empty_silver_sable.sql` |
| Per-input quality | Added nine-entry live-quality manifest covering eight FRED-derived inputs plus the static AI concentration baseline, with availability, freshness, fallback, revision, quality, contribution, and claim-eligibility fields | `server/intelligenceGovernance.ts` |
| Atomic current state | Added append-only `intelligenceStateManifests`, state hash, source-input snapshot ID, source-quality summary, governed claim references, dataset IDs, configuration/version IDs, and explicit coherence status | Coherent state `state:2026-08-20T18:10:10.620Z:4f0eb9dd3f512820` |
| Canonical score alignment | Removed both the FMOS substitution and evidence-packet blend that had produced a non-versioned second Pressure Index in the scheduled Seismograph output | `server/scheduledSeismograph.ts`; `server/seismographCore.ts` |
| Claim containment | Contained uncalibrated probability, outcome-rate, historical-warning, and analog-recurrence wording in shared score explanations, synthesis, alerts, share card, homepage showcase, product experience, and the prior crash-probability page | `server/publicClaimContainment.test.ts` |

## Atomic State Result

The final observed coherent manifest records **Pressure Index 27 / MODERATE RISK**, Frozen Champion V1, Seismograph model version 2.0, the frozen scoring version, the Phase 1B governance configuration, 9 input-quality records, 7 governed scenario / transition claim references, 3 qualified analog references, no fallback inputs, no unavailable inputs, five explicitly delayed monthly inputs, and one disclosed static AI baseline.

This is not a claim that all data are real-time or that a scenario is predictive. Its purpose is to make the exact data quality, model identity, and consumer-facing numerical claim status reproducible for one state.

## Acceptance-Gate Result

| Check | Result |
|---|---|
| Coherent append-only atomic state exists | PASS |
| Governed claims exist; predictive-eligible claims equal zero | PASS |
| Analog similarity is qualified rather than outcome probability | PASS |
| Immutable observation / resolution ledger exists | PASS |
| Reconstructed evidence unchanged: 318 complete scores, 2018-03 explicit incomplete state, 26 / 10 / 16 event record | PASS |
| Critical audited shared claims contained | PASS |
| Champion frozen and V3-H shadow-only | PASS |

> **Decision:** Phase 1B governance remediation is accepted. This acceptance does not authorize Phase 2 Early Warning Intelligence.

## Why Phase 2 Remains Blocked

The system now prevents unvalidated outputs from being represented as calibrated forecast probabilities, but it has not created the evidence needed to make those predictions. Phase 2 remains blocked until a separate pre-registered protocol establishes candidate-generation rules, horizons, data requirements, development/validation/holdout partitions, confirmation and invalidation rules, false-alarm policy, outcome definitions, and no-tuning governance. Pattern outcomes also remain suppressed until genuine original observations can be linked to immutable later resolutions.

The queued **Forecast Horizon Standard** will begin next. It must use the same contract: a future-facing magnitude, direction, target, probability, or scenario can have a horizon only when the underlying model supports one. Otherwise it must show that the horizon is not yet established or has insufficient evidence.

## Regression Coverage

Focused Phase 1B tests cover deterministic state hashing, missing/delayed/static input handling, claim semantics, mismatch disclosure, canonical Champion preservation through scheduled and assembly layers, and public-claim containment. The full suite remains required before the Phase 1B checkpoint.

## Internal References

- `PHASE_1B_GOVERNANCE_INVENTORY.md`
- `PHASE_1B_GOVERNED_CLAIM_CONTRACT.md`
- `PHASE_1B_ACCEPTANCE_GATE.json`
- `server/intelligenceGovernance.ts`
- `server/phase1bAcceptanceGate.ts`
- `server/scheduledSeismograph.ts`
- `server/seismographCore.ts`
