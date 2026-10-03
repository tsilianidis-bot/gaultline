/* ============================================================
   FAULTLINE — Decision Confidence Panel™
   Reusable confidence layer for every recommendation.
   Shows: Confidence Score, Supporting/Conflicting Signals,
   Expected Volatility, Reward/Risk. Data freshness, heuristic
   agreement and historical similarity render only when a caller
   supplies a real value (QA r11 B7: no probability range, no
   fabricated freshness/similarity defaults).
   ============================================================ */
import { useState } from "react";
import {
  Shield, TrendingUp, TrendingDown, AlertTriangle, Clock,
  BarChart2, Zap, Activity, ChevronDown, ChevronUp, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
export interface ConfidenceData {
  confidenceScore: number;           // 0-100
  supportingSignals: string[];
  conflictingSignals: string[];
  dataFreshnessMinutes: number | null; // real minutes since last data update; null = not shown
  institutionalAgreement?: number | null; // heuristic 0-100 score (not a % of institutions); omitted = not shown
  historicalSimilarity?: number | null;   // 0-100 similarity score from a real analog match; omitted = not shown
  historicalWinRate?: number;         // 0-100 (win rate in similar historical setups)
  expectedVolatility: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  rewardRisk: number | null;          // e.g. 2.4 means 2.4:1; null = not computable, shown as "—"
  verdict?: "BUY" | "HOLD" | "REDUCE" | "WAIT" | "EXIT";
}

// ── Helpers ───────────────────────────────────────────────────
function ConfidenceBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", width: "120px", flexShrink: 0, letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: "2px", transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color, width: "30px", textAlign: "right", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function VolatilityBadge({ level }: { level: ConfidenceData["expectedVolatility"] }) {
  const map = {
    LOW:      { color: "#22C55E", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)" },
    MODERATE: { color: "#FFD700", bg: "rgba(255,215,0,0.08)",   border: "rgba(255,215,0,0.2)" },
    HIGH:     { color: "#FF9500", bg: "rgba(255,149,0,0.08)",   border: "rgba(255,149,0,0.2)" },
    EXTREME:  { color: "#FF2D55", bg: "rgba(255,45,85,0.08)",   border: "rgba(255,45,85,0.2)" },
  };
  const s = map[level];
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", fontWeight: 700,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      padding: "2px 7px", borderRadius: "2px", letterSpacing: "0.12em",
    }}>
      {level}
    </span>
  );
}

function FreshnessIndicator({ minutes }: { minutes: number }) {
  const isStale = minutes > 30;
  const color = minutes <= 5 ? "#22C55E" : minutes <= 15 ? "#FFD700" : minutes <= 30 ? "#FF9500" : "#FF2D55";
  const label = minutes <= 1 ? "LIVE" : minutes <= 5 ? `${minutes}m ago` : minutes <= 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block", animation: minutes <= 5 ? "fl-pulse 5s ease-in-out infinite" : "none" }} />
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color, letterSpacing: "0.08em" }}>{label}</span>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────
interface DecisionConfidencePanelProps {
  data: ConfidenceData;
  compact?: boolean;   // compact mode for inline use
  defaultExpanded?: boolean;
}

export default function DecisionConfidencePanel({ data, compact = false, defaultExpanded = true }: DecisionConfidencePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const confidenceColor = data.confidenceScore >= 80 ? "#22C55E" : data.confidenceScore >= 60 ? "#FFD700" : data.confidenceScore >= 40 ? "#FF9500" : "#FF2D55";
  const hasRewardRisk = typeof data.rewardRisk === "number" && Number.isFinite(data.rewardRisk);
  const rr = hasRewardRisk ? (data.rewardRisk as number) : 0;
  const rrColor = !hasRewardRisk ? "#94A3B8" : rr >= 3 ? "#22C55E" : rr >= 2 ? "#FFD700" : rr >= 1 ? "#FF9500" : "#FF2D55";
  const rrText = hasRewardRisk ? `${rr.toFixed(1)}:1` : "—";
  const hasFreshness = typeof data.dataFreshnessMinutes === "number" && Number.isFinite(data.dataFreshnessMinutes);
  const hasAgreement = typeof data.institutionalAgreement === "number" && Number.isFinite(data.institutionalAgreement);
  const hasSimilarity = typeof data.historicalSimilarity === "number" && Number.isFinite(data.historicalSimilarity);
  const instColor = (data.institutionalAgreement ?? 0) >= 70 ? "#22C55E" : (data.institutionalAgreement ?? 0) >= 50 ? "#FFD700" : "#FF9500";

  return (
    <div style={{
      background: "rgba(6,8,12,0.95)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "6px",
      overflow: "hidden",
    }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.04)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield size={12} style={{ color: confidenceColor }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.14em" }}>DECISION CONFIDENCE</span>
          {/* Compact summary when collapsed */}
          {!expanded && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "4px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: confidenceColor, fontWeight: 700 }}>{data.confidenceScore}%</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>|</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: rrColor }}>{rrText} R:R</span>
              {hasFreshness && (
                <>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>|</span>
                  <FreshnessIndicator minutes={data.dataFreshnessMinutes as number} />
                </>
              )}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={12} style={{ color: "rgba(100,116,139,0.4)" }} /> : <ChevronDown size={12} style={{ color: "rgba(100,116,139,0.4)" }} />}
      </button>

      {/* ── Expanded body ──────────────────────────────────── */}
      {expanded && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Top metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
            {/* Confidence Score */}
            <div style={{ padding: "8px 10px", background: `${confidenceColor}08`, border: `1px solid ${confidenceColor}20`, borderRadius: "4px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", marginBottom: "3px" }}>CONFIDENCE</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "22px", color: confidenceColor, lineHeight: 1 }}>{data.confidenceScore}%</div>
            </div>

            {/* Reward/Risk */}
            <div style={{ padding: "8px 10px", background: `${rrColor}08`, border: `1px solid ${rrColor}20`, borderRadius: "4px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", marginBottom: "3px" }}>REWARD:RISK</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "22px", color: rrColor, lineHeight: 1 }}>{rrText}</div>
            </div>

            {/* Expected Volatility */}
            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", marginBottom: "5px" }}>EXP VOLATILITY</div>
              <VolatilityBadge level={data.expectedVolatility} />
            </div>
          </div>

          {/* Bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {hasAgreement && (
              <ConfidenceBar value={data.institutionalAgreement as number} color={instColor} label="AGREEMENT (HEURISTIC /100)" />
            )}
            {hasSimilarity && (
              <ConfidenceBar value={data.historicalSimilarity as number} color="#A78BFA" label="HISTORICAL SIMILARITY" />
            )}
            {data.historicalWinRate !== undefined && (
              <ConfidenceBar value={data.historicalWinRate} color="#00D4FF" label="HISTORICAL WIN RATE" />
            )}
          </div>

          {/* Data freshness — only when a real as-of age is supplied */}
          {hasFreshness && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={10} style={{ color: "rgba(100,116,139,0.4)" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>DATA FRESHNESS:</span>
              <FreshnessIndicator minutes={data.dataFreshnessMinutes as number} />
            </div>
          )}

          {/* Supporting / Conflicting signals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {/* Supporting */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
                <TrendingUp size={10} style={{ color: "#22C55E" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(34,197,94,0.6)", letterSpacing: "0.1em" }}>SUPPORTING ({data.supportingSignals.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {data.supportingSignals.slice(0, 4).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "5px" }}>
                    <span style={{ color: "#22C55E", marginTop: "1px", flexShrink: 0 }}>+</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.6)", lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conflicting */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
                <TrendingDown size={10} style={{ color: "#FF2D55" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,45,85,0.6)", letterSpacing: "0.1em" }}>CONFLICTING ({data.conflictingSignals.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {data.conflictingSignals.slice(0, 4).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "5px" }}>
                    <span style={{ color: "#FF2D55", marginTop: "1px", flexShrink: 0 }}>−</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.6)", lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer disclaimer */}
          <div style={{ display: "flex", gap: "5px", alignItems: "flex-start", paddingTop: "4px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
            <Info size={9} style={{ color: "#374151", flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.06em", lineHeight: 1.5, margin: 0 }}>
              CONFIDENCE SCORES ARE HEURISTIC, NOT CALIBRATED PROBABILITIES. PAST HISTORICAL SIMILARITY DOES NOT GUARANTEE FUTURE OUTCOMES. NOT FINANCIAL ADVICE.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
