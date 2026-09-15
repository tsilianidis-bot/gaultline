# RC remaining independent-calculation consumers

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Tip at write:** `761f73fdc2ba5d2fbecfe6668fb8e9d04c681dbb`  
**Policy:** do **not** exclude a calculation from canonical-truth acceptance until it is proven it cannot affect **CURRENT** product intelligence.

**CURRENT product intelligence** = surfaces that present today’s FAULTLINE market truth (Pressure Index, regime, Decision-Light, NOW/WHY/ACT/Situation Room, homepage briefing, mobile Pulse/Brief, EngineContext `canonicalCurrent`). Inventory: `PHASE_2I_CONSUMER_INVENTORY.json` rows with `classification: CURRENT_CANONICAL`.

Prior note (`docs/RC_INDEPENDENT_CALC_CONSUMERS.md`) covered four engines. This file traces the **remaining** independent producers. Same rule: if it can render on a CURRENT shell or write Champion/canonical state, it stays **in** acceptance.

## Already closed (do not re-exclude)

| Engine | CURRENT reach? | Acceptance |
| --- | --- | --- |
| Admin `pressure.getCurrentPressure` | No (Admin Health only) | Excluded after proof |
| Ticker `tradingSignals` as Pressure/regime authority | No | Excluded as market-truth authority; keep ticker QA |
| `marketIntelligence` regime engines | Yes — header/MCC chrome | **Included** |
| `marketStateCache` stale-if-error | Yes — CURRENT transport | **Included** |

## Remaining producers

| Engine | What it computes | Every consumer found | Reaches CURRENT? | Exclude from acceptance? |
| --- | --- | --- | --- | --- |
| `calculateFaultlinePressure()` live run (`server/pressure/engine.ts`) | Independent Champion V1 Pressure + vectors + alerts | **Canonical writer:** `scheduledSeismograph.runSeismographPipeline` (fails closed if pressure throws). **Scheduled:** `scheduledDailySnapshot`, `scheduledXPost`, `autonomousPublishing`, `risingStars` via `signalOutlook`. **tRPC / product:** `routers.ts` (many procedures), `signalOutlook`, `tradePreflight`, `positionGuidance`, `asymmetricOpportunities`, `readingHistory`, `cryptoEngine`, `ownerSimulation`, `diagnosticAI` inputs. **Client (indirect):** EngineContext via seismograph → `marketStateService`. Admin `getCurrentPressure` is one of many callers — already isolated. | **Yes.** This function **is** the Champion CURRENT producer when Seismograph persists + invalidates cache. Also feeds Trade Preflight / Outlook / snapshot / X / briefs if those jobs fire. | **No.** Distinct from the Admin *procedure*. Live `calculateFaultlinePressure()` must stay in acceptance as the Champion writer. Missing FRED/evidence must stay UNAVAILABLE; do not treat a fresh live run as CURRENT unless it went through canonical persist + EngineContext. |
| FMOS `runFMOSPipeline` / `runFMOSPipelineFast` | Independent regime / probability / analogs / 14-engine pack | **Canonical writer:** `scheduledSeismograph` (evidence packets; **must not** replace Champion score/regime — comment + `buildStateForAssembly` keep `pressure.overallPressure` / `pressure.regime`). **tRPC:** `routers/fmos.ts`, `routers/outlook.ts`, `routers/smartDiscovery.ts`. **Client:** `IntelligenceHub.tsx` (`fmos.runPipelineFast`), `ValidationLab.tsx`, `FmosHealthDashboard.tsx`. | **Yes — evidence + parallel Hub.** Champion score is not supposed to come from FMOS, but FMOS text/analogs sit in seismograph assembly and Hub is CURRENT_CANONICAL. | **No.** Keep in acceptance as “must not become Pressure authority.” |
| `computeSOB` (`sobEngine`) | Independent synthesis-of-belief | `scheduledSeismograph` evidence packet; `SOBPanel` / Market Synthesis consume EngineContext, not a live SOB call. | **Indirect.** Packet can appear in seismograph evidence. | **No** until proven it cannot shape CURRENT narrative fields. |
| `dayTradeEngine` (`scan` / `symbolSetup` / `getFavorability`) | Independent intraday setups + favorability | **Client:** `DayTradeIntelligence.tsx` (CURRENT_CANONICAL), `DayTradeDetail.tsx`, `UniversalSymbolIntelligence.tsx`. **Server:** `routers.ts` `dayTrade.*`. | **Yes — dedicated CURRENT surface.** Does not write `canonicalCurrent.pressureIndex`. | **No.** Ticker/intraday overlay on a CURRENT-classified page. Fail if it assigns Pressure/regime authority. |
| `aftershockEngine` | Independent contagion / aftershock graph | **Client:** `AftershockEngine.tsx`; `IntelligenceMode.tsx` (`aftershock.getAnalysis`) — IntelligenceMode is CURRENT_CANONICAL. **Server:** `routers.ts` `aftershock.*`. | **Yes — dashboard Intelligence mode.** Parallel, not Champion writer. | **No.** |
| `signalOutlook` (`getOutlook` / `getOpportunityDiscovery` / `getTodaysStory` / `getSecurityContext`) | Independent opportunity / story / security context; **calls `calculateFaultlinePressure()` internally** | **Client:** `SignalOutlookCenter.tsx`, `RisingStars.tsx`, `Opportunities.tsx`, `TodaysStory.tsx`, `UniversalTickerHeader.tsx`, `Signals.tsx` (rising-stars query), `OpportunityDiscoveryPanel.tsx`. **Server:** `routers/outlook.ts`, `scheduledRisingStarsHistory`, `risingStarsVisual`. | **Yes — product pages + ticker chrome + Signals.** Uses its own live Pressure run, not EngineContext, for outlook payloads. | **No.** Independent Pressure inside outlook can disagree with Champion CURRENT. Must stay in acceptance. |
| `tradePreflight` (`runTradePreflightSimulation`) | Action-specific Decision-Light; live Pressure unless override | **Client:** `TradePreflight.tsx` (CURRENT_CANONICAL). **Server:** `routers.ts`. Tests: `tradePreflight.decisionLight.test.ts`. | **Yes — CURRENT decision surface.** | **No.** Required fields already locked; must not invent a light when evidence is missing. |
| `diagnosticAI` (`getDiagnosticReport`) | Independent crash / bull-continuation scores (separate from Decision-Light) | `readingHistory`, `scheduledDailySnapshot`, `autonomousPublishing`, `signalOutlook` / `preFlight`, `routers.ts` diagnostics. | **Yes if snapshot / brief / PreFlight display those scores as “today.”** Bull-continuation and crash stay **separate** from Decision-Light by policy. | **No.** |
| `preFlight` (`getPreFlightData`) | Independent awareness pack | **Client:** `PreFlight.tsx`. Gate: `GATE_REQUIRED_TIER.preFlight = premium`. | Dedicated surface; not EngineContext. Still a “today” reading. | **No** (today-state product). |
| `cryptoEngine` / CoinGecko intel | Independent crypto signals / systemic risk / markets | **Client:** `CryptoIntelligence.tsx`, `CryptoSignals.tsx`, `CryptoSearch.tsx`, `HomeCryptoSection.tsx`, `PulseMode.tsx`, `SignalsMode.tsx`, mobile crypto. `CryptoSignals` is CURRENT_CANONICAL. | **Yes — CURRENT shells.** Optional for Champion (canonical `sourceHealth.coingecko` is not required). | **No** as parallel CURRENT chrome. Not Champion Pressure authority. |
| `positionGuidance` | Per-ticker guidance from live Pressure | `routers.ts` guidance procedures; diagnostic tests. | Guidance overlay, not EngineContext. | Keep in acceptance until a CURRENT page is proven unused. |
| `asymmetricOpportunities` | Independent Yahoo-screener + Pressure filter | `routers.ts`; opportunity UIs. | Opportunity radar, not Champion writer. | **No** if shown as today’s opportunity truth next to CURRENT. |
| `readingHistory` / `upsertTodaySnapshot` | Persists a daily score from a **live** Pressure run | `scheduledDailySnapshot`, `ReadingHistory.tsx` (HISTORICAL_CONTEXT), `MarketPreflight.tsx` timeframe query (CURRENT_CANONICAL component). | **Yes — snapshot can be read as “today” on Preflight.** | **No.** Snapshot is not a substitute for EngineContext, but it can display a live Pressure number on a CURRENT component. |
| `ownerSimulation` / `simPortfolioEngine` | Independent sim path + `computeTradingSignal` + live Pressure | Scheduled `daily-sim-portfolio`; owner sim pages. | **No for Champion CURRENT.** Explicit simulation / paper book. | **Yes for CURRENT market truth** (same class as Simulate Pressure). Keep in sim QA. |
| Shadow V3-H collect (`scheduledShadowModel`) | Shadow vs V1 comparison; **not** Champion | `/api/scheduled/shadow-*` only. | **No.** Must not write EngineContext. | Excludable as CURRENT authority; keep as “must not leak into Champion.” |

## Proof notes

### Live Pressure vs Admin procedure

`getCurrentPressure` is a public tRPC wrapper around `calculateFaultlinePressure()`. Excluding the **Admin Health caller** does not exclude the **function**. Seismograph comment in `buildStateForAssembly`: Champion V1 score/regime stay on `pressure.overallPressure` / `pressure.regime`; FMOS is evidence only. If Seismograph has never fired, EngineContext is stale-if-error or UNAVAILABLE — a later live admin run still must not become homepage truth (already tested).

### IntelligenceHub FMOS

`IntelligenceHub.tsx` is CURRENT_CANONICAL and calls `fmos.runPipelineFast`. That is a live independent pipeline on a CURRENT page. Treat as parallel leak risk, same class as `marketIntelligence` header strip.

### Day Trade / Aftershock / Outlook

All three appear on CURRENT_CANONICAL files (`DayTradeIntelligence`, `IntelligenceMode`, `Signals` / ticker header). None are proven unable to affect what a user reads as “today.” They stay in the pack.

## Canonical-truth acceptance (remaining)

| Item | In CURRENT acceptance? |
| --- | --- |
| Live `calculateFaultlinePressure()` as Champion writer (Seismograph) | **Included** |
| Admin `getCurrentPressure` UI | Excluded (prior proof) |
| FMOS (evidence + Hub fast path) | **Included** — must not author Pressure |
| SOB packet | **Included** |
| Day-trade / aftershock / outlook / tradePreflight / diagnostic crash-bull / preFlight / crypto overlay / reading snapshot | **Included** |
| Owner/sim portfolio | Excluded as CURRENT authority |
| Shadow V3-H | Excluded as CURRENT authority |

## Related

- `docs/RC_INDEPENDENT_CALC_CONSUMERS.md`
- `PHASE_2I_CONSUMER_INVENTORY.json`
- `server/independentCalcConsumers.test.ts`
- `server/scheduledSeismograph.ts`
- `docs/FAULTLINE_INTELLIGENCE_CONTRACT_V2_SCOPE.md` (v2 not implemented)
