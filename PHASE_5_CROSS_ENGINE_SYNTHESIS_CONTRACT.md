# Phase 5 — Governed Cross-Engine Synthesis Contract

## Contract Purpose

`phase5-cross-engine-synthesis-v1` creates a deterministic, machine-readable bridge between Phase 2 canonical state and later intelligence consumers. It **does not** calculate an Early Warning score, declare a warning lifecycle state, rank warnings, or authorize a forecast probability.

```text
phase2-canonical-state-v1
  → phase3-evidence-contract-v1 EvidencePacket
  → phase5-cross-engine-synthesis-v1 CrossEngineSynthesis
  → ASHA / Oracle / current-state API / immutable material-change archive / admin debug
```

The authoritative implementation is `shared/crossEngineSynthesis.ts` and `server/crossEngineSynthesis.ts`.

## State Lock and Provenance

Every `CrossEngineSynthesis` retains `synthesisId`, `originatingStateId`, `originatingEffectiveAt`, `generatedAt`, `modelVersion`, `configurationVersion`, `inputSnapshotId`, `supportingClaimIds`, historical claim IDs, quality, limitations, and deterministic contract provenance. `buildCrossEngineSynthesis()` rejects a packet whose canonical state ID differs from the input state.

## Normalized Engine Observation

`CrossEngineObservation` preserves each engine’s own unit and state. It never normalizes a credit, liquidity, breadth, or volatility value into a fake common score. Availability is explicit: `AVAILABLE`, `DEGRADED`, `STALE`, or `UNAVAILABLE`; an unavailable engine is never neutral and a stale engine is excluded from current confirmation.

## Relationships, Confirmations, and Divergences

Relationships are deterministic pairs of usable engine observations: `ENGINE_DIRECTION_ALIGNMENT` or `ENGINE_DIRECTION_DIVERGENCE`. Every relationship contains participating engines, state-locked times, supporting claim IDs, quality, evidence strength, overlap classification, and limitations.

Confirmation is allowed only for an explicit alignment with at least two evidence claims and `INDEPENDENT` sources. `PARTIALLY_OVERLAPPING`, `HIGHLY_OVERLAPPING`, and `UNKNOWN` relationships are not independently confirming. Confirmation strength is qualitative (`LIMITED` or `MODERATE`) and is never a probability.

Divergence is a structured candidate object with participating engines and provenance only. It is not an Early Warning state, score, qualification, or promotion.

## Evidence Independence

Independence uses declared canonical engine source input IDs. No shared input means `INDEPENDENT`; complete shared source coverage means `HIGHLY_OVERLAPPING`; partial intersection means `PARTIALLY_OVERLAPPING`; missing source identity is `UNKNOWN`. The service documents overlap instead of double-counting shared credit or transformed inputs.

## Summary, Conflict, and Change

The summary has only these conclusions: `ALIGNED`, `MIXED`, `CONFLICTED`, `INSUFFICIENT_CROSS_ENGINE_EVIDENCE`, and `NO_MATERIAL_CROSS_ENGINE_ALIGNMENT`. Conflict remains conflict. The deterministic summary supplies dominant relationships, confirmed alignments, divergences, state deltas where a prior synthesis is supplied, data quality, and limitations.

`persistCrossEngineSynthesis()` stores the latest synthesis and sends only material state-to-state events to the existing immutable institutional archive: conclusion change, divergence emergence/resolution, dominant driver change, or quality degradation. It does not emit routine alerts for trivial changes and does not create a warning lifecycle.

## Consumer Rules

ASHA and Oracle build exactly one Phase 5 synthesis from the same canonical public state and Phase 3 packet used by their Phase 4 interpretation transaction. `buildCrossEngineSynthesisPromptContract()` supplies only structured relationships and explicitly forbids invented confirmation, divergence, causality, probability, warning state, or Early Warning conclusions. Both response integrity objects retain the consumed synthesis and originating state IDs.

The public endpoint is `marketState.synthesisCurrent`. Raw relationship/source/debug internals are available only to `admin.getCrossEngineSynthesisDebug`.
