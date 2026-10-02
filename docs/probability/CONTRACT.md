# FAULTLINE Scenario-Probability Contract — `faultline-probability-contract-v1`

## Principle
Measured data → governed model → **versioned contract record** → PLATO / UI explanation.
Every user-facing percentage that claims to be a probability, scenario weight or confidence is a `ProbabilityClaim`. A UI or an LLM may only render `claim.display.text`. Neither may compute, re-scale or invent a percentage.

## One server source
- `server/probabilityContract.ts buildCanonicalProbabilityContract(manifest)` is a pure function of the stored `intelligenceStateManifests.manifestJson`.
- It is called once, inside `buildCanonicalIntelligenceState`. So `marketState.canonicalCurrent`, `evidenceCurrent` and every server reader get the same object, bound to `stateId`.
- Because it is derived at read time from the immutable manifest, history is never rewritten. An old manifest (seismograph `modelVersion "2.0"`) resolves to the old model version, `seismograph-evidence-vote-v1`. A new methodology writes new manifests with a new `modelVersion`.
- `marketStateService` (legacy `marketState.current`, which PLATO reads) overlays the same contract. The retired generators (G2 3-way, G3 5-way, G4 transitions) never leave the server as numbers.

## Types (`shared/probabilityContract.ts`)
```ts
PROBABILITY_CONTRACT_VERSION = "faultline-probability-contract-v1"

type ProbabilityDisplayState = "AVAILABLE" | "UNCALIBRATED" | "INSUFFICIENT_DATA" | "UNAVAILABLE" | "NOT_OFFERED";
type CalibrationStatus       = "CALIBRATED" | "UNCALIBRATED" | "NOT_ASSESSED";
type MissingDataStatus       = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
type FreshnessStatus         = "CURRENT" | "DELAYED" | "STALE" | "UNAVAILABLE";
type ProbabilityKind         = "SCENARIO_WEIGHT" | "REGIME_POSTERIOR" | "TRANSITION_FREQUENCY" | "EVENT_PROBABILITY";

interface ProbabilityModelRef { modelId: string; modelVersion: string; kind: ProbabilityKind; methodology: string }
interface HorizonClass       { bucket: HorizonBucket /* shared/forecastMetadata */; minDays: number|null; maxDays: number|null; description: string }
interface ScenarioDefinition { scenarioId: string; label: string; definition: string; eventDefinition: string|null; resolvable: boolean }
interface CalibrationRecord  { status: CalibrationStatus; metric: "ECE"|null; value: number|null; basis: string }
interface ProbabilityDisplay { state: ProbabilityDisplayState; text: string; percent: number|null }

interface ProbabilityClaim {
  contractVersion; claimId /* stable across versions, e.g. "seismograph.scenario.bull" */;
  stateId: string|null; claimObservationKey: string|null /* `${stateId}:${claimId}` = governedIntelligenceClaims key */;
  scenario: ScenarioDefinition; horizon: HorizonClass; model: ProbabilityModelRef;
  evidenceBasis: string; freshness: { status; asOf: string|null };
  missingData: { status; missingInputs: string[] }; calibration: CalibrationRecord;
  value: number|null;          // raw 0–100 model output, kept for the ledger/validation ONLY
  display: ProbabilityDisplay; // the only thing a UI/LLM may render
}
interface CanonicalProbabilityContract {
  contractVersion; stateId; generatedAt;
  scenarioSet: { setId; model; horizon; scenarios: ProbabilityClaim[] /* bull, neutral, bear */; display: ProbabilityDisplay };
  systemicRegime: { crisis; stressBuilding; transition; regimeConfidence: ProbabilityClaim } | null;
  transitions: ProbabilityClaim[];              // remain/elevated/low/crisis
  notOffered: ProbabilityClaim[];               // recession, crash, soft-landing, stagflation, alt-season
}
```

## Display rule (single function `resolveProbabilityDisplay`), checked in order
1. Not offered by any governed model → `NOT_OFFERED` "Not offered".
2. Value not finite / outside 0–100, freshness `UNAVAILABLE`, or missing data `UNAVAILABLE` → `UNAVAILABLE` "Unavailable".
3. Missing data `PARTIAL` or freshness `STALE` → `INSUFFICIENT_DATA` "Insufficient data".
4. Calibration not `CALIBRATED` → `UNCALIBRATED` "Uncalibrated".
5. Otherwise → `AVAILABLE`, rounded integer percent (no ×100 anywhere; values are 0–100).

## Model registry (versioned)
| modelId@version | Kind | Horizon | Calibration | Notes |
|---|---|---|---|---|
| `seismograph-evidence-vote@seismograph-evidence-vote-v1` | SCENARIO_WEIGHT | NOT_ESTABLISHED | UNCALIBRATED | Manifests with seismograph `2.0`. Known defect: analog similarity was voted as stress. |
| `seismograph-evidence-vote@seismograph-evidence-vote-v2` | SCENARIO_WEIGHT | NOT_ESTABLISHED | UNCALIBRATED | Seismograph `2.1`. The analog packet is non-directional (neutral). |
| `systemic-regime-hmm@<reading.modelVersion>` (e.g. `sre-hmm2-v1.0.0`) | REGIME_POSTERIOR | NOT_ESTABLISHED | UNCALIBRATED, ECE 0.515 (2-state, expanding-window OOS) | Crisis / stress-building / transition / state posterior |
| `seismograph-transition-frequency@seismograph-transition-v1` | TRANSITION_FREQUENCY | NOT_ESTABLISHED | UNCALIBRATED | Static defaults when the sample is empty → INSUFFICIENT_DATA |
| retired: `unified-seismograph-3way`, `unified-seismograph-5way`, `preflight-heuristic`, `browser-engine` | — | — | — | Never rendered |
| not offered: recession, crash, soft landing, stagflation, alt season | EVENT_PROBABILITY | NOT_ESTABLISHED | NOT_ASSESSED | "Not offered" |

Scenario definitions are stated as what the number measures. For example, bull = "share of the state's directional-evidence packets signalling bullish or recovering conditions". `eventDefinition` = null and `resolvable` = false, because no market-resolvable event or horizon has been registered. This is a validation blocker (below), not something to invent.

## Ledger / validation hooks (no migration)
- `governedIntelligenceClaims` for new states:
  - `modelVersion` = the contract model version (`seismograph-evidence-vote-v2`, `seismograph-transition-v1`)
  - `timeHorizon` = `"NOT_ESTABLISHED"` (HorizonBucket)
  - `eventDefinition` = the explicit scenario definition text
  - `metadataJson` = { contractVersion, modelId, horizonMinDays: null, horizonMaxDays: null, resolvable: false, calibrationStatus }
- Existing rows are untouched.
- `stateId` + `claimId` → `claimObservationKey`, which is what `forecastObservations.originalForecastJson.canonicalStateId` should reference once a resolvable event exists.
- `seismograph.version` "2.0" → "2.1" (in `stateHash` core) marks the v2 methodology. New states get new hashes. Old states keep v1.

## Blockers for James (not done here)
1. Display policy. Under the binding rule, the canonical bull/neutral/bear now renders "Uncalibrated", because nothing is calibrated. If you want those weights shown as qualified "scenario weights", that is one registry flag, but it is your call.
2. Resolvable event definitions plus horizons for the scenario set. These are needed before any calibration can exist (Validation §4.3–4.4).
3. Optional schema: there are no claim rows for systemic-regime probabilities. JSON-only for now. A migration is needed only if you want them as first-class governed claims or want claims+manifest written in one transaction.

## Planned PLATO changes (land after #58 merges, rebased on top of it)
#58 owns `server/ashaEngine.ts`, `server/ashaGateway.ts`, `server/plato/*`, `AshaLiveBriefing.tsx` (+ fallback), `AshaPanel.tsx`, `AshaDailyGreeting.tsx`, `shared/ashaContext.ts`. This PR does not edit them. It already fixes the source they read: `getCanonicalMarketState()` now overlays the contract, so `outlook.probabilities`, `regimeProbabilities`, `transitionProbabilities` and `confidence` reach PLATO as NaN (withheld) with `outlook.probabilityContract` attached, and `shared/ashaQuestionAnalysis.ts` no longer labels the bear weight CALIBRATED.

After #58 merges:
1. `ashaGateway.ts` `buildAshaCanonicalContextBlock`: add a `probabilityContract` block (each scenario/transition/systemic claim → `label: display.text`, model version, horizon NOT_ESTABLISHED) plus the rule "quote a % only when display.state is AVAILABLE; otherwise quote the text". Drop any `${probabilities.x}%` interpolation. Include #55's `why.evidenceAsOfMonth` beside the evidence families.
2. `ashaEngine.ts` greeting/prompt: drop client-sent `engineContext.regimeConfidence`; the `confidence > 0` checks (NaN-safe already, but remove "Probability Engine" from the available-engines list and the system-prompt line "The Probability Engine quantifies outcome distributions").
3. `AshaLiveBriefing.tsx`: tiles render only canonical values (Unavailable when no canonical state; never DEFAULT_INDICATORS engine output); remove the hardcoded `regimeConfidence: 0.75` prompt input; bull/crash tiles → `engineProbabilityText`.
4. `AshaPanel.tsx`, `OracleBriefing.tsx`: replace `${...Probability}%` with `engineProbabilityText` / `probabilityText(claim)`.
5. Tests: PLATO context snapshot contains "Uncalibrated"/"Not offered" and no `\d+%` next to bull/bear/crash/recession.

## Yield Curve (10Y–2Y) & 10Y Level vector: reachable range
The engine (`server/pressure/engine.ts` `scoreVolatilityRegime`) scores `0.6 × spreadScore + 0.4 × rateScore`, where spreadScore is 90 at most (10Y–2Y below −1 pp) and rateScore is 50 at most (10Y ≥ 6%). The highest reachable score is therefore **74**, so any band at ≥75 can never show for this vector. A steep, positive curve scores 20 on spread (low pressure). The copy in `seismographUnified.ts` and `preFlight.ts` used to say "steep re-steepening" means high pressure. It now matches the engine: the top band means a deeply inverted curve plus an elevated 10Y yield. Rescaling the vector, or dropping the unreachable band, is a model change and needs James.
