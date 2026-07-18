/* ============================================================
   FAULTLINE — Market Command Center
   The institutional operating system. First screen after login.
   8 regime indicator pills + 9 intelligence cards + Today's Story
   + Smart Discovery search. All above the fold on desktop.
   Design: Palantir Noir — void black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Command, Search, Zap, TrendingUp, TrendingDown, AlertTriangle,
  Shield, Target, Cpu, ChevronRight, RefreshCw, Clock, Activity,
  BarChart2, Bitcoin, Layers, ArrowUpRight, ArrowDownRight,
  Crosshair, Eye, Sparkles, BookOpen, Loader2,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import MarketSynthesisPanel from "@/components/MarketSynthesisPanel";
import { useTickerStore } from "@/contexts/TickerStore";
import { PremiumGateFull } from "@/components/PremiumGate";

// ── Helpers ───────────────────────────────────────────────────
function getRiskLabel(riskLevel: string): string {
  const map: Record<string, string> = {
    low: "BULLISH", moderate: "SELECTIVE", elevated: "CAUTIOUS",
    high: "DEFENSIVE", critical: "CRISIS",
  };
  return map[riskLevel] ?? "NEUTRAL";
}

function getVerdictColor(riskLevel: string): string {
  return getRiskColor(riskLevel === "low" ? "low" : riskLevel === "moderate" ? "moderate" : riskLevel === "elevated" ? "elevated" : "critical");
}

function formatRelTime(d: Date | null): string {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Regime pill ───────────────────────────────────────────────
function RegimePill({
  label, value, color, sub, onClick,
}: { label: string; value: string; color: string; sub?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "8px 12px", gap: "3px",
        background: `${color}0D`, border: `1px solid ${color}30`,
        borderRadius: "4px", cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease", flexShrink: 0, minWidth: "100px",
        boxShadow: `0 0 12px ${color}10`,
      }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLElement).style.background = `${color}1A`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px ${color}25`; } }}
      onMouseLeave={e => { if (onClick) { (e.currentTarget as HTMLElement).style.background = `${color}0D`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${color}10`; } }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", color: "rgba(100,116,139,0.7)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color, letterSpacing: "0.06em", lineHeight: 1, textShadow: `0 0 12px ${color}60` }}>{value}</span>
      {sub && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.1em" }}>{sub}</span>}
    </button>
  );
}

// ── Intelligence card ─────────────────────────────────────────
function IntelCard({
  label, value, sub, color, href, icon: Icon, badge,
}: {
  label: string; value: string; sub: string; color: string; href: string;
  icon?: React.ElementType; badge?: string;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      style={{
        display: "flex", flexDirection: "column", gap: "5px",
        padding: "12px 14px", textAlign: "left",
        background: "rgba(255,255,255,0.008)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "4px", cursor: "pointer",
        transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = `${color}08`;
        el.style.borderColor = `${color}25`;
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "rgba(255,255,255,0.008)";
        el.style.borderColor = "rgba(255,255,255,0.06)";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Corner accent */}
      <div style={{ position: "absolute", top: 0, right: 0, width: "6px", height: "6px", borderTop: `1px solid ${color}40`, borderRight: `1px solid ${color}40` }} />
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.16em", color: "rgba(100,116,139,0.6)", textTransform: "uppercase" }}>{label}</span>
        {Icon && <Icon size={10} color={`${color}70`} />}
      </div>
      {/* Value */}
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color, lineHeight: 1, textShadow: `0 0 14px ${color}50` }}>{value}</div>
      {/* Sub */}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.55)", lineHeight: 1.4 }}>{sub}</div>
      {/* Badge */}
      {badge && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 6px", background: `${color}15`, border: `1px solid ${color}30`, borderRadius: "2px", marginTop: "2px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color, letterSpacing: "0.12em" }}>{badge}</span>
        </div>
      )}
      {/* Arrow */}
      <ChevronRight size={10} style={{ position: "absolute", bottom: "10px", right: "10px", color: `${color}40` }} />
    </button>
  );
}

// ── Smart Discovery search bar ────────────────────────────────
function SmartDiscovery() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const QUICK_ACTIONS = [
    { label: "Best swing trades", query: "What are the best swing trades right now?" },
    { label: "Should I buy NVDA?", query: "Should I buy NVDA?" },
    { label: "What are institutions buying?", query: "What are institutions buying right now?" },
    { label: "Best AI stocks", query: "What are the best AI stocks to buy right now?" },
    { label: "Bitcoin risk", query: "What is the risk level for Bitcoin right now?" },
    { label: "Today's market verdict", query: "What is today's market verdict and regime?" },
  ];

  const { askPlaceholder } = useTickerStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    // Navigate to Ask FAULTLINE with the question pre-filled via URL param.
    // SmartDiscovery reads ?q= on mount and auto-submits through the real intelligence pipeline.
    // The intelligent context classifier in SmartDiscovery will resolve the correct symbol/mode.
    navigate(`/app/discover?q=${encodeURIComponent(trimmed)}`);
    setQuery("");
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "640px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit}>
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px",
          background: focused ? "rgba(0,212,255,0.06)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${focused ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "6px",
          transition: "all 0.15s ease",
          boxShadow: focused ? "0 0 20px rgba(0,212,255,0.12)" : "none",
        }}>
          <Search size={14} color={focused ? "#00D4FF" : "#4B5563"} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={askPlaceholder}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px",
              color: "#E2E8F0", letterSpacing: "0.04em",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>⌘K</span>
          </div>
        </div>
      </form>
      {/* Quick action chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", justifyContent: "center" }}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => navigate(`/app/discover?q=${encodeURIComponent(a.query)}`)}
            style={{
              padding: "4px 10px", background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
              color: "rgba(148,163,184,0.7)", cursor: "pointer",
              transition: "all 0.12s ease", letterSpacing: "0.06em",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#00D4FF"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.25)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.7)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Today's Story panel ───────────────────────────────────────
function TodaysStoryPanel({ regime, domains, probability, analogs }: {
  regime: { label: string; color: string };
  domains: Array<{ id: string; label: string; score: number; riskLevel: string; delta: number }>;
  probability: { bullProbability: number; crashProbability: number };
  analogs: Array<{ era: string; similarity: number; year?: string }>;
}) {
  const color = regime.color;
  const topThreat = useMemo(() => [...domains].sort((a, b) => b.score - a.score)[0], [domains]);
  const topStabilizer = useMemo(() => [...domains].sort((a, b) => a.score - b.score)[0], [domains]);
  const topAnalog = analogs[0];

  // Build narrative from engine data
  const story = useMemo(() => {
    const threatLabel = topThreat?.label ?? "Unknown";
    const stabLabel = topStabilizer?.label ?? "Unknown";
    const bull = probability.bullProbability;
    const crash = probability.crashProbability;
    const analogText = topAnalog ? `The closest historical analog is ${topAnalog.era} (${topAnalog.similarity}% match).` : "";

    let opening = "";
    if (regime.label.toLowerCase().includes("risk") || regime.label.toLowerCase().includes("stress") || regime.label.toLowerCase().includes("crisis")) {
      opening = `Markets are operating under elevated systemic pressure. The ${regime.label} regime is active, with ${threatLabel} driving the primary stress vector.`;
    } else if (regime.label.toLowerCase().includes("bull") || regime.label.toLowerCase().includes("expansion")) {
      opening = `Conditions favor risk-taking. The ${regime.label} regime is active, with ${stabLabel} providing the strongest structural support.`;
    } else {
      opening = `Markets are in a mixed regime. The ${regime.label} environment requires selectivity — not all opportunities are equal.`;
    }

    const middle = `Bull probability stands at ${bull}%, with crash risk at ${crash}%. ${threatLabel} remains the highest-pressure domain at ${topThreat?.score?.toFixed(1) ?? "—"}/10. ${analogText}`;
    const action = crash > 50 ? "Prioritize capital preservation. Reduce leverage and avoid new speculative positions." : bull > 60 ? "Momentum window is open. Focus on high-conviction breakouts with defined risk." : "Remain selective. Favor setups with asymmetric reward-to-risk and clear invalidation levels.";

    return { opening, middle, action };
  }, [regime, topThreat, topStabilizer, probability, topAnalog]);

  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "rgba(10,13,20,0.95)", border: `1px solid ${color}20`,
      borderLeft: `3px solid ${color}`, borderRadius: "4px",
      padding: "14px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <BookOpen size={12} color={color} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: `${color}80`, textTransform: "uppercase" }}>TODAY'S STORY</span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.6)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em" }}
        >
          {expanded ? "COLLAPSE ↑" : "EXPAND ↓"}
        </button>
      </div>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.7, marginBottom: "8px" }}>
        {story.opening}
      </p>
      {expanded && (
        <>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.7, marginBottom: "8px" }}>
            {story.middle}
          </p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "8px 10px", background: `${color}08`, border: `1px solid ${color}20`, borderRadius: "3px" }}>
            <Target size={11} color={color} style={{ flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: `${color}CC`, lineHeight: 1.6, margin: 0 }}>
              {story.action}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
function MarketCommandCenterInner() {
  const [, navigate] = useLocation();
  const { output, isLoading, isLive, lastUpdated, forceRefresh, isRefreshing } = useEngine();
  const { overall, domains, regime, probability, analogs, narrative } = output;
  const { user } = useAuth();

  const color = regime.color;
  const riskLevel = overall.riskLevel;

  // Derived data
  const topThreat = useMemo(() => [...domains].sort((a, b) => b.score - a.score)[0], [domains]);
  const topStabilizer = useMemo(() => [...domains].sort((a, b) => a.score - b.score)[0], [domains]);
  const changedDomains = useMemo(() => [...domains].filter(d => Math.abs(d.delta) > 0.1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)), [domains]);
  const aiDomain = useMemo(() => domains.find(d => d.id === "ai-bubble"), [domains]);
  const cryptoDomain = useMemo(() => domains.find(d => d.id === "crypto-risk" || d.id === "crypto"), [domains]);
  const creditDomain = useMemo(() => domains.find(d => d.id === "credit-stress"), [domains]);
  const liquidityDomain = useMemo(() => domains.find(d => d.id === "liquidity"), [domains]);

  const updatedAgo = useMemo(() => formatRelTime(lastUpdated), [lastUpdated]);

  // Cross-market regime intelligence
  const { data: miData } = trpc.marketIntelligence.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Map riskLevel → regime attribute for ambient lighting
  const regimeAttr = riskLevel === "low" ? "bullish" : riskLevel === "moderate" ? "moderate" : riskLevel === "elevated" ? "elevated" : "crisis";

  // Verdict
  const verdict = riskLevel === "low" ? "RISK ON" : riskLevel === "moderate" ? "STAY SELECTIVE" : riskLevel === "elevated" ? "REDUCE EXPOSURE" : "STEP ASIDE";
  const verdictColor = getVerdictColor(riskLevel);

  // ── 8 Regime indicator pills ──────────────────────────────
  const regimePills = useMemo(() => [
    {
      label: "MARKET VERDICT",
      value: verdict,
      color: verdictColor,
      sub: riskLevel === "low" ? "Risk-on window open" : riskLevel === "moderate" ? "High-conviction only" : riskLevel === "elevated" ? "Trim & protect" : "Capital preservation",
      href: "/app/pre-flight",
    },
    {
      label: "RISK REGIME",
      value: overall.riskLevel.toUpperCase(),
      color: getRiskColor(riskLevel),
      sub: `Score: ${overall.score.toFixed(1)}/10`,
      href: "/app/pressure",
    },
    {
      label: "OPP REGIME",
      value: riskLevel === "low" ? "BREAKOUTS" : riskLevel === "moderate" ? "REVERSALS" : "HEDGES",
      color: riskLevel === "low" ? "#00FF88" : riskLevel === "moderate" ? "#00D4FF" : "#FF9500",
      sub: riskLevel === "low" ? "Momentum aligned" : riskLevel === "moderate" ? "Oversold bounces" : "Inverse ETFs",
      href: "/app/opportunities",
    },
    {
      label: "LIQUIDITY",
      value: liquidityDomain ? (liquidityDomain.score > 6 ? "TIGHTENING" : liquidityDomain.score > 4 ? "NEUTRAL" : "AMPLE") : "NEUTRAL",
      color: liquidityDomain ? getRiskColor(liquidityDomain.riskLevel) : "#00D4FF",
      sub: liquidityDomain ? `Score: ${liquidityDomain.score.toFixed(1)}/10` : "Fed balance sheet",
      href: "/app/pressure",
    },
    {
      label: "AI BUBBLE",
      value: aiDomain ? (aiDomain.score > 7 ? "EXTREME" : aiDomain.score > 5 ? "ELEVATED" : aiDomain.score > 3 ? "MODERATE" : "CONTAINED") : "MODERATE",
      color: aiDomain ? getRiskColor(aiDomain.riskLevel) : "#00D4FF",
      sub: aiDomain ? `Score: ${aiDomain.score.toFixed(1)}/10` : "AI concentration",
      href: "/app/signals",
    },
    {
      label: "CRYPTO RISK",
      value: cryptoDomain ? (cryptoDomain.score > 7 ? "HIGH" : cryptoDomain.score > 5 ? "MODERATE" : "LOW") : (riskLevel === "low" ? "LOW" : riskLevel === "moderate" ? "MODERATE" : "HIGH"),
      color: cryptoDomain ? getRiskColor(cryptoDomain.riskLevel) : (riskLevel === "low" ? "#00FF88" : riskLevel === "moderate" ? "#FF9500" : "#FF2D55"),
      sub: cryptoDomain ? `Score: ${cryptoDomain.score.toFixed(1)}/10` : "BTC/ETH regime",
      href: "/app/crypto",
    },
    {
      label: "CREDIT STRESS",
      value: creditDomain ? (creditDomain.score > 7 ? "STRESSED" : creditDomain.score > 5 ? "ELEVATED" : creditDomain.score > 3 ? "BUILDING" : "STABLE") : "STABLE",
      color: creditDomain ? getRiskColor(creditDomain.riskLevel) : "#00FF88",
      sub: creditDomain ? `Score: ${creditDomain.score.toFixed(1)}/10` : "HY spreads",
      href: "/app/pressure",
    },
    {
      label: "INST. RISK METER",
      value: overall.score > 7 ? "RISK-OFF" : overall.score > 5 ? "CAUTIOUS" : overall.score > 3 ? "NEUTRAL" : "RISK-ON",
      color: overall.score > 7 ? "#FF2D55" : overall.score > 5 ? "#FF9500" : overall.score > 3 ? "#00D4FF" : "#00FF88",
      sub: `Bull ${probability.bullProbability}% · Bear ${probability.crashProbability}%`,
      href: "/app/market-intelligence",
    },
  ], [overall, riskLevel, verdict, verdictColor, aiDomain, cryptoDomain, creditDomain, liquidityDomain, probability]);

  // ── 9 Intelligence cards ──────────────────────────────────
  const intelCards = useMemo(() => {
    const topAnalog = analogs[0];
    const biggestShift = changedDomains[0];
    return [
      {
        label: "HIGHEST CONVICTION STOCK",
        value: riskLevel === "low" ? "NVDA / PLTR" : riskLevel === "moderate" ? "MSFT / AAPL" : "SPY PUTS",
        sub: riskLevel === "low" ? "AI momentum + macro aligned" : riskLevel === "moderate" ? "Defensive mega-cap" : "Hedge against downside",
        color: riskLevel === "low" ? "#00FF88" : riskLevel === "moderate" ? "#00D4FF" : "#FF9500",
        href: "/app/signal-outlook",
        icon: TrendingUp,
        badge: "STOCK",
      },
      {
        label: "HIGHEST CONVICTION CRYPTO",
        value: riskLevel === "low" ? "BTC / ETH" : riskLevel === "moderate" ? "BTC ONLY" : "AVOID",
        sub: riskLevel === "low" ? "Risk-on crypto rotation active" : riskLevel === "moderate" ? "Bitcoin as digital gold" : "Crypto risk elevated",
        color: riskLevel === "low" ? "#F7931A" : riskLevel === "moderate" ? "#F7931A" : "#FF2D55",
        href: "/app/crypto",
        icon: Bitcoin,
        badge: "CRYPTO",
      },
      {
        label: "LARGEST SECTOR ROTATION",
        value: biggestShift ? `${biggestShift.label.split(" ")[0]} ${biggestShift.delta > 0 ? "↑" : "↓"}` : "STABLE",
        sub: biggestShift ? `Δ${biggestShift.delta >= 0 ? "+" : ""}${biggestShift.delta.toFixed(2)} vs baseline` : "No major rotations",
        color: biggestShift ? (biggestShift.delta > 0 ? "#FF9500" : "#00FF88") : "#94A3B8",
        href: "/app/alt-rotation",
        icon: Layers,
      },
      {
        label: "BIGGEST THREAT",
        value: topThreat?.label?.split(" ").slice(0, 2).join(" ") ?? "—",
        sub: `Score: ${topThreat?.score?.toFixed(1) ?? "—"}/10 · ${topThreat?.riskLevel ?? "—"} risk`,
        color: "#FF2D55",
        href: "/app/pressure",
        icon: AlertTriangle,
        badge: "THREAT",
      },
      {
        label: "SAFEST OPPORTUNITY",
        value: topStabilizer?.label?.split(" ").slice(0, 2).join(" ") ?? "—",
        sub: `Score: ${topStabilizer?.score?.toFixed(1) ?? "—"}/10 · lowest pressure`,
        color: "#00FF88",
        href: "/app/signal-outlook",
        icon: Shield,
      },
      {
        label: "MOST DANGEROUS ASSET",
        value: riskLevel === "critical" ? "LEVERAGED ETFs" : riskLevel === "elevated" ? "SMALL CAPS" : riskLevel === "moderate" ? "MEMECOINS" : "NONE",
        sub: riskLevel === "critical" ? "Avoid 2x/3x exposure" : riskLevel === "elevated" ? "High beta underperforming" : riskLevel === "moderate" ? "Speculative risk elevated" : "Risk environment benign",
        color: "#FF2D55",
        href: "/app/pressure",
        icon: AlertTriangle,
        badge: "AVOID",
      },
      {
        label: "MOST UNDERVALUED",
        value: riskLevel === "low" ? "SMALL CAPS" : riskLevel === "moderate" ? "VALUE" : "TREASURIES",
        sub: riskLevel === "low" ? "IWM lagging SPX — catch-up trade" : riskLevel === "moderate" ? "Value vs growth spread widening" : "Flight to safety premium",
        color: "#00D4FF",
        href: "/app/signals",
        icon: TrendingUp,
      },
      {
        label: "MOST OVEREXTENDED",
        value: riskLevel === "low" ? "AI SEMIS" : riskLevel === "moderate" ? "MEGA CAP" : "NONE",
        sub: riskLevel === "low" ? "NVDA/AMD stretched vs fundamentals" : riskLevel === "moderate" ? "MAG7 concentration risk" : "No obvious overextension",
        color: "#FF9500",
        href: "/app/signals",
        icon: BarChart2,
      },
      {
        label: "TOP CATALYST TODAY",
        value: topAnalog?.era?.split(" ").slice(0, 2).join(" ") ?? "FED POLICY",
        sub: topAnalog ? `${topAnalog.similarity}% analog match · ${topAnalog.year?.slice(0, 4) ?? ""}` : "Watch FOMC + CPI",
        color: "#C084FC",
        href: "/app/pre-flight",
        icon: Zap,
      },
    ];
  }, [riskLevel, topThreat, topStabilizer, changedDomains, analogs]);

  return (
    <div
      data-regime={regimeAttr}
      style={{ background: "#050608", minHeight: "100vh", position: "relative" }}
      className="ambient-bg"
    >
      {/* Regime ambient overlay */}
      <div className="regime-ambient" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, transition: "background 2s ease" }} />

      {/* ── HEADER BAR ─────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px",
        background: "rgba(5,6,8,0.95)",
        borderBottom: `1px solid ${color}20`,
        backdropFilter: "blur(12px)",
      }}>
        {/* Left: Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}`, animation: "blink-alert 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.2em", color, textTransform: "uppercase", fontWeight: 600 }}>MARKET COMMAND CENTER</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>— {regime.label}</span>
        </div>
        {/* Right: Status + Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isLive ? "#00FF88" : "#FF9500", boxShadow: isLive ? "0 0 8px #00FF88" : "0 0 8px #FF9500" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.12em" }}>{isLive ? "LIVE" : "CACHED"} · {updatedAgo}</span>
          </div>
          <button
            onClick={() => forceRefresh()}
            disabled={isRefreshing || isLoading}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", cursor: "pointer", color: "#4B5563" }}
          >
            <RefreshCw size={10} style={{ animation: isRefreshing ? "fl-spin 1s linear infinite" : "none" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em" }}>REFRESH</span>
          </button>
        </div>
      </div>

      {/* ── SMART DISCOVERY ─────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 2, padding: "14px 20px 0" }}>
        <SmartDiscovery />
      </div>

      {/* ── WHAT DOES THIS MEAN? synthesis panel ─────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 20px 8px" }}>
        <MarketSynthesisPanel context="situation" />
      </div>

      {/* ── CROSS-MARKET REGIME INTELLIGENCE ─────────────────────────────── */}
      {miData && (
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center",
          padding: "10px 20px",
          background: "rgba(0,0,0,0.2)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", flexShrink: 0 }}>CROSS-MARKET</span>
          {/* Stock regime */}
          <RegimePill
            label="EQUITY REGIME"
            value={miData.stockRegime?.regime ?? '—'}
            color="#3B82F6"
            sub={miData.stockRegime?.confidence ? `Confidence: ${miData.stockRegime.confidence}%` : undefined}
            onClick={() => navigate("/app/market-intelligence")}
          />
          {/* Crypto regime */}
          <RegimePill
            label="CRYPTO REGIME"
            value={miData.cryptoRegime?.regime ?? '—'}
            color="#F59E0B"
            sub={miData.cryptoRegime?.confidence ? `Confidence: ${miData.cryptoRegime.confidence}%` : undefined}
            onClick={() => navigate("/app/market-intelligence")}
          />
          {/* Alignment */}
          {miData.alignmentStatus && (
            <RegimePill
              label="ALIGNMENT"
              value={miData.alignmentStatus}
              color={miData.alignmentScore != null && miData.alignmentScore > 65 ? "#10B981" : miData.alignmentScore != null && miData.alignmentScore < 35 ? "#EF4444" : "#6B7280"}
              sub={miData.plainEnglishSummary ? miData.plainEnglishSummary.slice(0, 40) + '...' : undefined}
              onClick={() => navigate("/app/market-intelligence")}
            />
          )}
          {/* Regime change alerts */}
          {miData.regimeChangeAlerts && miData.regimeChangeAlerts.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 10px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "4px",
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#FCA5A5", letterSpacing: "0.12em" }}>⚡ REGIME CHANGE DETECTED</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(252,165,165,0.7)" }}>{miData.regimeChangeAlerts[0].asset}: {miData.regimeChangeAlerts[0].previous} → {miData.regimeChangeAlerts[0].current}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 8 REGIME PILLS ──────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", gap: "8px", flexWrap: "wrap",
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        {regimePills.map(pill => (
          <RegimePill
            key={pill.label}
            label={pill.label}
            value={pill.value}
            color={pill.color}
            sub={pill.sub}
            onClick={() => navigate(pill.href)}
          />
        ))}
      </div>

      {/* ── 9 INTELLIGENCE CARDS ────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "8px",
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        {intelCards.map(card => (
          <IntelCard
            key={card.label}
            label={card.label}
            value={card.value}
            sub={card.sub}
            color={card.color}
            href={card.href}
            icon={card.icon}
            badge={card.badge}
          />
        ))}
      </div>

      {/* ── TODAY'S STORY + QUICK ACTIONS ───────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) min(280px, 100%)",
        gap: "14px", padding: "14px 20px 20px",
      }}>
        {/* Today's Story */}
        <TodaysStoryPanel
          regime={regime}
          domains={domains}
          probability={probability}
          analogs={analogs}
        />

        {/* Quick Actions panel */}
        <div style={{
          background: "rgba(10,13,20,0.95)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "4px", padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "4px" }}>QUICK ACTIONS</span>
          {[
            { label: "Run Pre-Flight Check", icon: Shield, href: "/app/pre-flight", color: "#00D4FF" },
            { label: "Open Decision Engine", icon: Crosshair, href: "/app/decision-engine", color: "#00D4FF" },
            { label: "View Opportunities", icon: Sparkles, href: "/app/opportunities", color: "#00FF88" },
            { label: "Analyze a Symbol", icon: Eye, href: "/app/symbol-intelligence", color: "#C084FC" },
            { label: "Check Portfolio", icon: BarChart2, href: "/app/portfolio", color: "#F7931A" },
            { label: "Market Stress Test", icon: Activity, href: "/app/pressure", color: "#FF9500" },
            { label: "Market Intelligence", icon: BarChart2, href: "/app/market-intelligence", color: "#00D4FF" },
            { label: "Signal Outlook", icon: Eye, href: "/app/signal-outlook", color: "#00FF88" },
          ].map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.href)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "7px 10px", background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${action.color}0A`; (e.currentTarget as HTMLElement).style.borderColor = `${action.color}25`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
              >
                <Icon size={11} color={`${action.color}90`} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", letterSpacing: "0.06em" }}>{action.label}</span>
                <ChevronRight size={9} color="rgba(100,116,139,0.4)" style={{ marginLeft: "auto" }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LOADING OVERLAY ─────────────────────────────────────── */}
      {isLoading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(5,6,8,0.85)", backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <Loader2 size={24} color="#00D4FF" style={{ animation: "fl-spin 1s linear infinite" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(0,212,255,0.6)", letterSpacing: "0.2em" }}>LOADING INTELLIGENCE…</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketCommandCenter() {
  return (
    <PremiumGateFull variant="marketCommandCenter">
      <MarketCommandCenterInner />
    </PremiumGateFull>
  );
}
