/* ============================================================
   FAULTLINE — Portfolio Command Center™
   Collapsible panel that sits above the holdings list.
   Adds: Exposure Analysis, Suggested Rebalancing, and
   Institutional Commentary on top of the existing portfolio.
   ============================================================ */
import { useState, useMemo } from "react";
import {
  ChevronDown, ChevronUp, PieChart, Sliders, MessageSquare,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Shield,
  RefreshCw, Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────
interface Position {
  ticker: string;
  name: string;
  assetType: string;
  shares: number;
  costBasis: number;
  marketValue: number | null;
  unrealizedPnlPct: number | null;
}

interface CommandCenterProps {
  positions: Position[];
  totalValue: number | null;
}

// ── Helpers ───────────────────────────────────────────────────
const ASSET_COLORS: Record<string, string> = {
  Stock:  "#00D4FF",
  ETF:    "#22C55E",
  Crypto: "#F7931A",
  Other:  "#A78BFA",
};

const REBALANCE_COLORS: Record<string, string> = {
  REDUCE:  "#FF2D55",
  TRIM:    "#FF9500",
  HOLD:    "#00D4FF",
  ADD:     "#22C55E",
  WATCH:   "#FFD700",
};

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: "2px", transition: "width 0.6s cubic-bezier(0.23,1,0.32,1)" }} />
    </div>
  );
}

// ── Exposure Analysis ─────────────────────────────────────────
function ExposureAnalysis({ positions, totalValue }: CommandCenterProps) {
  const breakdown = useMemo(() => {
    if (!totalValue || positions.length === 0) return [];
    const groups: Record<string, number> = {};
    positions.forEach(p => {
      const val = p.marketValue ?? p.shares * p.costBasis;
      const key = p.assetType || "Other";
      groups[key] = (groups[key] ?? 0) + val;
    });
    return Object.entries(groups)
      .map(([type, val]) => ({ type, val, pct: (val / totalValue) * 100 }))
      .sort((a, b) => b.pct - a.pct);
  }, [positions, totalValue]);

  const topHoldings = useMemo(() => {
    if (!totalValue || positions.length === 0) return [];
    return [...positions]
      .map(p => ({ ...p, val: p.marketValue ?? p.shares * p.costBasis }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 5)
      .map(p => ({ ...p, pct: (p.val / totalValue) * 100 }));
  }, [positions, totalValue]);

  const concentrationRisk = useMemo(() => {
    if (topHoldings.length === 0) return null;
    const top1Pct = topHoldings[0]?.pct ?? 0;
    const top3Pct = topHoldings.slice(0, 3).reduce((s, h) => s + h.pct, 0);
    if (top1Pct > 40) return { level: "HIGH", msg: `${topHoldings[0]?.ticker} represents ${top1Pct.toFixed(0)}% of portfolio`, color: "#FF2D55" };
    if (top3Pct > 70) return { level: "MODERATE", msg: `Top 3 holdings = ${top3Pct.toFixed(0)}% concentration`, color: "#FF9500" };
    return { level: "LOW", msg: "Portfolio appears well-diversified", color: "#22C55E" };
  }, [topHoldings]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      {/* Asset type breakdown */}
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", marginBottom: "10px" }}>ASSET ALLOCATION</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {breakdown.map(b => (
            <div key={b.type}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ASSET_COLORS[b.type] ?? "#94A3B8", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8" }}>{b.type}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: ASSET_COLORS[b.type] ?? "#94A3B8" }}>{b.pct.toFixed(1)}%</span>
              </div>
              <MiniBar pct={b.pct} color={ASSET_COLORS[b.type] ?? "#94A3B8"} />
            </div>
          ))}
        </div>
      </div>

      {/* Top holdings + concentration risk */}
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", marginBottom: "10px" }}>TOP HOLDINGS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {topHoldings.map((h, i) => (
            <div key={h.ticker} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", width: "12px" }}>#{i + 1}</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00D4FF", width: "50px" }}>{h.ticker}</span>
              <div style={{ flex: 1 }}>
                <MiniBar pct={h.pct} color="#00D4FF" />
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#94A3B8", width: "36px", textAlign: "right" }}>{h.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        {concentrationRisk && (
          <div style={{ marginTop: "10px", padding: "6px 8px", background: `${concentrationRisk.color}08`, border: `1px solid ${concentrationRisk.color}20`, borderRadius: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <AlertTriangle size={9} style={{ color: concentrationRisk.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: concentrationRisk.color, letterSpacing: "0.1em" }}>CONCENTRATION: {concentrationRisk.level}</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.6)", marginTop: "3px" }}>{concentrationRisk.msg}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rebalancing Suggestions ───────────────────────────────────
function RebalancingSuggestions({ positions, totalValue }: CommandCenterProps) {
  const suggestions = useMemo(() => {
    if (!totalValue || positions.length === 0) return [];
    const result: Array<{
      ticker: string;
      action: string;
      reason: string;
      pct: number;
      pnlPct: number | null;
    }> = [];

    positions.forEach(p => {
      const val = p.marketValue ?? p.shares * p.costBasis;
      const pct = (val / totalValue) * 100;
      const pnlPct = p.unrealizedPnlPct;

      // Oversized position
      if (pct > 30) {
        result.push({ ticker: p.ticker, action: "REDUCE", reason: `${pct.toFixed(0)}% of portfolio — oversized position`, pct, pnlPct });
      } else if (pct > 20) {
        result.push({ ticker: p.ticker, action: "TRIM", reason: `${pct.toFixed(0)}% allocation — consider trimming to 15-20%`, pct, pnlPct });
      }
      // Large loss
      else if (pnlPct != null && pnlPct < -20) {
        result.push({ ticker: p.ticker, action: "WATCH", reason: `${pnlPct.toFixed(1)}% unrealized loss — review thesis`, pct, pnlPct });
      }
      // Large gain — consider taking profits
      else if (pnlPct != null && pnlPct > 50 && pct > 10) {
        result.push({ ticker: p.ticker, action: "TRIM", reason: `+${pnlPct.toFixed(1)}% gain with ${pct.toFixed(0)}% weight — consider partial profit-taking`, pct, pnlPct });
      }
    });

    // If no issues found
    if (result.length === 0) {
      return [{ ticker: "PORTFOLIO", action: "HOLD", reason: "No immediate rebalancing signals detected", pct: 100, pnlPct: null }];
    }

    return result.sort((a, b) => {
      const order = { REDUCE: 0, TRIM: 1, WATCH: 2, ADD: 3, HOLD: 4 };
      return (order[a.action as keyof typeof order] ?? 5) - (order[b.action as keyof typeof order] ?? 5);
    });
  }, [positions, totalValue]);

  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", marginBottom: "10px" }}>REBALANCING SIGNALS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {suggestions.map((s, i) => {
          const color = REBALANCE_COLORS[s.action] ?? "#94A3B8";
          return (
            <div key={`${s.ticker}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 10px", background: `${color}06`, border: `1px solid ${color}18`, borderRadius: "4px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", fontWeight: 700, color, background: `${color}15`, padding: "2px 6px", borderRadius: "2px", flexShrink: 0, letterSpacing: "0.1em" }}>{s.action}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00D4FF" }}>{s.ticker} </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)" }}>{s.reason}</span>
              </div>
              {s.pnlPct != null && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: s.pnlPct >= 0 ? "#22C55E" : "#FF2D55", flexShrink: 0 }}>
                  {s.pnlPct >= 0 ? "+" : ""}{s.pnlPct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.3)", letterSpacing: "0.08em" }}>
        ALGORITHMIC SIGNALS ONLY — NOT PERSONALIZED FINANCIAL ADVICE
      </div>
    </div>
  );
}

// ── Institutional Commentary ──────────────────────────────────
function InstitutionalCommentary() {
  const { data, isLoading, error, refetch, isFetching } = trpc.portfolio.getIntelligence.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>
        <RefreshCw size={11} style={{ animation: "fl-spin 1s linear infinite" }} />
        LOADING INSTITUTIONAL ANALYSIS…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(255,45,85,0.6)" }}>
        Unable to load institutional commentary. <button onClick={() => refetch()} style={{ background: "none", border: "none", cursor: "pointer", color: "#00D4FF", fontFamily: "inherit", fontSize: "inherit" }}>Retry</button>
      </div>
    );
  }

  // Use the metrics array from getIntelligence (actual return type)
  const topMetrics = (data.metrics ?? []).slice(0, 4);

  // Derive overall assessment from regime + top metric
  const topRiskMetric = [...(data.metrics ?? [])].sort((a, b) => b.score - a.score)[0];
  const overallAssessment = topRiskMetric
    ? `Current regime: ${data.regime}. Highest risk factor: ${topRiskMetric.label} (${topRiskMetric.score}/100 — ${topRiskMetric.level}). ${topRiskMetric.driver}`
    : `Current regime: ${data.regime}.`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em" }}>MACRO RISK OVERLAY</div>
        <button onClick={() => refetch()} disabled={isFetching} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.4)", display: "flex", alignItems: "center", gap: "3px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px" }}>
          <RefreshCw size={9} style={{ animation: isFetching ? "fl-spin 1s linear infinite" : "none" }} />
          REFRESH
        </button>
      </div>

      {/* Risk metrics grid */}
      {topMetrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "12px" }}>
          {topMetrics.map(m => {
            const score = m.score;
            const color = m.color ?? (score >= 70 ? "#FF2D55" : score >= 50 ? "#FF9500" : "#22C55E");
            return (
              <div key={m.id} style={{ padding: "8px 10px", background: `${color}06`, border: `1px solid ${color}15`, borderRadius: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100px" }}>{m.label.toUpperCase()}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color }}>{score}</span>
                </div>
                <MiniBar pct={score} color={color} />
                {m.driver && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)", marginTop: "4px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.driver}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Overall assessment */}
      <div style={{ padding: "10px 12px", background: "rgba(0,212,255,0.04)", borderLeft: "2px solid rgba(0,212,255,0.25)", borderRadius: "0 4px 4px 0" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.14em", marginBottom: "5px" }}>INSTITUTIONAL ASSESSMENT</div>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", lineHeight: 1.6, margin: 0 }}>
          {overallAssessment}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
type Tab = "exposure" | "rebalance" | "institutional";

export default function PortfolioCommandCenter({ positions, totalValue }: CommandCenterProps) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("exposure");

  if (positions.length === 0) return null;

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "exposure",      label: "EXPOSURE",      icon: <PieChart size={10} /> },
    { id: "rebalance",     label: "REBALANCING",   icon: <Sliders size={10} /> },
    { id: "institutional", label: "MACRO OVERLAY", icon: <Shield size={10} /> },
  ];

  return (
    <div style={{
      background: "rgba(6,8,12,0.95)",
      border: "1px solid rgba(0,212,255,0.12)",
      borderRadius: "6px",
      overflow: "hidden",
      marginBottom: "16px",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "10px 14px",
          background: open ? "rgba(0,212,255,0.04)" : "transparent",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "background 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={12} style={{ color: "#00D4FF" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#00D4FF", letterSpacing: "0.14em" }}>
            PORTFOLIO COMMAND CENTER
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: "2px" }}>
            {positions.length} POSITIONS
          </span>
        </div>
        {open ? <ChevronUp size={12} style={{ color: "rgba(100,116,139,0.5)" }} /> : <ChevronDown size={12} style={{ color: "rgba(100,116,139,0.5)" }} />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(0,212,255,0.08)" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: "8px 12px",
                  background: activeTab === tab.id ? "rgba(0,212,255,0.06)" : "transparent",
                  border: "none", borderBottom: activeTab === tab.id ? "2px solid #00D4FF" : "2px solid transparent",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                  color: activeTab === tab.id ? "#00D4FF" : "rgba(100,116,139,0.5)",
                  letterSpacing: "0.1em", transition: "all 0.15s ease",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: "14px" }}>
            {activeTab === "exposure" && (
              <ExposureAnalysis positions={positions} totalValue={totalValue} />
            )}
            {activeTab === "rebalance" && (
              <RebalancingSuggestions positions={positions} totalValue={totalValue} />
            )}
            {activeTab === "institutional" && (
              <InstitutionalCommentary />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
