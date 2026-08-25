# Phase 3 — Interpretation Integrity / Evidence Contract

## Governing Rule

> Every material intelligence claim must be traceable to its evidence class, source, canonical state, methodology, and governance status.

The authoritative implementation is `shared/evidenceContract.ts`. It is additive to — and does not replace — the Phase 2 canonical state contract.

## Evidence Classes

| Class | Meaning | Required provenance | Prohibited conversion |
|---|---|---|---|
| `OBSERVED` | Directly sourced market, macro, engine, or manifest fact | source IDs, source type, source time, canonical state for current claims | Inference presented as direct fact |
| `DERIVED` | Deterministic computation from observations | dependency claim IDs, methodology ID/version, canonical state | Prediction merely because arithmetic was used |
| `HISTORICAL` | Governed historical or research evidence | dataset, methodology, period, event definition, sample size when applicable | Historical frequency or analog similarity becoming current probability |
| `INTERPRETED` | Evidence-bounded explanation or synthesis | supporting claim references and canonical state for current interpretation | Invented data, timing, causality, confirmation, or forecast |
| `FORECAST` | Future-oriented model output | complete `ForecastAuthorization` contract and canonical state | Forecast without authorization |

## Semantic Separation

`MODEL_PROBABILITY`, `HISTORICAL_FREQUENCY`, `SCENARIO_SCORE`, analog similarity, model confidence, evidence strength, and data quality are separate types/fields. They are never interchangeable percentages.

`EvidenceStrength` uses categorical vocabulary: `PRELIMINARY`, `MODERATE`, `STRONG`, and `VERY_STRONG`. It measures evidentiary support, not generic AI confidence or input freshness. Data quality remains a separate field.

## Validation and Withholding

`validateEvidenceClaim()` centrally validates class-specific requirements. Invalid claims return governed `INVALID`, `WITHHELD`, `DEGRADED`, `UNAVAILABLE`, or `INSUFFICIENT_EVIDENCE` outcomes rather than silently becoming valid.

`withholdUnsupportedForecast()` creates an explicit interpreted withholding: **“No governed forecast available. Insufficient evidence for a reliable estimate.”** It removes numerical probability, target, horizon, and forecast-contract fields.

The Forecast Horizon Standard is preserved and now requires a complete Phase 3 `ForecastAuthorization` before a supported horizon is available to narrative prompts.

## State Binding and Packets

Current claims carry `stateId`, `effectiveAt`, optional input snapshot, model version, and configuration version in `CanonicalClaimBinding`. `createEvidencePacket()` rejects State A claims in a State B packet.

`server/evidencePacket.ts` builds the reusable current packet from the authoritative canonical state. It creates only the observed and derived facts that are actually present. It does not fabricate historical claims or forecasts from existing claim references.

## Prompt Boundaries

`evidenceNarrativePromptContract()` is applied at ASHA, ASHA gateway, Oracle / Smart Discovery, Outlook, and Daily Brief generation boundaries. It prohibits invented metrics, history, timing, targets, causality, confirmation, cross-engine confirmation, and unauthorized forecasts.

## Scope Boundary

This contract does not begin Phase 4 ASHA/Oracle redesign, Phase 5 structured Cross-Engine Synthesis, Phase 6 Early Warning, Phase 9 confirmation/invalidation engine, or later UI work. It supplies the shared governed evidence layer those phases require.
