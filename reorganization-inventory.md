# FAULTLINE Reorganization Inventory

This inventory began as a reconstruction from repository state `9ee9d02d5116` and Stage 4 commit `ef0208619ac9`. It has now been reconciled with the recovered 36-row audit committed in `shared/legacyCapabilityAudit.ts` at synchronized repository state `807228c1`. The code-level audit and `shared/pageTreatmentManifest.ts` are authoritative when they differ from the provisional reconstruction below.

## Current route architecture

| Surface | Current contract |
|---|---|
| Canonical destinations | Five authenticated destinations owned by `shared/routeRegistry.ts`: `/app/now`, `/app/why`, `/app/outlook`, `/app/watch`, and `/app/act` |
| Canonical deep views | Five protected detail routes: `/app/now/deep`, `/app/why/deep`, `/app/outlook/deep`, `/app/watch/deep`, and `/app/act/deep` |
| Persistent utilities | ASHA, search, alerts, help, and account; route-backed utilities resolve through the registry |
| Expert workspaces | Pressure Engine, Signal Outlook Center, Decision Engine, Day Trade Intelligence, Universal Symbol Intelligence, and Smart Discovery |
| Declared unique protected routes | Roadmap, administrative workspaces, ASHA intelligence, X publishing tools, market movers, glossary, application blog routes, track record, reading history, SEO optimizer, analytics, validation lab, and FMOS health |
| Legacy aliases | 31 protected `/app` aliases and 5 mobile aliases, all centrally owned by `ANALYTICAL_LEGACY_ALIASES` |

The current route test contract consists of `server/routeRegistry.test.ts`, `server/routeRegistryConsumers.test.ts`, and `server/routeConsolidation.test.ts`. Together they enforce registry metadata, path uniqueness, alias ownership, route-context preservation, absence of duplicated canonical paths in client code, classification of explicit protected routes, preservation of declared unique routes, removal of duplicate legacy mounts, and direct registry-owned redirects.

## Authoritative recovered capability audit

The completed audit contains 36 rows: 33 recovered classifications and three direct-source manual classifications for Pressure, Scores, and TradePreflight. Focused validation at `807228c1` passed TypeScript and 22 route, registry, consumer, and page-manifest tests.

| Final treatment | Count | Pages and direct destination |
|---|---:|---|
| Preserve direct unique or expert capability | 15 | Pressure → `/app/pressure`; Alerts → `/app/alerts`; HistoricalAnalogs → `/app/historical-analogs`; SimulatePressure → `/app/simulate-pressure`; Watchlist → `/app/watchlist`; Signals → `/app/signals`; Portfolio → `/app/portfolio`; CryptoHub → `/app/crypto`; CryptoSearch → `/app/crypto-search`; CryptoWatchlist → `/app/crypto-watchlist`; CryptoSignals → `/app/crypto-signals`; SimPortfolio → `/app/sim-portfolio`; TradeJournal → `/app/trade-journal`; IntelligenceValidation → `/app/validation`; DecisionLedger → `/app/decision-ledger` |
| Redirect preserved capability into an expert workspace | 2 | Scores → `/app/pressure?tab=scores`; TradePreflight → `/app/decision-engine#trade-preflight` |
| Redirect redundant page to a canonical deep view | 18 | Charts, DailyReport, DiagnosticAI, SituationRoom, PreFlight, StockHeatmap, MarketCommandCenter, SeismographIntelligence, SeismographicDash, IntelligenceHub, and MarketIntelligence → NOW deep; Scenarios, AftershockEngine, and CryptoRegimeDashboard → OUTLOOK deep; AltRotation → WHY deep; InsiderIntelligence and SocialIntelligence → WATCH deep; Opportunities → ACT deep |
| Archive unreachable redundant source | 1 | CryptoIntelligence has no legacy path and remains unmounted |

The synchronized router mounts every direct-preserve destination, and centralized aliases own every redirectable legacy path. Route-contract tests also prohibit duplicate legacy analytical mounts and lock the recovered audit at 33 recovered plus three manual rows.

## Provisional legacy analytical source reconstruction

Before the audit result synchronized, the Stage 4 router history yielded 35 removed lazy-loaded page components. This table is retained as reconstruction evidence, but it no longer defines pending classification work: the authoritative audit includes those components plus the already-preserved Pressure workspace.

| Lines | Legacy page source |
|---:|---|
| 2,696 | `client/src/pages/Signals.tsx` |
| 1,535 | `client/src/pages/SituationRoom.tsx` |
| 1,462 | `client/src/pages/SocialIntelligence.tsx` |
| 1,274 | `client/src/pages/SeismographicDash.tsx` |
| 1,101 | `client/src/pages/CryptoSignals.tsx` |
| 963 | `client/src/pages/Portfolio.tsx` |
| 956 | `client/src/pages/PreFlight.tsx` |
| 940 | `client/src/pages/SeismographIntelligence.tsx` |
| 909 | `client/src/pages/Watchlist.tsx` |
| 903 | `client/src/pages/AltRotation.tsx` |
| 895 | `client/src/pages/CryptoIntelligence.tsx` |
| 858 | `client/src/pages/CryptoSearch.tsx` |
| 855 | `client/src/pages/Charts.tsx` |
| 854 | `client/src/pages/IntelligenceHub.tsx` |
| 844 | `client/src/pages/DiagnosticAI.tsx` |
| 822 | `client/src/pages/AftershockEngine.tsx` |
| 757 | `client/src/pages/SimPortfolio.tsx` |
| 728 | `client/src/pages/IntelligenceValidation.tsx` |
| 703 | `client/src/pages/TradeJournal.tsx` |
| 698 | `client/src/pages/MarketCommandCenter.tsx` |
| 692 | `client/src/pages/DecisionLedger.tsx` |
| 667 | `client/src/pages/InsiderIntelligence.tsx` |
| 661 | `client/src/pages/TradePreflight.tsx` |
| 655 | `client/src/pages/Opportunities.tsx` |
| 644 | `client/src/pages/StockHeatmap.tsx` |
| 599 | `client/src/pages/SimulatePressure.tsx` |
| 595 | `client/src/pages/HistoricalAnalogs.tsx` |
| 576 | `client/src/pages/CryptoWatchlist.tsx` |
| 572 | `client/src/pages/DailyReport.tsx` |
| 525 | `client/src/pages/Alerts.tsx` |
| 512 | `client/src/pages/CryptoRegimeDashboard.tsx` |
| 439 | `client/src/pages/MarketIntelligence.tsx` |
| 404 | `client/src/pages/Scenarios.tsx` |
| 302 | `client/src/pages/Scores.tsx` |
| 141 | `client/src/pages/CryptoHub.tsx` |

Compatibility aliases such as `/app/command-center`, `/app/pressure-index`, `/app/ai-diagnostic`, `/app/daily-briefing`, `/app/ai-watch`, `/app/ask-asha`, and mobile paths do not each represent an additional page source. They will be checked as redirect contracts after the 35 source components are classified.

### Source-to-route mapping

Every row below was checked against three sources: the parent router at `ef02086^`, the current `client/src/App.tsx`, and the current `shared/routeRegistry.ts`. Wrapper-only reachability was additionally verified with client import searches. In particular, `CryptoIntelligence.tsx` has no current import, explicit route, or registry alias, while `/app/scenarios` is explicitly registry-owned even though `Scenarios.tsx` is currently unreachable.

| Legacy page source | Stage 4 parent-router reachability | Current registry treatment |
|---|---|---|
| `IntelligenceHub.tsx` | Direct mount at `/app/intelligence-hub` | Alias to NOW |
| `MarketCommandCenter.tsx` | Direct mount at `/app/command` | Alias to NOW |
| `DecisionLedger.tsx` | Direct mount at `/app/decision-ledger` | Alias to NOW |
| `Scores.tsx` | Nested in the preserved Pressure workspace | `/app/scores` aliases to NOW pressure view |
| `Charts.tsx` | Nested in the preserved Pressure workspace | `/app/charts` aliases to NOW evidence view |
| `Scenarios.tsx` | Imported but not rendered; `/app/scenarios` was redirect-only | Alias to OUTLOOK scenarios view |
| `Alerts.tsx` | Direct mount at `/app/alerts` | Alias to WATCH alerts view |
| `HistoricalAnalogs.tsx` | Direct mount at `/app/analogs` | Alias to NOW analogs view |
| `SimulatePressure.tsx` | Direct mount at `/app/simulate` | Alias to OUTLOOK scenarios view |
| `DailyReport.tsx` | Direct mount at `/app/report` | Alias to NOW briefing view |
| `Watchlist.tsx` | Direct mount at `/app/watchlist` | Alias to WATCH |
| `Signals.tsx` | Direct mount at `/app/signals` | Alias to WATCH |
| `CryptoHub.tsx` | Direct mount at `/app/crypto` | Alias to WATCH |
| `CryptoSearch.tsx` | Nested in `CryptoHub.tsx` | `/app/crypto-search` aliases to WATCH |
| `CryptoSignals.tsx` | Nested in `CryptoHub.tsx` | `/app/crypto-signals` aliases to WATCH |
| `CryptoWatchlist.tsx` | Nested in `CryptoHub.tsx` | `/app/crypto-watchlist` aliases to WATCH |
| `CryptoIntelligence.tsx` | Imported but not rendered and not wrapped by Crypto Hub | No current route or registry alias |
| `DiagnosticAI.tsx` | Direct mount at `/app/diagnostic` | Alias to WHY positioning view |
| `Portfolio.tsx` | Direct mount at `/app/portfolio` | Alias to WATCH |
| `AftershockEngine.tsx` | Direct mount at `/app/aftershock` | Alias to OUTLOOK signal-health view |
| `SeismographicDash.tsx` | Direct mount at `/app/seismograph` | Alias to NOW pressure view |
| `SeismographIntelligence.tsx` | Direct mount at `/app/seismograph-legacy` | Alias to NOW pressure view |
| `AltRotation.tsx` | Direct mount at `/app/alt-rotation` | Alias to WHY rotation view |
| `TradePreflight.tsx` | Nested in the preserved Decision Engine workspace | `/app/trade-preflight` aliases to Decision Engine |
| `SituationRoom.tsx` | Nested in the preserved Decision Engine workspace | `/app/situation-room` aliases to Decision Engine |
| `Opportunities.tsx` | Direct mount at `/app/opportunities` | Alias to ACT |
| `MarketIntelligence.tsx` | Direct mount at `/app/market-intelligence` | Alias to WHY positioning view |
| `CryptoRegimeDashboard.tsx` | Direct mount at `/app/crypto-regime` | Alias to WHY positioning view |
| `SocialIntelligence.tsx` | Direct mount at `/app/social-intelligence` | Alias to WHY positioning view |
| `PreFlight.tsx` | Direct mount at `/app/pre-flight` | Alias to ACT analyze view |
| `InsiderIntelligence.tsx` | Direct mount at `/app/insider-intelligence` | Alias to WHY positioning view |
| `TradeJournal.tsx` | Direct mount at `/app/trade-journal` | Alias to ACT |
| `StockHeatmap.tsx` | Direct mount at `/app/stock-heatmap` | Alias to WHY rotation view |
| `SimPortfolio.tsx` | Direct mount at `/app/sim-portfolio` | Alias to ACT |
| `IntelligenceValidation.tsx` | Direct mount at `/app/intelligence-validation` | Alias to WHY evidence view |

## Oversized-file baseline

The current source tree contains 63 in-scope files over 800 lines. This scan includes TypeScript, TSX, CSS, the Drizzle schema, and test source under `client/src`, `server`, `shared`, and `drizzle`; it excludes dependencies, build output, generated source, migrations, and test snapshots. Test source is intentionally included because Stage 5 applies to every maintained code module, while snapshots are generated artifacts.

The exact baseline command is:

```bash
find client/src server shared drizzle -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) \
  ! -path '*/node_modules/*' \
  ! -path '*/dist/*' \
  ! -path '*/generated/*' \
  ! -path '*/migrations/*' \
  ! -name '*.snap' -print0 \
| xargs -0 wc -l \
| awk '$1 > 800 && $2 != "total" {print $1, $2}' \
| sort -nr
```

At `9ee9d02d5116`, this command returns 63 rows. The captured sorted result has SHA-256 `dd0b2193ef3c9908431e613647fa456453b872aaeca99776ade9bba3c329bcbb`.

| Lines | File |
|---:|---|
| 3,312 | `client/src/pages/SmartDiscovery.tsx` |
| 3,254 | `server/routers.ts` |
| 3,194 | `client/src/pages/MarketingSite.tsx` |
| 2,823 | `server/tradePreflight.ts` |
| 2,696 | `client/src/pages/Signals.tsx` |
| 2,301 | `server/signalOutlook.ts` |
| 2,299 | `client/src/pages/DayTradeIntelligence.tsx` |
| 1,821 | `drizzle/schema.ts` |
| 1,779 | `client/src/pages/Guide.tsx` |
| 1,726 | `client/src/pages/SignalOutlookCenter.tsx` |
| 1,668 | `client/src/pages/OwnerSimulation.tsx` |
| 1,651 | `server/seismographUnified.ts` |
| 1,585 | `server/routers/smartDiscovery.ts` |
| 1,535 | `client/src/pages/SituationRoom.tsx` |
| 1,513 | `client/src/pages/Dashboard.tsx` |
| 1,484 | `server/db.ts` |
| 1,462 | `client/src/pages/SocialIntelligence.tsx` |
| 1,453 | `client/src/pages/AdminPortal.tsx` |
| 1,449 | `client/src/lib/cinematicEngine.ts` |
| 1,437 | `client/src/pages/ComponentShowcase.tsx` |
| 1,390 | `client/src/pages/SeoOptimizer.tsx` |
| 1,382 | `server/dayTradeEngine.ts` |
| 1,360 | `server/ownerSimulation.ts` |
| 1,343 | `client/src/pages/Pressure.tsx` |
| 1,324 | `client/src/lib/signalsData.ts` |
| 1,274 | `client/src/pages/SeismographicDash.tsx` |
| 1,124 | `server/socialIntelligence.ts` |
| 1,101 | `client/src/pages/CryptoSignals.tsx` |
| 1,095 | `client/src/components/ScoreExplainer.tsx` |
| 1,083 | `client/src/components/MarketPreflight.tsx` |
| 1,079 | `client/src/pages/UserAccount.tsx` |
| 1,068 | `server/signalsProxy.ts` |
| 1,061 | `client/src/components/OnboardingFlow.tsx` |
| 1,057 | `client/src/components/TickerSearch.tsx` |
| 1,052 | `server/platformStability.test.ts` |
| 1,028 | `server/seoOptimizer.ts` |
| 1,010 | `client/src/index.css` |
| 1,001 | `client/src/pages/Press.tsx` |
| 979 | `server/seismographEngine.ts` |
| 963 | `client/src/pages/Portfolio.tsx` |
| 960 | `server/autonomousPublishing.ts` |
| 956 | `client/src/pages/PreFlight.tsx` |
| 940 | `client/src/pages/SeismographIntelligence.tsx` |
| 936 | `client/src/hooks/useCinematicAudio.ts` |
| 926 | `client/src/components/PremiumGate.tsx` |
| 925 | `client/src/App.tsx` |
| 909 | `client/src/pages/Watchlist.tsx` |
| 909 | `client/src/pages/UniversalSymbolIntelligence.tsx` |
| 903 | `client/src/pages/AltRotation.tsx` |
| 895 | `client/src/pages/CryptoIntelligence.tsx` |
| 877 | `server/intentResolver.ts` |
| 863 | `client/src/pages/AnalyticsDashboard.tsx` |
| 858 | `client/src/pages/CryptoSearch.tsx` |
| 858 | `client/src/components/AppLayout.tsx` |
| 855 | `client/src/pages/Charts.tsx` |
| 854 | `client/src/pages/IntelligenceHub.tsx` |
| 844 | `client/src/pages/DiagnosticAI.tsx` |
| 838 | `server/seismographCore.ts` |
| 831 | `client/src/pages/Blog.tsx` |
| 829 | `client/src/pages/ValidationLab.tsx` |
| 822 | `server/cryptoIntelligence.ts` |
| 822 | `client/src/pages/AftershockEngine.tsx` |
| 817 | `client/src/pages/admin/ConversationIntelligence.tsx` |

The decomposition acceptance check will rerun this same deterministic scan and require a result of zero files above the threshold.
