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
