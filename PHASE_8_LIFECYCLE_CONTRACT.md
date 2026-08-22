# Phase 8 — Early Warning Lifecycle Contract

**Contract:** `phase8-lifecycle-v1`  
**Model:** `faultline-qualified-candidate-lifecycle` / `1.0.0`  
**Configuration:** `phase8-governance-v1`

## Authority

Phase 8 consumes only immutable Phase 7 `ImportanceQualificationEvaluation` results, which reference immutable Phase 6 candidates, canonical state IDs, and Phase 5 synthesis IDs. LLMs, UI, ASHA, Oracle, social content, and narrative text have no lifecycle authority.

## Active and dormant states

| State | Phase 8 status | Meaning |
|---|---|---|
| `EMERGING` | Active | First governed qualification; insufficient temporal persistence to be established. |
| `DEVELOPING` | Active | Continued governed qualification met the centralized persistence requirement. |
| `FADING` | Active | Structured support has weakened or remained non-qualified under governed temporal rules. It is not invalidation. |
| `ELEVATED` | Dormant | Deferred. Phase 8 does not autonomously enter it. |
| `CONFIRMING` | Dormant | Requires typed Phase 9 authority. |
| `INVALIDATED` | Dormant | Requires typed Phase 9 authority. |
| `RESOLVED` | Dormant | Requires later governed resolution authority. |

## Governance

The persistence requirement is **two qualified observations** to move from `EMERGING` to `DEVELOPING`. Two consecutive governed non-qualifying observations are required to move an established lifecycle to `FADING`; one dip is held as `TEMPORARY_NON_QUALIFICATION`. A qualified lifecycle returning from `FADING` becomes `EMERGING` and must rebuild temporal persistence. These are engineering/governance thresholds, not statistically optimized thresholds, probability, forecast timing, or target guidance.

Missing, stale, unavailable, preliminary, or conflicted input does not escalate a lifecycle. It appends an auditable held-state observation with `DATA_DEGRADED` or `EVIDENCE_CONFLICT`; it does not treat missing evaluation as evidence of fading.

## Immutability and projections

`candidateDetections` remains immutable. `importanceQualificationEvaluations` remains immutable and append-only. `earlyWarningLifecycleObservations` is separate append-only evidence. `earlyWarningLifecycles` is a derived current projection only, updated only when a strictly later observation is accepted. The projection is never the sole historical truth.

## Reason codes

`FIRST_QUALIFICATION`, `CONTINUED_QUALIFICATION`, `PERSISTENCE_REQUIREMENT_MET`, `TEMPORARY_NON_QUALIFICATION`, `NO_LONGER_QUALIFIED`, `DATA_DEGRADED`, `EVALUATION_UNAVAILABLE`, `EVIDENCE_CONFLICT`, `REENTRY_AFTER_FADE`, `OUT_OF_ORDER_IGNORED`, and `DUPLICATE_EVALUATION_IGNORED` are structured transition authority. Narrative prose is not.
