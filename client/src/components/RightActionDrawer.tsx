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
  Bell, Bookmark, Briefcase, AlertTriangle, Eye, FileText,
  ChevronRight, Layers, Radio,
} from "lucide-react";
import { useDrawer } from "@/contexts/DrawerContext";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
  resolveCanonicalDestination,
  type CanonicalDestinationId,
} from "@shared/routeRegistry";
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
export type QuickAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  description?: string;
  action: "navigate" | "asha" | "external";
  target?: string;   // path for navigate, prompt for asha
};

// ── Registry-owned contextual actions ────────────────────────
const destination = CANONICAL_DESTINATION_BY_ID;
const expert = EXPERT_WORKSPACE_BY_ID;
const utility = PERSISTENT_UTILITY_BY_ID;

const PAGE_ACTIONS: Record<CanonicalDestinationId, QuickAction[]> = {
  now: [
    { id: "ask-today", label: "Ask ASHA About Today", icon: MessageSquare, action: "asha", target: "Explain what is happening in markets right now and what changed." },
    { id: "open-pressure", label: "Open Pressure Engine", icon: AlertTriangle, action: "navigate", target: expert.pressure.path },
    { id: "open-signals", label: "Open Signals", icon: Radio, action: "navigate", target: destination.watch.path },
    { id: "view-history", label: "Compare With History", icon: Layers, action: "navigate", target: `${destination.why.path}?view=history` },
  ],
  why: [
    { id: "ask-drivers", label: "Ask ASHA Why", icon: MessageSquare, action: "asha", target: "Why are current market conditions developing, and which evidence carries the most weight?" },
    { id: "view-history", label: "View Historical Context", icon: Layers, action: "navigate", target: `${destination.why.path}?view=history` },
    { id: "open-pressure", label: "Open Pressure Engine", icon: AlertTriangle, action: "navigate", target: expert.pressure.path },
    { id: "view-outlook", label: "View Outlook", icon: Eye, action: "navigate", target: destination.outlook.path },
  ],
  outlook: [
    { id: "ask-outcome", label: "Ask ASHA What Is Next", icon: MessageSquare, action: "asha", target: "What is the highest-probability market path, and what would invalidate it?" },
    { id: "signal-outlook", label: "Open Signal Outlook", icon: Eye, action: "navigate", target: expert["signal-outlook"].path },
    { id: "scenarios", label: "Compare Scenarios", icon: BarChart2, action: "navigate", target: `${destination.outlook.path}?view=scenarios` },
    { id: "watch", label: "Review What to Watch", icon: Bell, action: "navigate", target: destination.watch.path },
  ],
  watch: [
    { id: "ask-watch", label: "Ask ASHA What to Watch", icon: MessageSquare, action: "asha", target: "Which developing conditions and signals deserve the most attention now?" },
    { id: "alerts", label: "Review Alerts", icon: Bell, action: "navigate", target: utility.alerts.path },
    { id: "watchlists", label: "Open Watchlists", icon: Bookmark, action: "navigate", target: `${destination.watch.path}?view=watchlists` },
    { id: "portfolio", label: "Review Portfolio", icon: Briefcase, action: "navigate", target: `${destination.watch.path}?view=portfolio` },
  ],
  act: [
    { id: "ask-response", label: "Ask ASHA How to Respond", icon: MessageSquare, action: "asha", target: "How should I respond to current conditions, and what risk controls matter most?" },
    { id: "analyze", label: "Analyze a Symbol", icon: Search, action: "navigate", target: expert["symbol-intelligence"].path },
    { id: "decide", label: "Open Decision Engine", icon: Command, action: "navigate", target: expert["decision-engine"].path },
    { id: "journal", label: "Open Decision Journal", icon: FileText, action: "navigate", target: `${destination.act.path}?view=journal` },
  ],
};

// ── Default actions (fallback for any page) ───────────────────
const DEFAULT_ACTIONS: QuickAction[] = [
  { id: "ask-asha",      label: "Ask ASHA",                   icon: MessageSquare, action: "asha",     target: "What is the most important thing happening in the market right now?" },
  { id: "analyze",       label: "Analyze a Symbol",           icon: Search,        action: "navigate", target: expert["symbol-intelligence"].path },
  { id: "decide",        label: "Open Decision Engine",       icon: Command,       action: "navigate", target: expert["decision-engine"].path },
  { id: "watchlist",     label: "View Watchlists",            icon: Bookmark,      action: "navigate", target: `${destination.watch.path}?view=watchlists` },
  { id: "alerts",        label: "View Alerts",                icon: Bell,          action: "navigate", target: utility.alerts.path },
  { id: "journal",       label: "Open Decision Journal",      icon: FileText,      action: "navigate", target: `${destination.act.path}?view=journal` },
];

export function getActionsForPath(path: string): QuickAction[] {
  const owner = resolveCanonicalDestination(path);
  return owner ? PAGE_ACTIONS[owner.id] : DEFAULT_ACTIONS;
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
