# Phase 2 Canonical State Audit

## Repository-Grounded Dependency Map

| Surface | Current source | Divergence boundary | Phase 2 status |
|---|---|---|---|
| NOW | `EngineContext` → `marketState.current`, plus direct `pressure.getCurrentPressure` for change | Direct pressure query can differ from the rendered legacy projection | **MUST MIGRATE** |
| WHY | `EngineContext` legacy market state plus projected output fallback | Canonical-first selection still permits projected fallback | **MUST MIGRATE** |
| WATCH | `EngineContext` legacy market state plus projected output fallback | Monitoring fields can be filled from projection | **MUST MIGRATE** |
| ASHA / Oracle | `AshaPanel` composes context from `output` | No `state_id` or claim/analog reference is carried into the prompt context | **MUST MIGRATE** |
| Outlook / Daily Story | `routers/outlook.ts` independently collects analysis inputs | Forecast Horizon protects output timing, but does not yet supply canonical state identity | **MUST MIGRATE** |
| Market Context | `EngineContext` plus direct assembled Seismograph query | Mixed current output paths | **CAN MIGRATE LATER, but source is known** |
| Scheduled Seismograph | Frozen Champion plus Seismograph core → append-only governance manifest | Canonical source candidate; Phase 1B resolved the former score/regime replacement | **AUTHORITATIVE MANIFEST SOURCE** |
| Legacy `marketStateService` | Unified Seismograph cached legacy projection | Does not expose Phase 2 state ID, governed claim references, per-engine provenance, or append-only manifest identity | **COMPATIBILITY ADAPTER ONLY** |

The earlier parallel inventory was excluded because it named paths and infrastructure not present in this repository. This document uses direct repository evidence only.

## Phase 2 Canonical Contract Implemented

`shared/canonicalIntelligenceState.ts` defines the additive `phase2-canonical-state-v1` contract. `server/canonicalIntelligenceState.ts` reads the latest append-only Phase 1B `intelligenceStateManifests` record and produces an authoritative state with immutable identity, versions, governed claim and analog IDs, per-engine state, data-quality propagation, conflicts, historical context labels, and a public-safe projection.

`trpc.marketState.canonicalCurrent` is the authoritative read interface. It never recalculates Champion, substitutes a pressure score, merges reconstructed research with live state history, or promotes V3-H.

## Phase 2 Gate Status

**PHASE 2 REMAINS BLOCKED.** The canonical service and contract now exist and are test-covered, but the primary consumer migrations required by the brief are not complete. NOW, WHY, WATCH, ASHA, Oracle, and Outlook still read legacy or mixed projections. A Phase 2 pass would be inaccurate until those consumers use the canonical state ID and canonical fields without independent core-state construction.

## Failure and Quality Policy

The service returns no canonical state if no append-only manifest exists. It exposes `COHERENT`, `DEGRADED`, or `UNAVAILABLE` provenance based on the immutable source manifest. Unavailable inputs, fallback inputs, and mismatch notes become structured conflicts; optional unavailability remains explicit and can leave a state usable, while fallback or engine mismatch degrades it. Acceleration and persistence remain null rather than inferred.
