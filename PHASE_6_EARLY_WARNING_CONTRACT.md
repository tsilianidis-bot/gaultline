# Phase 6 — Early Warning Intelligence Contract

## Scope and Authority

`phase6-early-warning-intelligence-v1` is a deterministic, **state-locked prioritization layer** built only from a single Phase 5 `CrossEngineSynthesis` object. It does not query or reconstruct raw engine state independently. Its candidate and warning records retain the originating `synthesisId`, canonical `stateId`, effective time, governed claim IDs, quality, freshness, and limitations.

> **An Early Warning Score is a priority score, not a probability, price target, return estimate, recession probability, or forecast.**

| Control | Implemented rule |
|---|---|
| Input authority | One governed `CrossEngineSynthesis` with Phase 2 canonical provenance |
| Candidate type | `CROSS_ENGINE_DIVERGENCE` only; no headline, analogy, single-indicator, or LLM-created warning |
| Output count | At most three qualified material warnings; zero is normal and explicitly rendered |
| State binding | Candidate, API, archive observation, ASHA, and Oracle all retain the same state and synthesis IDs |
| Narrative authority | ASHA and Oracle may describe only supplied qualified warning objects; neither may infer a warning from raw metrics |
| Original history | Original warning payload is immutable; later observations are append-only |

## Deterministic Score Components

| Component | Range | Current governed rule |
|---|---:|---|
| Magnitude | 0–15 | Only the structured Phase 5 divergence magnitude; unavailable is `0` and prevents qualification |
| Acceleration | 0–10 | Only the structured Phase 5 divergence acceleration; unavailable is `0` |
| Persistence | 5 or 25 | `NEW = 5`; `PERSISTING = 25` |
| Historical lead strength | 0 | Explicitly unavailable until a separate governed historical-lead study exists |
| Cross-engine confirmation | 0 or 15 | Fifteen only for an independent Phase 5 confirmation involving the candidate engines |
| Systemic importance | 0 or 25 | Twenty-five for a multi-engine relationship |
| Novelty | 5 or 20 | `PERSISTING = 5`; `NEW = 20`; novelty alone never qualifies a warning |
| Data confidence | 0, 10, or 20 | Based on availability, freshness, degradation, and Phase 5 independence |

## Qualification and Lifecycle

Qualification requires **independence**, acceptable freshness, non-insufficient evidence quality, a governed magnitude of at least `10`, `PERSISTING` state, and a composite score of at least `70`. This deliberately withholds current relationships whose Phase 5 synthesis does not supply a governed magnitude.

| Lifecycle | Governed transition |
|---|---|
| `EMERGING` | First qualified warning |
| `DEVELOPING` | Persistent warning score increases from its prior governed observation |
| `CONFIRMING` | Independent confirmation exists and the score is at least 85 |
| `ELEVATED` | Persistent score is at least 90 |
| `FADING` | A previously active relationship remains but no longer qualifies or weakens |
| `INVALIDATED` | The active relationship is absent from the next state-locked Phase 5 synthesis |

## Persistence and Public Boundaries

`earlyWarnings` preserves immutable original evidence alongside a current lifecycle pointer. `earlyWarningObservations` is append-only and records detection, lifecycle changes, fading, invalidation, score changes, and later observations. Each observation also writes an immutable institutional-memory event keyed by warning ID and synthesis ID.

The current evaluation is exposed only at `marketState.earlyWarningsCurrent`; per-warning append-only history is exposed by `marketState.earlyWarningHistory`. The canonical HOME dashboard uses these endpoints directly. The scheduled Seismograph pipeline calls Phase 6 only after persisting the exact Phase 5 synthesis for its canonical run.
