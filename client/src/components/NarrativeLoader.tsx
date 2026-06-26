/* ============================================================
   NarrativeLoader — Project Black narrative loading states
   Replaces generic spinners with context-aware progress messages
   that communicate what FAULTLINE is actually doing.
   ============================================================ */
import { useState, useEffect } from "react";

interface NarrativeLoaderProps {
  variant: "signal-outlook" | "diagnostic" | "opportunity-discovery" | "decision-engine" | "day-trade" | "preflight" | "generic";
  symbol?: string;
  action?: string;
  className?: string;
}

const NARRATIVES: Record<NarrativeLoaderProps["variant"], string[]> = {
  "signal-outlook": [
    "Fetching live market data...",
    "Computing price levels and key zones...",
    "Analyzing momentum across 4 timeframes...",
    "Running regime classification...",
    "Scoring signal strength and conviction...",
    "Generating AI interpretation...",
    "Building trade framework...",
    "Finalizing outlook...",
  ],
  "diagnostic": [
    "Loading macro indicators...",
    "Building 4-timeframe regime analysis...",
    "Scoring credit stress, liquidity, and volatility...",
    "Identifying regime transition signals...",
    "Generating AI diagnostic narrative...",
    "Cross-referencing historical analogs...",
    "Finalizing diagnostic report...",
  ],
  "opportunity-discovery": [
    "Scanning 2,400 securities for today's best setups...",
    "Filtering by momentum, volume, and regime alignment...",
    "Scoring opportunity conviction across 17 categories...",
    "Identifying institutional accumulation patterns...",
    "Analyzing risk/reward for top candidates...",
    "Running AI enrichment on top opportunities...",
    "Ranking by opportunity score...",
    "Finalizing discovery results...",
  ],
  "decision-engine": [
    "Loading portfolio context...",
    "Fetching live data for your security...",
    "Running move favorability simulation...",
    "Computing green lights and threat board...",
    "Analyzing historical analogs for this setup...",
    "Stress-testing your thesis...",
    "Calculating position sizing...",
    "Generating final verdict...",
  ],
  "day-trade": [
    "Scanning intraday momentum signals...",
    "Identifying high-volume setups...",
    "Computing VWAP and key intraday levels...",
    "Scoring execution quality for each setup...",
    "Filtering by regime favorability...",
    "Identifying intraday setups with highest execution scores...",
    "Finalizing day trade intelligence...",
  ],
  "preflight": [
    "Loading macro environment data...",
    "Computing Pressure Index across 6 domains...",
    "Analyzing bull/bear probability...",
    "Running regime classification...",
    "Generating market awareness score...",
    "Building pre-flight briefing...",
    "Finalizing market awareness report...",
  ],
  "generic": [
    "Loading intelligence data...",
    "Running AI analysis...",
    "Processing results...",
    "Finalizing output...",
  ],
};

export default function NarrativeLoader({ variant, symbol, action, className }: NarrativeLoaderProps) {
  const messages = NARRATIVES[variant];
  const [msgIdx, setMsgIdx] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  // Cycle through narrative messages
  useEffect(() => {
    const iv = setInterval(() => {
      setMsgIdx(prev => Math.min(prev + 1, messages.length - 1));
    }, 1800);
    return () => clearInterval(iv);
  }, [messages.length]);

  // Animate dots
  useEffect(() => {
    const iv = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(iv);
  }, []);

  const currentMsg = messages[msgIdx];
  // Replace placeholders
  const displayMsg = currentMsg
    .replace("[ticker]", symbol ?? "security")
    .replace("[action]", action ?? "move");

  const progress = ((msgIdx + 1) / messages.length) * 100;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "280px",
        gap: "20px",
        padding: "32px 24px",
      }}
    >
      {/* Animated seismic pulse */}
      <div style={{ position: "relative", width: "56px", height: "56px" }}>
        {/* Outer pulse rings */}
        <div style={{
          position: "absolute", inset: "-8px", borderRadius: "50%",
          border: "1px solid rgba(0,212,255,0.2)",
          animation: "narrative-pulse 2s ease-out infinite",
        }} />
        <div style={{
          position: "absolute", inset: "-16px", borderRadius: "50%",
          border: "1px solid rgba(0,212,255,0.1)",
          animation: "narrative-pulse 2s ease-out 0.6s infinite",
        }} />
        {/* Core circle */}
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: "rgba(0,212,255,0.06)",
          border: "1px solid rgba(0,212,255,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 20px rgba(0,212,255,0.12)",
        }}>
          {/* Rotating inner arc */}
          <svg width="32" height="32" viewBox="0 0 32 32" style={{ animation: "spin-slow 2s linear infinite" }}>
            <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1.5" />
            <path d="M 16 4 A 12 12 0 0 1 28 16" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: "200px", height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, rgba(0,212,255,0.5), #00D4FF)",
          borderRadius: "1px",
          transition: "width 1.6s cubic-bezier(0.23,1,0.32,1)",
          boxShadow: "0 0 8px rgba(0,212,255,0.4)",
        }} />
      </div>

      {/* Narrative message */}
      <div style={{ textAlign: "center", maxWidth: "280px" }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          color: "#00D4FF",
          letterSpacing: "0.06em",
          lineHeight: 1.6,
          minHeight: "20px",
          transition: "opacity 0.3s ease",
        }}>
          {displayMsg}{".".repeat(dotCount)}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.12em",
          marginTop: "6px",
          textTransform: "uppercase",
        }}>
          FAULTLINE AI — {Math.round(progress)}%
        </div>
      </div>

      <style>{`
        @keyframes narrative-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
