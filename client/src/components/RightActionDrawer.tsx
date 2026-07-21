/* ============================================================
   RightActionDrawer — Contextual quick-action drawer
   Design: "Actions become intelligent."
   - Pale blue-gray edge tab — always visible, distinct from left
   - Contextual actions change per page
   - Closes after action is selected
   - Keyboard: Cmd+Shift+A toggles
   ============================================================ */
import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Zap, X, MessageSquare, Search, BarChart2, Command,
  Bell, Bookmark, BookOpen, Briefcase, TrendingUp, Users,
  AlertTriangle, RefreshCw, Eye, FileText, Target,
  ChevronRight, Layers, Radio,
} from "lucide-react";
import { useDrawer } from "@/contexts/DrawerContext";
// ASHA is triggered via CustomEvent 'asha:summon' — no direct context needed

// ── Colours ───────────────────────────────────────────────────
const DRAWER_BG      = "#EEF2F7";   // pale blue-gray
const DRAWER_BORDER  = "#D8E0EA";   // soft blue-gray border
const TEXT_PRIMARY   = "#1A1A1A";
const TEXT_SECONDARY = "#4A5568";
const TEXT_MUTED     = "#8A9AB0";
const ACCENT_BLUE    = "#3B82F6";
const TAB_BG         = "#E4EBF5";   // slightly deeper blue-gray for tab

// ── Action definition ─────────────────────────────────────────
type QuickAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  description?: string;
  action: "navigate" | "asha" | "external";
  target?: string;   // path for navigate, prompt for asha
};

// ── Page-specific contextual actions ─────────────────────────
// Keyed by partial path match
const PAGE_ACTIONS: Record<string, QuickAction[]> = {
  "/app/seismograph": [
    { id: "ask-today",     label: "Ask ASHA About Today",      icon: MessageSquare, action: "asha",     target: "What changed in the market today?" },
    { id: "open-signals",  label: "Open Signals",              icon: Radio,         action: "navigate", target: "/app/signals" },
    { id: "view-alerts",   label: "Review Alerts",             icon: Bell,          action: "navigate", target: "/app/alerts" },
    { id: "situation",     label: "Open Situation Room",       icon: Command,       action: "navigate", target: "/app/decision-engine" },
  ],
  "/app/dashboard": [
    { id: "ask-today",     label: "Ask ASHA About Today",      icon: MessageSquare, action: "asha",     target: "Explain today's market conditions" },
    { id: "open-signals",  label: "Open Signals",              icon: Radio,         action: "navigate", target: "/app/signals" },
    { id: "view-alerts",   label: "Review Alerts",             icon: Bell,          action: "navigate", target: "/app/alerts" },
    { id: "situation",     label: "Open Situation Room",       icon: Command,       action: "navigate", target: "/app/decision-engine" },
  ],
  "/app/signals": [
    { id: "ask-signals",   label: "Ask ASHA About Signals",    icon: MessageSquare, action: "asha",     target: "What signals are most significant right now?" },
    { id: "analyze",       label: "Analyze a Symbol",          icon: Search,        action: "navigate", target: "/app/symbol-intelligence" },
    { id: "watchlist",     label: "Add to Watchlist",          icon: Bookmark,      action: "navigate", target: "/app/watchlist" },
    { id: "outlook",       label: "View Signal Outlook",       icon: Eye,           action: "navigate", target: "/app/signal-outlook" },
  ],
  "/app/portfolio": [
    { id: "risk-scan",     label: "Run Portfolio Risk Scan",   icon: AlertTriangle, action: "asha",     target: "Run a portfolio risk scan on my current positions" },
    { id: "ask-portfolio", label: "Ask ASHA About Portfolio",  icon: MessageSquare, action: "asha",     target: "Analyze my portfolio in the current macro regime" },
    { id: "rebalance",     label: "Rebalance Review",          icon: RefreshCw,     action: "asha",     target: "Should I rebalance my portfolio given current conditions?" },
    { id: "benchmark",     label: "Compare Against Benchmark", icon: BarChart2,     action: "asha",     target: "How does my portfolio compare against SPY?" },
  ],
  "/app/symbol-intelligence": [
    { id: "ask-symbol",    label: "Ask ASHA About This Asset", icon: MessageSquare, action: "asha",     target: "Analyze this asset in the current macro regime" },
    { id: "add-watch",     label: "Add to Watchlist",          icon: Bookmark,      action: "navigate", target: "/app/watchlist" },
    { id: "compare",       label: "Compare Assets",            icon: BarChart2,     action: "asha",     target: "Compare this asset against its sector peers" },
    { id: "situation",     label: "Open Situation Room",       icon: Command,       action: "navigate", target: "/app/decision-engine" },
  ],
  "/app/decision-engine": [
    { id: "ask-outcome",   label: "Ask ASHA Highest Probability", icon: MessageSquare, action: "asha",  target: "What is the highest-probability market outcome right now?" },
    { id: "preflight",     label: "Run Pre-Flight Check",      icon: Target,        action: "navigate", target: "/app/pre-flight" },
    { id: "save-analysis", label: "Save Current Analysis",     icon: Bookmark,      action: "navigate", target: "/app/decision-ledger" },
    { id: "signals",       label: "Open Signals",              icon: Radio,         action: "navigate", target: "/app/signals" },
  ],
  "/app/opportunities": [
    { id: "ask-opps",      label: "Ask ASHA for Opportunities", icon: MessageSquare, action: "asha",    target: "What are the best opportunities in the current regime?" },
    { id: "analyze",       label: "Analyze a Symbol",           icon: Search,        action: "navigate", target: "/app/symbol-intelligence" },
    { id: "signals",       label: "Open Signals",               icon: Radio,         action: "navigate", target: "/app/signals" },
    { id: "watchlist",     label: "Add to Watchlist",           icon: Bookmark,      action: "navigate", target: "/app/watchlist" },
  ],
  "/app/market-intelligence": [
    { id: "ask-regime",    label: "Ask ASHA About Regime",     icon: MessageSquare, action: "asha",     target: "What regime are we in and how long has it lasted?" },
    { id: "analogs",       label: "View Historical Analogs",   icon: Layers,        action: "navigate", target: "/app/analogs" },
    { id: "pressure",      label: "Open Pressure Index",       icon: AlertTriangle, action: "navigate", target: "/app/pressure" },
    { id: "situation",     label: "Open Situation Room",       icon: Command,       action: "navigate", target: "/app/decision-engine" },
  ],
  "/app/crypto": [
    { id: "ask-crypto",    label: "Ask ASHA About Crypto",     icon: MessageSquare, action: "asha",     target: "How does crypto behave in the current macro regime?" },
    { id: "regime",        label: "View Crypto Regime",        icon: BarChart2,     action: "navigate", target: "/app/crypto-regime" },
    { id: "watchlist",     label: "Add to Watchlist",          icon: Bookmark,      action: "navigate", target: "/app/watchlist" },
    { id: "signals",       label: "Open Signals",              icon: Radio,         action: "navigate", target: "/app/signals" },
  ],
};

// ── Default actions (fallback for any page) ───────────────────
const DEFAULT_ACTIONS: QuickAction[] = [
  { id: "ask-asha",      label: "Ask ASHA",                   icon: MessageSquare, action: "asha",     target: "What is the most important thing happening in the market right now?" },
  { id: "analyze",       label: "Analyze a Symbol",           icon: Search,        action: "navigate", target: "/app/symbol-intelligence" },
  { id: "situation",     label: "Open Situation Room",        icon: Command,       action: "navigate", target: "/app/decision-engine" },
  { id: "watchlist",     label: "View Watchlist",             icon: Bookmark,      action: "navigate", target: "/app/watchlist" },
  { id: "alerts",        label: "View Alerts",                icon: Bell,          action: "navigate", target: "/app/alerts" },
  { id: "save-analysis", label: "Save Analysis",              icon: FileText,      action: "navigate", target: "/app/decision-ledger" },
];

function getActionsForPath(path: string): QuickAction[] {
  for (const [key, actions] of Object.entries(PAGE_ACTIONS)) {
    if (path.startsWith(key)) return actions;
  }
  return DEFAULT_ACTIONS;
}

export default function RightActionDrawer() {
  const [location, navigate] = useLocation();
  const { rightOpen, toggleRight, closeRight } = useDrawer();
  // ASHA triggered via CustomEvent
  const drawerRef = useRef<HTMLDivElement>(null);

  const actions = getActionsForPath(location);

  // Keyboard shortcut: Cmd+Shift+A
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "a") {
        e.preventDefault();
        toggleRight();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleRight]);

  // Tap-outside close
  useEffect(() => {
    if (!rightOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        closeRight();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rightOpen, closeRight]);

  const handleAction = useCallback((action: QuickAction) => {
    if (action.action === "navigate" && action.target) {
      navigate(action.target);
      closeRight();
    } else if (action.action === "asha" && action.target) {
      closeRight();
      window.dispatchEvent(new CustomEvent("asha:summon", { detail: { prompt: action.target } }));
    } else if (action.action === "external" && action.target) {
      window.open(action.target, "_blank");
      closeRight();
    }
  }, [navigate, closeRight]);

  return (
    <>
      {/* ── Edge tab — always visible ── */}
      <button
        onClick={toggleRight}
        aria-label="Open quick actions"
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 200,
          background: TAB_BG,
          border: `1px solid ${DRAWER_BORDER}`,
          borderRight: "none",
          borderRadius: "8px 0 0 8px",
          padding: "14px 8px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          boxShadow: "-2px 0 12px rgba(0,0,0,0.18)",
          transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
          opacity: rightOpen ? 0 : 1,
          pointerEvents: rightOpen ? "none" : "auto",
          userSelect: "none",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "#D8E5F2";
          (e.currentTarget as HTMLElement).style.boxShadow = "-3px 0 16px rgba(0,0,0,0.22)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = TAB_BG;
          (e.currentTarget as HTMLElement).style.boxShadow = "-2px 0 12px rgba(0,0,0,0.18)";
        }}
      >
        <Zap size={16} color={TEXT_SECONDARY} />
        <span style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: TEXT_SECONDARY,
          fontWeight: 600,
          textTransform: "uppercase",
        }}>ACTIONS</span>
      </button>

      {/* ── Backdrop ── */}
      {rightOpen && (
        <div
          onClick={closeRight}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 210,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── Drawer panel ── */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(300px, 88vw)",
          zIndex: 220,
          background: DRAWER_BG,
          borderLeft: `1px solid ${DRAWER_BORDER}`,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.28)",
          display: "flex",
          flexDirection: "column",
          transform: rightOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.26s cubic-bezier(0.23,1,0.32,1)",
          willChange: "transform",
          overflowY: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 16px 12px",
          borderBottom: `1px solid ${DRAWER_BORDER}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={14} color={ACCENT_BLUE} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.22em",
              color: TEXT_SECONDARY,
              fontWeight: 700,
              textTransform: "uppercase",
            }}>
              QUICK ACTIONS
            </span>
          </div>
          <button
            onClick={closeRight}
            aria-label="Close actions"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: TEXT_SECONDARY,
              padding: 4,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              transition: "color 0.12s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT_PRIMARY)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_SECONDARY)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Context label */}
        <div style={{
          padding: "8px 16px 4px",
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.16em",
            color: TEXT_MUTED,
            textTransform: "uppercase",
          }}>
            ACTIONS FOR THIS PAGE
          </span>
        </div>

        {/* Action list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 24px" }}>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "11px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${DRAWER_BORDER}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.12s cubic-bezier(0.23,1,0.32,1)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "#DDE6F2";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={15} color={ACCENT_BLUE} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12px",
                    letterSpacing: "0.04em",
                    color: TEXT_PRIMARY,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {action.label}
                  </div>
                  {action.action === "asha" && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "9px",
                      color: TEXT_MUTED,
                      marginTop: 2,
                      letterSpacing: "0.06em",
                    }}>
                      ASK ASHA
                    </div>
                  )}
                </div>
                <ChevronRight size={12} color={TEXT_MUTED} />
              </button>
            );
          })}
        </div>

        {/* Keyboard hint */}
        <div style={{
          padding: "8px 16px 12px",
          borderTop: `1px solid ${DRAWER_BORDER}`,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: TEXT_MUTED }}>
            ⌘⇧A to toggle
          </span>
        </div>
      </div>
    </>
  );
}
