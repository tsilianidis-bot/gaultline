# FAULTLINE Probability / Scenario Inventory (Phase 1)

- Code: `tsilianidis-bot/gaultline` @ `d1834a5` (integration, #53/#54/#55 merged). Worktree `/workspace/probability/repo`.
- Public pages read on PR #56 head `aa431d2` (it now contains d1834a5).
- Live values come from the prod captures of Oct 1 (`/workspace/prod-qa-oct1/api-*.json`, `server/__fixtures__/prod-2026-10-01/*`).
- Legend for "Owner": **P** = this stream, **#56/#57/#58** = an open PR owns the file, **DI** = Data Integrity follow-up (Now.tsx, Signals.tsx, AshaIntelligenceCenter, Watchlist, ScoreExplainer), **dead** = not routed in `App.tsx`.

## 0. Root cause: five independent probability generators

| ID | Generator (file:function) | Output today (Oct 1 prod) | What it really is | Calibrated? |
|---|---|---|---|---|
| G1 | `server/seismographCore.ts assembleSeismographOutput` (reached from `scheduledSeismograph` → `buildAtomicIntelligenceStateManifest` → `manifest.scenarioOutputs`) | **43 / 43 / 14** bull/neutral/bear | The share of the 7 evidence packets whose signal is bullish / neutral / bearish (`bullPackets.length / total`). It is a vote count, not a probability. **Defect:** `seismographAdapters.ts` maps the FMOS analog *similarity* to a signal (`>70 ⇒ "stressed"`). So the 91%-similar "Fed Pivot Rally" (a bullish analog) is the only bearish vote. That one vote is the whole 14% bear, and it makes "Historical Context" the `primaryDriver`. | No. 230/230 governed claims are UNVERIFIED, with `timeHorizon` and `eventDefinition` NULL. |
| G2 | `server/seismographUnified.ts computeProbabilities` → `marketState.current.outlook.probabilities` | **64 / 21 / 15** (+ `confidence` 50) | A heuristic over the monthly `pressureHistory` and 5 evidence families. It reaches PLATO through `ashaGateway.buildAshaCanonicalContextBlock` (`outlook: marketState.outlook`). The client overwrites it on NOW, but the server (PLATO) does not. | No |
| G3 | `server/seismographUnified.ts compute5WayRegimeProbabilities` → `outlook.regimeProbabilities` | **53 / 33 / 8 / 4 / 2** bull/softLanding/stagflation/recession/crash | Fixed lookup tables by score band, plus family-signal nudges, normalized to 100. **Defect:** sub-scores read through `|| 50` fills. | No |
| G4 | `server/seismographUnified.ts computeTransitionProbabilities` and `seismographEngine/buildStateForAssembly` (assembled `transitionProbabilities`) | Unified: 60/20/20/0 (n=5). Assembled: **70/15/10/5**, which are the static defaults used when no state exists. | Historical frequency over n similar months (n=5–6 months of live history), with static defaults when n=0. | No |
| G5 | Systemic Regime HMM (`server/systemicRegime/*`, `quant/systemic-regime`) → `manifest.domainValues.systemicRegime` and `systemicRegime.current` | crisisProbability 0, stressBuilding 0, regimeConfidence 1.0 | The posterior of a 2-state Gaussian HMM. The 2-state OOS crisis-calibration **ECE = 0.5152** (`quant/systemic-regime/artifacts/fred_validation_report.json` `byNStates.2.calibration`). | **No, and measured as badly calibrated.** |
| G6 | Browser engine `client/src/lib/engine.ts computeEngine` | bull/crash/recession/... | Used for the simulation / deterministic fallback only. | No |
| G7 | `server/preFlight.ts getPreFlightData` and `buildRecessionRisk` | bull/bear/recession/crash, "~N% 12-month recession probability" | Invented linear formulas (`clamp(round(recessionScore*0.6),5,70)`). **Defect:** `getVectorScore(vectors,"credit-stress")`, but the vector id is `credit-contagion`, so credit is always the default 50 (lines 169, 260, 350, 467, 567, 654, 714). | No |
| G8 | LLM output: `server/routers/smartDiscovery.ts` (the model returns `bullProbability`/`bearProbability`), `server/routers/dailyBrief.ts` (prompt quotes bull probability), `server/routers/outlook.ts` (prompt quotes FMOS bull/bear/transition) | varies | **These break James's rule:** the LLM produces or repeats probabilities. | n/a |
| G9 | FMOS probability engine `server/fmos/engines/*` (62/10/28 in packets), `cryptoRegimeEngine` next-regime probabilities, `signalOutlook` pressure→bull/bear, `homepageBriefing` bull/crash | various | Heuristics | No |

So the "one shared scenario-source problem" is this: G1, G2 and G3 all reach users at once, and **none** of them carries a model version, horizon, event definition or calibration status at the point where it is rendered.

## 1. Symptom → source trace

| # | Symptom | Surface (file:line) | Source |
|---|---|---|---|
| 1a | 43/43/14 on NOW | `client/src/pages/Now.tsx:853-1225` (DI) via `lib/canonicalNowProjection.mergeCanonicalMarketState` → `canonicalScenarioSet(scenarioOutputs)` | G1 |
| 1b | 64/21/15 in PLATO context | `server/ashaGateway.ts:77 buildAshaCanonicalContextBlock` (#58) ← `marketStateService.assembleCanonicalMarketState:150` | G2 |
| 1c | BULL 5300% on /app/now/deep | `client/src/components/AshaHeroSection.tsx:249` `Math.round(value * 100)` on 0–100 values (also `:383` crash ×100); data from `lib/marketStateProjection.projectCanonicalMarketState:96` | G3 |
| 1d | 5-way on Outlook | `client/src/pages/Outlook.tsx:215-223` (`regimeProbabilities`), and `formatCanonicalPercent(NaN)` would print "0%" | G3 |
| 2 | Crisis p 0% / Stress 0% | `client/src/components/SystemicRegimeModule.tsx:47-58` (rendered by Now.tsx:1101); the "Model score" is shown as a % next to it | G5 (ECE 0.515) |
| 3 | Historical Context counted as stressed | `server/seismographAdapters.ts:146-170`; this sets the 14% bear and `primaryDriver: "Historical Context"`. Meanwhile the canonical/legacy `topAnalog` is null, so the UI reads "No verified analog". | G1 defect |
| 4 | `\|\| 50` fills | `server/seismographUnified.ts:290-293` (`computeSimilarity`), `:416-423` (history normalisation). A missing sub-score becomes a neutral 50 and flows into evidence families, 6-month averages, analog similarity and G3. (`:645` volFam lookup is fixed by #55; the `:656` math is unchanged.) | G2/G3 inputs |
| 5 | Stale PLATO greeting / context | `server/ashaEngine.ts:788 generateAshaDailyGreeting` (#58 now) and `ashaGateway.ts:77` (#58) both read `getCanonicalMarketState()`, the legacy G2/G3/G4 object. The client-sent `engineContext.regimeConfidence` is forwarded as `pageSupplement`. | G2/G3/G4 |
| 6 | ~15 legacy `x.x/10` on /app/now/deep | `client/src/pages/Dashboard.tsx:283-285, 371, 433, 569, 575, 643, 708, 712, 714, 758-763, 845, 852, 1239, 1245, 1329-1330` | canonical score ÷ 10 |
| 7 | preFlight recession figure, credit id | `server/preFlight.ts:86` (`recessionProbability`), `:259-287` (`buildRecessionRisk`, "12-Month Probability ~N%"), `:714-721`; "Volatility Regime" VIX copy `:297-310, :402-410, :514`; `server/fmos/engines/evidence.ts:244-250` | G7 |
| 8 | Public probability copy | see §3 | marketing |

## 2. App surfaces (user-facing %), by source

| Surface | File:line | Source | Owner |
|---|---|---|---|
| NOW scenario cards, distribution, §04 | `Now.tsx:694, 853-858, 1056-1067, 1122-1138, 1214-1232` | G1 via merge | DI (planned, after the DI rebase) |
| NOW "Highest-probability path … (60% historical frequency)" | `Now.tsx:1148-1150, 1230-1232` ← `seismographUnified.buildMarketNarrative` | G4 | text built server-side → P (server) |
| NOW Crisis p / Stress / Model score | `SystemicRegimeModule.tsx:44-58` | G5 | P |
| NOW header "TRANSITION RISK 5%" | `MarketContextStrip.tsx:273-276` (AppLayout, every app page) | G4 static default | P |
| Context-strip scenario leader | `MarketContextStrip.tsx:84-98` | G1 via merge | P |
| /app/now/deep ticker, hero, bull/crash cards, ProbBars, verdict text, ScoreExplainers | `Dashboard.tsx:569-575, 708-714, 758-763, 824-825, 1108-1146` | G3 | P (ScoreExplainer component itself is DI; only its call sites are edited) |
| /app/now/deep PLATO hero bars (5300%) | `AshaHeroSection.tsx:180-187, 249, 383` | G3 | P |
| /app/now/deep Pulse / Intelligence modes | `dashboard/PulseMode.tsx:117-118`, `IntelligenceMode.tsx:100-111`, `FaultlineInterpretation.tsx:134-135, 27-33` | G3 | P |
| /app/now/deep share card | `ShareCard.tsx:29-31, 153-165` | G3 | P |
| /app/now/deep synthesis | `MarketSynthesisPanel.tsx:169-170` (thresholds into copy) | G3 | P |
| /app/now/deep awareness modal | `MarketPreflight.tsx:162-163, 239` | G3 | P |
| /app/now/deep seismograph banner | `SeismographNarrativeBanner.tsx:297-298` ("{bull}% probability of a bullish outcome") | G1 (assembled) | P (Signals.tsx banner gating is DI; the component isn't on DI's list, so I flag possible overlap) |
| /app/now/deep briefing panel | `HomepageBriefingPanel.tsx:152-215` ← `server/homepageBriefing.ts:500` | G9 | deferred (see §5) |
| Outlook scenario branching / band | `Outlook.tsx:66-149, 215-223` | G3 | P |
| Act scenario cards, confidence | `Act.tsx:272, 296-323, 403, 465, 540` (already gated by `forecastConfidenceDisplay`; NaN → "UNAVAILABLE") | G1/G2 via merge | reads the contract through the merge; no edit |
| Watch confidence | `Watch.tsx:265, 351, 535` (gated) | G2 confidence | reads merge; no edit |
| Mobile brief/pulse | `mobile/MobileBrief.tsx:118-171`, `MobilePulse.tsx:161-184` (`scenarioOutputs.neutral` read as "regime hold" %) | G1 | deferred (§5) |
| Pressure page ScoreExplainer | `Pressure.tsx:1232` | — | DI component |
| PLATO panel OracleBriefing | `AshaPanel.tsx:407`, `OracleBriefing.tsx:31` | G3 | #58 |
| Onboarding briefing | `AshaLiveBriefing.tsx:449-450` | G3 | #58 (now editing) |
| Signal Outlook env bull/bear | `SignalOutlookCenter.tsx:857-858` ← `server/signalOutlook.ts:1435` | G9 | deferred |
| Act deep (SmartDiscovery) LLM bull/bear | `SmartDiscovery.tsx` (14 refs) ← `server/routers/smartDiscovery.ts:568-934` | G8 | deferred: needs prompt and schema change (James) |
| Day-trade "Prob: N%" | `DayTradeIntelligence.tsx:307` | heuristic | deferred |
| Simulate Pressure | `SimulatePressure.tsx:407-412` | G6 (simulation, labelled) | deferred |
| Crypto regime next-regime % | `cryptoRegimeEngine.ts:44-70, 265` | G9 | deferred |
| Unrouted pages | `DailyReport, SituationRoom, IntelligenceHub, Scenarios, SeismographicDash, MarketCommandCenter, TradePreflight, PreFlight` | G3/G7 | dead; not touched |

## 3. Public copy (all on #56 except MarketCrashProbability2026)

| Page | File:line (#56 head) | Claim |
|---|---|---|
| /recession-probability | `seo/RecessionProbability.tsx:7, 12` ("Recession Probability Indicator — Leading…"), `:58` "recession probability score", `:63-64` FAQ accuracy, `:68` tiers LOW 0–25 / MODERATE 25–50 / ELEVATED 50–75 / HIGH 75+, `:72` positioning tied to probability, `:75-76` "preceded every U.S. recession since 1955"; `server/seoMeta.ts:100-103` | No recession-probability model exists. Not offered. |
| /alt-season-indicator | `seo/AltSeasonIndicator.tsx:7-8` meta "Live Probability", `:13`, `:32` "five signals into a single alt season probability score", `:42`; `seoMeta.ts:105-108` | No alt-season model. Not offered. |
| /market-crash-probability-2026 | `seo/MarketCrashProbability2026.tsx:7, 79, 87, 91` (**not in #56**); `seoMeta.ts:90-93` title "Market Crash Probability" | No crash probability. |
| /vs/finviz | `seo/vs/VsFinviz.tsx:22` "Crash Probability Analysis" | — |
| /vs/bloomberg | `seo/vs/VsBloomberg.tsx:16, 21, 65` "crash probability (metrics)" | — |
| /press | `Press.tsx:66, 133-134, 484, 538, 600-601` "Probability Engine — assigns regime transition probabilities across 1M/3M/6M/12M horizons" | No such horizons exist (G4 is a single 3-month window, uncalibrated). |
| /pressure-index | `PressureIndex.tsx:350-351` "regime probability" in the diagnostic card | — |

## 4. PLATO / LLM paths

- `ashaGateway.buildAshaCanonicalContextBlock` (#58) serializes the whole `marketState.outlook`: G2 (64/21/15 + confidence 50), G3 (5-way), G4 (60/20/20/0, confidence 41) and `highestProbabilityPath` "60% historical frequency".
- `ashaEngine.generateAshaDailyGreeting` (#58) uses the same block, plus the client `engineContext.regimeConfidence` (browser engine) as `pageSupplement`.
- `seismographCore.buildASHAContextBlock` (`forASHA.systemPromptBlock`: "Bull 43% | Neutral 43% | Bear 14%, Confidence 67%, Transition to crisis 5%") feeds `smartDiscovery.ts:676`.
- `routers/outlook.ts:321-323` quotes FMOS bull/bear/transition, labelled "not calibrated". `dailyBrief.ts:330, 366` quotes "Bull Probability".

## 5. Persistence / ledger

- `intelligenceGovernance.buildGovernedClaims`: 3 scenario claims, `DERIVED_SCENARIO_SCORE`, `modelVersion "seismograph-core-v1"`, `timeHorizon` NULL, `eventDefinition` NULL. Plus 4 transition `DERIVED_SCENARIO_COMPONENT`, analogs and patterns.
- The manifest core `modelVersion` = `seismograph.version` ("2.0") is part of `stateHash`, so a version bump makes a new state hash. Old rows are never rewritten.
- The systemic-regime probabilities live only in `domainValues.systemicRegime` (in the hash) and have no claim rows.

## PLATO post-#58 additions (steering 7:55 AM, #58 head e89ec7b9)
- AshaLiveBriefing.tsx tiles still render engine data that can be default indicators when no canonical state exists → render canonical-only / Unavailable.
- AshaLiveBriefing.tsx prompt input hardcodes regimeConfidence 0.75 → drop; use probabilityContract display text.
- ashaGateway.ts PLATO context omits #55's why.evidenceAsOfMonth → include it alongside probabilityContract.

