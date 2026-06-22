// ============================================================
// FAULTLINE — Opportunity Discovery Panel™
// Proactive 8-category opportunity feed displayed on the home screen
// before users search. Shows top 4 items per category.
// ============================================================
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, Zap, Star, Target, Cpu,
  Bitcoin, Globe, BarChart2, Flame, ChevronRight, RefreshCw,
  Clock, AlertTriangle,
} from "lucide-react";

type DiscoveryCategory =
  | "top_opportunity_today"
  | "emerging_breakouts"
  | "high_conviction_setups"
  | "ai_leaders"
  | "crypto_leaders"
  | "macro_beneficiaries"
  | "undervalued_opportunities"
  | "high_risk_high_reward";

const CATEGORY_ICONS: Record<DiscoveryCategory, React.ReactNode> = {
  top_opportunity_today:    <Star size={13} className="text-yellow-400" />,
  emerging_breakouts:       <Zap size={13} className="text-cyan-400" />,
  high_conviction_setups:   <Target size={13} className="text-emerald-400" />,
  ai_leaders:               <Cpu size={13} className="text-violet-400" />,
  crypto_leaders:           <Bitcoin size={13} className="text-orange-400" />,
  macro_beneficiaries:      <Globe size={13} className="text-sky-400" />,
  undervalued_opportunities:<BarChart2 size={13} className="text-lime-400" />,
  high_risk_high_reward:    <Flame size={13} className="text-red-400" />,
};

const CATEGORY_ACCENT: Record<DiscoveryCategory, string> = {
  top_opportunity_today:    "#FACC15",
  emerging_breakouts:       "#22D3EE",
  high_conviction_setups:   "#34D399",
  ai_leaders:               "#A78BFA",
  crypto_leaders:           "#FB923C",
  macro_beneficiaries:      "#38BDF8",
  undervalued_opportunities:"#A3E635",
  high_risk_high_reward:    "#F87171",
};

const RISK_COLORS: Record<string, string> = {
  Low:     "#34D399",
  Medium:  "#FACC15",
  High:    "#FB923C",
  Extreme: "#F87171",
};

function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 65 ? "#34D399" : score >= 45 ? "#FACC15" : "#F87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1)" }}
      />
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size >= 36 ? 9 : 8} fontWeight="700"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
      >
        {score}
      </text>
    </svg>
  );
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "Bullish") return <TrendingUp size={11} className="text-emerald-400" />;
  if (direction === "Bearish") return <TrendingDown size={11} className="text-red-400" />;
  return <Minus size={11} className="text-zinc-400" />;
}

export default function OpportunityDiscoveryPanel() {
  const [activeCategory, setActiveCategory] = useState<DiscoveryCategory>("top_opportunity_today");
  const [, navigate] = useLocation();

  const { data, isLoading, error, refetch, isFetching } = trpc.outlook.getOpportunityDiscovery.useQuery(undefined, {
    staleTime: 8 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activeBucket = data?.buckets.find(b => b.category === activeCategory);
  const accent = CATEGORY_ACCENT[activeCategory];

  const handleTickerClick = (ticker: string, assetType: "stock" | "crypto") => {
    navigate(`/app/signals/outlook?symbol=${ticker}&assetType=${assetType}`);
  };

  return (
    <div
      className="intel-module"
      style={{
        padding: "16px",
        marginBottom: "10px",
        animation: "cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 490ms both",
        border: `1px solid rgba(255,255,255,0.06)`,
        borderRadius: "8px",
        background: "rgba(5,6,8,0.7)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: accent, boxShadow: `0 0 6px ${accent}`,
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.12em", color: "#fff", textTransform: "uppercase" }}>
            Opportunity Discovery
          </span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
            {data ? `P-INDEX ${data.pressureIndex} · ${data.regime}` : "LOADING"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.3)", padding: "2px",
              transition: "color 0.2s",
            }}
            title="Refresh opportunities"
          >
            <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button
            onClick={() => navigate("/app/opportunities")}
            style={{
              background: "none", border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: "4px", cursor: "pointer",
              color: "rgba(255,255,255,0.5)", fontSize: "10px",
              padding: "2px 8px", letterSpacing: "0.06em",
              display: "flex", alignItems: "center", gap: "4px",
              transition: "all 0.2s",
            }}
          >
            VIEW ALL <ChevronRight size={10} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        display: "flex", gap: "4px", flexWrap: "wrap",
        marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "10px",
      }}>
        {data?.buckets.map(bucket => (
          <button
            key={bucket.category}
            onClick={() => setActiveCategory(bucket.category as DiscoveryCategory)}
            style={{
              background: activeCategory === bucket.category
                ? `rgba(${hexToRgb(CATEGORY_ACCENT[bucket.category as DiscoveryCategory])}, 0.15)`
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeCategory === bucket.category ? CATEGORY_ACCENT[bucket.category as DiscoveryCategory] + "60" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "4px",
              cursor: "pointer",
              color: activeCategory === bucket.category ? "#fff" : "rgba(255,255,255,0.45)",
              fontSize: "10px",
              padding: "3px 8px",
              display: "flex", alignItems: "center", gap: "4px",
              transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            {CATEGORY_ICONS[bucket.category as DiscoveryCategory]}
            {bucket.label}
          </button>
        ))}
      </div>

      {/* Active bucket content */}
      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "16px 0", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
          <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
          Scanning market opportunities…
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 0", color: "#F87171", fontSize: "11px" }}>
          <AlertTriangle size={13} />
          Unable to load opportunities. Market data may be unavailable.
        </div>
      )}

      {activeBucket && (
        <div>
          {/* Bucket description */}
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "10px", letterSpacing: "0.04em" }}>
            {activeBucket.description}
          </p>

          {/* Items grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {activeBucket.items.map((item, idx) => (
              <button
                key={item.ticker}
                onClick={() => handleTickerClick(item.ticker, item.assetType)}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "6px",
                  padding: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                  animation: `cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) ${idx * 60}ms both`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}40`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                {/* Row 1: Ticker + Score Ring */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "800", color: "#fff", letterSpacing: "0.04em" }}>
                        {item.ticker}
                      </span>
                      <DirectionIcon direction={item.direction} />
                    </div>
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
                      {item.name.length > 18 ? item.name.slice(0, 18) + "…" : item.name}
                    </span>
                  </div>
                  <ScoreRing score={item.opportunityScore} size={34} />
                </div>

                {/* Row 2: Time horizon + Risk */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    <Clock size={9} style={{ color: "rgba(255,255,255,0.3)" }} />
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
                      {item.expectedTimeHorizon}
                    </span>
                  </div>
                  <span style={{
                    fontSize: "9px", fontWeight: "600",
                    color: RISK_COLORS[item.riskLevel] ?? "#FACC15",
                    letterSpacing: "0.06em",
                  }}>
                    {item.riskLevel.toUpperCase()} RISK
                  </span>
                </div>

                {/* Row 3: Catalyst */}
                <p style={{
                  fontSize: "9px", color: "rgba(255,255,255,0.35)",
                  lineHeight: "1.4", margin: 0,
                  letterSpacing: "0.02em",
                }}>
                  {item.catalyst}
                </p>
              </button>
            ))}
          </div>

          {/* Footer: generated time */}
          <div style={{ marginTop: "8px", textAlign: "right" }}>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
              GENERATED {new Date(activeBucket.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility: hex to "r,g,b" for rgba()
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
