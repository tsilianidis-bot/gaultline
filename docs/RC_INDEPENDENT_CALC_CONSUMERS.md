# RC independent-calculation consumers

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Question:** can AdminPortal `getCurrentPressure`, ticker `tradingSignals`, `marketIntelligence` regime engines, or `marketStateCache` stale-if-error reach **CURRENT product intelligence**?

**CURRENT product intelligence** here means surfaces that present *today’s* FAULTLINE market truth: Pressure Index, regime, Decision-Light, NOW/WHY/ACT/Situation Room, homepage briefing, mobile Pulse/Brief, EngineContext `canonicalCurrent`. Inventory: `PHASE_2I_CONSUMER_INVENTORY.json` rows with `classification: CURRENT_CANONICAL`.

Leak-prevention tests: `server/independentCalcConsumers.test.ts` (plus existing `legacyCurrentTruthBypass.test.ts`, `phase2iCanonicalClosure.test.ts`, `nowComposition` / `fredProxy` Now.tsx guards).

## Matrix

| Engine | What it computes | Every consumer found | Reaches CURRENT product intelligence? | Exclude from canonical-truth acceptance? |
| --- | --- | --- | --- | --- |
| `pressure.getCurrentPressure` → `calculateFaultlinePressure()` | Independent live Pressure run + optional DB prior + shadow | **Client:** only `AdminPortal.tsx` Health tab. **Server:** `server/routers.ts` public procedure. Tests/docs mention the name. | **No.** CURRENT_CANONICAL files must not call it. Homepage / mobile Pulse/Brief / public Pressure Index / Now already bound to canonical state. | **Yes — after this proof.** Diagnostic-only. Still a public procedure; do not add new product callers. |
| `tradingSignals` (`computeTradingSignal(s)`) | Ticker BUY/SELL/HOLD from OHLC / RSI / MACD / SMA + **regime input** | **Server:** `routers.ts` + `routers/signals.ts`, `signalVisualDetail.ts`, `ownerSimulation.ts`, `simPortfolioEngine.ts`, `cryptoSignals.ts` (types/helpers). **Client:** `Signals.tsx`, `MobileSignals.tsx`. Tests. | **Ticker overlay only.** `Signals.tsx` is CURRENT_CANONICAL for **macro** via `useEngine()` (`regimeForSignals` from `engine.output`). Trading signals do not write `pressureIndex` / canonical regime. Sim/owner paths are non-current. | **Yes for CURRENT market truth.** Keep in Signals *ticker* QA. Fail if a CURRENT surface uses it as Pressure/regime authority. |
| `marketIntelligence` (`stockRegimeEngine` / `cryptoRegimeEngine` / `crossMarketEngine`) | Independent EQ/crypto regime + alignment | **Router:** `getAll`, `getStock`, `getCrypto`, `getCryptoRegimeDashboard`, `getRecentAlerts`, `clearCache`. **Client:** `MarketIntelligence.tsx`, `CryptoRegimeDashboard.tsx`, `AppLayout.tsx` → `AppMarketHeader`, `MarketCommandCenter.tsx`, `SmartDiscovery.tsx` (ledger snapshot). **Server:** `smartDiscovery.logRecommendation` may call `computeCrossMarketIntelligence()` if the client omitted regimes. | **Parallel chrome / dedicated pages — yes it renders on CURRENT shells.** Header REGIME strip and MCC cards sit next to EngineContext. They do **not** feed `canonicalCurrent.pressureIndex` or Decision-Light. SmartDiscovery CURRENT answers still come from `useEngine()`. | **No.** Cannot exclude: independent regime text is visible on CURRENT product chrome (`AppLayout`, MCC, Oracle logging). Treat as **non-authoritative parallel** until scoped or labeled. Keep in acceptance as “must not become Pressure authority.” |
| `marketStateCache` stale-if-error | Last-known Unified Seismograph when refresh throws (5m fresh / 24h stale TTL) | `canonicalMarketStateCache` in `marketStateService.ts` → `marketState.current` / canonical projection → `EngineContext` (`isLive` false when `cache.status === 'stale-if-error'`). WHY page banner. ASHA gateway provenance. `scheduledSeismograph` invalidates the cache. Tests in `marketStateCache.test.ts` / `marketStateService.test.ts`. | **Yes — this IS the CURRENT cache.** Stale-if-error can be what NOW/WHY/ACT see, labeled not live. | **No.** Must remain in canonical-truth acceptance. Missing evidence must stay UNAVAILABLE; stale-if-error must not be presented as fresh. |

## Proof notes

### `getCurrentPressure`

Workspace client grep: single `trpc.pressure.getCurrentPressure` in `AdminPortal.tsx`. Phase 2I CURRENT files are asserted to fail if that string appears. Admin Health tab uses the payload as an ONLINE/LOADING light, not as the public Pressure Index.

### `tradingSignals`

`Signals.tsx` sets `regimeForSignals` from `engine.output.regime` / `overall.score`, then mutates `signals.getTradingSignals`. Independent calc is downstream of canonical regime, not a replacement. Tests fail if CURRENT_CANONICAL sources import `computeTradingSignal` or assign `pressureIndex` from a trading-signal field.

### `marketIntelligence`

`AppMarketHeader` renders `intelligence.stockRegime` / `cryptoRegime` as a **REGIME** strip. Ticker values (including Pressure Index) come from `useEngine()` `output`, not from `getAll`. MCC uses `useEngine()` for the command-center CURRENT scores and `miData` only for the extra regime cards. That is enough reach to keep the engine **in** acceptance (parallel leak risk), not enough to treat it as Champion CURRENT.

### `stale-if-error`

`EngineContext` sets `isLive` false when cache status is `stale-if-error` or a required source is unavailable. `selectBrowserMarketOutput` maps that status to `dataStatus: "fallback"`. WHY shows an amber stale banner. Tests fail if EngineContext treats stale-if-error as live or if CURRENT consumers drop the cache status.

## Canonical-truth acceptance (this RC)

| Item | In CURRENT acceptance? |
| --- | --- |
| Admin `getCurrentPressure` | Excluded (cannot reach CURRENT product intelligence) |
| Ticker `tradingSignals` as market truth | Excluded (cannot set CURRENT Pressure/regime) |
| `marketIntelligence` regime engines | **Included** — visible on CURRENT chrome; must not author Pressure |
| `marketStateCache` stale-if-error | **Included** — CURRENT transport |

## Related

- `PHASE_2I_CONSUMER_INVENTORY.json`
- `server/legacyCurrentTruthBypass.test.ts`
- `docs/FAULTLINE_INTELLIGENCE_CONTRACT_V2_SCOPE.md` (v2 not implemented)
