# FAULTLINE Tier Refactor Audit

## Tier System (existing, from shared/tiers.ts)
- AccessTier: 'free' | 'core' | 'premium' | 'founding'
- Hierarchy: free < core < premium < founding
- Stripe plans: core ($9.99/mo), core_annual, premium ($59/mo), premium_annual, founding ($49/mo), lifetime ($299)
- NOTE: The brief uses "Trader" = premium/founding, "Power" = new tier concept
  - We will MAP: Free=free, Trader=core+premium, Power=premium+founding (no new DB tiers needed)
  - Specifically: Trader features → require 'core' or 'premium'; Power features → require 'premium'

## Existing GateVariant → Required Tier
- signals: core
- portfolio: core
- altRotation: core
- founding: premium
- risk: premium
- intelligence: premium
- crypto: premium
- aftershock: premium
- watchlist: premium

## Pages with PremiumGate/PremiumBlurOverlay (already gated)
- AftershockEngine.tsx → PremiumGateFull variant="aftershock" (premium) — INTERNAL, hidden
- Alerts.tsx → PremiumGateFull variant="risk" (premium) → should be Trader (core)
- AltRotation.tsx → PremiumGateFull variant="altRotation" (core) ✓
- CryptoIntelligence.tsx → PremiumGateFull variant="crypto" (premium) ✓
- CryptoSearch.tsx → PremiumGateFull variant="crypto" (premium) ✓
- CryptoSignals.tsx → PremiumGateFull variant="crypto" (premium) ✓
- CryptoWatchlist.tsx → PremiumGateFull variant="watchlist" (premium) → should be core
- DiagnosticAI.tsx → PremiumBlurOverlay variant="intelligence" (premium) — INTERNAL, hidden
- Portfolio.tsx → PremiumGateFull variant="portfolio" (core) ✓
- Signals.tsx → PremiumGateFull variant="signals" (core) ✓

## Call AI Receptionist — ALL ENTRY POINTS TO REMOVE
1. client/src/App.tsx:16 — import ChatbotWidget
2. client/src/App.tsx:583 — <ChatbotWidget /> (floating widget on all pages)
3. client/src/components/AppLayout.tsx:16 — import AIReceptionistLink
4. client/src/components/AppLayout.tsx:401 — <AIReceptionistLink variant=... location="header" />
5. client/src/components/MobileLayout.tsx:16 — import AIReceptionistLink
6. client/src/components/MobileLayout.tsx:140 — <AIReceptionistLink variant="tap-to-call" .../>
7. client/src/components/PremiumGate.tsx:7 — import AIReceptionistLink
8. client/src/components/PremiumGate.tsx:488 — <AIReceptionistLink variant="inline" location="feature_gate" />
9. client/src/pages/MarketingSite.tsx:16 — import AIReceptionistLink
10. client/src/pages/MarketingSite.tsx:446 — <AIReceptionistLink variant="tap-to-call" location="homepage_hero" />
11. client/src/pages/MarketingSite.tsx:2038 — <AIReceptionistLink variant="tap-to-call" location="pricing_section" /> (inside "NOT SURE WHICH PLAN FITS?" block)
12. client/src/components/AppLayout.tsx:107 — Chat Inbox admin nav entry (keep admin access, just remove from nav if needed)
- Backend: chatbot router in routers.ts (startSession, sendMessage, captureLead) — KEEP (shared infra)
- Backend: chatbotEngine.ts — KEEP (shared infra)
- Backend: chatbotSessions, chatbotMessages, chatbotLeads tables — KEEP

## NAV GROUPS (current customer-facing)
### UNDERSTAND
- Signal Outlook → /app/signal-outlook (Trader)
- Pre-Flight Check → /app/pre-flight (Power)
- Social Intelligence → /app/social-intelligence (Trader)
- Insider Intelligence → /app/insider-intelligence (Trader)
- Sector Rotation → /app/alt-rotation (Trader)
- Crypto Hub → /app/crypto (Trader)
- Market Intelligence → /app/market-intelligence (Free)
- Crypto Regime → /app/crypto-regime (Free)

### OPPORTUNITIES
- Ask FAULTLINE → /app/discover (Free with cap)
- Opportunities → /app/opportunities (Trader)
- Signals → /app/signals (Trader)
- Symbol Intelligence → /app/symbol-intelligence (Trader)
- Decision Engine → /app/decision-engine (Trader)
- Day Trade Intel → /app/day-trade-intelligence (Power)

### MONITOR
- Alerts → /app/alerts (Trader)
- Watchlist → /app/watchlist (Free, max 3)
- Portfolio → /app/portfolio (Trader)
- Trade Journal → /app/trade-journal (Trader)
- Guide → /app/guide (Free)
- Account → /app/account (Free)

## FREE TIER — What should be accessible
- Dashboard (home) — full free access
- Market Intelligence (/app/market-intelligence) — full free
- Crypto Regime (/app/crypto-regime) — full free
- Ask FAULTLINE (/app/discover) — limited (5-10 questions/day)
- Watchlist (/app/watchlist) — limited (max 3 symbols)
- Guide (/app/guide) — full free
- Account (/app/account) — full free
- Public blog, marketing site, SEO pages — full free

## TRADER TIER (core/premium) — What to unlock
- Signals (/app/signals) — core
- Symbol Intelligence (/app/symbol-intelligence) — core
- Opportunities (/app/opportunities) — core
- Portfolio (/app/portfolio) — core
- Trade Journal (/app/trade-journal) — core
- Alerts (/app/alerts) — core (currently premium, needs downgrade)
- Sector Rotation (/app/alt-rotation) — core
- Social Intelligence (/app/social-intelligence) — core
- Insider Intelligence (/app/insider-intelligence) — core
- Crypto Hub (/app/crypto) — premium
- Decision Engine (/app/decision-engine) — premium
- Full Ask FAULTLINE (unlimited) — premium
- Full Daily Intelligence Report — premium
- Signal Outlook (/app/signal-outlook) — premium

## POWER TIER (premium/founding) — What to unlock
- Pre-Flight Check (/app/pre-flight) — premium
- Day Trade Intel (/app/day-trade-intelligence) — premium
- Market Command Center (/app/market-command-center) — premium (if currently free)
- Historical analogs — premium
- Scenario modeling — premium

## CHANGES NEEDED TO GATE_REQUIRED_TIER
- alerts: premium → core (Alerts should be Trader)
- watchlist: premium → free (with 3-symbol cap enforced in UI)
- signals: core ✓
- portfolio: core ✓
- altRotation: core ✓
- intelligence: premium ✓
- crypto: premium ✓
- Add new gate variants: 'symbolIntel', 'decisionEngine', 'opportunities', 'tradeJournal', 'socialIntel', 'insiderIntel', 'signalOutlook', 'preFlight', 'dayTrade'

## MARKETING TIER NAMES (update to match brief)
- free → "Observer" (was "Preview")
- core → "Trader" (was "Core")
- premium → "Power" (was "Pro")
- founding → "Founding Member" (keep)
