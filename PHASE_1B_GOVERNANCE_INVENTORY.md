# Phase 1B Governance Inventory

## Binding Scope

This inventory is a Phase 1B remediation artifact. It does not alter the frozen Champion V1 calculation, the legacy 317-row history, verified or reconstructed research scores, the 26-event registry, the 10-met / 16-missed finding, or V3-H shadow-only status.

## Probability-Like Output Families

| Family | Producer | Current semantic issue | Phase 1B disposition |
|---|---|---|---|
| FMOS bull / neutral / bear distribution | `server/fmos/engines/probability.ts` | Distribution fields lack a governed event definition, horizon, calibration status, and evidence tier | Register as `DERIVED_SCENARIO_SCORE`; do not present as forecast probability |
| FMOS five-way regime distribution | `server/fmos/engines/probability.ts` | Heuristic allocation can be interpreted as mutually exclusive probability | Register as `DERIVED_SCENARIO_SCORE`; preserve constituent labels |
| Seismograph transition values | `server/seismographEngine.ts`, `server/seismographUnified.ts` | Transition components lack a forecast contract and may not total a coherent distribution | Register as `DERIVED_SCENARIO_COMPONENT`; display only with semantics note |
| Daily Brief probability fields | `server/dailyBriefSnapshot.ts` | Carries raw numerical values but insufficient claim metadata | Reference governed claim records, not unqualified prediction language |
| Current canonical market-state probabilities | `server/marketStateService.ts` | Consumer output lacks calibration provenance and horizon | Reference governed claim records and evidence status |

## Analog Output Families

| Family | Producer | Similarity method / data source | Phase 1B disposition |
|---|---|---|---|
| FMOS historical analogs | `server/fmos/engines/historicalAnalog.ts` | Five-vector Euclidean-distance similarity against a static reference dataset | Govern as `FEATURE_SET_SIMILARITY`; fixed outcome prose must be presented as historical reference, not recurrence probability |
| Pressure analogs | `server/pressure/engine.ts` | Pressure-state reference comparison | Govern as `PRESSURE_STATE_REFERENCE`; do not imply forecast accuracy |
| Unified Seismograph analogs | `server/seismographUnified.ts` | Separate synthesis-layer analog math | Govern as `SYNTHESIS_ANALOG`; preserve model identity so it cannot be confused with FMOS analogs |
| Pattern outcome distributions | `server/seismographEngine.ts` | Pattern-engine aggregation | Govern as `UNSUPPORTED_PENDING_IMMUTABLE_RESOLUTION` until source-backed immutable resolution exists |

## Existing Provenance Foundations

`algorithmScoreProvenance` already stores append-only forward Champion input manifests, formula hashes, availability records, and outcome observations. `dailyBriefSnapshots` already provides immutable publication snapshots with input freshness and narrative validation. Phase 1B extends their semantics into a minimum atomic state manifest rather than replacing the existing ledgers.

## Claim Consumer Priorities

| Consumer | Material issue | Required Phase 1B action |
|---|---|---|
| `ScoreExplainer.tsx` | Shares unsupported historical precedence, fixed-horizon, and probability claims broadly | Narrowly replace unsupported predictive language with governed scenario / research context |
| `MarketSynthesisPanel.tsx` | Uses bull / crash values as environment odds | Label as derived scenario scores and cite uncalibrated status |
| `SystemicAlerts.tsx` | Converts similarity and fixed pattern outcomes into probability-weighted / statistically significant claims | Contain wording; expose analog identity and no-outcome-probability rule |
| `ShareCard.tsx` | Shares probabilities and analog similarity as direct public claim | Add governed status / method note or suppress predictive presentation |

## Implementation Rule

> A numerical value may continue to exist internally, but no consumer may call it a prediction or market likelihood unless its governed claim record specifies event definition, horizon, source model, model version, methodology, evidence status, and display eligibility.
