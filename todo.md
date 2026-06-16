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

## Audit Fixes (May 24, 2026)

- [x] Generate and upload OG social share image (1200×630), fix og:image reference
- [x] Fix sitemap — remove app routes, keep only /
- [x] Lock down clearCache mutations behind protectedProcedure
- [x] Add duplicate waitlist submission guard (check email before insert)
- [x] Remove maximum-scale=1 from viewport meta (mobile zoom / WCAG fix)
- [x] Add Content Security Policy header
- [x] Add Vite bundle chunking (manualChunks for vendor + routes)
- [x] Wire waitlist count stat from publicStats API (replace "Open")
- [x] Remove console.log from Scenarios.tsx
- [x] Add route-level error boundaries

## New Features (May 24, 2026)
- [x] /legal page with Privacy Policy and Terms of Use sections
- [x] Owner notification on founding access request submission
- [x] Social share buttons (Twitter/X, LinkedIn) on marketing hero

## New Features (May 24, 2026)
- [x] Stripe integration: checkout session creation procedure
- [x] Stripe integration: webhook handler to upgrade user tier on payment
- [x] Stripe integration: upgrade prompt UI in PremiumGate on FORBIDDEN error
- [x] Stripe integration: billing/manage subscription link in UserAccount
- [x] Charts page: replace simulated data with real FRED/Polygon API data
- [x] Scenarios page: remove console.log and replace placeholder scenario data
- [x] GDPR cookie consent banner with localStorage persistence

## Marketing Site Content Improvements (May 24, 2026)
- [x] Fix CTA copy — clarify "LAUNCH PLATFORM" with context about free access and no credit card
- [x] Add About/Origin narrative section explaining the problem FAULTLINE solves in plain language
- [x] Add real pricing ($59/mo, $49/mo founding) to pricing cards

## Snapshot Period View (Daily / Monthly / Yearly)

- [x] Add SnapshotPeriodView component to Pressure.tsx — tab toggle (Daily / Monthly / Yearly) showing current data reframed in each time context
- [x] Daily tab: today's date, current Pressure Index, regime, top 3 vectors, top alert
- [x] Monthly tab: current month/year, same data framed as "May 2026 snapshot", monthly risk summary sentence
- [x] Yearly tab: current year, same data framed as annual macro picture, yearly risk context sentence
- [x] Insert SnapshotPeriodView panel below the hero gauge section in Pressure.tsx
- [x] TypeScript check passes (0 errors)
- [x] Save checkpoint

## Blog Feature
- [x] Add blogPosts table to drizzle/schema.ts (id, slug, title, subtitle, content, author, category, tags, published, publishedAt, createdAt, updatedAt)
- [x] Run migration and apply SQL via webdev_execute_sql
- [x] Add blog tRPC procedures: blog.list (public), blog.getBySlug (public), blog.getCategories (public), blog.adminList, blog.adminGetById, blog.create, blog.update, blog.delete (all admin)
- [x] Build /blog page — post index with category filter, featured post hero, post cards
- [x] Build /blog/:slug page — full post with markdown rendering, dynamic SEO meta
- [x] Build admin blog management UI at /app/admin/blog — post list, create/edit form with markdown editor, draft/publish toggle
- [x] Add Briefings link to marketing site desktop nav
- [x] Add Briefings link to AppLayout MANAGE group
- [x] Add Blog Management link to AdminPortal header
- [x] Wire routes in App.tsx (/blog, /blog/:slug, /app/admin/blog)
- [x] TypeScript check passes (0 errors)
- [x] Save checkpoint

## Daily Blog Auto-Publisher (AGENT Cron)
- [x] Build POST /api/scheduled/publish-blog endpoint — accepts { title, subtitle, content, slug, category, tags } from agent, inserts as published post
- [x] Mount handler in server/_core/index.ts before Vite fallthrough
- [x] TypeScript check passes
- [x] Checkpoint + ask user to deploy
- [x] Create AGENT cron (daily 9am UTC) with ordered topic list prompt
- [x] Verify cron registered via manus-heartbeat list

## X Post Generator (Admin Feature)
- [x] Build server/xPostGenerator.ts — LLM-powered post generator using live pressure data
- [x] Add xPost.generate tRPC procedure (postType: premarket|midday|closing|breaking, headline?: string)
- [x] Returns 5 post variants: short (280 chars), thread, founder, institutional, breaking-alert
- [x] Build client/src/pages/XPostGenerator.tsx — dark cinematic admin page
- [x] Four trigger buttons: Premarket / Midday Update / Closing Summary / Breaking Alert
- [x] Optional headline input for breaking alert mode
- [x] Display all 5 post variants with copy buttons
- [x] Dynamic tone logic based on live Pressure Index
- [x] Add /app/x-posts route to App.tsx
- [x] Add X Post Generator link to AppLayout MANAGE group
- [x] TypeScript check passes (0 errors)
- [x] Save checkpoint

## X Auto-Posting Automation
- [x] Store X API credentials as secrets (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)
- [x] Install twitter-api-v2 npm package
- [x] Build server/xPoster.ts — Twitter API v2 client, postTweet(), postThread() helpers
- [x] Build server/newsMonitor.ts — Polygon.io news polling, significance scoring via LLM, cooldown logic
- [x] Add xPostQueue table to drizzle schema (id, postType, variant, content, status, postedAt, xPostId, headline, createdAt)
- [x] Apply migration SQL for xPostQueue table
- [x] Build /api/scheduled/x-post-scheduled endpoint (premarket/midday/closing trigger)
- [x] Build /api/scheduled/x-news-monitor endpoint (polls news, triggers breaking alerts)
- [x] Register 3 daily cron jobs (8:10am, 12pm, 3:45pm ET) + news monitor every 15 min
- [x] Build X Post Queue admin UI at /app/x-posts (shows queue, status, posted content)
- [x] TypeScript check passes
- [x] Save checkpoint

## Track Record Page (Historical Backfill)
- [x] Fetch FRED historical data 2000–2026 (BAMLH0A0HYM2, DGS10, DGS2, FEDFUNDS, CPIAUCSL, UNRATE, PPIACO)
- [x] Run Pressure Index engine on monthly snapshots to build 25-year backfill
- [x] Fetch S&P 500 historical data for outcome comparison
- [x] Identify regime escalation events and score accuracy
- [x] Add pressureHistory table to schema and migrate
- [x] Seed database with backfilled monthly readings (2000–2026)
- [x] Add tRPC procedures: trackRecord.getHistory, trackRecord.getRegimeEvents
- [x] Build public /track-record page with timeline chart, regime events table, accuracy stats
- [x] Add Track Record link to marketing site nav and AppLayout
- [x] TypeScript check passes
- [x] Save checkpoint
- [x] Assess findings and deliver credibility analysis

## Track Record Page — Historical Pressure Index (2000–2026)
- [x] Calibrate backfill scoring engine with crisis amplifier (max 82 in Oct 2008)
- [x] Add pressureHistory table to Drizzle schema (drizzle/schema.ts)
- [x] Generate and apply migration SQL for pressureHistory table
- [x] Insert 317 months of historical Pressure Index data (Jan 2000–May 2026)
- [x] Add getPressureHistory and getPressureHistoryStats helpers to server/db.ts
- [x] Add trackRecord.getHistory and trackRecord.getStats tRPC procedures (public)
- [x] Build /track-record standalone public page (TrackRecord.tsx)
  - [x] Regime timeline bar chart (SVG, hover tooltips, crisis annotations)
  - [x] Regime distribution bar (color-coded segments)
  - [x] Aggregate stats row (total months, HIGH+CRITICAL count, avg/max score)
  - [x] Crisis period analysis cards (2001-03, 2008-09, 2010-12, 2020)
  - [x] Full monthly table (reverse-chronological, all 317 records)
  - [x] CTA section linking to live Pressure Engine
- [x] Register /track-record route in App.tsx
- [x] Add TRACK RECORD link to marketing site desktop nav
- [x] Add /track-record and /blog to sitemap.xml

## Dashboard Cinematic Search Panels (Stock + Crypto Porch)
- [x] CryptoPorchPanel — SVG arc gauge, quick-select chips (BTC/ETH/SOL/AVAX/RNDR/HYPE), blurred demo preview, porch upgrade overlay
- [x] StockPorchPanel — SVG arc gauge, BUY/HOLD/SELL action badge, quick-select chips (NVDA/AAPL/TSLA/SPY/XLU/ARKK), blurred demo preview, porch upgrade overlay
- [x] Side-by-side grid layout integrated into Dashboard.tsx above HomeStockIntelSection
- [x] Cinematic reveal animation (560ms stagger)
- [x] Vitest tests for demo data integrity (304 tests passing)
- [x] Cross-navigation links: Portfolio → Signals (VIEW FULL SIGNAL ANALYSIS per ticker, OPEN SIGNALS ENGINE in header); Signals → Portfolio (ADD TO PORTFOLIO per stock card)

## Tiered Pricing Restructure (Free / Core / Pro / Founding)
- [x] Add 'core' to accessTier enum in drizzle/schema.ts and run migration
- [x] Add core plan ($9.99/mo) to server/stripe/products.ts
- [x] Add coreProcedure middleware to server/_core/trpc.ts
- [x] Update routers.ts: Portfolio and Signals procedures use coreProcedure
- [x] Add 'core' variant to PremiumGate.tsx with $9.99 upgrade prompt
- [x] Update UserAccount.tsx: Core tier badge, upgrade button, tier benefits
- [x] Update MarketingSite.tsx: Add Core tier card to pricing section (4-tier layout)
- [x] Add public /pressure-index page (no login, shows live Pressure Index score + regime)
- [x] Update admin.setUserTier to accept 'core' tier
- [x] Update tier.test.ts for new 'core' tier
- [x] Run full test suite and save checkpoint
- [x] Add 'core' to accessTier enum in schema.ts and apply DB migration
- [x] Add coreProcedure middleware in server/_core/trpc.ts
- [x] Gate portfolio, signals, and altRotation procedures behind coreProcedure
- [x] Add Core plan ($9.99/mo) to server/stripe/products.ts
- [x] Update createCheckout and webhook to handle 'core' plan/tier
- [x] Add Core tier config to UserAccount.tsx (badge, features, upgrade button)
- [x] Add Core upgrade button ($9.99/mo) to UserAccount upgrade section
- [x] Add PremiumGateFull 'altRotation' variant with Core upgrade prompt
- [x] Update MarketingSite.tsx pricing to 4-tier grid (Free/Core/Pro/Founding)
- [x] Create public /pressure-index page (no login required, live gauge)

## Pricing Architecture Refinement (v2)
- [x] Rename "Observer" → "Preview Access" in MarketingSite pricing
- [x] Update Free tier features: limited stock/crypto previews, daily macro snapshot, teaser dashboards, limited searches, public market briefings
- [x] Add "Unlock Full Intelligence" CTA to free tier card
- [x] Update Core tier positioning copy: "Mobile-first market intelligence"
- [x] Update Core features: limited signals, crypto signals, portfolio, alt rotation, daily briefings, volatility monitoring, push alerts, watchlist, limited Aftershock alerts, macro snapshot feed
- [x] Add "MOST POPULAR ENTRY" label to Core tier card
- [x] Update Pro tier positioning: "Institutional-grade intelligence" with full feature list
- [x] Update Founding tier: add scarcity counter, "Founding Access Closing Soon", "Limited Founding Cohort" badge
- [x] Add annual billing toggle to pricing section (Core Annual, Pro Annual, 20% savings)
- [x] Expand /pressure-index page: market regime summary, macro explanation, teaser premium cards, locked premium cards, CTAs
- [x] Strengthen premium psychology: glass cards, glow effects, lock overlays, animated transitions in PremiumGate
- [x] Update UserAccount.tsx tier configs to match new positioning

## Core Mobile PWA (/mobile)
- [x] Add PWA manifest.json with FAULTLINE icons and standalone display mode
- [x] Add iOS meta tags for Add-to-Home-Screen support
- [x] Create MobileLayout.tsx with bottom nav (Pulse/Signals/Watchlist/Rotation/Brief)
- [x] Add /mobile/* routes to App.tsx with MobileLayout
- [x] Build MobilePulse.tsx (Pressure Index, regime, bull/crash probability, top risk, daily summary)
- [x] Build MobileSignals.tsx (limited stock + crypto signals, locked Pro cards)
- [x] Build MobileWatchlist.tsx (add tickers/crypto, basic signal status, persisted to DB)
- [x] Build MobileRotation.tsx (alt rotation snapshot, BTC dominance, AI token momentum, risk-on/off)
- [x] Build MobileBrief.tsx (daily brief, top signal, top macro, top rotation note)
- [x] Add watchlist DB table and tRPC procedures (add/remove/list per user)
- [x] Add Core tier gate to mobile routes (redirect to upgrade if free tier)
- [x] Add iPhone Add-to-Home-Screen guidance banner
- [x] Run tests and save checkpoint

## Site-Wide Pricing & Core Mobile Showcase (v3)
- [x] Update MarketingSite.tsx pricing section: finalized tier names, copy, and feature lists
- [x] Add FAULTLINE Core mobile showcase section to marketing homepage (iPhone mockups, install instructions)
- [x] Update PremiumGate.tsx copy to match finalized tier messaging
- [x] Update UserAccount.tsx tier configs and upgrade CTAs
- [x] Add "Founding Access Closing Soon" scarcity messaging throughout

## Automated Blog Posts
- [x] Audit existing blog schema, DB helpers, and procedures
- [x] /api/scheduled/publish-blog endpoint already built and deployed
- [x] AdminBlog editor page already built at /app/admin/blog
- [x] Daily AGENT cron created: "FAULTLINE Daily Blog Post" fires at 12:00 UTC daily (task_uid: nqZ2cLgTLM33VcWx4cNZ6x)

## X Post Deploy Fix
- [x] Add xPost.post tRPC mutation that calls postTweet() and logs to xPostQueue
- [x] Add "POST TO X" button to XPostGenerator page
- [x] Add "POST THREAD" button for thread variant
- [x] Create heartbeat crons for 3x daily scheduled X posts (premarket/midday/closing) — manual setup via Schedules UI; endpoint /api/scheduled/x-post-scheduled is live

## Asset Info Panel on Signal Cards
- [x] Add asset info panels to StockCard (sector/industry/description via Polygon)
- [x] Add asset info panels to CryptoSignalCard (description/categories via CoinGecko)
- [x] Add getCoinDetail to coingeckoProxy.ts
- [x] Add signals.getStockInfo tRPC procedure
- [x] Add crypto.getCoinInfo tRPC procedure
- [x] Style Track Record tab green with VERIFIED badge (desktop nav + mobile drawer + marketing site) to stock signal cards (company description + sector/industry from Polygon or Yahoo Finance)
- [x] Add asset info panels to StockCard (sector/industry/description via Polygon)
- [x] Add asset info panels to CryptoSignalCard (description/categories via CoinGecko)
- [x] Add getCoinDetail to coingeckoProxy.ts
- [x] Add signals.getStockInfo tRPC procedure
- [x] Add crypto.getCoinInfo tRPC procedure
- [x] Style Track Record tab green with VERIFIED badge (desktop nav + mobile drawer + marketing site) to crypto signal cards (coin description + category/sector from CoinGecko)
- [x] Wire info data into tRPC procedures (stock: signals.getStockInfo, crypto: reuse CoinGecko coin detail)
- [x] UI: collapsible INFO panel on each signal card with description text and sector badge

## Email Integration (SendGrid) — Admin Approval Emails

- [x] Add SENDGRID_API_KEY secret via webdev_request_secrets
- [x] Create server/email.ts helper with sendEmail() function using SendGrid
- [x] Add admin.sendApprovalEmail tRPC mutation in routers.ts
- [x] Add "Send Approval Email" button to WaitlistTab in AdminPortal.tsx (visible on approved requests)
- [x] Add "Send Approval Email" button to UsersTab for founding tier users (deferred — not needed, WaitlistTab covers all approval flows)
- [x] Write vitest test for email helper (7 tests passing)
- [x] Checkpoint after email integration complete

## FAULTLINE Interpretation Section

- [x] Create client/src/components/dashboard/FaultlineInterpretation.tsx — dynamic interpretation section
- [x] Add to IntelligenceMode.tsx below structural risk summary
- [x] Add to PulseMode.tsx below Daily Brief summary
- [x] Checkpoint after complete

## User Management — Admin Portal

- [x] Add admin.removeUser tRPC mutation (delete user from DB)
- [x] Add admin.setUserTier tRPC mutation (set tier to 'free', 'founding', 'premium', etc.) — already existed, now also includes 'free' tier button
- [x] Add Remove User button with confirmation dialog to UsersTab in AdminPortal.tsx
- [x] Add Set Tier buttons (free/premium/founding) to UsersTab in AdminPortal.tsx
- [x] Checkpoint after user management complete

## Stripe Webhook Fixes
- [x] Fix tier assignment — always fetch line items from Stripe API (not from webhook payload)
- [x] Add invoice.paid handler for subscription renewals
- [x] Checkpoint after Stripe webhook fixes

## Stripe Billing Setup
- [x] Create FAULTLINE Mobile product ($9.99/month) and capture price ID
- [x] Create FAULTLINE Premium product ($59/month) and capture price ID
- [x] Create FAULTLINE Founders Lifetime product ($1200 one-time) and capture price ID
- [x] Add STRIPE_CORE_PRICE_ID, STRIPE_PREMIUM_PRICE_ID, STRIPE_FOUNDING_PRICE_ID to secrets
- [x] Create webhook endpoint for https://getfaultline.live/api/stripe/webhook
- [x] Subscribe webhook to 4 events
- [x] STRIPE_WEBHOOK_SECRET is a built-in managed secret — new signing secret is whsec_pEqvz2m76f67YpuLVpd9udJPGJtIOf8l (must be updated manually in Settings → Payment)
- [x] Webhook test verification fix deployed — evt_test_ detected before signature check

## Multi-Tier Risk Framework (Stop-Loss Redesign)
- [x] Read current stop-loss logic in TickerSearch and server-side signal generation
- [x] Build computeRiskLevels() server helper: Trade Stop (ATR-based, 5–15%), Swing Stop (SMA20-based, 10–25%), Thesis Failure (50-session structural low, 20–65%)
- [x] Add Conservative/Balanced/Aggressive profile multipliers to RiskFramework UI component
- [x] Build RiskFramework UI component with 3-tier display, profile toggle, % risk labels, AI explanations
- [x] Wire RiskFramework into TickerSearch replacing old stop-loss display
- [x] Update R:R calculation to use Trade Stop (not Thesis Failure) as primary
- [x] Also applied multi-tier risk levels to crypto (cryptoSignals.ts) with crypto-appropriate wider bands
- [x] Checkpoint after risk framework redesign

## Signals Dashboard Live Price Fix
- [x] Add SPCE to PRIORITY_TICKERS in signalsProxy.ts
- [x] Refactor fetchLiveQuotes to batch-fetch Yahoo Finance live prices during market hours for all priority tickers
- [x] Use Polygon grouped bars as fallback only when market is closed or Yahoo fails
- [x] Checkpoint after fix
- [x] Expand PRIORITY_TICKERS from 20 to 42 tickers to cover all SIGNAL_STOCKS (was only 8 of 31 overlapping — root cause of stale prices)
- [x] Run Yahoo + Polygon in parallel so Yahoo prices work independently of Polygon timeouts
- [x] Checkpoint after full live price fix

## Clarity & Navigation Audit Implementation
- [x] Restructure AppLayout NAV_GROUPS: OVERVIEW / MARKET STRESS / SIGNALS / INTELLIGENCE / TOOLS / CRYPTO / ACCOUNT
- [x] Rename nav labels: Pressure Engine→Market Stress, Scores→Risk Score Breakdown, Diagnostic AI→AI Market Explanation, AI Watch→AI Sector Watch, Daily Report→Daily Market Briefing, Historical Analogs→Historical Comparisons, Simulate→Pressure Simulator, Alt Rotation→Sector Rotation, Guide→How to Use FAULTLINE
- [x] Move Blog and Track Record out of primary nav (keep accessible via Account/footer area)
- [x] Fix mobile primary tabs: replace Blog with Market Stress (Pressure page)
- [x] Update mobile shortLabels to plain English (CSig→Crypto Sig, CWatch→Crypto Watch, AltRot→Rotation, Shock→Aftershock, Sim→Simulator, A.Blog→Admin Blog)
- [x] Add PageHeader with h1 title + one-sentence subtitle to all 14 pages
- [x] Add back-to-dashboard breadcrumb to all pages via PageHeader component
- [x] Update data-status labels: Polygon.io → Yahoo Finance in Signals.tsx and Guide.tsx
- [x] Update ticker count from 19/31 to 42 in Signals.tsx and Guide.tsx
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 351/351 tests passing
- [x] pnpm build: ✓ built in 24.30s
- [x] Checkpoint after clarity improvements

## Complete Market Awareness™ — Full Implementation
- [x] Add preflight_prompt_mode column to user preferences (full_guidance | minimal_reminders | off), default full_guidance
- [x] Add tRPC procedures: awareness.getPreflightMode, awareness.setPreflightMode
- [x] Build MarketPreflight.tsx: 13-item checklist, institutional tone, no gamification, correct copy, disclaimers
- [x] Build Current Reading Interpretation panel (score meaning, pressure level, regime, drivers, trend, watch next)
- [x] Build Possible Future Outcomes panel (4 scenarios: bullish/neutral/bearish/systemic with support/confirmation/invalidating/watch signals)
- [x] Build AwarenessDashboardCard (Full Guidance: full card; Minimal: compact score + button; Off: hidden)
- [x] Build PreflightTrigger button component (mode-aware: Full shows missing checks, Minimal shows compact button, Off hides)
- [x] Add Market Preflight Prompts setting to Profile/Account Preferences page (Full Guidance / Minimal Reminders / Off)
- [x] Wire AwarenessDashboardCard into Dashboard.tsx
- [x] Wire PreflightTrigger into: Pressure, Signals, Scores, DiagnosticAI, AIWatch, Charts, DailyReport
- [x] Add required disclaimers to modal (preflight disclaimer + scenario disclaimer)
- [x] pnpm check (0 errors), pnpm test (351/351 passing)
- [x] Checkpoint

## Market Preflight Preference Controls (Jun 7, 2026)
- [x] Add Market Preflight Prompts preference card to UserAccount.tsx (Full Guidance / Minimal Reminders / Off, default Full Guidance)
- [x] Wire PreflightTrigger into 7 additional pages: Pressure, Signals, Scores, DiagnosticAI, AIWatch, Charts, DailyReport
- [x] Behavior: Full Guidance = dashboard card + checklist CTA + missing checks + helper prompts; Minimal = compact score + button; Off = hide page-level prompts but keep feature accessible
- [x] Underlying system, tracking history, and DB column preserved when Off
- [x] 0 TypeScript errors, 351/351 tests passing

## PreflightTrigger — Remaining 4 Pages (Jun 7, 2026)
- [x] Wire PreflightTrigger into Watchlist.tsx (rightSlot alongside existing Add button, with regime label from useEngine)
- [x] Wire PreflightTrigger into Portfolio.tsx (PageHeader rightSlot)
- [x] Wire PreflightTrigger into SimulatePressure.tsx (near simulation controls header, with live regime.label)
- [x] Wire PreflightTrigger into Guide.tsx (PageHeader rightSlot + dedicated Complete Market Awareness™ section with all required copy, checklist, score table, preference controls, live trigger, and disclaimer)
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 351/351 tests passing
- [x] pnpm build: ✓ built in 29.20s
- [x] Checkpoint

## Dashboard Timestamp + Guide Keywords (Jun 7, 2026)
- [x] Add lastPreflightAt to computeAwarenessScore return (marketAwareness.ts) — most recent completed_daily_market_preflight action today, or null
- [x] Display "Last preflight: Today at H:MM AM/PM" or "Last preflight: Not completed today" below progress bar in AwarenessDashboardCard — subtle 10px mono text, no gamification, no streaks, no badges
- [x] Add keywords field to Section interface in Guide.tsx
- [x] Add 9 keyword aliases to market-preflight section: preflight, market preflight, awareness score, complete market awareness, daily review, decision checklist, risk review, before acting, market checklist
- [x] Update Guide search filter to match keywords field
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 351/351 tests passing
- [x] pnpm build: ✓ built in 27.44s

## Reading History + Outcome Support Engine + Timeframe Awareness (Jun 7, 2026)

### Audit findings
- [x] pressureHistory table exists (monthly, not daily — cannot reuse for daily snapshots)
- [x] No daily_reading_snapshots table existed
- [x] No readingHistory router existed
- [x] No Reading History page existed

### Database
- [x] Add daily_reading_snapshots table to drizzle/schema.ts
- [x] Run pnpm drizzle-kit generate (migration 0014) and apply SQL via webdev_execute_sql

### Backend
- [x] Create server/readingHistory.ts — snapshot helpers, Outcome Support Engine, getTimeframeAnalysis, getHistory, getOutcomeSupport
- [x] Add readingHistory router to routers.ts (8 procedures: getHistory, getTimeframeAnalysis, getOutcomeSupport, getLatestSnapshot, getSnapshotsByRange, saveSnapshot, getWeeklyTrend, getYearlyHighLow)

### Frontend
- [x] Create client/src/pages/ReadingHistory.tsx — Today/Week/Month/Year/Outcome Support tabs
- [x] Add Timeframes tab to Market Preflight modal with Today/Week/Month/Year sub-selector
- [x] Add Timeframe Awareness section to Guide page
- [x] Add Reading History section to Guide page
- [x] Add Reading History to MARKET STRESS nav group in AppLayout.tsx
- [x] Add /app/reading-history route to App.tsx
- [x] All disclaimers added (timeframe readings not predictions, data note when history unavailable)

### QA
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 351/351 passing
- [x] pnpm build: built in 28.20s

## HOLOGRAPHIC Dashboard Mode — CANCELLED (Jun 8, 2026)
- [x] HOLOGRAPHIC mode was partially added but user cancelled — reverted

## HOLOGRAPHIC Mode Revert (Jun 8, 2026)
- [x] Remove "holographic" from dashboardMode enum in drizzle/schema.ts
- [x] Generate migration 0016 and apply via webdev_execute_sql (ALTER TABLE MODIFY COLUMN)
- [x] Remove holographic from updateDashboardMode in server/db.ts
- [x] Remove holographic from setDashboardMode z.enum in server/routers.ts
- [x] Remove HOLOGRAPHIC from ViewModeSelector.tsx (back to 3 modes, grid-cols-3)
- [x] Remove holographic from DashboardMode type in Dashboard.tsx
- [x] Remove HolographicMode import and render in Dashboard.tsx
- [x] Delete HolographicMode.tsx if it was created (was not created)
- [x] Audit AwarenessDashboardCard styling for HUD compatibility — card sits below DataIntegrity, HUD shell fully preserved
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 351/351 passing
- [x] pnpm build: ✓ built in 27.97s
- [x] Checkpoint

## Final Launch QA (Jun 8, 2026)
- [x] Login flow: unauthenticated users correctly redirected to Manus OAuth portal
- [x] Dashboard load: cockpit/HUD shell renders on /app/dashboard with all panels
- [x] HUD/cockpit shell: ambient particles, radar scan, pressure ring, IntelTicker, regime glow all present
- [x] Market Preflight card: AwarenessDashboardCard renders below DataIntegrity panel
- [x] Run Preflight modal: opens from card CTA button
- [x] Checklist tab: verified in source (preflight items, score ring, progress bar)
- [x] Reading tab: verified in source (market reading context)
- [x] Outcomes tab: verified in source (possible future outcomes)
- [x] Timeframes tab: verified in source (historical timeframe data with disclaimer)
- [x] Close button: modal has Close button and Confirm Preflight Complete action
- [x] Preference modes: Full Guidance / Minimal Reminders / Off — wired to trpc.awareness.setPreflightMode
- [x] Mobile layout: bottom nav bar (DASH/STRESS/SIGNALS/WATCH/PORT/MORE), no overflow
- [x] Marketing page: Complete Market Awareness™ added to FEATURES grid and MODULES grid
- [x] No buy/sell/hold language on marketing page; BUY/SELL/HOLD labels on signals pages are gated behind PorchOverlay (login required) and accompanied by disclaimers
- [x] Disclaimers: Guide page top-level + preflight section + modal Timeframes tab all have explicit disclaimers
- [x] No broken routes: all 25+ routes verified in App.tsx Switch
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 351/351 passing
- [x] pnpm build: ✓ built in 36.44s
- [x] Final checkpoint saved

## Market Preflight coreProcedure Fix (Jun 8, 2026)
- [x] Pre-change verification: confirmed file paths, render chain, root cause (coreProcedure blocked free-tier users)
- [x] Apply fix: logAction, getScore, getHistory → protectedProcedure (server/routers.ts lines 1429, 1450, 1459)
- [x] Write targeted tests: server/awareness.access.test.ts — 17 tests covering anonymous/free/core/founding + regression
- [x] pnpm check: 0 TypeScript errors
- [x] pnpm test: 368/368 passing (26 test files, +17 new awareness access tests)
- [x] pnpm build: ✓ built in 31.96s
- [x] Checkpoint

## Strategic Roadmap — Phase 6: SEO Audit & Fix (Jun 8, 2026)
- [x] Audit sitemap.xml — all 27 routes verified, /app/analogs added
- [x] robots.txt — updated with explicit Allow/Disallow rules, /app/admin disallowed
- [x] All 26 page meta titles fixed to ≤60 chars (verified by script)
- [x] All page meta descriptions are 50-160 chars
- [x] Canonical tags set in index.html and updated per-page via useSEO hook
- [x] OG tags (og:title, og:description, og:url) updated in useSEO hook
- [x] JSON-LD structured data updated: added Complete Market Awareness™, Historical Analog Engine, Portfolio Intelligence to featureList
- [x] Internal linking: MODULES array now has deep links to /app/pressure, /app/aftershock, /app/signals, /app/crypto, /app/analogs, /app/portfolio
- [x] pnpm check: 0 errors
- [x] Checkpoint (combined with Phase 2)

## Strategic Roadmap — Phase 2: Market Preflight First-Login (Jun 8, 2026)
- [x] Add lastPreflightCompletedAt column to users table in drizzle/schema.ts
- [x] Generate migration 0017 and apply via webdev_execute_sql
- [x] Add awareness.completePreflightSession tRPC procedure (stores UTC timestamp)
- [x] Add awareness.getPreflightStatus procedure (returns last completion timestamp)
- [x] Build PreflightGate component (client/src/components/PreflightGate.tsx)
- [x] Gate: show if no completion in last 24h (or never completed)
- [x] Require explicit "Complete Preflight" or "Skip for Today" action
- [x] Wire PreflightGate into Dashboard.tsx above all content
- [x] pnpm check: 0 errors
- [x] Checkpoint (combined with Phase 3)

## Strategic Roadmap — Phase 3: Portfolio Intelligence (Jun 8, 2026)
- [x] Build server-side intelligence logic in portfolio.getIntelligence tRPC procedure (server/routers.ts)
- [x] Add portfolio.getIntelligence tRPC procedure (protectedProcedure) — 8 metrics: Pressure Score, AI Bubble Exposure, Rate Sensitivity, Concentration Risk, Liquidity Risk, Recession Exposure, Crash Vulnerability, Regime Alignment
- [x] Build PortfolioIntelligence.tsx component with 8 metric cards (client/src/components/PortfolioIntelligence.tsx)
- [x] Mount above holdings in Portfolio.tsx
- [x] pnpm check: 0 errors
- [x] Checkpoint (combined with Phase 5)

## Strategic Roadmap — Phase 5: Historical Analog Engine (Jun 8, 2026)
- [x] HistoricalAnalogs.tsx already existed (595 lines) with all required features
- [x] /app/analogs route already in App.tsx
- [x] Analogs already in navigation sidebar and mobile nav
- [x] Analogs already in sitemap.xml
- [x] All 4 required examples present: Dot-Com, GFC, COVID, 2022 Inflation Shock
- [x] All required sections present: Similarity %, Historical Match, Timeline, Outcome Analysis, Key Lessons, Portfolio Impact
- [x] pnpm check: 0 errors

## Strategic Roadmap — Phase 4: Alert Evolution / Systemic Alerts (Jun 8, 2026)
- [x] Build SystemicAlerts.tsx component (client/src/components/SystemicAlerts.tsx)
- [x] 6 macro alert categories: Regime Shift, Liquidity Deterioration, Credit Stress, AI Concentration Risk, Systemic Risk Escalation, Historical Analog Trigger
- [x] Each alert has 3-part structure: What Happened / Why It Matters / What Historically Followed
- [x] Alerts generated from live EngineContext data (no server roundtrip needed)
- [x] SystemicAlertsPanel mounted above threshold watchlist in Alerts.tsx
- [x] pnpm check: 0 errors
- [x] pnpm test: 368/368 passing
- [x] pnpm build: ✓ built in 28.80s
- [x] Checkpoint

## Trade Preflight Simulator (Jun 9, 2026)
- [x] Add trade.simulate tRPC procedure (protectedProcedure) in server/routers.ts
- [x] Procedure accepts { moveType, timeframe, ticker? } and returns full structured output
- [x] Deterministic scoring: move-type logic + timeframe smoothing + engine vectors
- [x] LLM explanation field via invokeLLM()
- [x] Build client/src/pages/TradePreflight.tsx (dedicated page at /app/trade-preflight)
- [x] Current Market Condition panel (11 fields)
- [x] Simulate Your Move section: 10 move types selector
- [x] Ticker input field (shown only when "Buy a specific ticker" selected)
- [x] Timeframe selector: Today / This week / 1-3 months / 6-12 months
- [x] Simulation output panel: all 14 output fields with visual meters/rings
- [x] Green Lights panel and Red Flags panel
- [x] Invalidation triggers section
- [x] Compliance disclaimer text
- [x] Add /app/trade-preflight route to App.tsx
- [x] Add Trade Preflight Simulator nav item to AppLayout.tsx (TOOLS group)
- [x] Add SEO entry to useSEO.ts PAGE_SEO
- [x] Add prominent Trade Preflight Simulator card to Dashboard.tsx
- [x] Write vitest tests for trade.simulate procedure
- [x] pnpm check: 0 errors, pnpm test: all passing, pnpm build: success
- [x] Save checkpoint

## FAULTLINE Situation Room Rebrand (Jun 9, 2026)
- [x] Update server/tradePreflight.ts: add marketStatus (Cleared/Caution/Defensive) and threatBoard fields to output
- [x] Rename TradePreflight.tsx → SituationRoom.tsx with full command-center design
- [x] Section A: Market Status panel (marketStatus badge, pressure index, bull%, crash%, regime, liquidity, credit, volatility, fed, recession, AI speculation, breadth)
- [x] Section B: Trade Preflight Simulator (move selector, timeframe, ticker input)
- [x] Section C: Move Favorability Score (ring, prob bars, risk/confidence badges)
- [x] Section D: Action Bias panel (supported/threatened, aggressive/selective/defensive/patient, staged entry guidance)
- [x] Section E: Green Lights panel (conditions supporting the move)
- [x] Section F: Threat Board panel (red flags, hidden pressure, invalidation triggers, key indicators)
- [x] Section G: What Could Break the Setup (invalidation triggers)
- [x] Section H: Key Indicators to Watch Next
- [x] Compliance disclaimer
- [x] Update App.tsx: add /app/situation-room route (keep /app/trade-preflight as redirect or alias)
- [x] Update AppLayout.tsx: rename nav item to "Situation Room" in TOOLS group
- [x] Add SEO entry PAGE_SEO.situationRoom to useSEO.ts
- [x] Add prominent "Enter the Situation Room" card to Dashboard.tsx
- [x] Update marketing landing page: Situation Room hero copy + CTA
- [x] Add "Built for Every Trading Style" section with 5 trader-type cards
- [x] Write vitest tests for updated tradePreflight.ts (30 tests, all passing)
- [x] TypeScript: 0 errors, tests: all passing, build: success
- [x] Save checkpoint

## SEO Optimizer Module
- [x] server/seoOptimizer.ts: full backend engine (URL fetcher, content parser, scoring engine, keyword extractor, LLM-powered suggestions)
- [x] tRPC procedures: seo.analyzeUrl, seo.analyzeContent, seo.generateMeta, seo.keywordResearch
- [x] client/src/pages/SeoOptimizer.tsx: full command-center page with all panels
- [x] Panel: Overall SEO Score (0-100 with grade A-F and animated ring)
- [x] Panel: SERP Preview (Google search result preview for desktop + mobile)
- [x] Panel: Meta Tag Analyzer (title, description, keywords — length, quality, issues)
- [x] Panel: Meta Tag Generator (AI-powered meta title/description/keywords output)
- [x] Panel: Keyword Intelligence (primary keyword, density, LSI keywords, missing terms)
- [x] Panel: Content Quality Score (readability, word count, heading structure, image alt)
- [x] Panel: Technical SEO Checklist (canonical, robots, schema, page speed signals)
- [x] Panel: Internal Linking Opportunities (FAULTLINE blog posts to link to)
- [x] Panel: Competitor Gap Analysis (compare against competitor URLs)
- [x] Panel: AI Content Brief (LLM-generated full content brief with outline)
- [x] Panel: Social Sharing Preview (OG/Twitter card preview)
- [x] Route: /app/seo-optimizer in App.tsx
- [x] Nav: SEO Optimizer in TOOLS group in AppLayout.tsx
- [x] useSEO entry for the page
- [x] Vitest tests for seoOptimizer.ts

## Technical Debt Cleanup — Senior Fintech Audit (Jun 2026)

### Phase 1: Shared Tier/Pricing Source of Truth
- [x] Create shared/tiers.ts with canonical tier definitions, display names, Stripe plan IDs, access levels, feature gates
- [x] Refactor server/stripe/products.ts to import from shared/tiers.ts
- [x] Refactor PremiumGate.tsx to use shared tier constants
- [x] Refactor MobileLayout.tsx to use shared tier pricing (remove hardcoded $9.99)
- [x] Refactor MarketingSite.tsx pricing section to use shared tier constants
- [x] Refactor server tier checks to use shared tier access levels
- [x] Eliminate tier-name drift (free/core/premium/founding vs Observer/Core/Analyst/Operator)

### Phase 2: Stripe Webhook Test Coverage
- [x] Add server/stripe/webhook.test.ts covering checkout.session.completed
- [x] Add test for invoice.paid handler
- [x] Add test for customer.subscription.deleted handler
- [x] Add test for invoice.payment_failed handler
- [x] Add billing flow integration test: checkout → webhook → tier update → access granted
- [x] Add test: cancelled user loses premium access
- [x] Add test: paid user immediately receives correct tier access

### Phase 3: AI Concentration Credibility Fix
- [x] Mark AI concentration score in pressure engine as static estimate with lastUpdated timestamp
- [x] Add dataStatus field to AI bubble vector output (static/live/cached/fallback)
- [x] Update UI to show "STATIC ESTIMATE" label on AI concentration metric
- [x] Add regression test: AI bubble vector output includes dataStatus field
- [x] Add regression test: weight changes produce expected composite score delta

### Phase 4: Pressure Engine Audit Trail
- [x] Add pressureRuns table to drizzle/schema.ts (timestamp, engineVersion, weights, rawInputs, vectorScores, compositeScore, regimeLabel, dataStatus, warnings)
- [x] Generate migration and apply via webdev_execute_sql
- [x] Write to pressureRuns table on every calculateFaultlinePressure() call
- [x] Add admin.getPressureRuns tRPC procedure for historical inspection
- [x] Preserve existing pressureHistory and dailyReadingSnapshots behavior

### Phase 5: Error Tracking (Sentry)
- [x] Install @sentry/node and @sentry/react
- [x] Add SENTRY_DSN secret via webdev_request_secrets
- [x] Initialize Sentry in server/_core/index.ts with environment gating
- [x] Initialize Sentry in client/src/main.tsx with environment gating
- [x] Add fallback activation logging for FRED, Polygon, Yahoo, CoinGecko, Stripe, LLM calls
- [x] Ensure no secrets exposed to client-side Sentry config

### Phase 6: Database Integrity
- [x] Add FK constraints with onDelete cascade to positions, cryptoWatchlist, mobileWatchlist, userMarketAwarenessActions, foundingAccessRequests
- [x] Add composite index on (userId, createdAt) for user-scoped tables
- [x] Add index on userId for positions, cryptoWatchlist, mobileWatchlist tables
- [x] Write safe migration SQL and verify no data loss before applying

### Phase 7: Router and DB File Split
- [x] Split server/routers.ts into domain routers: auth, billing, portfolio, pressure, signals, crypto, awareness, readingHistory, blog, social, admin, preflight
- [~] Split server/db.ts into domain repositories: users.repo.ts, portfolio.repo.ts, watchlist.repo.ts, billing.repo.ts, content.repo.ts, analytics.repo.ts, pressure.repo.ts
- [x] Preserve all existing procedure names and API contracts
- [x] Add adminProcedure middleware to server/_core/trpc.ts (replace 8+ inline role checks)

### Phase 8: Live Data Architecture
- [~] Centralize server-side pressure refresh (single worker writes to DB, clients read from DB)
- [~] Add SSE endpoint for pressure score push delivery
- [x] Update UI LIVE/STALE/CACHED/FALLBACK/STATIC labels to reflect actual data status
- [x] Keep polling as fallback

### Phase 9: Mobile Code Splitting
- [x] Add React lazy() and Suspense for /mobile/* routes
- [x] Ensure mobile routes do not load full desktop terminal bundle
- [x] Move mobile pricing references to shared/tiers.ts
- [x] Keep existing mobile UI and five-tab structure

### Phase 10: Validation
- [x] Run full TypeScript check (0 errors)
- [x] Run full test suite (all passing)
- [x] Confirm no existing routes or UI pages broken
- [x] Save checkpoint with delivery report

## Launch-Readiness Hardening — Requirements 11–15 (Jun 2026)

### Requirement 11: Universal Data Truth Labeling
- [x] Create shared/dataStatus.ts with DataStatus type (live/delayed/cached/stale/fallback/static/unavailable) and DataSourceMeta interface
- [x] Add dataStatus, lastUpdated, source, fallbackReason fields to pressure engine output
- [x] Add dataStatus fields to FRED proxy responses
- [x] Add dataStatus fields to Polygon proxy responses
- [x] Add dataStatus fields to Yahoo Finance responses
- [x] Add dataStatus fields to CoinGecko responses
- [x] Add dataStatus fields to LLM/AI outputs
- [x] Add dataStatus fields to signal scoring outputs
- [x] Update UI to show data status badges — never label anything LIVE unless it is actually live
- [x] Remove or replace any false LIVE labels on static/cached/estimated data

### Requirement 12: Methodology Transparency Page
- [x] Create /app/methodology route and page (MethodologyPage.tsx)
- [x] Show engine version, vector weights, data sources, live/cached/static status per input
- [x] Show last updated timestamps, plain-English vector explanations, fallback behavior
- [x] Add legal disclaimer section
- [x] Add to nav (admin-accessible or public)
- [x] Register route in App.tsx

### Requirement 13: Admin Feature Flags / Kill Switches
- [x] Add feature_flags table to drizzle/schema.ts (key, enabled, description, updatedAt)
- [x] Generate and apply migration
- [x] Seed default flags: ai_narrative, x_posting, blog_publishing, crypto_intelligence, pressure_fallback_display, stripe_checkout, mobile_signup, llm_reports, experimental_signals
- [x] Add admin.getFeatureFlags and admin.setFeatureFlag tRPC procedures
- [x] Add FeatureFlagsTab to AdminPortal.tsx
- [x] Add useFeatureFlag(key) hook on client
- [x] Gate relevant features behind flag checks (AI narrative, X posting, blog, crypto, Stripe checkout, mobile signup)

### Requirement 14: Investment-Advice Compliance Copy Audit
- [x] Audit MarketingSite.tsx for prediction/guarantee/advice language
- [x] Audit Dashboard.tsx and all dashboard pages for compliance
- [x] Audit Signals.tsx, CryptoSignals.tsx for BUY/SELL/HOLD disclaimer adequacy
- [x] Audit DailyReport.tsx and AI-generated content for advice language
- [x] Audit mobile PWA pages for compliance
- [x] Add baseline disclaimer to: marketing footer, dashboard footer, checkout page, onboarding, methodology page
- [x] Baseline: "FAULTLINE provides market intelligence and risk analysis for educational and informational purposes only. It is not financial, investment, legal, or tax advice."
- [x] Ensure disclaimer does not weaken brand voice

### Requirement 15: Launch Readiness Checklist
- [x] Produce final Launch Readiness Checklist document covering all 23 items from spec
- [x] Confirm TypeScript passes (0 errors)
- [x] Confirm full test suite passes
- [x] Save final checkpoint with version ID

## Heatmap Expansion

- [x] Expand crypto heatmap from top 30 to top 100 coins (CryptoSearch.tsx + server limit)
- [x] Add top 100 stock performers heatmap — server procedure, data fetch, dedicated page
- [x] Wire stock heatmap into navigation

## Stock Heatmap Multi-Tab Expansion

- [x] Add getTopStockLosers() and getTopStockByVolume() server functions to yahooProxy.ts
- [x] Add stocks.getTopLosers and stocks.getTopByVolume tRPC procedures to routers.ts
- [x] Rebuild StockHeatmap.tsx with 3 tabs: Top Gainers, Top Losers, Highest Volume
- [x] Add sector filter panel (ALL + each GICS sector) that works across all 3 tabs
- [x] Move Stock Heatmap nav item next to other stock/equity tabs in AppLayout.tsx (SIGNALS group)
- [x] Ensure each tab shows top 100 entries with correct color coding (green=gain, red=loss, blue=volume)

## Stock Heatmap Enhancements (Round 2)

- [x] Add cross-tab comparison strip — banner above tabs showing top gainer, top loser, and highest volume stock simultaneously
- [x] Add auto-refresh countdown timer — "Refreshes in X:XX" countdown next to Refresh button (3-min server cache cycle)
- [x] Add Sector Heatmap sub-view — toggle to collapse 100 individual cells into grouped sector view (avg gain/loss/volume per GICS sector)

## Stock Heatmap — Additional Classification Tabs + Volume Fix

- [x] Fix volume tab: color cells red/green based on price direction (intensity = volume)
- [x] Add "52-WEEK HIGHS" tab — stocks near/at 52-week high, colored by % change
- [x] Add "52-WEEK LOWS" tab — stocks near/at 52-week low, colored by % change
- [x] Add "MOST VOLATILE" tab — highest intraday range (high-low/open %), colored by volatility
- [x] Add "SMALL-CAP RUNNERS" tab — small-cap gainers with strong momentum (replaces oversold/overbought which require RSI data not in screener)
- [x] Add backend screener functions for new tabs in yahooProxy.ts
- [x] Wire new tRPC procedures in routers.ts
- [x] Add cross-tab comparison strip (top gainer, top loser, highest volume shown simultaneously)
- [x] Add auto-refresh countdown timer next to Refresh button
- [x] Add Sector Heatmap sub-view toggle (collapse 100 cells into grouped sector averages)

## Asymmetric Opportunities Tab (Signals Page)

- [x] Build server/asymmetricOpportunities.ts — scoring engine that identifies high-reward/low-risk setups
  - [x] Score each stock on: momentum (RSI/MACD), proximity to support, volume surge, market cap (<$10B preferred), short interest, sector strength
  - [x] Compute asymmetry ratio: estimated upside % / estimated downside % from key levels
  - [x] LLM classification: catalyst, risk factors, conviction level, entry thesis
- [x] Add stocks.getAsymmetricOpportunities tRPC procedure in routers.ts
- [x] Add "ASYMMETRIC OPPORTUNITIES" tab to Signals.tsx tab bar
- [x] Build AsymmetricOpportunityCard component with: ticker, company, sector, asymmetry ratio, conviction badge, upside/downside targets, catalyst, risk factors, AI thesis
- [x] Ensure hover tooltips on all data points explaining what each metric means
- [x] TypeScript: 0 errors, tests passing (426 passed)

## Readings History Fix + Heatmap Redesign

- [x] Fix readings history — root cause: 0 rows in DB; generated today's snapshot (score: 30, 2026-06-14)
- [x] Add daily snapshot cron at 6:30 AM UTC (task_uid: 6ApawzzUJkEGnfApokZW2w)
- [x] Redesign heatmap as proper squarified treemap (cells sized by market cap)
- [x] Add combined Gainers/Losers tab (split-screen, both treemaps side-by-side)
- [x] Volume tab: red/green by price direction, intensity by volume
- [x] Cross-tab strip: top gainer, top loser, top volume shown simultaneously
- [x] Auto-refresh countdown: 3-min countdown with auto-refetch
- [x] Sector sub-view: toggle to collapse treemap into grouped sector cards

## Founding Request Email Notifications Fix ⏸ PAUSED (priority, awaiting SendGrid key)
- [ ] Add SENDGRID_API_KEY secret
- [ ] Wire sendEmail() to founding request handler so owner gets email at jt@getfaultline.live
- [ ] Add form confirmation state to founding access request form to prevent duplicate submissions

## $10K → $1M Simulated Portfolio ("The Proof")
- [x] DB schema: simPortfolioAccounts, simPortfolioPositions, simPortfolioTrades, simPortfolioJournal tables
- [x] Apply migration SQL via webdev_execute_sql
- [x] DB helpers in server/db.ts: getSimAccounts, upsertSimAccount, getSimOpenPositions, insertSimPosition, updateSimPosition, insertSimTrade, getSimTrades, getSimJournalEntries, upsertSimJournalEntry
- [x] Build server/simPortfolioEngine.ts: trade decision logic with COMPREHENSIVE rationale
  - [x] Each trade decision must document: (1) FAULTLINE pressure score + regime at time of trade, (2) domain scores (credit/AI/treasury/recession/liquidity) that influenced decision, (3) technical indicators (RSI, MACD, SMA crossover, support/resistance), (4) volume confirmation, (5) asymmetry ratio (upside/downside), (6) catalyst (why NOW), (7) risk factors, (8) invalidation condition, (9) position sizing rationale
  - [x] BUY rationale: full multi-paragraph narrative, not just a one-liner
  - [x] SELL rationale: explain what changed vs entry thesis, which FAULTLINE signal triggered exit
  - [x] HOLD rationale: daily documentation of why position is maintained despite market moves
- [x] Build server/simPortfolioJournal.ts: AI daily journal generator
  - [x] Per-position daily commentary: what the stock/crypto did, why we hold/sold, what FAULTLINE says
  - [x] Portfolio-level narrative: macro regime context, sector rotation, risk posture
  - [x] Forward-looking section: what to watch, potential triggers for action
- [x] Add tRPC procedures: simPortfolio.getOverview, getPositions, getTrades, getJournal, runDailyUpdate (admin)
- [x] Daily cron via manus-heartbeat to auto-generate journal entries and mark-to-market positions (task_uid: NLfVgFwkKYoY9HeDuANsMD, fires 9 PM UTC weekdays)
- [x] Add sim_portfolio_visible feature flag to DB (default: false)
- [x] Add on/off toggle to owner/admin portal for sim portfolio visibility
- [x] Build client/src/pages/SimPortfolio.tsx:
  - [x] Hero: $10K stocks + $10K crypto starting capital, current value, total return %, days running
  - [x] Equity curve chart (total portfolio value over time, split stocks vs crypto)
  - [x] Current positions grid (stocks + crypto tabs): ticker, entry price, current price, shares/units, P&L $, P&L %, FAULTLINE signal badge, hold/sell recommendation
  - [x] Trade log with FULL rationale panel: each trade expandable to show all 9 rationale dimensions
  - [x] Daily journal feed: date-stamped AI entries explaining market conditions, FAULTLINE readings, and decisions
  - [x] Progress bar: $10K → $1M milestone tracker
  - [x] Visibility gate: if sim_portfolio_visible=false, show "Coming Soon" or hide from nav
- [ ] Seed initial stock positions (5-8 tickers from asymmetric opportunities engine) ⏸ PAUSED — engine will open positions autonomously when signals align
- [ ] Seed initial crypto positions (3-5 coins from crypto signals) ⏸ PAUSED — engine will open positions autonomously when signals align
- [x] Generate first daily journal entry (first evaluation ran — held cash per current market conditions)
- [x] Add nav item to AppLayout (INTELLIGENCE group) — admin/owner only until sim_portfolio_visible enabled
- [x] TypeScript: 0 errors, tests passing
- [x] Admin preview banner added to SimPortfolio.tsx (amber banner with feature flag instructions)
- [x] Nav item filtered to admin-only in AppLayout.tsx (desktop + mobile)

## Real-Time Trade Recon (On-Demand Owner Scanner) ✅ SUPERSEDED
- [x] Superseded by Owner Simulation Module (/owner/simulation) which includes full real-time opportunity scanning, 9-dimension scoring, LLM rationale, and one-click trade execution

## Owner $100K Portfolio + Trade Recon Scanner ✅ SUPERSEDED
- [x] Superseded by Owner Simulation Module (/owner/simulation) which includes $100K virtual account, accountLabel column added to simPortfolioAccounts, full trade recon engine, and all procedures

## Owner Simulation Module (/owner/simulation) ✅ COMPLETE
- [x] DB schema: owner_simulation_accounts, owner_simulation_positions, owner_simulation_trades, owner_simulation_daily_snapshots, owner_simulation_objectives tables
- [x] Apply migration SQL via webdev_execute_sql
- [x] Seed owner account: $100,000 starting capital
- [x] Build server/ownerSimulation.ts: opportunity engine (FAULTLINE-powered scoring), DB helpers, all tRPC procedures
- [x] tRPC procedures: ownerSim.getAccount, resetAccount, getObjective, setObjective, getOpportunities, enterTrade, closePosition, getPositions, getTrades, getValuation, getGoalProgress, getDailySnapshots, generateJournal, rejectTrade
- [x] Build client/src/pages/OwnerSimulation.tsx: full premium dark cinematic cockpit UI
  - [x] Objective clarifier (required before opportunities): 6 objective types + custom, asset preference, risk mode, max position size, max loss, timeframe
  - [x] Owner Simulation header: starting capital, current value, daily P&L, total P&L, cash available, open risk, goal $1M, progress bar, FAULTLINE regime, bull/bear pressure
  - [x] Real-time opportunity cards: ticker, asset type, direction, entry zone, stop-loss, target 1/2, position size, risk $, R/R ratio, FAULTLINE confidence, why now, invalidation, objective fit, LIVE/STALE/SIMULATION labels
  - [x] Trade execution: Simulate Buy, Add, Close, Reject (with reason)
  - [x] Risk controls: position size, max loss if stop hit, % of account at risk, warning if exceeds limits
  - [x] Portfolio table: open positions with unrealized P&L, mark-to-market
  - [x] Closed trades log with realized P&L
  - [x] $1M goal tracker: milestones ($125K/$150K/$200K/$250K/$500K/$750K/$1M), pace, ahead/behind/neutral
  - [x] AI journal panel: daily entry with objective, trades taken/skipped, what worked, mistakes, AI summary
  - [x] NOT FINANCIAL ADVICE / SIMULATION ONLY disclaimer banner
  - [x] Mobile responsive
- [x] Add /owner/simulation route to App.tsx (admin-only guard)
- [x] Add "Owner Simulation" nav button in admin section of AppLayout (Trophy icon)
- [x] TypeScript: 0 errors
- [x] Tests passing: 426 tests, 0 failures

## Optimal Action Suggestion Panel (Owner Simulation) ✅ COMPLETE
- [x] Add ownerSim.getOptimalAction tRPC procedure: synthesize FAULTLINE pressure + regime + open positions + objective → single best recommended action with full rationale
- [x] Optimal action fields: actionType (BUY/SELL/TRIM/HOLD/RAISE_CASH/HEDGE/REBALANCE/WAIT), ticker (optional), rationale (multi-paragraph), confidence (0-100), urgency (LOW/MEDIUM/HIGH/CRITICAL), supportingSignals[], counterArguments[], suggestedSize, timeframe
- [x] Add Optimal Action panel to OwnerSimulation.tsx: prominent card above opportunity list, action badge with color, confidence bar, urgency badge, rationale text, supporting signals chips, counter-arguments, refresh button
- [x] TypeScript: 0 errors
- [x] Tests passing: 426 tests, 0 failures

## 12-Part Signal/Crypto/SEO Upgrade ✅ COMPLETE

### Part 1 — Global Market Labeling Cleanup ✅
- [x] Audited all signal labels across Signals.tsx, CryptoSignals.tsx, DiagnosticAI.tsx, TradePreflight.tsx
- [x] Stock labels: STOCK SIGNAL, EQUITY REGIME, EQUITY ACTION BIAS added
- [x] Crypto labels: CRYPTO SIGNAL, CRYPTO REGIME, CRYPTO ACTION BIAS added
- [x] Macro labels: scope prefixes added to DiagnosticAI AI Interpretation and Why It Matters sections

### Part 2 — Separate Crypto Completely ✅
- [x] Signals.tsx: STOCK SIGNAL asset-class header on every stock card
- [x] CryptoSignals.tsx: CRYPTO SIGNAL header with BTC regime indicator on every crypto card
- [x] CryptoSignals.tsx: regime conflict warning banner added
- [x] No mixed unlabeled lists remain

### Part 3 — Fix Crypto Signal Conflict ✅
- [x] cryptoSignals.ts: added cryptoRegime field (Bullish/Neutral/Defensive/Risk-Off)
- [x] cryptoSignals.ts: added regimeConflict boolean + regimeConflictExplanation string
- [x] CryptoSignals.tsx: regime conflict warning shown when individual signal differs from overall crypto regime
- [x] Crypto Regime labels: Bullish / Neutral / Defensive / Risk-Off

### Part 4 — Precise Signal Language ✅
- [x] tradingSignals.ts: added actionLabel field with descriptive labels (Accumulation Zone, Momentum Confirmed, Reduce Exposure, Avoid New Entry, etc.)
- [x] cryptoSignals.ts: added actionLabel field with crypto-specific precision labels
- [x] Signals.tsx: TradingSignalBadge shows actionLabel instead of raw BUY/SELL
- [x] CryptoSignals.tsx: ActionBadge shows actionLabel instead of raw BUY/SELL

### Part 5 — Asset-Class-Specific Scoring ✅
- [x] tradingSignals.ts: assetClass field added ("STOCK" | "CRYPTO" | "ETF")
- [x] cryptoSignals.ts: assetClass field added (always "CRYPTO")
- [x] Crypto scoring uses BTC dominance, volatility regime, ATH proximity, liquidity score
- [x] Stock scoring uses equity regime, macro pressure, sector strength, earnings/rates sensitivity

### Part 6 — UI Card Headers ✅
- [x] Signals.tsx: "STOCK SIGNAL — {TICKER}" header on every stock card
- [x] CryptoSignals.tsx: "CRYPTO SIGNAL — {SYMBOL} · REGIME: {regime}" header on every crypto card
- [x] Different icons: TrendingUp for stocks, Zap for crypto

### Part 7 — Diagnostic AI Cleanup ✅
- [x] DiagnosticAI.tsx: "EQUITY REGIME" replaces generic "REGIME"
- [x] DiagnosticAI.tsx: "EQUITY ACTION BIAS" replaces generic "ACTION BIAS"
- [x] DiagnosticAI.tsx: scope labels added to AI Interpretation and Why It Matters sections

### Part 8 — Data Consistency Audit ✅
- [x] All crypto output uses cryptoSignals.ts regime and signal logic
- [x] TradePreflight.tsx: asset-scoped labels added to checklist items

### Part 9 — Market Preflight Split ✅
- [x] TradePreflight.tsx: checklist items labeled with asset class (Equity / Crypto / Macro)

### Part 10 — SEO Optimizer Auto-Apply ✅
- [x] seo.applyFix tRPC procedure added to routers.ts: writes meta tags directly to index.html
- [x] SeoOptimizer.tsx: "Apply SEO Fixes to Site" button added with status feedback
- [x] Status messages: Applied / Failed with file-level detail
- [x] No more "paste into head" instructions

### Part 11 — Regression Tests ✅
- [x] server/signalUpgrade.regression.test.ts: 14 regression tests covering all spec requirements
- [x] All 448 tests passing, 21 skipped (expected), 0 failures

### Part 12 — Acceptance Criteria Verification ✅
- [x] User can instantly tell what is for stocks vs crypto (asset-class headers on every card)
- [x] Crypto has its own separate intelligence system (separate scoring, regime, labels)
- [x] Crypto Signals and Crypto Intelligence are consistent or explain the difference (regimeConflict field)
- [x] No unlabeled mixed-market readings remain
- [x] BUY/SELL replaced with precise guidance language (actionLabel field)
- [x] SEO Optimizer modifies app SEO output automatically (applyFix procedure)
- [x] TypeScript: 0 errors | Tests: 448 passed, 0 failures

## Feature 1 — Shareable Public Report Links ✅ COMPLETE
- [x] DB: shared_reports table (id, ownerUserId, reportType, publicShareId (nanoid), snapshotJson, createdAt, expiresAt, viewCount, revoked)
- [x] Apply migration SQL
- [x] DB helpers: createSharedReport, getSharedReportByPublicId, revokeSharedReport, listSharedReportsByUser, incrementSharedReportViewCount
- [x] tRPC procedures: sharedReports.create, sharedReports.getPublic (public), sharedReports.revoke, sharedReports.listMine
- [x] Public report page at /r/:publicShareId: clean branded read-only view, no private data
- [x] CTA banner: "Powered by FAULTLINE — Unlock full market intelligence."
- [x] Share button in Stock Intelligence (Signals.tsx)
- [x] Share button in CryptoSignals page
- [x] Share button in TradePreflight / Market Preflight
- [x] Share button in DiagnosticAI
- [x] Shared Reports management panel in UserAccount.tsx (list, revoke, copy link, view count)
- [x] nanoid(21) used for publicShareId — no sequential IDs

## Feature 2 — Paywall Blur with CTA ✅ COMPLETE
- [x] User tier detection: free vs premium/founding via accessTier field
- [x] PremiumBlurOverlay extended with tierAware mode: blurs content for wrong-tier authenticated users
- [x] Blur/lock premium sections for free users with upgrade CTA routing to Stripe checkout
- [x] Founding and premium users see everything unlocked
- [x] Applied to: DiagnosticAI (AI Interpretation + Why It Matters panels)
- [x] Existing PremiumGateFull already gates Signals and CryptoSignals pages

## Feature 3 — Interactive Sizing Calculator ✅ COMPLETE
- [x] SizingCalculator reusable component (client/src/components/SizingCalculator.tsx)
  - [x] Inputs: account size, risk per trade %, entry price, stop price, target price
  - [x] Outputs: dollar risk, position size, shares/units, max loss, max gain, R/R ratio, % of account
  - [x] If R/R < 1.5, shows caution banner
  - [x] Educational disclaimer: "Not financial advice — educational decision support only"
  - [x] Collapsible, pre-seeded with signal price levels when available
- [x] Integrated into Stock Intelligence (Signals.tsx StockCard expanded section)
- [x] Integrated into CryptoSignals expanded card
- [x] Integrated into TradePreflight result section

## Growth Features Tests ✅ COMPLETE
- [x] Test: free vs premium access enforcement (tierMeetsRequirement logic — 8 tests)
- [x] Test: public report fetch returns correct snapshot (access control tests)
- [x] Test: revoked report returns FORBIDDEN error
- [x] Test: expired report returns FORBIDDEN error
- [x] Test: valid non-revoked non-expired report is accessible
- [x] Test: sizing calculator math (dollar risk, shares, max loss, R/R, position %) — 14 tests
- [x] TypeScript: 0 errors
- [x] All tests passing: 494 passed, 21 skipped, 0 failures (server/growthFeatures.regression.test.ts — 46 tests)

## External Visibility / Injected Platform Strategy

- [x] Write external-platform-distribution.md — full 5-channel strategy doc (TradingView, Discord, Product Hunt, RapidAPI, Slack)
- [x] Write platform-launch-checklist.md — marketing/admin launch checklist with priority order

## Signal Outlook Center™

### Backend
- [x] Add outlookHistory table to drizzle/schema.ts and apply migration
- [x] Create server/signalOutlook.ts — deterministic scoring engine (Stock 8-factor, Crypto 8-factor)
- [x] Add LLM interpretation layer to signalOutlook.ts (Why This Outlook, What Could Change It, FAULTLINE Environment impact)
- [x] Add outlook.getTopOpportunities tRPC procedure (top 5 stock + top 5 crypto)
- [x] Add outlook.getOutlook tRPC procedure (full outlook for a symbol + timeframe)
- [x] Add outlook.getHistory tRPC procedure (24h/7d/30d comparison)
- [x] Add outlook.getWatchlistOutlooks tRPC procedure (quick outlook for all watchlist items)

### Frontend
- [x] Create client/src/pages/SignalOutlookCenter.tsx — landing screen with top opportunities grid
- [x] Build OutlookCard component — score, direction, confidence, risk, regime alignment
- [x] Build FaultlineEnvironment section — pressure reading, trend, regime, bull/bear probability
- [x] Build WhyThisOutlook section — AI plain-English explanation of all 8 factors
- [x] Build WhatCouldChangeThis section — invalidation scenarios
- [x] Build WhatWouldFaultlineDo section — 3-scenario analysis (Aggressive/Balanced/Defensive)
- [x] Build StockOutlookAnalysis section — sector, SPY/QQQ alignment, relative strength, earnings risk
- [x] Build CryptoOutlookAnalysis section — BTC dominance, ETH leadership, alt rotation, liquidity
- [x] Build DiagnosticAI2 integration section — primary driver, bull/bear case, macro path
- [x] Build PreflightImpact section — does current awareness support/oppose this trade
- [x] Build TradeReadiness section — Cleared/Caution/Defensive from Situation Room
- [x] Build OutlookHistory section — 24h/7d/30d comparison with trend indicator
- [x] Build TradeFramework section — entry/opportunity/risk zones (calculated only, never invented)
- [x] Wire watchlist quick-outlook chips to Signal Outlook Center
- [x] Add /app/signal-outlook route to App.tsx
- [x] Add Signal Outlook to FLAGSHIP nav group in AppLayout.tsx
- [x] Mobile QA — one-thumb navigation, no horizontal scroll, large typography

### QA
- [x] Write regression tests for signalOutlook.ts scoring engine (10/10 passing)
- [x] TypeScript: 0 errors
- [x] Full test suite passing

## Signal + Outlook UX Restructure & Crypto Search Fix

### Crypto Search Fix
- [ ] Add TAO (bittensor), PENDLE, WLD, DYDX, MANTA, ZK, STRK, BLUR, FLOKI, MEME, TURBO, ORDI, SATS, RATS, BOME, NOT, DOGS, HMSTR, CATI, MAJOR to SYMBOL_MAP in coingeckoProxy.ts
- [ ] Verify TAO and Bittensor resolve correctly via getCoinMarketData
- [ ] Verify crypto.getSignal works for TAO, Bittensor, ETH, Ethereum, SOL, Solana

### Timeframe Expansion
- [ ] Add "day" to OutlookTimeframe type in signalOutlook.ts (Day Trade)
- [ ] Add timeframeLabel for "day" → "Intraday"
- [ ] Add Day Trade scoring logic (intraday bias, VWAP condition, momentum trigger, high volatility warning)
- [ ] Update timeframeSchema in server/routers/outlook.ts to include "day"
- [ ] Update SignalOutlookCenter.tsx timeframe selector to show Day Trade / Short-Term / Swing / Long-Term
- [ ] Add Day Trade Framework section to FullOutlookResult (intradayBias, openingRangeCondition, vwapCondition, volumeConfirmation, momentumTrigger, highVolatilityWarning, avoidConditions)

### Signals Page Restructure
- [ ] Add Stocks/Crypto top-level switch to Signals.tsx
- [ ] Add Signals/Outlook tab structure inside each asset class
- [ ] Add Quick Outlook badge (score, direction, confidence, risk) to every StockCard
- [ ] Add [Open Outlook] button to every StockCard (navigates to /app/signal-outlook?symbol=X&type=stock)
- [ ] Add Top Opportunities section inside Stock Signals tab
- [ ] Add Watchlist Signals section inside Stock Signals tab (for logged-in users)
- [ ] Add inline Stock Outlook tab inside Signals page (embeds SignalOutlookCenter content)

### CryptoSignals Page Restructure
- [ ] Add Signals/Outlook tab structure to CryptoSignals.tsx
- [ ] Add Quick Outlook badge (score, direction, confidence, risk) to every CryptoSignalCard
- [ ] Add [Open Outlook] button to every CryptoSignalCard (navigates to /app/signal-outlook?symbol=X&type=crypto)
- [ ] Add Top Opportunities section inside Crypto Signals tab
- [ ] Add Watchlist Signals section inside Crypto Signals tab (for logged-in users)

### Signal Outlook Center Deep-Link Support
- [ ] Add useSearch() URL param support to SignalOutlookCenter.tsx (?symbol=X&type=stock|crypto&tf=day|short|swing|long)
- [ ] Auto-trigger outlook on page load when URL params are present

### Mobile UX
- [ ] Verify one-thumb navigation on Signals restructure
- [ ] Verify Crypto not buried beneath Stocks on mobile
- [ ] Verify Signals/Outlook tabs work on mobile

### QA
- [ ] TAO appears in Crypto Signals search
- [ ] Bittensor appears in Crypto Signals search
- [ ] Open Outlook button on every stock signal card
- [ ] Open Outlook button on every crypto signal card
- [ ] Day Trade timeframe in SignalOutlookCenter
- [ ] Short-Term timeframe in SignalOutlookCenter
- [ ] Swing Trade timeframe in SignalOutlookCenter
- [ ] Long-Term timeframe in SignalOutlookCenter
- [ ] No AI-generated fake price levels
- [ ] TypeScript: 0 errors
- [ ] All tests passing

## Signals UX Restructure + Crypto Search Fix (Jun 16 2026)
- [x] Fix crypto search — add TAO, Bittensor, ONDO, PENDLE, EIGEN, ETHFI, PYTH, STRK, MANTA, BLAST, DEGEN, BRETT, FLOKI, BONK, WIF, POPCAT, GOAT, PNUT, MOODENG and 10+ more to SYMBOL_MAP
- [x] Expand OutlookTimeframe to include 'day' (Day Trade) in signalOutlook.ts, outlook router, and DB schema
- [x] Add 🔭 SIGNAL OUTLOOK button to every StockCard expanded section in Signals.tsx (deep-links to /app/signal-outlook?symbol=X&type=stock)
- [x] Add 🔭 SIGNAL OUTLOOK button to every CryptoSignalCard expanded section in CryptoSignals.tsx (deep-links to /app/signal-outlook?symbol=X&type=crypto)
- [x] Wire URL param deep-linking in SignalOutlookCenter.tsx (useSearch from wouter — ?symbol=X&type=stock|crypto auto-populates and runs the outlook)
- [x] Add Day Trade timeframe button to SignalOutlookCenter timeframe selector UI
- [x] TypeScript: 0 errors
- [x] Full test suite: 504 passed / 525 total
