/* ============================================================
   FAULTLINE — Universal Ticker Bar
   Persistent active security strip shown in the app header
   when a ticker is selected via TickerStore.
   One-click navigation to any analysis page.
   ============================================================ */
import { useLocation } from "wouter";
import { useTickerStore } from "@/contexts/TickerStore";
import { Eye, Target, Cpu, Shield, X, ChevronRight, Crosshair } from "lucide-react";

const ANALYSIS_LINKS = [
  { label: "SIGNAL OUTLOOK",  icon: Eye,       path: (t: string, type: string) => `/app/signal-outlook?symbol=${t}&type=${type}` },
  { label: "DECISION ENGINE", icon: Crosshair,  path: (t: string, type: string) => `/app/decision-engine?symbol=${t}&type=${type}` },
  { label: "AI DIAGNOSTIC",   icon: Cpu,        path: (t: string, type: string) => `/app/diagnostic?symbol=${t}&type=${type}` },
  { label: "SITUATION ROOM",  icon: Target,     path: (t: string, type: string) => `/app/situation-room?symbol=${t}&type=${type}` },
  { label: "PRE-FLIGHT",      icon: Shield,     path: (t: string, _type: string) => `/app/pre-flight?symbol=${t}` },
];

export default function UniversalTickerBar() {
  const { current, clearTicker } = useTickerStore();
  const [, navigate] = useLocation();

  if (!current) return null;

  const accent = current.assetType === "crypto" ? "#F7931A" : "#00D4FF";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0",
      background: `${accent}08`,
      borderBottom: `1px solid ${accent}20`,
      padding: "0 16px",
      height: "32px",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Active ticker label */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "12px", flexShrink: 0 }}>
        <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}`, animation: "blink-alert 2s ease-in-out infinite" }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.12em", color: `${accent}80`, textTransform: "uppercase" }}>ACTIVE</span>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "14px", color: accent, letterSpacing: "0.06em", textShadow: `0 0 10px ${accent}60` }}>{current.ticker}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>{current.name}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", background: "rgba(255,255,255,0.04)", padding: "1px 4px", borderRadius: "2px" }}>{current.assetType.toUpperCase()}</span>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "16px", background: `${accent}20`, marginRight: "12px", flexShrink: 0 }} />

      {/* Analysis quick-links */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1, overflow: "hidden" }}>
        {ANALYSIS_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <button
              key={link.label}
              onClick={() => navigate(link.path(current.ticker, current.assetType))}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "3px 8px", borderRadius: "3px",
                background: "transparent", border: "none",
                cursor: "pointer", flexShrink: 0,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                color: "rgba(100,116,139,0.6)", letterSpacing: "0.1em",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = accent; (e.currentTarget as HTMLElement).style.background = `${accent}10`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.6)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Icon size={9} />
              {link.label}
              <ChevronRight size={8} />
            </button>
          );
        })}
      </div>

      {/* Clear button */}
      <button
        onClick={clearTicker}
        style={{
          display: "flex", alignItems: "center", gap: "3px",
          padding: "3px 6px", borderRadius: "3px",
          background: "transparent", border: "none",
          cursor: "pointer", flexShrink: 0,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
          color: "rgba(100,116,139,0.4)", letterSpacing: "0.08em",
          transition: "all 0.12s ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF2D55"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.4)"; }}
      >
        <X size={9} />
        CLEAR
      </button>
    </div>
  );
}
