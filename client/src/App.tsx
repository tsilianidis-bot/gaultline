/* ============================================================
   FAULTLINE — Palantir Noir Intelligence Terminal
   App shell with cinematic intro screen + bottom tab navigation
   ============================================================ */
import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EngineProvider } from "./contexts/EngineContext";
import AppLayout from "./components/AppLayout";
import IntroScreen from "./components/IntroScreen";
import FREDDebugConsole from "./components/FREDDebugConsole";
import CookieConsent from "./components/CookieConsent";

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
      {/* Legal page — standalone, no AppLayout */}
      <Route path="/legal">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Legal />
          </Suspense>
        </ErrorBoundary>
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
              <Route path="/app" component={Dashboard} />
              <Route path="/app/scores" component={Scores} />
              <Route path="/app/charts" component={Charts} />
              <Route path="/app/ai-watch" component={AIWatch} />
              <Route path="/app/scenarios" component={Scenarios} />
              <Route path="/app/alerts" component={Alerts} />
              <Route path="/app/analogs" component={HistoricalAnalogs} />
              <Route path="/app/simulate" component={SimulatePressure} />
              <Route path="/app/report" component={DailyReport} />
              <Route path="/app/watchlist" component={Watchlist} />
              <Route path="/app/signals" component={Signals} />
              <Route path="/app/crypto" component={CryptoIntelligence} />
              <Route path="/app/crypto-search" component={CryptoSearch} />
              <Route path="/app/crypto-watchlist" component={CryptoWatchlist} />
              <Route path="/app/guide" component={Guide} />
              <Route path="/app/diagnostic" component={DiagnosticAI} />
              <Route path="/app/portfolio" component={Portfolio} />
              <Route path="/app/aftershock" component={AftershockEngine} />
              <Route path="/app/crypto-signals" component={CryptoSignals} />
              <Route path="/app/admin" component={AdminPortal} />
              <Route path="/app/admin/users" component={AdminUsers} />
              <Route path="/app/admin/blog" component={AdminBlog} />
              <Route path="/app/x-posts" component={XPostGenerator} />
              <Route path="/app/x-post-queue" component={XPostQueue} />
              <Route path="/app/account" component={UserAccount} />
              <Route component={Dashboard} />
            </Switch>
          </Suspense>
          </ErrorBoundary>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  // Show intro if not seen this session
  const [introComplete, setIntroComplete] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
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

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <EngineProvider>
          <TooltipProvider>
            <Toaster />

            {/* Cinematic intro — shown once per session */}
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
              }}
            >
              <Router />
              <FREDDebugConsole />
            </div>

            {/* GDPR Cookie Consent Banner */}
            <CookieConsent />

          </TooltipProvider>
        </EngineProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
