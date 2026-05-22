/* ============================================================
   FAULTLINE — Palantir Noir Intelligence Terminal
   App shell with cinematic intro screen + bottom tab navigation
   ============================================================ */
import { useState, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EngineProvider } from "./contexts/EngineContext";
import AppLayout from "./components/AppLayout";
import IntroScreen from "./components/IntroScreen";
import Dashboard from "./pages/Dashboard";
import Scores from "./pages/Scores";
import Charts from "./pages/Charts";
import AIWatch from "./pages/AIWatch";
import Scenarios from "./pages/Scenarios";
import Alerts from "./pages/Alerts";
import HistoricalAnalogs from "./pages/HistoricalAnalogs";
import SimulatePressure from "./pages/SimulatePressure";
import DailyReport from "./pages/DailyReport";
import Watchlist from './pages/Watchlist';
import Signals from './pages/Signals';
import Pressure from './pages/Pressure';
import Guide from './pages/Guide';
import DiagnosticAI from './pages/DiagnosticAI';
import Portfolio from './pages/Portfolio';
import FREDDebugConsole from "./components/FREDDebugConsole";

// ── Session key: show intro once per browser session ──────────
const INTRO_SEEN_KEY = 'fl_intro_seen_v1';

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/pressure" component={Pressure} />
        <Route path="/" component={Dashboard} />
        <Route path="/scores" component={Scores} />
        <Route path="/charts" component={Charts} />
        <Route path="/ai-watch" component={AIWatch} />
        <Route path="/scenarios" component={Scenarios} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/analogs" component={HistoricalAnalogs} />
        <Route path="/simulate" component={SimulatePressure} />
        <Route path="/report" component={DailyReport} />
        <Route path="/watchlist" component={Watchlist} />
        <Route path="/signals" component={Signals} />
        <Route path="/guide" component={Guide} />
        <Route path="/diagnostic" component={DiagnosticAI} />
        <Route path="/portfolio" component={Portfolio} />
        <Route component={Dashboard} />
      </Switch>
    </AppLayout>
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

          </TooltipProvider>
        </EngineProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
