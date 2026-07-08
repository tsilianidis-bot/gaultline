/* ============================================================
   FAULTLINE — Intelligence Hub
   Unified institutional intelligence center.
   6 sections: Today's Brief · What Changed · Opportunities ·
   Risks · Your Portfolio · Deep Analysis
   Smart conditional surfacing based on regime + portfolio state.
   ============================================================ */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Shield,
  BarChart2, ChevronRight, RefreshCw, Clock, Activity,
  BookOpen, Layers, Target, Eye, Cpu, ArrowUpRight,
  ArrowDownRight, Crosshair, Copy, Download, CheckCircle,
  Info, TriangleAlert, Flame, Sparkles,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ── Color helpers ─────────────────────────────────────────────
function riskBg(level: string) {
  const map: Record<string, string> = {
    low: "rgba(0,255,136,0.06)", moderate: "rgba(0,212,255,0.06)",
    elevated: "rgba(255,149,0,0.06)", high: "rgba(255,45,85,0.06)",
    critical: "rgba(255,45,85,0.10)",
  };
  return map[level] ?? "rgba(255,255,255,0.03)";
}

function riskBorder(level: string) {
  const map: Record<string, string> = {
    low: "rgba(0,255,136,0.18)", moderate: "rgba(0,212,255,0.18)",
    elevated: "rgba(255,149,0,0.22)", high: "rgba(255,45,85,0.25)",
    critical: "rgba(255,45,85,0.35)",
  };
  return map[level] ?? "rgba(255,255,255,0.08)";
}

const ACCENT = {
  green: "#00FF88", cyan: "#00D4FF", amber: "#FF9500",
  red: "#FF2D55", purple: "#C084FC", gold: "#F7931A",
};

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        toast.success("Copied to clipboard");
      }}
      style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "3px 8px", background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px",
        cursor: "pointer", color: "rgba(148,163,184,0.7)",
        fontSize: "9px", fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.1em", transition: "all 0.15s ease",
      }}
    >
      {copied ? <CheckCircle size={9} color={ACCENT.green} /> : <Copy size={9} />}
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({
  label, sub, color = ACCENT.cyan, badge, copyText, conditional: _conditional,
}: {
  label: string; sub?: string; color?: string; badge?: string; copyText?: string; conditional?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "2px", height: "14px", background: color, borderRadius: "1px", boxShadow: `0 0 8px ${color}` }} />
        <div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
          {sub && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)", marginLeft: "8px" }}>{sub}</span>}
        </div>
        {badge && (
          <span style={{ padding: "1px 6px", background: `${color}15`, border: `1px solid ${color}30`, borderRadius: "2px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color, letterSpacing: "0.12em" }}>{badge}</span>
        )}
      </div>
      {copyText && <CopyButton text={copyText} />}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color, onClick }: { label: string; value: string; sub?: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px", background: `${color}08`,
        border: `1px solid ${color}20`, borderRadius: "4px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(148,163,184,0.6)", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color, lineHeight: 1, textShadow: `0 0 12px ${color}50` }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.55)", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

// ── Alert banner ──────────────────────────────────────────────
function AlertBanner({ icon: Icon, text, color, href }: { icon: React.ElementType; text: string; color: string; href?: string }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => href && navigate(href)}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "8px 12px", background: `${color}08`,
        border: `1px solid ${color}25`, borderRadius: "4px",
        cursor: href ? "pointer" : "default",
        marginBottom: "8px",
      }}
    >
      <Icon size={12} color={color} />
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: `${color}CC`, letterSpacing: "0.08em", flex: 1 }}>{text}</span>
      {href && <ChevronRight size={10} color={`${color}60`} />}
    </div>
  );
}

// ── Probability bar ───────────────────────────────────────────
function ProbabilityBar({ bull, neutral, bear }: { bull: number; neutral: number; bear: number }) {
  return (
    <div style={{ marginTop: "8px" }}>
      <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", gap: "1px" }}>
        <div style={{ width: `${bull}%`, background: ACCENT.green, transition: "width 0.5s ease" }} />
        <div style={{ width: `${neutral}%`, background: "rgba(148,163,184,0.4)", transition: "width 0.5s ease" }} />
        <div style={{ width: `${bear}%`, background: ACCENT.red, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: ACCENT.green }}>BULL {bull}%</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)" }}>NEUTRAL {neutral}%</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: ACCENT.red }}>BEAR {bear}%</span>
      </div>
    </div>
  );
}

// ── Report card ───────────────────────────────────────────────
function ReportCard({
  title, summary, color, badge, href, conditional, copyText,
}: {
  title: string; summary: string; color: string; badge?: string;
  href?: string; conditional?: string; copyText?: string;
}) {
  const [, navigate] = useLocation();
  return (
    <div style={{
      background: "rgba(255,255,255,0.008)", border: `1px solid ${color}18`,
      borderRadius: "4px", padding: "14px 16px", marginBottom: "10px",
      position: "relative",
    }}>
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, ${color}40, transparent)` }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.18em", color, textTransform: "uppercase", fontWeight: 600 }}>{title}</span>
          {badge && (
            <span style={{ padding: "1px 5px", background: `${color}15`, border: `1px solid ${color}30`, borderRadius: "2px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color, letterSpacing: "0.1em" }}>{badge}</span>
          )}
          {conditional && (
            <span style={{ padding: "1px 5px", background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "2px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(148,163,184,0.6)", letterSpacing: "0.1em" }}>CONDITIONAL</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {copyText && <CopyButton text={copyText} />}
          {href && (
            <button
              onClick={() => navigate(href)}
              style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", background: `${color}10`, border: `1px solid ${color}25`, borderRadius: "3px", cursor: "pointer", color, fontSize: "8px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em" }}
            >
              VIEW <ChevronRight size={8} />
            </button>
          )}
        </div>
      </div>

      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(203,213,225,0.85)", lineHeight: 1.7, margin: 0 }}>
        {summary}
      </p>

      {conditional && (
        <div style={{ marginTop: "8px", padding: "5px 8px", background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: "3px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)" }}>TRIGGERED WHEN: {conditional}</span>
        </div>
      )}
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────
function TabBtn({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px", background: active ? "rgba(0,212,255,0.1)" : "transparent",
        border: active ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
        borderRadius: "3px", cursor: "pointer",
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
        letterSpacing: "0.14em", color: active ? ACCENT.cyan : "rgba(148,163,184,0.55)",
        textTransform: "uppercase", transition: "all 0.15s ease",
        position: "relative", whiteSpace: "nowrap",
      }}
    >
      {label}
      {badge && (
        <span style={{
          position: "absolute", top: "-4px", right: "-4px",
          width: "14px", height: "14px", borderRadius: "50%",
          background: ACCENT.red, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#fff",
        }}>{badge}</span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────
export default function IntelligenceHub() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"brief" | "changed" | "opportunities" | "risks" | "portfolio" | "deep">("brief");

  const {
    output, isLoading, isLive, lastUpdated, forceRefresh, isRefreshing,
  } = useEngine();
  const overall = output.overall;
  const riskLevel = output.overall.riskLevel;
  const probability = output.probability;
  const regime = output.regime;
  const domains = output.domains;
  const analogs = output.analogs;
  const changedDomains = useMemo(() => [...domains].filter((d) => Math.abs(d.delta) > 0.1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)), [domains]);

  // FMOS fast pipeline for hub data
  const { data: fmosData, isLoading: fmosLoading } = trpc.fmos.runPipelineFast.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: false,
  });

  // Opportunity scan
  const { data: oppData } = (trpc as any).smartDiscovery?.getOpportunityRanking?.useQuery?.(undefined, {
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Portfolio data
  const { data: portfolioData } = (trpc as any).portfolio?.getHoldings?.useQuery?.(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  }) ?? { data: null };

  // Watchlist
  const { data: watchlistData } = (trpc as any).watchlist?.getAll?.useQuery?.(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  }) ?? { data: null };

  const color = getRiskColor(riskLevel);
  const updatedAgo = lastUpdated
    ? (() => {
        const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
      })()
    : "—";

  // Smart conditional flags
  const hasRegimeChange = changedDomains.length > 0;
  const hasRiskEscalation = riskLevel === "elevated" || riskLevel === "high" || riskLevel === "critical";
  const hasAIBubble = domains.some(d => (d.id === "ai-bubble" || d.id === "ai-concentration") && d.score > 5);
  const hasLiquidityChange = domains.some(d => d.id === "liquidity" && (d.score > 6 || d.score < 3));
  const hasPortfolio = portfolioData && Array.isArray(portfolioData) && portfolioData.length > 0;
  const hasWatchlist = watchlistData && Array.isArray(watchlistData) && watchlistData.length > 0;

  // Risk alert count for badge
  const riskAlertCount = [hasRegimeChange, hasRiskEscalation, hasAIBubble, hasLiquidityChange]
    .filter(Boolean).length;

  // Regime label
  const verdictLabel = riskLevel === "low" ? "TAKE RISK" : riskLevel === "moderate" ? "STAY SELECTIVE" : riskLevel === "elevated" ? "REDUCE EXPOSURE" : "STEP ASIDE";

  // Top threat
  const topThreat = useMemo(() => {
    return [...domains].sort((a, b) => b.score - a.score)[0];
  }, [domains]);

  // Top stabilizer
  const topStabilizer = useMemo(() => {
    return [...domains].sort((a, b) => a.score - b.score)[0];
  }, [domains]);

  // Brief text for copy
  const briefText = useMemo(() => {
    const p = probability;
    return `FAULTLINE MARKET BRIEF — ${new Date().toLocaleDateString()}

REGIME: ${regime.label} | RISK LEVEL: ${riskLevel.toUpperCase()} | VERDICT: ${verdictLabel}
PRESSURE INDEX: ${overall.score.toFixed(1)}/10

PROBABILITY DISTRIBUTION:
Bull ${p.bullProbability}% · Neutral ${p.softLandingProbability ?? 5}% · Bear ${p.crashProbability}%

CONFIDENCE: ${fmosData?.confidence?.score ?? "—"}/100
EVIDENCE DIVERSITY: ${fmosData?.evidence?.diversityScore ?? "—"}

TOP THREAT: ${topThreat?.label ?? "—"} (${topThreat?.score?.toFixed(1) ?? "—"}/10)
TOP STABILIZER: ${topStabilizer?.label ?? "—"} (${topStabilizer?.score?.toFixed(1) ?? "—"}/10)

REGIME CHANGES: ${changedDomains.length > 0 ? changedDomains.map(d => `${d.label} Δ${d.delta > 0 ? "+" : ""}${d.delta.toFixed(2)}`).join(", ") : "None"}

Updated: ${updatedAgo}`;
  }, [regime, riskLevel, verdictLabel, overall, probability, fmosData, topThreat, topStabilizer, changedDomains, updatedAgo]);

  if (isLoading) {
    return (
      <div style={{ background: "#050608", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "32px", height: "32px", border: `2px solid ${ACCENT.cyan}30`, borderTop: `2px solid ${ACCENT.cyan}`, borderRadius: "50%", animation: "fl-spin 1s linear infinite", margin: "0 auto 12px" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.2em" }}>LOADING INTELLIGENCE HUB...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#050608", minHeight: "100vh" }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px",
        background: "rgba(5,6,8,0.97)",
        borderBottom: `1px solid ${color}20`,
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}`, animation: "blink-alert 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.2em", color, textTransform: "uppercase", fontWeight: 600 }}>INTELLIGENCE HUB</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>— {regime.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isLive ? ACCENT.green : ACCENT.amber, boxShadow: isLive ? `0 0 8px ${ACCENT.green}` : `0 0 8px ${ACCENT.amber}` }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.12em" }}>{isLive ? "LIVE" : "CACHED"} · {updatedAgo}</span>
          </div>
          <button
            onClick={() => forceRefresh()}
            disabled={isRefreshing}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", cursor: "pointer", color: "rgba(148,163,184,0.6)" }}
          >
            <RefreshCw size={10} style={{ animation: isRefreshing ? "fl-spin 1s linear infinite" : "none" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em" }}>REFRESH</span>
          </button>
          <CopyButton text={briefText} />
        </div>
      </div>

      {/* ── REGIME STATUS BAR ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
        padding: "8px 20px",
        background: riskBg(riskLevel),
        borderBottom: `1px solid ${riskBorder(riskLevel)}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.15em" }}>VERDICT</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color, letterSpacing: "0.08em", textShadow: `0 0 10px ${color}60` }}>{verdictLabel}</span>
        </div>
        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.15em" }}>PRESSURE</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color, letterSpacing: "0.06em" }}>{overall.score.toFixed(1)}/10</span>
        </div>
        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.15em" }}>CONFIDENCE</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: fmosData?.confidence?.score != null && fmosData.confidence.score >= 60 ? ACCENT.green : fmosData?.confidence?.score != null && fmosData.confidence.score >= 40 ? ACCENT.amber : ACCENT.red, letterSpacing: "0.06em" }}>
            {fmosData?.confidence?.score ?? "—"}/100
          </span>
        </div>
        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.15em" }}>BULL/BEAR</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: ACCENT.green, letterSpacing: "0.06em" }}>{probability.bullProbability}%</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.4)" }}>/</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: ACCENT.red, letterSpacing: "0.06em" }}>{probability.crashProbability}%</span>
        </div>
        {hasRegimeChange && (
          <>
            <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: ACCENT.amber, animation: "blink-alert 1s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: ACCENT.amber, letterSpacing: "0.12em" }}>REGIME CHANGE DETECTED</span>
            </div>
          </>
        )}
      </div>

      {/* ── TAB BAR ────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "4px", flexWrap: "wrap",
        padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        overflowX: "auto",
      }}>
        <TabBtn label="Today's Brief" active={activeTab === "brief"} onClick={() => setActiveTab("brief")} />
        <TabBtn label="What Changed" active={activeTab === "changed"} onClick={() => setActiveTab("changed")} badge={hasRegimeChange ? String(changedDomains.length) : undefined} />
        <TabBtn label="Opportunities" active={activeTab === "opportunities"} onClick={() => setActiveTab("opportunities")} />
        <TabBtn label="Risks" active={activeTab === "risks"} onClick={() => setActiveTab("risks")} badge={riskAlertCount > 0 ? String(riskAlertCount) : undefined} />
        <TabBtn label="Your Portfolio" active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")} />
        <TabBtn label="Deep Analysis" active={activeTab === "deep"} onClick={() => setActiveTab("deep")} />
      </div>

      {/* ── TAB CONTENT ────────────────────────────────────────── */}
      <div style={{ padding: "16px 20px 80px" }}>

        {/* ── TODAY'S BRIEF ──────────────────────────────────── */}
        {activeTab === "brief" && (
          <div>
            <SectionHeader label="Executive Market Brief" color={color} sub={`Updated ${updatedAgo}`} copyText={briefText} />

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px", marginBottom: "16px" }}>
              <StatCard label="Market Verdict" value={verdictLabel} color={color} onClick={() => navigate("/app/pre-flight")} />
              <StatCard label="Pressure Index" value={`${overall.score.toFixed(1)}/10`} color={color} onClick={() => navigate("/app/pressure")} />
              <StatCard label="Confidence" value={`${fmosData?.confidence?.score ?? "—"}/100`} color={fmosData?.confidence?.score != null && fmosData.confidence.score >= 60 ? ACCENT.green : ACCENT.amber} />
              <StatCard label="Evidence Diversity" value={`${fmosData?.evidence?.diversityScore ?? "—"}`} sub="0=single source · 4=all families" color={fmosData?.evidence?.diversityScore != null && fmosData.evidence.diversityScore >= 3 ? ACCENT.green : ACCENT.amber} />
            </div>

            {/* Probability distribution */}
            <div style={{ background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "14px 16px", marginBottom: "12px" }}>
              <SectionHeader label="Probability Distribution" color={ACCENT.cyan} />
              <ProbabilityBar
                bull={probability.bullProbability}
                neutral={probability.softLandingProbability ?? 5}
                bear={probability.crashProbability}
              />
            </div>

            {/* Recommended posture */}
            <div style={{ background: riskBg(riskLevel), border: `1px solid ${riskBorder(riskLevel)}`, borderRadius: "4px", padding: "14px 16px", marginBottom: "12px" }}>
              <SectionHeader label="Recommended Posture" color={color} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(203,213,225,0.9)", lineHeight: 1.8, margin: 0 }}>
                {riskLevel === "low"
                  ? "Risk-on window is open. Momentum is aligned with macro conditions. Increase exposure to high-conviction growth assets. Prioritize AI infrastructure, energy, and financials. Maintain tight stops on speculative positions."
                  : riskLevel === "moderate"
                  ? "Selective positioning required. Only high-conviction setups with clear catalysts. Avoid speculative names without fundamental support. Hedge tail risk with defensive positions. Monitor for regime deterioration."
                  : riskLevel === "elevated"
                  ? "Reduce gross exposure. Trim extended positions. Increase cash or defensive allocation (Treasuries, gold, utilities). Avoid new risk-on entries until pressure normalizes. Set alerts for further deterioration."
                  : "Capital preservation mode. Step aside from risk assets. Defensive allocation only — short-duration bonds, cash, gold. Do not catch falling knives. Wait for confirmed regime stabilization before re-entering."}
              </p>
            </div>

            {/* 3 biggest changes */}
            {changedDomains.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "14px 16px", marginBottom: "12px" }}>
                <SectionHeader label="3 Biggest Changes" color={ACCENT.amber} />
                {changedDomains.slice(0, 3).map((d: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(203,213,225,0.8)" }}>{d.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {d.delta > 0 ? <ArrowUpRight size={10} color={ACCENT.red} /> : <ArrowDownRight size={10} color={ACCENT.green} />}
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "12px", color: d.delta > 0 ? ACCENT.red : ACCENT.green }}>
                        {d.delta > 0 ? "+" : ""}{d.delta.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* FMOS decision */}
            {fmosData?.decision && (
              <div style={{ background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "14px 16px" }}>
                <SectionHeader label="FMOS Decision Engine" color={ACCENT.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <StatCard label="Verdict" value={fmosData.decision.verdict ?? "WATCH"} color={fmosData.decision.verdict === "BUY" || fmosData.decision.verdict === "ACCUMULATE" ? ACCENT.green : fmosData.decision.verdict === "SELL" || fmosData.decision.verdict === "REDUCE" ? ACCENT.red : ACCENT.amber} />
                  <StatCard label="Conviction" value={fmosData.decision.conviction != null ? String(fmosData.decision.conviction) : "—"} color={ACCENT.purple} />
                </div>
                {fmosData.decision.primaryReason && (
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", lineHeight: 1.7, margin: "10px 0 0" }}>{fmosData.decision.primaryReason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── WHAT CHANGED ───────────────────────────────────── */}
        {activeTab === "changed" && (
          <div>
            <SectionHeader label="What Changed Since Yesterday" color={ACCENT.amber} />

            {changedDomains.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <CheckCircle size={20} color={ACCENT.green} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.6)", margin: 0 }}>No significant regime changes detected. Market conditions are stable.</p>
              </div>
            ) : (
              <>
                <AlertBanner icon={TriangleAlert} text={`${changedDomains.length} domain${changedDomains.length > 1 ? "s" : ""} shifted materially since last session`} color={ACCENT.amber} href="/app/pressure" />
                {changedDomains.map((d, i) => (
                  <ReportCard
                    key={i}
                    title={d.label}
                    summary={`Score shifted ${d.delta > 0 ? "up" : "down"} by ${Math.abs(d.delta).toFixed(2)} points to ${d.score.toFixed(1)}/10. Risk level: ${d.riskLevel.toUpperCase()}. ${d.delta > 0 ? "Increasing pressure in this domain warrants attention." : "Easing pressure in this domain is constructive for risk assets."}`}
                    color={d.delta > 0 ? ACCENT.red : ACCENT.green}
                    badge={d.delta > 0 ? "DETERIORATING" : "IMPROVING"}
                    href="/app/pressure"
                    copyText={`${d.label}: Δ${d.delta > 0 ? "+" : ""}${d.delta.toFixed(2)} → ${d.score.toFixed(1)}/10 (${d.riskLevel})`}
                  />
                ))}
              </>
            )}

            {/* Pressure attribution */}
            <div style={{ marginTop: "16px" }}>
              <SectionHeader label="Pressure Attribution" color={ACCENT.cyan} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                {domains.slice(0, 8).map((d: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => navigate("/app/pressure")}
                    style={{ padding: "10px 12px", background: `${getRiskColor(d.riskLevel)}08`, border: `1px solid ${getRiskColor(d.riskLevel)}18`, borderRadius: "4px", cursor: "pointer" }}
                  >
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>{d.label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: getRiskColor(d.riskLevel), lineHeight: 1 }}>{d.score.toFixed(1)}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.4)" }}>/10</span>
                    </div>
                    <div style={{ marginTop: "5px", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }}>
                      <div style={{ width: `${(d.score / 10) * 100}%`, height: "100%", background: getRiskColor(d.riskLevel), borderRadius: "1px", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES ──────────────────────────────────── */}
        {activeTab === "opportunities" && (
          <div>
            <SectionHeader label="Opportunity Report" color={ACCENT.green} />

            {/* Market posture for opportunities */}
            <AlertBanner
              icon={riskLevel === "low" ? TrendingUp : riskLevel === "moderate" ? Target : Shield}
              text={riskLevel === "low" ? "Risk-on: Breakout setups, momentum plays, and growth names are favored" : riskLevel === "moderate" ? "Selective: Focus on high-conviction reversals and oversold quality names" : "Defensive: Inverse ETFs, hedges, and capital preservation vehicles only"}
              color={riskLevel === "low" ? ACCENT.green : riskLevel === "moderate" ? ACCENT.cyan : ACCENT.amber}
              href="/app/signal-outlook"
            />

            {/* Opportunity ranking from scan */}
            {oppData?.rankedOpportunities && oppData.rankedOpportunities.length > 0 ? (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)", margin: "0 0 10px" }}>{oppData.marketContext}</p>
                </div>
                {oppData.rankedOpportunities.slice(0, 5).map((opp: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/app/symbol-intelligence?symbol=${opp.symbol}`)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: "12px 14px", marginBottom: "8px",
                      background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "4px", cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: `${ACCENT.green}15`, border: `1px solid ${ACCENT.green}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: ACCENT.green, fontWeight: 700 }}>#{i + 1}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: ACCENT.green }}>{opp.symbol}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)" }}>{opp.name}</span>
                        {opp.action && (
                          <span style={{ padding: "1px 6px", background: `${ACCENT.green}15`, border: `1px solid ${ACCENT.green}30`, borderRadius: "2px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: ACCENT.green }}>{opp.action}</span>
                        )}
                      </div>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", margin: 0, lineHeight: 1.6 }}>{opp.rationale}</p>
                      {(opp.confidencePercent || opp.timeHorizon) && (
                        <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                          {opp.confidencePercent && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)" }}>CONFIDENCE: {opp.confidencePercent}%</span>}
                          {opp.timeHorizon && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)" }}>HORIZON: {opp.timeHorizon}</span>}
                          {opp.expectedReward && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: ACCENT.green }}>R/R: {opp.expectedReward}</span>}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={12} color="rgba(148,163,184,0.3)" />
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px", marginBottom: "12px" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.5)", margin: 0 }}>Run Opportunity Scan to see ranked opportunities</p>
                <button onClick={() => navigate("/app/discover")} style={{ marginTop: "10px", padding: "6px 14px", background: `${ACCENT.green}10`, border: `1px solid ${ACCENT.green}25`, borderRadius: "3px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: ACCENT.green, letterSpacing: "0.1em" }}>
                  OPEN OPPORTUNITY SCAN →
                </button>
              </div>
            )}

            {/* Sector rotation */}
            <div style={{ marginTop: "16px" }}>
              <SectionHeader label="Sector Rotation" color={ACCENT.cyan} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                {[
                  { sector: "Technology", score: riskLevel === "low" ? 8.2 : riskLevel === "moderate" ? 6.1 : 3.8, trend: riskLevel === "low" ? "up" : "down" },
                  { sector: "Energy", score: riskLevel === "low" ? 7.5 : riskLevel === "moderate" ? 6.8 : 5.2, trend: "up" },
                  { sector: "Financials", score: riskLevel === "low" ? 7.1 : riskLevel === "moderate" ? 5.9 : 4.1, trend: riskLevel === "low" ? "up" : "down" },
                  { sector: "Healthcare", score: riskLevel === "elevated" || riskLevel === "high" ? 7.2 : 5.5, trend: riskLevel === "elevated" ? "up" : "flat" },
                  { sector: "Utilities", score: riskLevel === "elevated" || riskLevel === "high" ? 7.8 : 4.2, trend: riskLevel === "elevated" ? "up" : "down" },
                  { sector: "Crypto", score: riskLevel === "low" ? 7.9 : riskLevel === "moderate" ? 5.5 : 2.8, trend: riskLevel === "low" ? "up" : "down" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>{s.sector}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: s.score >= 7 ? ACCENT.green : s.score >= 5 ? ACCENT.cyan : ACCENT.amber }}>{s.score.toFixed(1)}</span>
                      {s.trend === "up" ? <ArrowUpRight size={10} color={ACCENT.green} /> : s.trend === "down" ? <ArrowDownRight size={10} color={ACCENT.red} /> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RISKS ──────────────────────────────────────────── */}
        {activeTab === "risks" && (
          <div>
            <SectionHeader label="Risk Intelligence" color={ACCENT.red} badge={riskAlertCount > 0 ? `${riskAlertCount} ALERTS` : undefined} />

            {/* Active alerts */}
            {hasRiskEscalation && (
              <AlertBanner icon={Flame} text={`Risk Escalation: ${riskLevel.toUpperCase()} regime — ${riskLevel === "elevated" ? "reduce exposure, trim extended positions" : "capital preservation mode, step aside from risk assets"}`} color={ACCENT.red} href="/app/pressure" />
            )}
            {hasRegimeChange && (
              <AlertBanner icon={TriangleAlert} text={`Regime Change: ${changedDomains.length} domain${changedDomains.length > 1 ? "s" : ""} shifted — ${changedDomains[0]?.label} is the primary driver`} color={ACCENT.amber} href="/app/pressure" />
            )}
            {hasAIBubble && (
              <AlertBanner icon={Cpu} text="AI Bubble Monitor: AI/mega-cap concentration risk is elevated. Monitor NVDA/MSFT/AAPL weighting in portfolios." color={ACCENT.purple} href="/app/signals" />
            )}
            {hasLiquidityChange && (
              <AlertBanner icon={Activity} text={`Liquidity Alert: ${domains.find(d => d.id === "liquidity")?.score ?? 0 > 6 ? "Liquidity tightening — credit conditions deteriorating" : "Liquidity improving — easing conditions are constructive"}`} color={ACCENT.cyan} href="/app/pressure" />
            )}

            {/* Top threats */}
            <div style={{ marginBottom: "16px" }}>
              <SectionHeader label="Top Threats" color={ACCENT.red} />
              {[...domains].sort((a: any, b: any) => b.score - a.score).slice(0, 4).map((d: any, i: number) => (
                <ReportCard
                  key={i}
                  title={d.label}
                  summary={`Current score: ${d.score.toFixed(1)}/10 (${d.riskLevel} risk). ${d.score > 7 ? "Critical level — active threat to portfolio performance. Consider defensive positioning." : d.score > 5 ? "Elevated — monitor closely. May escalate with adverse catalysts." : "Building pressure — not yet critical but warrants awareness."}`}
                  color={getRiskColor(d.riskLevel)}
                  badge={d.riskLevel.toUpperCase()}
                  href="/app/pressure"
                />
              ))}
            </div>

            {/* What would calm / worsen risk */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "4px", padding: "12px 14px" }}>
                <SectionHeader label="What Would Calm Risk" color={ACCENT.green} />
                <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
                  {[
                    "Fed pivot or dovish guidance",
                    "Inflation data below expectations",
                    "Strong earnings with guidance raises",
                    "Credit spreads tightening",
                    "VIX declining below 15",
                  ].map((item, i) => (
                    <li key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", lineHeight: 1.8 }}>{item}</li>
                  ))}
                </ul>
              </div>
              <div style={{ background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: "4px", padding: "12px 14px" }}>
                <SectionHeader label="What Would Worsen Risk" color={ACCENT.red} />
                <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
                  {[
                    "Surprise rate hike or hawkish pivot",
                    "CPI above 4% or PCE surprise",
                    "Credit event / bank stress",
                    "Geopolitical escalation",
                    "Earnings misses with guidance cuts",
                  ].map((item, i) => (
                    <li key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", lineHeight: 1.8 }}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── YOUR PORTFOLIO ─────────────────────────────────── */}
        {activeTab === "portfolio" && (
          <div>
            <SectionHeader label="Portfolio Intelligence" color={ACCENT.cyan} />

            {!hasPortfolio ? (
              <div style={{ padding: "32px 20px", textAlign: "center", background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <Layers size={24} color="rgba(148,163,184,0.3)" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.5)", margin: "0 0 12px" }}>Add holdings to your portfolio to see personalized risk analysis, concentration warnings, and regime-aligned recommendations.</p>
                <button onClick={() => navigate("/app/portfolio")} style={{ padding: "8px 16px", background: `${ACCENT.cyan}10`, border: `1px solid ${ACCENT.cyan}25`, borderRadius: "3px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: ACCENT.cyan, letterSpacing: "0.1em" }}>
                  ADD HOLDINGS →
                </button>
              </div>
            ) : (
              <div>
                <AlertBanner icon={Shield} text="Portfolio risk analysis is based on current regime and FMOS signal data" color={ACCENT.cyan} href="/app/portfolio" />
                <ReportCard
                  title="Portfolio Risk Report"
                  summary={`Your portfolio is being evaluated against the current ${riskLevel} risk regime. ${riskLevel === "elevated" || riskLevel === "high" ? "Consider reducing high-beta positions and increasing defensive allocation." : riskLevel === "moderate" ? "Maintain selective positioning. Review concentration in speculative names." : "Risk environment is supportive. Maintain or increase high-conviction positions."}`}
                  color={color}
                  href="/app/portfolio"
                  copyText="View full portfolio risk report in FAULTLINE"
                />
              </div>
            )}

            {/* Watchlist */}
            <div style={{ marginTop: "16px" }}>
              <SectionHeader label="Watchlist Intelligence" color={ACCENT.purple} sub={!hasWatchlist ? "Add tickers to watchlist" : undefined} />
              {!hasWatchlist ? (
                <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.5)", margin: "0 0 10px" }}>Add tickers to your watchlist to see signal updates and regime-aligned alerts.</p>
                  <button onClick={() => navigate("/app/watchlist")} style={{ padding: "6px 14px", background: `${ACCENT.purple}10`, border: `1px solid ${ACCENT.purple}25`, borderRadius: "3px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: ACCENT.purple, letterSpacing: "0.1em" }}>
                    MANAGE WATCHLIST →
                  </button>
                </div>
              ) : (
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)" }}>
                  {Array.isArray(watchlistData) ? watchlistData.length : 0} tickers tracked — view signal updates in Watchlist
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── DEEP ANALYSIS ──────────────────────────────────── */}
        {activeTab === "deep" && (
          <div>
            <SectionHeader label="Deep Analysis" color={ACCENT.purple} />

            {/* Historical analogs */}
            {analogs.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <SectionHeader label="Historical Analog Report" color={ACCENT.purple} />
                {analogs.slice(0, 3).map((analog: any, i: number) => (
                  <ReportCard
                    key={i}
                    title={`${analog.era ?? "Historical Period"} — ${analog.similarity ?? 0}% Match`}
                    summary={`${analog.description ?? "Similar market conditions detected."}${analog.outcome ? ` Historical outcome: ${analog.outcome}` : ""}${analog.lesson ? ` Key lesson: ${analog.lesson}` : ""}`}
                    color={ACCENT.purple}
                    badge={`${analog.similarity ?? 0}% MATCH`}
                    href="/app/analogs"
                    copyText={`Historical Analog: ${analog.era} (${analog.similarity}% match) — ${analog.description}`}
                  />
                ))}
                <button onClick={() => navigate("/app/analogs")} style={{ width: "100%", padding: "8px", background: `${ACCENT.purple}08`, border: `1px solid ${ACCENT.purple}20`, borderRadius: "3px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: ACCENT.purple, letterSpacing: "0.1em" }}>
                  VIEW ALL HISTORICAL ANALOGS →
                </button>
              </div>
            )}

            {/* Scenario analysis */}
            <div style={{ marginBottom: "16px" }}>
              <SectionHeader label="Scenario Analysis" color={ACCENT.cyan} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {[
                  { label: "Bull Case", prob: probability.bullProbability, color: ACCENT.green, desc: "Inflation cools, Fed pivots, earnings beat. Risk-on rotation accelerates." },
                  { label: "Base Case", prob: probability.softLandingProbability ?? 5, color: ACCENT.cyan, desc: "Soft landing achieved. Selective opportunities in quality names." },
                  { label: "Bear Case", prob: probability.crashProbability, color: ACCENT.red, desc: "Recession or credit event. Defensive positioning required." },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "12px", background: `${s.color}06`, border: `1px solid ${s.color}18`, borderRadius: "4px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: s.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>{s.label}</div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: s.color, lineHeight: 1, marginBottom: "6px" }}>{s.prob}%</div>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.6)", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Signal confidence details */}
            {fmosData?.evidence && (
              <div style={{ marginBottom: "16px" }}>
                <SectionHeader label="Signal Confidence Details" color={ACCENT.cyan} />
                <div style={{ background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "14px 16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
                    <StatCard label="Overall Confidence" value={`${fmosData.confidence?.score ?? "—"}/100`} color={ACCENT.cyan} />
                    <StatCard label="Evidence Diversity" value={`${fmosData.evidence.diversityScore ?? "—"}/4`} color={fmosData.evidence.diversityScore >= 3 ? ACCENT.green : ACCENT.amber} />
                    <StatCard label="Data Freshness" value={fmosData.complete ? "COMPLETE" : "PARTIAL"} color={fmosData.complete ? ACCENT.green : ACCENT.amber} />
                    <StatCard label="Engine Version" value={fmosData.engineVersion ?? "—"} color={ACCENT.purple} />
                  </div>
                  {!fmosData.complete && fmosData.errors && fmosData.errors.length > 0 && (
                    <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(255,149,0,0.06)", border: "1px solid rgba(255,149,0,0.2)", borderRadius: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: ACCENT.amber, letterSpacing: "0.1em" }}>PIPELINE WARNINGS:</span>
                      {fmosData.errors.map((e: string, i: number) => (
                        <p key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,149,0,0.7)", margin: "3px 0 0" }}>• {e}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick links to deep pages */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { label: "Validation Lab", sub: "Brier scores & calibration", href: "/app/validation-lab", color: ACCENT.green },
                { label: "FMOS Health", sub: "Engine diagnostics", href: "/app/fmos-health", color: ACCENT.cyan },
                { label: "Historical Analogs", sub: "Pattern matching", href: "/app/analogs", color: ACCENT.purple },
                { label: "Simulate Pressure", sub: "Scenario stress testing", href: "/app/simulate", color: ACCENT.amber },
              ].map((link, i) => (
                <button
                  key={i}
                  onClick={() => navigate(link.href)}
                  style={{ padding: "12px 14px", background: `${link.color}06`, border: `1px solid ${link.color}18`, borderRadius: "4px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}
                >
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: link.color, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "3px" }}>{link.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.5)" }}>{link.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
