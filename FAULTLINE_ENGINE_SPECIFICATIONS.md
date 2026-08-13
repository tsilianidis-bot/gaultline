# FAULTLINE Engine Specifications

> **Classification rule:** “Implemented” means executable source exists in the current project. “Fallback/static” means source explicitly handles a non-live or model-estimated condition. “Planned/conceptual” means the product language may describe a capability but this document does not identify a dedicated executable implementation in the current source tree.

## System inventory

| System | Source authority | Status | Primary output |
|---|---|---|---|
| Pressure Index V1 | `server/pressure/engine.ts` | Implemented | 0–100 composite, vectors, level, regime, alerts, analogs, freshness. |
| V3-H Shadow Model | `server/pressure/shadowEngine.ts` | Implemented shadow evaluation | Separate internal comparison records; not the user-facing canonical score. |
| Canonical Seismograph | `server/seismographCore.ts`, `seismographUnified.ts`, adapters | Implemented | Evidence packets, patterns, transitions, provenance. |
| Canonical MarketState | `server/marketStateService.ts` | Implemented | Five Questions context, source health, freshness, warnings. |
| Outlook / probability layer | Market-state/outlook composition and routers | Implemented as contextual distribution | Scenario-oriented market outlook; not a ticker forecast. |
| Historical context and analogs | `historicalContextEngine.ts`, `historicalIntelligenceEngine.ts`, Pressure engine | Implemented retrospective analysis | Similarity/context comparisons with reconstruction limitation. |
| Signals and Symbol Intelligence | `tradingSignals.ts`, `signalsClassifier.ts`, `dayTradeEngine.ts` | Implemented | Asset-specific setup/technical/context output. |
| Crypto Intelligence | `cryptoIntelligence.ts`, `cryptoEngine.ts`, `cryptoRegimeEngine.ts`, `cryptoSignals.ts` | Implemented | Crypto regime, market conditions, signals, and health-aware reports. |
| Pre-Flight / Decision support | `preFlight.ts`, `tradePreflight.ts`, `positionGuidance.ts` | Implemented | Conditional decision framing and preflight workflows. |
| Portfolio / simulation | `simPortfolioEngine.ts`, `ownerSimulation.ts` | Implemented | Simulated positions, trades, journals, snapshots. |
| Aftershock / recovery | `aftershockEngine.ts`, `recoveryEngine.ts` | Implemented | Post-stress/recovery-oriented analytical output. |
| Global Markets | `server/routers/markets.ts`, `server/yahooProxy.ts` | Implemented | Live/delayed cross-asset snapshot and movers. |
| ASHA | `ashaEngine.ts`, `ashaGateway.ts`, model policy | Implemented provider-dependent | Evidence-synthesized explanation with provenance. |

## 1. Pressure Index V1

### Purpose

Produce a bounded 0–100 indicator of systemic pressure from macro/credit/rate inputs. A larger score represents greater modeled stress; it is not a probability of a crash or a personalized allocation recommendation.

### Inputs and source handling

The engine requests FRED series including HY spread (`BAMLH0A0HYM2`), 10Y/2Y Treasury yields (`DGS10`, `DGS2`), SOFR, CPI, PPI, Fed Funds, and unemployment. HY spread is normalized to basis points when FRED supplies a decimal representation. CPI and PPI are converted to year-over-year changes using current and 12-month-prior observations.

If FRED cannot provide data, the code has explicit fallback defaults. If a recently verified live snapshot is younger than 30 minutes, the engine can return that preserved snapshot with fallback labeling. This is continuity behavior, not live data.

### Formula and weights

| Vector | Weight | Source inputs | Executable method |
|---|---:|---|---|
| Liquidity Stress | 20% | HY spread, SOFR | Linear maps; HY component 65%, SOFR component 35%. |
| Credit Contagion Risk | 20% | HY spread, 10Y yield, unemployment | Spread 50%, rate 25%, labor 25%. |
| Volatility Regime | 15% | 10Y, 2Y yields | Yield-curve state 60%, rate level 40%; a yield curve proxy rather than a direct VIX feed. |
| Macro Sensitivity | 20% | CPI YoY, PPI YoY, Fed Funds | Bounded inflation/policy-pressure mapping. |
| Market Breadth | 10% | Unemployment, 10Y yield | Macro/labor-based breadth proxy, not exchange advance/decline breadth. |
| AI / Speculative Bubble | 15% | 10Y yield, HY spread | Static concentration baseline adjusted by live macro inputs; no live market-cap source wired. |

`overallPressure = round(sum(vector.score × vector.weight))`. The Pressure Level bands are Low 0–24, Moderate 25–44, Elevated 45–64, High 65–79, and Critical 80–100. The engine derives the associated regime, historical analogs, and alerts after composite calculation.

### Dependencies and limitations

This system depends on FRED availability/publication lags. Monthly macro series are marked delayed. Static AI-concentration logic must remain visibly static. The historical analog system is analytical context, not proof of a future outcome. V3-H runs fire-and-forget and does not block V1.

## 2. V3-H shadow model

The shadow model records a distinct two-layer structural/acute stress model and forward-outcome collection for an evaluation period. Source and database artifacts include `server/pressure/shadowEngine.ts`, `scheduledShadowModel.ts`, and `shadowModel*` schema tables. It is deliberately separated from the canonical V1 UI result. Recovery rule: preserve parameter-freeze/no-tuning policies and do not promote shadow output to production scoring without an explicit evaluation decision.

## 3. Canonical Seismograph

### Purpose and contract

The Seismograph turns provider/engine readings into evidence packets and time-series context. Its contract supports macro pressure, regime classification, probability distribution, historical analogs, transitions, liquidity, credit, momentum, volatility, cross-market alignment, crypto cycle, breakdown/recovery, sentiment, and insider flow.

### Inputs and output

Each packet contains source, time, evidence type, signal (`bullish`, `bearish`, `neutral`, `stressed`, `recovering`, or `transitioning`), strength, confidence, human-readable reading, optional sub-scores, and metadata. Provider provenance explicitly labels FRED status as `live`, `fallback`, or `unavailable`. Persisted readings/patterns/transitions support history and user-facing explanation.

### Limitation

Historical Seismograph displays are reconstructed analytical records. They cannot imply that FAULTLINE was live or warned users at the historical date.

## 4. Canonical MarketState and Five Questions compositor

`server/marketStateService.ts` produces a single, source-health-aware state used by page composition and ASHA. It combines the current read (`now`), causal/evidence explanation (`why`), scenario context (`outlook`), developing/watch conditions (`watch`), response framing (`act`), and historical context. It does not authorize a client to invent current engine facts.

| Input family | Output responsibility |
|---|---|
| Engine readings | Current condition, evidence, confidence, alerts, and evidence consensus/divergence. |
| Provider status/cache | Freshness, warnings, cache status, and source health. |
| Historical records | Context/analog framing, not live historical claims. |
| Outlook composition | Market-level scenarios/probabilities and conditions that can revise them. |

## 5. Outlook and probability layer

The current implementation treats probability as a market-level outcome distribution carried in canonical MarketState and outlook UI/server composition. It should report confidence, competing scenarios, evidence, and invalidation conditions. It must not be represented as a standalone oracle or a probability that a particular ticker will move. Where provider data is unavailable, display uncertainty rather than synthesizing precision.

## 6. Historical context and analog engines

`historicalContextEngine.ts` and `historicalIntelligenceEngine.ts` support historical framing; the Pressure Index also exposes analog matches. Inputs include preserved historical records and current vector/context patterns. Outputs should explain similarity and difference, time horizon, and retrospective status. Methodological reconciliation remains required before elevating historical Track Record results beyond neutral retrospective description.

## 7. Signal, Symbol, and Day Trade Intelligence

The asset-specific stack includes `signalsProxy.ts`, `tradingSignals.ts`, `signalsClassifier.ts`, and `dayTradeEngine.ts`. It consumes quote/technical/provider information and produces setup-level readings, levels, context, rationale, and provider health. This is separate from macro MarketState. It relies on source availability, may use caches/fallbacks, and must not make a direct price guarantee or hide degraded providers.

## 8. Crypto Intelligence

Crypto modules process CoinGecko/Yahoo-compatible data and crypto-specific regime/signal logic. Outputs include crypto-market conditions, asset context, rotation/signal components, and provider-health interpretation. Macro conditions can inform risk appetite, but crypto output needs its own asset/data limitations.

## 9. Pre-Flight, position guidance, and decision support

`preFlight.ts`, `tradePreflight.ts`, and `positionGuidance.ts` provide conditional pre-trade/decision framing. They consider move types, market regime, and where available ticker context. Outputs must present alternatives, invalidation triggers, and risk considerations. They are not trade execution, fiduciary advice, or a substitute for user judgment.

## 10. Portfolio simulation, Aftershock, and recovery

Simulation modules model virtual accounts, positions, trades, journals, and snapshots in database tables. Aftershock/recovery modules provide specialized interpretive workflows after stress events. These systems must remain clearly labeled as analytical/simulated where their database inputs or model assumptions are not live brokerage data.

## 11. Global Markets

`server/routers/markets.ts` fetches a 23-instrument cross-asset snapshot through `yahooProxy.getQuotes()` with a 90-second LRU cache. It covers U.S. equities, Europe, Asia, rates, dollar, commodities, and crypto; it derives summary classifications and strongest/weakest rankings. The UI refresh interval matches the cache. Labels must preserve delayed market-data status; no hardcoded price values should be introduced.

## 12. ASHA synthesis layer

ASHA is a provider-dependent LLM synthesis layer, not an engine of record. `ashaGateway.ts` builds a bounded canonical context and appends provenance rules; `ashaEngine.ts` constrains identity, evidence, probability framing, and structured response behavior. ASHA may explain the available evidence but must not invent unavailable engine output or hide source-health limitations.

## Conceptual or planned boundaries

The product language may refer to a broad “10-engine” intelligence system. The source tree contains many executable modules, but an engine's existence in a prompt does not prove a wholly independent current data feed. Treat provider-dependent or static/fallback components according to their actual source status, document new engines in this specification, and avoid representing roadmap ideas as production functionality.
