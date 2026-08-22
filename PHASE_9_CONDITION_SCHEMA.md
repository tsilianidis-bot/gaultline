# Phase 9 Condition Schema

`ConditionRule` and `ConditionEvaluation` are defined in `shared/confirmationInvalidation.ts`. Each evaluation is append-only and carries `stateId`, `synthesisId`, candidate/lifecycle/plan/thesis identity, condition rule, observed structured value, quality, evidence strength, independence, claim IDs, rule/config versions, and limitations.

| Primitive | Current source | Meaning | Safe unavailable behavior |
|---|---|---|---|
| `THRESHOLD_ABOVE` | Phase 5 divergence magnitude | Tests expansion against the confirmation governance threshold | `UNEVALUABLE`; no authority |
| `THRESHOLD_BELOW` | Phase 5 divergence magnitude | Tests normalization against the invalidation governance threshold | `UNEVALUABLE`; no authority |
| `PERSISTENCE_MET` | Phase 5 divergence persistence | Requires governed `PERSISTING`, not a score or narrative claim | `NOT_MET`; no authority |
| `COMPOSITE_AND` | Plan aggregation | Requires every condition in the relevant rule set | Any unavailable/insufficient element blocks authority |

Data must be `HEALTHY`, evidence strength at least `MODERATE`, and evidence independence `INDEPENDENT`. Missing, stale/degraded, unavailable, overlapping, conflicted, or evaluation-error input is not treated as confirmation or invalidation evidence.
