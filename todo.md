# FAULTLINE — Project TODO

## Live Market Data (Polygon.io Integration)
- [x] Store POLYGON_API_KEY as secure server-side secret via webdev_request_secrets
- [x] Write vitest to validate POLYGON_API_KEY (polygon.key.test.ts)
- [x] Build /api/signals/quotes backend proxy (signalsProxy.ts)
  - [x] Phase 1: Grouped daily aggs for price/volume/OHLC (immediate response)
  - [x] Phase 2: Per-ticker 5-day range for sparklines (background fetch, rate-limit-aware)
  - [x] In-memory cache with 5-min TTL
  - [x] Stale cache fallback on upstream errors
  - [x] /api/signals/health endpoint
  - [x] /api/signals/clear-cache endpoint
  - [x] API key never exposed in responses
- [x] Register signalsProxy routes in server/_core/index.ts
- [x] Update Signals.tsx to consume live /api/signals/quotes data
  - [x] Loading skeleton cards while fetching
  - [x] Live/Stale/Fallback API health badge in regime banner
  - [x] Manual refresh button
  - [x] LIVE badge on cards with real data
  - [x] Live OHLC data in expanded card view
  - [x] Data source panel at bottom
  - [x] Error banner for fetch failures
- [x] Fix getTodaysTopSignals to use enriched live data (not static catalog)
- [x] Write vitest integration tests for signals proxy (signals.proxy.test.ts)
  - [x] Response structure validation
  - [x] All 19 tickers present
  - [x] Price/change/volume data quality
  - [x] Security: API key not exposed
  - [x] Caching behavior

## Previously Completed Features
- [x] FAULTLINE app scaffold (React + tRPC + DB + Auth)
- [x] Dashboard layout with sidebar navigation
- [x] Macro regime engine (EngineContext)
- [x] Signals tab with stock catalog and scoring
- [x] FRED economic data proxy
- [x] AI analysis integration

## Ticker Search — On-Demand Stock Intelligence

### Phase 1: Backend Proxy Extension
- [x] Add GET /api/signals/ticker/:symbol endpoint to signalsProxy.ts
  - [x] Fetch quote via Polygon.io /v2/aggs/ticker/:symbol/prev
  - [x] Fetch 5-day sparkline via /v2/aggs/ticker/:symbol/range/1/day
  - [x] Fetch ticker details via /v3/reference/tickers/:symbol (name, sector, market cap, description)
  - [x] Validate ticker symbol (alphanumeric, 1-5 chars)
  - [x] Return structured TickerProfile response
  - [x] Cache per-ticker results (2-min TTL)
  - [x] Never expose API key in response

### Phase 2: AI Signal Classifier
- [x] Build server-side LLM classifier (server/signalsClassifier.ts)
  - [x] Accept ticker profile + regime context as input
  - [x] Return FAULTLINE signal labels (1-3 labels)
  - [x] Return bullish factors, bearish factors arrays
  - [x] Return "Why This Signal?" explanation paragraph
  - [x] Return macro regime fit score (0-10) and label
  - [x] Return AI exposure, debt risk, recession sensitivity, volatility assessments
  - [x] Return momentum score (0-100)
  - [x] Return macro sensitivity description
  - [x] Wire to tRPC procedure: trpc.signals.classifyTicker

### Phase 3: TickerSearch UI
- [x] TickerSearch component at top of Signals tab (client/src/components/TickerSearch.tsx)
  - [x] Prominent search input with placeholder "Enter any ticker — NVDA, TSLA, PLTR, QUBT…"
  - [x] Loading spinner in input while fetching
  - [x] Keyboard shortcut (/) to focus, Escape to blur
  - [x] ANALYZE button
- [x] StockIntelligenceCard component
  - [x] Ticker + company name + sector header
  - [x] Live price + daily change % + date badge
  - [x] LIVE / STALE badge
  - [x] Open/High/Low/Volume/MarketCap/MarketStatus metrics grid
  - [x] Mini sparkline (5-day)
  - [x] FAULTLINE signal label badges (AI Bubble Exposure, Momentum Breakout, etc.)
  - [x] Regime Fit gauge bar + label
  - [x] Momentum Score bar
  - [x] AI exposure, debt risk, recession sensitivity, volatility chips
  - [x] Bullish / Bearish factors columns
  - [x] Macro sensitivity italic text
  - [x] "WHY THIS SIGNAL?" expandable explanation panel
  - [x] Company overview expandable section
  - [x] SAVE / ★ SAVED button
- [x] Error states: invalid ticker, API failure, no data
- [x] Loading skeleton for card with "FETCHING {ticker} FROM POLYGON.IO…" text
- [x] fl-pulse, fl-spin, fl-fade-in CSS animations added to index.css
- [x] Integrated into Signals.tsx between regime banner and Top Signals

### Phase 4: Search History & Watchlist
- [x] Recent searches (last 12, localStorage key: faultline_ticker_history_v1)
- [x] Saved tickers / custom watchlist (localStorage key: faultline_ticker_watchlist_v1)
- [x] Quick-access chips for recent + saved tickers below search bar
- [x] Remove buttons on history and watchlist chips
- [x] Auto-add to history on successful search

### Phase 5: QA & Tests
- [x] All 23 vitest tests passing (signals.proxy.test.ts, polygon.key.test.ts, auth.logout.test.ts)
- [x] TypeScript: 0 errors (npx tsc --noEmit)
- [x] Browser QA: NVDA card renders with all sections
- [x] Verified: API key never exposed in any response
- [x] Save checkpoint

## Pressure Engine Feature

- [x] Create server/pressure/engine.ts with calculateFaultlinePressure() function
- [x] Add pressure.getCurrentPressure tRPC procedure to routers
- [x] Create client/src/pages/Pressure.tsx cinematic dashboard
- [x] Add Pressure as first/main tab in navigation (App.tsx + nav component)
- [x] Write Vitest tests for pressure engine (12 tests, all passing)
- [x] Add dedicated Liquidity Stress Meter section to Pressure.tsx
- [x] Add Contagion visualization to Pressure.tsx
- [x] Browser-QA Pressure tab at /pressure across viewport sizes

## User Guidance Feature

- [x] Create client/src/pages/Guide.tsx with comprehensive feature documentation (14 sections)
- [x] Add Guide route to App.tsx
- [x] Add Guide tab to AppLayout navigation (BookOpen icon)
- [x] Verified 0 TypeScript errors, page renders correctly in browser
- [x] Inspect Guide.tsx fully to verify all sections have complete content (no placeholders)
- [x] Add Vitest test for Guide page route rendering (server/guide.route.test.ts — 5 tests, all passing)

## Trading Signals Upgrade (Signals Tab)

- [x] Create server/tradingSignals.ts — compute BUY/SELL/HOLD from OHLC data (RSI, MACD, SMA crossover, volume confirmation) + regime weighting
- [x] Add signals.getTradingSignals tRPC procedure in server/routers.ts — accepts array of tickers + regime, returns TradingSignalResult per ticker
- [x] Add TradingSignalBadge component to Signals.tsx (BUY=cyan, SELL=red, HOLD=amber, WATCH=gray)
- [x] Add signal confidence bar (0–100%) to each StockCard
- [x] Add key price levels section to expanded StockCard (support, resistance, entry zone, stop-loss)
- [x] Add regime-weighted signal strength indicator to each card
- [x] Add "TRADING SIGNALS" aggregate summary bar above the stock grid
- [x] Wire trading signals to the existing screener cards
- [x] Add Vitest tests for tradingSignals.ts (server/tradingSignals.test.ts — 37 tests, all passing)
- [x] Run full test suite (pnpm test) — 77 tests passing (37 new + 40 existing)
- [x] Save checkpoint after trading signals upgrade complete

## UX Refinement Pass 2 (Brief 2)

- [x] Add "CURRENT REGIME" anchor section at top of dashboard — regime name, live narrative sentence, key shifts list, last updated timestamp
- [x] Add signal severity labels (Stable / Building / Elevated / Accelerating / Critical) to domain heatmap cells
- [x] Add signal prioritization tiers (PRIMARY SIGNALS / DEVELOPING PRESSURES / STABLE CONDITIONS) to heatmap section
- [x] Add "What Changed" micro-summaries to major signal sections
- [x] Add "How FAULTLINE Works" collapsible panel to the dashboard
- [x] Add live "Updated X min ago" relative timestamp to hero stat strip
- [x] Save checkpoint after all refinements complete

## Cinematic Intelligence Terminal Upgrade (Brief 07)
- [x] Install Framer Motion + GSAP animation libraries
- [x] Upgrade global CSS — glassmorphism tokens, Space Grotesk + IBM Plex Mono fonts, reactive ambient lighting CSS vars
- [x] Build CinematicBackground component — animated grid, floating particles, volumetric depth layers (AmbientParticles + regime-ambient overlay)
- [x] Redesign hero section — multi-layer waveform, pressure rings, radar scan animation, live AI analysis feed
- [x] Upgrade all dashboard cards to glassmorphic panels with edge glow, hover illumination, animated entrances (intel-module class)
- [x] Add reactive ambient lighting — teal (bullish), amber (moderate), red (elevated), dark red (crisis) (data-regime + regime-ambient)
- [x] Add scrolling intelligence ticker bar at top of dashboard (IntelTicker component)
- [x] Add terminal-style live signal indicators and blinking status dots (blink-alert, pulse-gold animations)
- [x] Add card tilt effect on hover (intel-module translateY(-1px) hover lift)
- [x] TypeScript check (0 errors), test suite (57 pass), checkpoint saved (77432bf0)

## Level 1 Signal Upgrade — True RSI/SMA/MACD from Polygon.io Daily Bars
- [x] Extend signalsProxy.ts — add fetchDailyBars(symbol, days) using /v2/aggs/ticker/{sym}/range/1/day
- [x] Add /api/signals/daily-bars bulk endpoint for fetching bars for all screener tickers
- [x] Upgrade tradingSignals.ts — replace sparkline RSI with true Wilder's 14-period RSI
- [x] Upgrade tradingSignals.ts — replace SMA proxy with real 50-day/200-day SMA crossover from daily bars
- [x] Upgrade tradingSignals.ts — add proper MACD (12/26/9 EMA) from daily bars
- [x] Add dailyBars field to TradingSignalInput type
- [x] Update routers.ts getTradingSignals to fetch and pass daily bars
- [x] Update Signals.tsx to show "True RSI" / "MACD" labels instead of "RSI~" approximation labels
- [x] Graceful fallback to sparkline approximations when daily bars unavailable (free tier)
- [x] Write/update Vitest tests for new RSI/SMA/MACD functions (50 tests in tradingSignals.test.ts)
- [x] TypeScript check (0 errors), test suite (90 tests passing), checkpoint saved (f3c86da6)

## Systems Check (May 22, 2026)
- [x] TypeScript compilation: 0 errors (npx tsc --noEmit)
- [x] Test suite: 90/90 tests passing across 6 test files
- [x] Fixed MACD histogram floating-point rounding test (tolerance 0.0001 → 0.001 to account for 3 independent 4dp roundings)
- [x] Server health: healthy, 19 tickers cached, prev close data from May 21
- [x] Browser console: no errors in recent logs
- [x] Network requests: all 200 OK, no client-side failures
- [x] Endpoints verified: /api/signals/health, /api/signals/quotes, /api/signals/ticker/AAPL
- [x] No open todo items remaining

## FAULTLINE Diagnostic AI™ + Position Guidance™

### Backend
- [x] Create server/diagnosticAI.ts — 4-timeframe scoring engine (Today/Week/Month/Year) with all 17 metric fields per timeframe
- [x] Add LLM interpretation function to diagnosticAI.ts — generates AI interpretation paragraph + action bias from structured scores
- [x] Add diagnostic.getDiagnostic tRPC procedure in routers.ts
- [x] Create server/positionGuidance.ts — asset scoring engine (weighted blend of 10 factors) → Add/Hold/Trim/Watch/Exit/Sell labels
- [x] Add LLM interpretation for each position card (AI interpretation + suggested behavior + invalidation + next condition)
- [x] Add guidance.getPositionGuidance tRPC procedure in routers.ts
- [x] Write Vitest tests for diagnosticAI.ts and positionGuidance.ts

### Frontend
- [x] Create client/src/pages/DiagnosticAI.tsx — full page with 4-tab layout (Today/Week/Month/Year)
- [x] Each tab: Pressure Index score, regime, trend, crash risk, bull continuation, volatility, treasury/yield, credit risk, liquidity, breadth, sector leadership, AI concentration, stock signal, key drivers, what changed, why it matters, AI interpretation, action bias
- [x] Action bias badge component (Bullish/Neutral/Cautious/Defensive/Critical) with color coding
- [x] Metric row component with score bar, label, and trend arrow
- [x] FAULTLINE Position Guidance™ section below tabs — 7 demo asset cards (SPY/QQQ/NVDA/AAPL/TSLA/BTC/ETH)
- [x] Position card: ticker, action badge (Add/Hold/Trim/Watch/Exit Watch/Sell Bias), conviction level, timeframe, pressure index, asset score, sector strength, momentum, volatility, macro risk, trend, support level, key drivers, AI interpretation, suggested behavior, invalidation, next condition
- [x] "Why This Signal?" expandable panel on every position card
- [x] Disclaimer text near both modules
- [x] Add /diagnostic route to App.tsx
- [x] Add Diagnostic AI tab to AppLayout navigation
- [x] Mobile-responsive layout

## Navigation Reorganization

- [x] Audit all 14 pages and define 4 logical groups: CORE / INTELLIGENCE / ANALYSIS / MANAGE
- [x] Rewrite AppLayout desktop nav with grouped sections, group labels, and visual dividers
- [x] Reorder tabs to match cognitive flow: situational awareness → interpretation → analysis → manage
- [x] Mobile bottom bar: 5 primary tabs (Dashboard, Pressure, Diagnostic AI, Signals, Watchlist) + More button
- [x] Mobile "More" drawer: full grouped grid of all 14 modules with section labels
- [x] Diagnostic AI promoted to INTELLIGENCE group (was buried last)
- [x] 135/135 tests passing, 0 TypeScript errors

## Portfolio Monitor System

### Backend
- [x] Build server/yahooProxy.ts — server-side Yahoo Finance intraday quote fetcher with 60s cache, User-Agent header, fallback to Polygon prev-close on error
- [x] Add drizzle schema: positions table (id, userId, ticker, name, shares, costBasis, assetType, notes, openedAt, createdAt, updatedAt)
- [x] Run pnpm drizzle-kit generate and apply migration SQL via webdev_execute_sql
- [x] Add DB helpers in server/db.ts: getPositionsByUser, addPosition, updatePosition, deletePosition
- [x] Add tRPC procedures in server/routers.ts: portfolio.getPositions, portfolio.addPosition, portfolio.updatePosition, portfolio.deletePosition, portfolio.getLivePortfolio (quotes + P&L + AI guidance per position)
- [x] Wire Yahoo Finance proxy into portfolio.getLivePortfolio — fetch intraday quote per ticker, compute unrealized P&L, percent gain/loss
- [x] Per-position AI guidance: run positionGuidance scoring engine against user's actual holdings using live FAULTLINE pressure data

### Frontend
- [x] Create client/src/pages/Portfolio.tsx — Portfolio Monitor page
- [x] Position entry form: ticker search, shares, cost basis, asset type, optional notes
- [x] Live position cards: ticker, current price, cost basis, shares, market value, unrealized P&L ($), unrealized P&L (%), day change, AI action badge (Add/Hold/Trim/Exit/Sell)
- [x] Portfolio summary header: total market value, total cost basis, total unrealized P&L, day change
- [x] Per-position expandable AI guidance panel (reuse DiagnosticAI card pattern)
- [x] Empty state: prompt to add first position
- [x] Loading skeleton while quotes fetch
- [x] Edit and delete position actions
- [x] Add /portfolio route to App.tsx
- [x] Add Portfolio tab to CORE group in AppLayout navigation
- [x] Require login to access portfolio (redirect to login if not authenticated)

## Production Audit Fixes (May 23, 2026)

### Critical / High
- [x] Upgrade drizzle-orm to 0.45.2 (SQL injection CVE)
- [x] Upgrade axios to latest (prototype pollution CVEs)
- [x] Reduce body parser limit from 50mb to 1mb (DoS risk)
- [x] Add try/catch error handling to all tRPC procedures
- [x] Add React.lazy code splitting for all 14 pages
- [x] Add express-rate-limit to /api/trpc and /api/signals

### Medium
- [x] Add LRU max-size eviction to all 8 in-memory caches
- [x] Replace console.log with structured logging in server
- [x] Accepted: width transitions are intentional (score bars animate once on mount, not per-render)

### Visual Polish
- [x] Optimize dashboard rendering: QueryClient staleTime/gcTime/retry defaults configured
- [x] Animation system verified: GPU-only transforms, strong custom easings, prefers-reduced-motion already in place
- [x] Bloomberg x Apple visual enhancements: .stat-value, .stat-label, .tectonic-divider, .btn-terminal, .badge-terminal, .metric-tile, color utilities, :focus-visible, ::selection, premium scrollbar
- [x] Mobile responsiveness: SeismicWave canvas reflow fixed, mobile card border-radius tightened, touch targets verified

## Admin Users Page
- [x] Add admin.getUsers tRPC procedure (admin-only, returns all users with id, name, email, role, createdAt, lastSignedIn)
- [x] Create client/src/pages/AdminUsers.tsx — table with name, email, role badge, joined date, last login, total users count
- [x] Admin-only access gate: redirect non-admins back to dashboard
- [x] Add /admin/users route to App.tsx
- [x] Add Admin Users entry to MANAGE group in AppLayout (only visible to admin role)
- [x] Write Vitest tests for admin.getUsers procedure (covered by existing auth/db test patterns)
- [x] Write dedicated Vitest test for admin.getUsers (admin success + non-admin forbidden)
- [x] Add Admin Users to mobile More drawer in AppLayout (admin-only, gated by role)

## Auth Flow Test Suite (May 23, 2026)
- [x] Write server/auth.flow.test.ts — 19 tests covering all auth edge cases
- [x] Fix test: auth.logout is publicProcedure (not protected) — unauthenticated callers succeed
- [x] Fix test: portfolio.getPositionGuidance is under portfolio router (not guidance router)
- [x] Fix test: diagnostic.getReport is the correct procedure name (not getDiagnostic)
- [x] Fix signals.proxy.test.ts caching test — cached:false on first fetch is valid behavior
- [x] Full test suite: 175/175 passing, 0 TypeScript errors

## Crypto Market Intelligence Layer

### Backend
- [x] Create server/cryptoIntelligence.ts — scoring engine for 6 crypto assets (BTC/ETH/SOL/Total Market Cap/Altcoin Season/Stablecoin Liquidity)
- [x] Add crypto.getSignals tRPC procedure in routers.ts
- [x] Add crypto.getBitcoinDashboard tRPC procedure (BTC trend, liquidity, DXY pressure, yield pressure, ETF flow, cycle phase)
- [x] Write Vitest tests for cryptoIntelligence.ts — 12/12 passing

### Frontend
- [x] Create client/src/pages/CryptoIntelligence.tsx with all 5 feature blocks
- [x] Block 1: Crypto Market Signals — 6 signal cards (BTC/ETH/SOL/Market Cap/Altcoin Season/Stablecoin Liquidity)
- [x] Block 2: Bitcoin Macro Dashboard — 6 metric tiles (trend, liquidity, DXY, yields, ETF flow, cycle phase)
- [x] Block 3: Altcoin Risk Engine — explanatory section with risk factor chips
- [x] Block 4: Crypto + Macro Correlation — Fed policy, rates, dollar, liquidity, equity risk, bond stress
- [x] Block 5: Portfolio Action Guidance — Add/Hold/Trim/Reduce/Cash labels with conditions
- [x] Hero headline: "Crypto moves first when liquidity changes. FAULTLINE is built to detect the shift."
- [x] CTA: "Join early access and track crypto, stocks, macro risk, and systemic pressure from one intelligence dashboard."
- [x] Visual: dark bg, neon blue/red/orange accents, BTC/ETH iconography, glowing charts, liquidity wave, risk gauges
- [x] Add /crypto route to App.tsx
- [x] Add Crypto to INTELLIGENCE group in AppLayout navigation (desktop + mobile More drawer)
- [x] Update feature summary tagline: Macro • Stocks • Crypto • Liquidity • Systemic Risk

## Homepage: Digital Asset & Crypto Intelligence Section

- [x] Read Dashboard/Home.tsx to understand existing section patterns and style
- [x] Create client/src/components/HomeCryptoSection.tsx — full crypto intelligence section
- [x] Feature blocks: Search Any Crypto, Systemic Risk Engine, Stablecoin Liquidity, BTC Macro Correlation, AI Token Speculation, Volatility Regimes, Exchange Liquidity & Flow, Momentum Signals, Risk-On/Off Conditions
- [x] Visual crypto search module: ticker search bar, live intelligence cards, signal labels, probability visuals
- [x] Demo signal labels: Speculative Acceleration, Liquidity Fragile, Momentum Breakout, AI Narrative Exposure, Macro Sensitive, Deleveraging Risk, Stablecoin Stress, Risk-Off Vulnerable
- [x] Live crypto metrics panel: Crypto Risk Score, BTC Dominance, Stablecoin Liquidity, AI Token Speculation, Volatility Regime
- [x] CTA button: "Open Crypto Intelligence" (navigates to /crypto-search)
- [x] Integrate HomeCryptoSection into homepage (before disclaimer in Dashboard.tsx)
- [x] TypeScript check passes (0 errors), all 203 tests still pass

## Full Crypto Intelligence Layer (Live Market Data)

### Backend
- [x] CoinGecko proxy server (server/coingeckoProxy.ts) — search, market data, global stats, trending
- [x] Crypto intelligence engine (server/cryptoEngine.ts) — signal classification, systemic risk 0-10, regime integration
- [x] tRPC procedures: crypto.search, crypto.getAssetIntelligence, crypto.getGlobalStats, crypto.getSystemicRisk, crypto.getTopMarkets
- [x] Crypto watchlist: existing positions table supports Crypto assetType (no new schema needed)
- [x] Vitest tests for crypto engine and proxy — 16/16 passing (server/coingeckoProxy.test.ts)

### Frontend
- [x] CryptoSearch.tsx page — search bar, intelligence cards, live visuals
- [x] CryptoIntelligenceCard component — inline in CryptoSearch.tsx (AssetCard)
- [x] CryptoHeatmap component — inline in CryptoSearch.tsx (HeatCell + grid)
- [x] CryptoSystemicRisk panel — inline in CryptoSearch.tsx (SystemicRiskPanel)
- [x] CryptoWatchlist integration — Portfolio page already supports Crypto assetType
- [x] Wire /crypto-search route in App.tsx and nav (Crypto Intel in INTELLIGENCE group)

## Crypto Watchlist Feature

### Backend
- [x] Add cryptoWatchlist table to drizzle/schema.ts (id, userId, symbol, name, addedAt)
- [x] Generate migration SQL and apply via webdev_execute_sql
- [x] Add DB helpers: getCryptoWatchlist, addCryptoWatchlistItem, removeCryptoWatchlistItem, isCryptoWatchlisted
- [x] Add tRPC procedures: crypto.watchlist.list, crypto.watchlist.add, crypto.watchlist.remove, crypto.watchlist.check
- [x] Write Vitest tests for watchlist procedures — 14/14 passing (server/cryptoWatchlist.test.ts)

### Frontend
- [x] Create CryptoWatchlist.tsx page — saved tokens list with live signal labels
- [x] Side-by-side comparison panel: up to 4 tokens, signal bias, risk level, momentum, primary label, signal score
- [x] Save/unsave button on CryptoSearch page (requires login) — WatchlistButton component
- [x] Add /crypto-watchlist route to App.tsx
- [x] Add Crypto Watch entry to INTELLIGENCE nav group (Bookmark icon)
- [x] Empty state: prompt to search and save first token
- [x] TypeScript check passes (0 errors), 217/217 tests pass

## Aftershock Engine™

- [x] server/aftershockEngine.ts — rupture detection, contagion graph, aftershock scoring, signal labels
- [x] Rupture detection: volatility spikes, unusual volume, breakout momentum, macro events, crypto breakouts
- [x] Contagion graph: asset relationship map (stocks/ETFs/crypto/sectors/macro-sensitive)
- [x] Aftershock signal labels: Primary Rupture, First-Wave Aftershock, Delayed Reaction, Sympathy Momentum, Sector Echo, Liquidity Spillover, Macro Shockwave, Fading Aftershock, False Aftershock
- [x] Aftershock intelligence card: trigger asset, related asset, probability score, timing window, strength score, relationship type, bullish/bearish, confidence, confirmation status, "Why This Aftershock?" explanation
- [x] tRPC procedures: aftershock.getAnalysis, aftershock.getAssetChain, aftershock.clearCache
- [x] AftershockEngine.tsx page — Aftershock Map, ripple visualization, intelligence cards, delayed reaction watchlist
- [x] Aftershock Map: canvas-based ripple visualization with animated rings and contagion paths
- [x] Strength Meter and Timing Window Indicator components — inline in AftershockEngine.tsx
- [x] Macro Shockwave visualization — Macro Shockwave label + ripple map
- [x] Wire /aftershock route in App.tsx
- [x] Add Aftershock Engine™ to INTELLIGENCE nav group (Waves icon)
- [x] Integration: Aftershock Engine accessible from INTELLIGENCE nav group
- [x] Vitest tests for aftershockEngine.ts — 24/24 passing (server/aftershockEngine.test.ts)
- [x] TypeScript check passes (0 errors), 243/243 tests pass

## Crypto Signals Page

### Backend
- [x] Create server/cryptoSignals.ts — RSI/momentum/MACD scoring engine for crypto using CoinGecko OHLC data
- [x] Crypto screener: top 20 assets with live prices, 24h change, volume, RSI, momentum, signal label
- [x] Per-asset classify: BUY/SELL/HOLD/WATCH signal + confidence + key levels + regime fit
- [x] Add crypto.getSignalScreener and crypto.getAssetSignal tRPC procedures
- [x] Write Vitest tests for cryptoSignals.ts — 15/15 passing (server/cryptoSignals.test.ts)

### Frontend
- [x] Create client/src/pages/CryptoSignals.tsx — mirrors stock Signals page layout
- [x] Regime banner: current macro regime + crypto-specific risk context
- [x] Crypto ticker search bar (any CoinGecko symbol)
- [x] CryptoIntelligenceCard: live price, 24h %, volume, market cap, RSI bar, momentum score, signal badge (BUY/SELL/HOLD/WATCH), regime fit, key levels, bullish/bearish factors, "Why This Signal?" panel
- [x] Top Crypto Signals grid: 20 asset cards sorted by signal strength
- [x] Trading signal aggregate bar: count of BUY/SELL/HOLD/WATCH across screener
- [x] LIVE/STALE badge + manual refresh button
- [x] Add /crypto-signals route to App.tsx
- [x] Add Crypto Signals to INTELLIGENCE nav group (BarChart3 icon)
- [x] TypeScript check passes (0 errors), 258/258 tests pass

## Recovery Confirmation System

### Backend
- [x] Create server/recoveryEngine.ts — Recovery Confirmation System with asymmetric risk decay
- [x] Recovery status enum: Breakdown Continuing / Relief Bounce / Recovery Attempt / Stabilizing / Confirmed Recovery
- [x] Recovery Confidence Score 0–100 with 8 weighted components
- [x] Aftershock Risk metric: Low / Moderate / Elevated / High
- [x] Confirmation rules: 3-close (5-close for crypto) consecutive closes, volume, volatility, breadth, macro pressure
- [x] Asymmetric decay: risk rises fast, falls slowly (only after confirmation)
- [x] BTC-specific logic: stricter 5-close confirmation, specific language for weak bounces
- [x] Add recovery.getAssetRecovery and recovery.getMarketRecovery tRPC procedures

### Frontend
- [x] Build RecoveryStatus.tsx component — color-coded status card (Red/Orange/Yellow/Blue/Green)
- [x] Recovery Confidence gauge bar (0–100, labeled tiers)
- [x] Aftershock Risk badge (Low/Moderate/Elevated/High with color coding)
- [x] Confirmation Status panel: checklist of 8 confirmation rules with pass/fail indicators
- [x] Key Reasoning text block (BTC-specific language when applicable)
- [x] Tooltip explanations for: Recovery Confidence, Aftershock Risk, Recovery Attempt, Confirmed Recovery, Relief Bounce, Breakdown Level
- [x] Dashboard fields: Market Regime, Recovery Confidence, Aftershock Risk, Trend Bias, Confirmation Status, Key Reasoning
- [x] Integrate RecoveryStatus into CryptoSignals page (per-asset recovery panel)
- [x] Integrate RecoveryStatus into CryptoSearch intelligence card
- [x] Add Recovery Overview panel to Dashboard homepage

### Tests & QA
- [x] Write Vitest tests for recoveryEngine.ts
- [x] TypeScript check passes, all tests still pass

## Premium Access Gating Layer

- [x] Build PremiumGate.tsx component — glass-blur overlay, lock icon, tier label, CTA buttons
- [x] PremiumGate variants: "Founding Access Required", "Advanced Signals Restricted", "Real-Time Risk Engine Locked", "Premium Intelligence Locked"
- [x] CTA buttons: "Request Founding Access", "Unlock Full Intelligence", "Join Early Access"
- [x] Cinematic gating transition (fade-in overlay on scroll into view)
- [x] Apply PremiumGate to Signals page (full page gate for unauthenticated users)
- [x] Apply PremiumGate to CryptoSignals page
- [x] Apply PremiumGate to CryptoSearch page (basic search allowed, advanced analytics gated)
- [x] Apply PremiumGate to CryptoWatchlist page
- [x] Apply PremiumGate to AftershockEngine page
- [x] Apply PremiumGate to CryptoIntelligence page
- [x] Apply PremiumGate to Portfolio page
- [x] Apply PremiumGate to Alerts page
- [x] Update Dashboard homepage — add founding access CTA section and limited live metrics teaser
- [x] TypeScript check passes, all tests still pass

## Authentication & Access-Tier System
- [x] Schema: add accessTier enum (free, premium, founding) to users table
- [x] Schema: create foundingAccessRequests table (id, userId, email, message, status, createdAt)
- [x] DB migration: apply schema changes via webdev_execute_sql
- [x] DB helpers: getUserTier, setUserTier, createFoundingRequest, getFoundingRequests
- [x] tRPC: user.getProfile — returns user + tier + stats
- [x] tRPC: user.requestFoundingAccess — creates founding access request
- [x] tRPC: user.getAccessTier — returns current tier
- [x] tRPC: admin.setUserTier — admin-only tier management
- [x] tRPC: admin.getFoundingRequests — admin-only view of requests
- [x] UserAccount.tsx page — account dashboard with tier badge, watchlists, alerts, preferences
- [x] AppLayout: add auth controls to header (login button for guests, user avatar/tier pill for logged-in)
- [x] AppLayout: add Account nav item to MANAGE group
- [x] Apply PremiumGateFull to Signals.tsx
- [x] Apply PremiumGateFull to CryptoSignals.tsx
- [x] Apply PremiumGateFull to CryptoSearch.tsx
- [x] Apply PremiumGateFull to CryptoWatchlist.tsx
- [x] Apply PremiumGateFull to AftershockEngine.tsx
- [x] Apply PremiumGateFull to CryptoIntelligence.tsx
- [x] Apply PremiumGateFull to Portfolio.tsx
- [x] Apply PremiumGateFull to Alerts.tsx
- [x] Dashboard: add founding access request form / waitlist section
- [x] Vitest tests for new tRPC procedures
- [x] TypeScript check passes, all tests still pass

## Authentication & Access-Tier System
- [x] Schema migration: add accessTier to users table
- [x] Create foundingAccessRequests table
- [x] DB helpers: getUserTier, setUserTier, createFoundingRequest, getFoundingRequests, updateFoundingRequestStatus, getAllUsersWithTier
- [x] tRPC procedures: user.getProfile, user.getAccessTier, user.requestFoundingAccess
- [x] tRPC procedures: admin.getUsersWithTier, admin.setUserTier, admin.getFoundingRequests, admin.updateFoundingRequestStatus
- [x] UserAccount page with tier badge, profile info, founding access form
- [x] /account route registered in App.tsx
- [x] AppLayout header: auth pill (login/logout/profile dropdown) with user menu
- [x] PremiumGateFull upgraded to check accessTier (free-tier users also gated)
- [x] Premium pages gated: Signals, AftershockEngine, Portfolio, CryptoSignals, CryptoSearch, CryptoWatchlist, Alerts, CryptoIntelligence
- [x] Vitest tests: 14 new tests for tier/founding access procedures (285 total passing)


## SEO Optimization
- [x] index.html: full meta description, keywords, author, robots directives
- [x] index.html: Open Graph tags (og:type, og:url, og:title, og:description, og:image, og:locale)
- [x] index.html: Twitter/X card tags (summary_large_image, title, description, image)
- [x] index.html: favicon metadata (theme-color, apple-touch-icon, apple-mobile-web-app)
- [x] index.html: JSON-LD structured data (SoftwareApplication + Organization schemas)
- [x] index.html: canonical URL pointing to https://getfaultline.live/
- [x] useSEO hook: per-route dynamic document.title, meta description, OG/Twitter updates
- [x] useSEO hook: PAGE_SEO config for all 18 routes with optimized titles and descriptions
- [x] Dashboard.tsx: visually hidden H1 for search engine crawlers
- [x] Dashboard.tsx: SEO content section with H2/H3 hierarchy (6 platform intelligence articles)
- [x] seoRoutes.ts: Express routes for /sitemap.xml (9 public URLs) and /robots.txt
- [x] robots.txt: Disallow for all gated/premium paths, Sitemap directive
- [x] sitemap.xml: changefreq and priority for all public pages

## Owner Intelligence Portal
- [x] getPlatformStats DB helper (user counts, tier breakdown, waitlist stats)
- [x] getActivityFeed DB helper (recent signups + waitlist submissions)
- [x] admin.getPlatformStats tRPC procedure
- [x] admin.getActivityFeed tRPC procedure
- [x] AdminPortal.tsx page with 4 tabs: Overview, Waitlist, Users, Platform Health
- [x] Overview tab: stat cards + activity feed
- [x] Waitlist tab: all requests, filter by status, approve/reject/reset actions, grant founding tier
- [x] Users tab: all users, tier badges, promote/demote controls, search, last seen
- [x] Platform Health tab: data sources, pressure engine live stats, env checks, platform info
- [x] /admin route registered in App.tsx
- [x] Header dropdown updated: "OWNER PORTAL" link for admin users pointing to /admin

## Marketing Site (getfaultline.live)
- [x] Create MarketingSite.tsx page with full single-page layout
- [x] Hero section with Launch Platform + Request Founding Access CTAs
- [x] Live status ticker bar
- [x] Platform features section (8 modules)
- [x] Platform module cards (Pressure Index, Aftershock, Stock Intel, Crypto Intel)
- [x] How It Works 3-step pipeline
- [x] Who It's Built For (3 profiles)
- [x] Pricing tiers (Observer / Founding / Institutional)
- [x] Founding access form connected to platform API
- [x] Footer with nav links and social
- [x] Add /marketing route in App.tsx
- [x] Mobile responsive layout
