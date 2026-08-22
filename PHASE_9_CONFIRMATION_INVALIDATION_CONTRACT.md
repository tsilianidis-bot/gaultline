# Phase 9 Confirmation & Invalidation Contract

## Authority

The authoritative machine-readable contract is `shared/confirmationInvalidation.ts` (`phase9-confirmation-invalidation-v1`). The runtime authority is `server/confirmationInvalidation.ts`. Phase 9 consumes only the immutable Phase 6 candidate, Phase 7 qualification, Phase 8 lifecycle identity/state, and current structured Phase 5 divergence evidence.

> Confirmation is a governed structural thesis-support event. Invalidation is a governed structural thesis-contradiction event. Neither is a probability, forecast, target, outcome, resolution, or public alert.

| Field | Governing value |
|---|---|
| Model ID | `faultline-structural-thesis-condition-engine` |
| Model version | `1.0.0` |
| Configuration version | `phase9-governance-v1` |
| Rule-set version | `cross-engine-divergence-rules-v1` |
| Candidate template | `CROSS_ENGINE_DIVERGENCE` only |
| Minimum confirmation lifecycle | `DEVELOPING` |
| Quality gate | `HEALTHY` canonical quality |
| Evidence-strength floor | `MODERATE` |
| Evidence independence | `INDEPENDENT` |
| Conflict precedence | `CONFLICTED_CONDITIONS_NO_AUTHORITY_EVENT` |

The implementation deliberately returns `NO_GOVERNED_CONFIRMATION_PLAN` for any future candidate type without an explicit template. LLMs cannot create or alter theses, plans, conditions, results, or authority events.

## Lifecycle authority boundary

Phase 8 remains lifecycle authority. Phase 9 writes typed `CONFIRMATION_AUTHORIZED` or `INVALIDATION_AUTHORIZED` events. Phase 8 consumes those events only through `consumePhase9LifecycleAuthority()`. `CONFIRMING` is non-terminal; `INVALIDATED` is terminal for its lifecycle episode. `ELEVATED` and `RESOLVED` remain dormant.
