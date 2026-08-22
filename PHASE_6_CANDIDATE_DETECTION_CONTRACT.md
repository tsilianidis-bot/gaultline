# Phase 6 Candidate Detection Contract

## Scope

Phase 6 deterministically detects potentially meaningful **candidate observations** from the already-governed Phase 2 canonical state, Phase 3 evidence contract, and Phase 5 structured cross-engine synthesis. It does not score importance, qualify, rank, publish, present, track warning lifecycle, confirm, invalidate, forecast, or generate social content.

> `CANDIDATE ≠ QUALIFIED WARNING`

## Authoritative Modules

| Responsibility | Module |
|---|---|
| Shared machine-readable contract | `shared/candidateDetection.ts` |
| Deterministic evaluator and internal persistence | `server/candidateDetection.ts` |
| Single global scheduled invocation | `server/scheduledSeismograph.ts` |
| Protected candidate diagnostics | `server/routers/admin.ts` → `admin.getCandidateDetectionDebug` |

## Source Authority

```text
phase2-canonical-state-v1 + Phase 3 evidence + Phase 5 CrossEngineSynthesis
→ deterministic Phase 6 detector → structured candidate observations
```

The detector consumes only `CrossEngineSynthesis` structured relationships/divergences. It does not parse LLM prose, ASHA/Oracle output, rendered UI, generic summaries, analog text, or historical reconstruction.

## Candidate Gate

The only active detector category is `CROSS_ENGINE_DIVERGENCE`. It emits a candidate only when the Phase 5 divergence is independent, fresh, evidence-sufficient, materially measured (`magnitude >= 10`), and persistent. Failure returns no candidate; unavailable data is not converted into zero, neutral, healthy, probability, target, timing, or forecast output.

## Explicitly Absent Later-Phase Semantics

`compositeWarningScore`, qualification, ranking, top-three selection, publication, lifecycle state, confirmation conditions, invalidation conditions, public warning API, public warning UI, ASHA warning presentation, and Oracle warning presentation are absent from active Phase 6 paths. Later-phase prototype work remains recoverable from checkpoint `31d051a6` but is intentionally absent from the active Phase 6 implementation.
