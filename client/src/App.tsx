/* ============================================================
   FAULTLINE — Palantir Noir Intelligence Terminal
   App shell with cinematic intro screen + bottom tab navigation
   ============================================================ */
import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EngineProvider } from "./contexts/EngineContext";
import AppLayout from "./components/AppLayout";
import IntroScreen from "./components/IntroScreen";
import FREDDebugConsole from "./components/FREDDebugConsole";
import CookieConsent from './components/CookieConsent';
import RouteTracker from './components/RouteTracker';
import { DemoProvider, isDemoPath } from './contexts/DemoContext';
import DemoBanner from './components/DemoBanner';

// ── Lazy-loaded pages — each page is a separate chunk ─────────
// Dashboard is eager (first page, must be instant)
import Dashboard from "./pages/Dashboard";

const Pressure        = lazy(() => import("./pages/Pressure"));
const Scores          = lazy(() => import("./pages/Scores"));
const Charts          = lazy(() => import("./pages/Charts"));
const AIWatch         = lazy(() => import("./pages/AIWatch"));
const Scenarios       = lazy(() => import("./pages/Scenarios"));
const Alerts          = lazy(() => import("./pages/Alerts"));
const HistoricalAnalogs = lazy(() => import("./pages/HistoricalAnalogs"));
const SimulatePressure = lazy(() => import("./pages/SimulatePressure"));
const DailyReport     = lazy(() => import("./pages/DailyReport"));
const Watchlist       = lazy(() => import("./pages/Watchlist"));
const Signals         = lazy(() => import("./pages/Signals"));
const Guide           = lazy(() => import("./pages/Guide"));
const DiagnosticAI    = lazy(() => import("./pages/DiagnosticAI"));
const Portfolio       = lazy(() => import("./pages/Portfolio"));
const AdminUsers      = lazy(() => import("./pages/AdminUsers"));
const CryptoIntelligence = lazy(() => import("./pages/CryptoIntelligence"));
const CryptoSearch = lazy(() => import("./pages/CryptoSearch"));
const CryptoWatchlist = lazy(() => import("./pages/CryptoWatchlist"));
const AftershockEngine = lazy(() => import("./pages/AftershockEngine"));
const CryptoSignals    = lazy(() => import("./pages/CryptoSignals"));
const UserAccount      = lazy(() => import("./pages/UserAccount"));
const AdminPortal      = lazy(() => import("./pages/AdminPortal"));
const MarketingSite    = lazy(() => import("./pages/MarketingSite"));
const Legal            = lazy(() => import("./pages/Legal"));
const Blog             = lazy(() => import("./pages/Blog"));
const BlogPost         = lazy(() => import("./pages/BlogPost"));
const AdminBlog        = lazy(() => import("./pages/AdminBlog"));
const XPostGenerator   = lazy(() => import("./pages/XPostGenerator"));
const XPostQueue       = lazy(() => import("./pages/XPostQueue"));
const TrackRecord      = lazy(() => import("./pages/TrackRecord"));
const AltRotation = lazy(() => import('./pages/AltRotation'));
const TradePreflight = lazy(() => import('./pages/TradePreflight'));
const SituationRoom = lazy(() => import('./pages/SituationRoom'));
const PreFlight = lazy(() => import('./pages/PreFlight'));
const InsiderIntelligence = lazy(() => import("./pages/InsiderIntelligence"));
const DayTradeIntelligence = lazy(() => import("./pages/DayTradeIntelligence"));
const SeoOptimizer = lazy(() => import("./pages/SeoOptimizer"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const ReadingHistory   = lazy(() => import("./pages/ReadingHistory"));
const PressureIndex    = lazy(() => import("./pages/PressureIndex"));
const Methodology      = lazy(() => import("./pages/Methodology"));
const StockHeatmap     = lazy(() => import("./pages/StockHeatmap"));
const SimPortfolio     = lazy(() => import("./pages/SimPortfolio"));
const OwnerSimulation  = lazy(() => import("./pages/OwnerSimulation"));
const PublicSharedReport = lazy(() => import("./pages/PublicSharedReport"));
const SignalOutlookCenter = lazy(() => import("./pages/SignalOutlookCenter"));
const SocialIntelligence = lazy(() => import("./pages/SocialIntelligence"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const TradeJournal = lazy(() => import("./pages/TradeJournal"));

// ── Public SEO landing pages (no auth required, crawlable) ────────
const PublicSignals        = lazy(() => import("./pages/PublicSignals"));
// ── SEO Expansion — 20 Flagship Pages ────────────────────────────
const MarketCrashProbability2026 = lazy(() => import("./pages/seo/MarketCrashProbability2026"));
const AltSeasonIndicator   = lazy(() => import("./pages/seo/AltSeasonIndicator"));
const BitcoinRiskDashboard = lazy(() => import("./pages/seo/BitcoinRiskDashboard"));
const EthereumRiskDashboard = lazy(() => import("./pages/seo/EthereumRiskDashboard"));
const NVDASignal           = lazy(() => import("./pages/seo/NVDASignal"));
const PLTRSignal           = lazy(() => import("./pages/seo/PLTRSignal"));
const TAOSignal            = lazy(() => import("./pages/seo/TAOSignal"));
const TSLASignal           = lazy(() => import("./pages/seo/TSLASignal"));
const METASignal           = lazy(() => import("./pages/seo/METASignal"));
const AMDSignal            = lazy(() => import("./pages/seo/AMDSignal"));
const AIStocksDashboard    = lazy(() => import("./pages/seo/AIStocksDashboard"));
const MarketRegimeTracker  = lazy(() => import("./pages/seo/MarketRegimeTracker"));
const MarketCrashIndicator = lazy(() => import("./pages/seo/MarketCrashIndicator"));
const RecessionProbability = lazy(() => import("./pages/seo/RecessionProbability"));
const FederalReserveTracker = lazy(() => import("./pages/seo/FederalReserveTracker"));
const LiquidityMonitor     = lazy(() => import("./pages/seo/LiquidityMonitor"));
const VolatilityDashboard  = lazy(() => import("./pages/seo/VolatilityDashboard"));
const AIStockSignals       = lazy(() => import("./pages/seo/AIStockSignals"));
const CryptoSignalsIntelligence = lazy(() => import("./pages/seo/CryptoSignalsIntelligence"));
const PublicCryptoSignals  = lazy(() => import("./pages/PublicCryptoSignals"));
const DynamicStockPage     = lazy(() => import("./pages/seo/DynamicStockPage"));
const DynamicCryptoPage    = lazy(() => import("./pages/seo/DynamicCryptoPage"));
const PublicStockMarketRisk = lazy(() => import("./pages/PublicStockMarketRisk"));
const PublicCryptoMarketRisk = lazy(() => import("./pages/PublicCryptoMarketRisk"));
const PublicSituationRoom  = lazy(() => import("./pages/PublicSituationRoom"));
const PublicAnalogs        = lazy(() => import("./pages/PublicAnalogs"));
const PublicAIBubble       = lazy(() => import("./pages/PublicAIBubble"));
const PublicDiagnosticAI   = lazy(() => import("./pages/PublicDiagnosticAI"));
const NotFound             = lazy(() => import("./pages/NotFound"));
const IntelligenceArchive  = lazy(() => import("./pages/IntelligenceArchive"));
const Analysis             = lazy(() => import("./pages/Analysis"));
const Opportunities        = lazy(() => import("./pages/Opportunities"));
const UniversalSymbolIntelligence = lazy(() => import("./pages/UniversalSymbolIntelligence"));
const Glossary = lazy(() => import("./pages/Glossary"));
const ValidationLab = lazy(() => import("./pages/ValidationLab"));
const FmosHealthDashboard = lazy(() => import("./pages/FmosHealthDashboard"));
const IntelligenceValidation = lazy(() => import("./pages/IntelligenceValidation"));
const ChatInbox = lazy(() => import("./pages/admin/ChatInbox"));
const AdminPublishing  = lazy(() => import('./pages/AdminPublishing'));
const DailyBriefArchive = lazy(() => import('./pages/DailyBriefArchive'));
const DailyBriefPost   = lazy(() => import('./pages/DailyBriefPost'));
const IntelligenceLibrary = lazy(() => import('./pages/IntelligenceLibrary'));
const IntelligenceLibraryPost = lazy(() => import('./pages/IntelligenceLibraryPost'));
const CryptoHub = lazy(() => import("./pages/CryptoHub"));
const DecisionEngine = lazy(() => import("./pages/DecisionEngine"));
const MarketCommandCenter = lazy(() => import("./pages/MarketCommandCenter"));
const TodaysStory = lazy(() => import("./pages/TodaysStory"));
const SmartDiscovery = lazy(() => import("./pages/SmartDiscovery"));
const DecisionLedger = lazy(() => import("./pages/DecisionLedger"));
const IntelligenceHub   = lazy(() => import("./pages/IntelligenceHub"));
const EngineeringDiagnostics = lazy(() => import("./pages/admin/EngineeringDiagnostics"));
const MarketIntelligence = lazy(() => import("./pages/MarketIntelligence"));
const CryptoRegimeDashboard = lazy(() => import("./pages/CryptoRegimeDashboard"));
const PhoenixSystems = lazy(() => import("./pages/PhoenixSystems"));
const Press = lazy(() => import("./pages/Press"));
const About = lazy(() => import("./pages/About"));

// ── Mobile PWA pages ─────────────────────────────────────────
const MobileLayout   = lazy(() => import("./components/MobileLayout"));
const MobilePulse    = lazy(() => import("./pages/mobile/MobilePulse"));
const MobileSignals  = lazy(() => import("./pages/mobile/MobileSignals"));
const MobileWatchlist = lazy(() => import("./pages/mobile/MobileWatchlist"));
const MobileRotation = lazy(() => import("./pages/mobile/MobileRotation"));
const MobileBrief    = lazy(() => import("./pages/mobile/MobileBrief"));
const MobileCrypto   = lazy(() => import("./pages/mobile/MobileCrypto"));
const MobileAccount  = lazy(() => import("./pages/mobile/MobileAccount"));
const MobileUpgrade  = lazy(() => import("./pages/mobile/MobileUpgrade"));

// ── Page loading fallback — minimal, non-jarring ──────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      color: 'rgba(0,255,200,0.4)',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '11px',
      letterSpacing: '0.15em',
    }}>
      <span style={{ animation: 'fl-pulse 1.4s ease-in-out infinite' }}>
        LOADING MODULE…
      </span>
    </div>
  );
}

// ── Session key: show intro once per browser session ──────────
const INTRO_SEEN_KEY = 'fl_intro_seen_v1';

function Router() {
  return (
    <Switch>
      {/* Demo mode — /demo and /demo/* redirect to /app/* with DemoProvider active */}
      <Route path="/demo/discover"><Redirect to="/app/discover" /></Route>
      <Route path="/demo/dashboard"><Redirect to="/app/dashboard" /></Route>
      <Route path="/demo/pressure"><Redirect to="/app/pressure" /></Route>
      <Route path="/demo/signals"><Redirect to="/app/signals" /></Route>
      <Route path="/demo/diagnostic"><Redirect to="/app/diagnostic" /></Route>
      <Route path="/demo/signal-outlook"><Redirect to="/app/signal-outlook" /></Route>
      <Route path="/demo/day-trade-intelligence"><Redirect to="/app/day-trade-intelligence" /></Route>
      <Route path="/demo/decision-engine"><Redirect to="/app/decision-engine" /></Route>
      <Route path="/demo/opportunities"><Redirect to="/app/opportunities" /></Route>
      <Route path="/demo/insider-intelligence"><Redirect to="/app/insider-intelligence" /></Route>
      <Route path="/demo/social-intelligence"><Redirect to="/app/social-intelligence" /></Route>
      <Route path="/demo/crypto"><Redirect to="/app/crypto" /></Route>
      <Route path="/demo/watchlist"><Redirect to="/app/watchlist" /></Route>
      <Route path="/demo/portfolio"><Redirect to="/app/portfolio" /></Route>
      <Route path="/demo"><Redirect to="/app/discover" /></Route>
      {/* Catch-all for any unlisted /demo/* sub-routes — redirect to discover */}
      <Route path="/demo/:rest*"><Redirect to="/app/discover" /></Route>
      {/* Public Shared Report — no login required, no AppLayout */}
      <Route path="/r/:publicShareId">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <PublicSharedReport />
          </Suspense>
        </ErrorBoundary>
      </Route>

      {/* Analysis Hub — Evergreen SEO content hub */}
      <Route path="/analysis">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Analysis />
          </Suspense>
        </ErrorBoundary>
      </Route>

      {/* /intelligence → alias for Intelligence Archive */}
      <Route path="/intelligence">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <IntelligenceArchive />
          </Suspense>
        </ErrorBoundary>
      </Route>

      {/* Intelligence Archive — standalone public page */}
      <Route path="/intel-archive">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <IntelligenceArchive />
          </Suspense>
        </ErrorBoundary>
      </Route>

      {/* Daily Brief archive — standalone public pages */}
      <Route path="/daily-brief/:slug">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <DailyBriefPost />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/daily-brief">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <DailyBriefArchive />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Intelligence Library — standalone public pages */}
      <Route path="/intelligence-library/:slug">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <IntelligenceLibraryPost />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/intelligence-library">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <IntelligenceLibrary />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Blog — standalone public pages */}
      <Route path="/blog/:slug">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <BlogPost />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/blog">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Blog />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Mobile PWA routes — standalone, no AppLayout */}
      <Route path="/mobile/:tab*">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <MobileLayout>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/mobile/signals" component={MobileSignals} />
                  <Route path="/mobile/watchlist" component={MobileWatchlist} />
                  <Route path="/mobile/rotation" component={MobileRotation} />
                  <Route path="/mobile/brief" component={MobileBrief} />
                  <Route path="/mobile/crypto" component={MobileCrypto} />
                  <Route path="/mobile/account" component={MobileAccount} />
                  <Route path="/mobile/upgrade" component={MobileUpgrade} />
                  <Route component={MobilePulse} />
                </Switch>
              </Suspense>
            </MobileLayout>
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Public Pressure Index — no login required */}
      <Route path="/methodology">
        {() => <Suspense fallback={<PageLoader />}><Methodology /></Suspense>}
      </Route>

      <Route path="/pressure-index">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <PressureIndex />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Track Record — standalone public page */}
      <Route path="/track-record">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <TrackRecord />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Legal page — standalone, no AppLayout */}
      <Route path="/legal">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Legal />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Contact Us — standalone public page */}
      <Route path="/contact">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <ContactUs />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Press page — standalone public page */}
      <Route path="/press">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Press />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* About page — standalone public page */}
      <Route path="/about">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <About />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Phoenix Systems company page — standalone public page */}
      <Route path="/phoenix-systems">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <PhoenixSystems />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Stripe checkout success page — standalone, no AppLayout */}
      <Route path="/checkout/success">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <CheckoutSuccess />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Public SEO landing pages — standalone, no AppLayout, crawlable */}
      <Route path="/signals">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicSignals /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/crypto-signals">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicCryptoSignals /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/stock-market-risk-dashboard">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicStockMarketRisk /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/crypto-market-risk-dashboard">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicCryptoMarketRisk /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/situation-room">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicSituationRoom /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/analogs">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicAnalogs /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/ai-bubble-risk-tracker">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicAIBubble /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/diagnostic-ai">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PublicDiagnosticAI /></Suspense></ErrorBoundary>
      </Route>
      {/* SEO Expansion — 20 Flagship Pages */}
      <Route path="/market-crash-probability-2026">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><MarketCrashProbability2026 /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/market-crash-indicator">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><MarketCrashIndicator /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/recession-probability">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><RecessionProbability /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/alt-season-indicator">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><AltSeasonIndicator /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/bitcoin-risk-dashboard">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><BitcoinRiskDashboard /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/ethereum-risk-dashboard">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><EthereumRiskDashboard /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/stock/nvda">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><NVDASignal /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/stock/pltr">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><PLTRSignal /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/stock/tsla">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><TSLASignal /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/stock/meta">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><METASignal /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/stock/amd">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><AMDSignal /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/crypto/tao">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><TAOSignal /></Suspense></ErrorBoundary>
      </Route>
      {/* Dynamic stock/crypto pages — auto-generate for any symbol */}
      <Route path="/stock/:symbol">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><DynamicStockPage /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/crypto/:symbol">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><DynamicCryptoPage /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/federal-reserve-tracker">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><FederalReserveTracker /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/liquidity-monitor">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><LiquidityMonitor /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/volatility-dashboard">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><VolatilityDashboard /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/ai-stocks-dashboard">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><AIStocksDashboard /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/ai-stock-signals">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><AIStockSignals /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/crypto-signals-intelligence">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><CryptoSignalsIntelligence /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/market-regime-tracker">
        <ErrorBoundary><Suspense fallback={<PageLoader />}><MarketRegimeTracker /></Suspense></ErrorBoundary>
      </Route>
      {/* Marketing site at root — standalone, no AppLayout */}
      <Route path="/">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <MarketingSite />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* All platform routes inside AppLayout under /app */}
      <Route>
        <AppLayout>
          <ErrorBoundary inline>
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path="/app/pressure" component={Pressure} />
              <Route path="/app/intelligence-hub" component={IntelligenceHub} />
              <Route path="/app/command" component={MarketCommandCenter} />
              <Route path="/app/todays-story" component={TodaysStory} />
              <Route path="/app/discover" component={SmartDiscovery} />
              <Route path="/app/decision-ledger" component={DecisionLedger} />
              <Route path="/app"><Redirect to="/app/discover" /></Route>
              <Route path="/app/dashboard" component={Dashboard} />
              {/* P1 — Deprecated routes redirect to new destinations */}
              {/* Canonical URL aliases — advertised paths */}
              <Route path="/app/command-center"><Redirect to="/app/command" /></Route>
              <Route path="/app/pressure-index"><Redirect to="/app/pressure" /></Route>
              <Route path="/app/ai-diagnostic"><Redirect to="/app/diagnostic" /></Route>
              <Route path="/app/daily-briefing"><Redirect to="/app/report" /></Route>
              <Route path="/app/scores"><Redirect to="/app/pressure" /></Route>
              <Route path="/app/charts"><Redirect to="/app/symbol-intelligence" /></Route>
              <Route path="/app/ai-watch"><Redirect to="/app/signals" /></Route>
              <Route path="/app/scenarios"><Redirect to="/app/decision-engine" /></Route>
              <Route path="/app/alerts" component={Alerts} />
              <Route path="/app/analogs" component={HistoricalAnalogs} />
              <Route path="/app/simulate" component={SimulatePressure} />
              <Route path="/app/report" component={DailyReport} />
              <Route path="/app/watchlist" component={Watchlist} />
              <Route path="/app/signals" component={Signals} />
              <Route path="/app/crypto" component={CryptoHub} />
              <Route path="/app/crypto-search"><Redirect to="/app/crypto" /></Route>
              <Route path="/app/crypto-watchlist"><Redirect to="/app/crypto" /></Route>
              <Route path="/app/guide" component={Guide} />
              <Route path="/app/diagnostic" component={DiagnosticAI} />
              <Route path="/app/portfolio" component={Portfolio} />
              <Route path="/app/aftershock" component={AftershockEngine} />
              <Route path="/app/crypto-signals"><Redirect to="/app/crypto" /></Route>
              <Route path="/app/admin" component={AdminPortal} />
              <Route path="/app/admin/users" component={AdminUsers} />
              <Route path="/app/admin/engineering" component={EngineeringDiagnostics} />
              <Route path="/app/admin/blog" component={AdminBlog} />
              <Route path="/app/admin/publishing" component={AdminPublishing} />
              <Route path="/app/admin/chat-inbox">
                <ErrorBoundary><Suspense fallback={<PageLoader />}><ChatInbox /></Suspense></ErrorBoundary>
              </Route>
              <Route path="/app/x-posts" component={XPostGenerator} />
              <Route path="/app/x-post-queue" component={XPostQueue} />
              <Route path="/app/alt-rotation" component={AltRotation} />
              <Route path="/app/decision-engine" component={DecisionEngine} />
              <Route path="/app/trade-preflight"><Redirect to="/app/decision-engine" /></Route>
              <Route path="/app/situation-room"><Redirect to="/app/decision-engine" /></Route>
              <Route path="/app/opportunities" component={Opportunities} />
              <Route path="/app/market-intelligence" component={MarketIntelligence} />
              <Route path="/app/crypto-regime" component={CryptoRegimeDashboard} />
              <Route path="/app/signal-outlook" component={SignalOutlookCenter} />
              <Route path="/app/social-intelligence" component={SocialIntelligence} />
              <Route path="/app/pre-flight" component={PreFlight} />
              <Route path="/app/insider-intelligence" component={InsiderIntelligence} />
              <Route path="/app/day-trade-intelligence" component={DayTradeIntelligence} />
              <Route path="/app/trade-journal" component={TradeJournal} />
              <Route path="/app/symbol-intelligence" component={UniversalSymbolIntelligence} />
              <Route path="/app/glossary" component={Glossary} />
              <Route path="/app/account" component={UserAccount} />
              <Route path="/app/blog/:slug" component={BlogPost} />
              <Route path="/app/blog" component={Blog} />
              <Route path="/app/track-record" component={TrackRecord} />
              <Route path="/app/reading-history" component={ReadingHistory} />
              <Route path="/app/seo-optimizer" component={SeoOptimizer} />
              <Route path="/app/analytics" component={AnalyticsDashboard} />
              <Route path="/app/stock-heatmap" component={StockHeatmap} />
              <Route path="/app/sim-portfolio" component={SimPortfolio} />
              <Route path="/app/validation-lab" component={ValidationLab} />
              <Route path="/app/intelligence-validation" component={IntelligenceValidation} />
              <Route path="/app/fmos-health" component={FmosHealthDashboard} />
              <Route path="/owner/simulation" component={OwnerSimulation} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
          </ErrorBoundary>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  const isDemo = isDemoPath();

  // Show intro if not seen this session.
  // Auto-skip when the user lands directly on a deep /app/* link
  // (e.g. /app/situation-room) so the feature is immediately visible.
  // Also skip for demo mode — auditors should see the app immediately.
  const [introComplete, setIntroComplete] = useState<boolean>(() => {
    try {
      if (isDemo) return true; // skip intro in demo mode
      if (sessionStorage.getItem(INTRO_SEEN_KEY) === '1') return true;
      const path = window.location.pathname;
      // Skip intro for any deep app link that isn't the root dashboard
      if (path.startsWith('/app/') && path !== '/app/dashboard' && path !== '/app/') {
        sessionStorage.setItem(INTRO_SEEN_KEY, '1');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // Dashboard fade-in after intro
  const [dashVisible, setDashVisible] = useState(introComplete);

  const handleIntroComplete = useCallback(() => {
    try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
    setIntroComplete(true);
    // Small delay to let intro exit animation finish
    setTimeout(() => setDashVisible(true), 100);
  }, []);

  // If already seen, show dashboard immediately
  useEffect(() => {
    if (introComplete) setDashVisible(true);
  }, [introComplete]);

  const appContent = (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <EngineProvider>
          <TooltipProvider>
            <Toaster />

            {/* Demo mode banner — shown at top of every page in demo mode */}
            {isDemo && <DemoBanner />}

            {/* Cinematic intro — shown once per session (skipped in demo mode) */}
            {!introComplete && (
              <IntroScreen onComplete={handleIntroComplete} />
            )}

            {/* Main app — fades in after intro */}
            <div
              style={{
                opacity: dashVisible ? 1 : 0,
                transition: 'opacity 0.8s cubic-bezier(0.23,1,0.32,1)',
                // Keep in DOM so engine/data loads during intro
                visibility: introComplete ? 'visible' : 'hidden',
                pointerEvents: introComplete ? 'auto' : 'none',
                // Push content below demo banner in demo mode
                paddingTop: isDemo ? '30px' : undefined,
              }}
            >
              <RouteTracker />
              <Router />
              <FREDDebugConsole />
            </div>

            {/* GDPR Cookie Consent Banner — hidden in demo mode */}
            {!isDemo && <CookieConsent />}

          </TooltipProvider>
        </EngineProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );

  return isDemo ? <DemoProvider>{appContent}</DemoProvider> : appContent;
}

export default App;
