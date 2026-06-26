// ============================================================
// FAULTLINE — Opportunity Discovery Engine™ Page
// /app/opportunities
// Full-page proactive opportunity feed with all 8 categories.
// ============================================================
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import NarrativeLoader from "@/components/NarrativeLoader";
import {
  TrendingUp, TrendingDown, Minus, Zap, Star, Target, Cpu,
  Bitcoin, Globe, BarChart2, Flame, ChevronRight, RefreshCw,
  Clock, AlertTriangle, ArrowLeft, Filter,
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
  top_opportunity_today:    <Star size={14} />,
  emerging_breakouts:       <Zap size={14} />,
  high_conviction_setups:   <Target size={14} />,
  ai_leaders:               <Cpu size={14} />,
  crypto_leaders:           <Bitcoin size={14} />,
  macro_beneficiaries:      <Globe size={14} />,
  undervalued_opportunities:<BarChart2 size={14} />,
  high_risk_high_reward:    <Flame size={14} />,
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

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 65 ? "#34D399" : score >= 45 ? "#FACC15" : "#F87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1)" }}
      />
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={10} fontWeight="800"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
      >
        {score}
      </text>
    </svg>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const config = {
    Bullish: { icon: <TrendingUp size={10} />, color: "#34D399", bg: "rgba(52,211,153,0.12)" },
    Bearish: { icon: <TrendingDown size={10} />, color: "#F87171", bg: "rgba(248,113,113,0.12)" },
    Neutral: { icon: <Minus size={10} />, color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
    Avoid:   { icon: <Minus size={10} />, color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  }[direction] ?? { icon: <Minus size={10} />, color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      background: config.bg, color: config.color,
      fontSize: "9px", fontWeight: "700", letterSpacing: "0.06em",
      padding: "2px 6px", borderRadius: "3px",
    }}>
      {config.icon} {direction.toUpperCase()}
    </span>
  );
}

export default function Opportunities() {
  useSEO({
    title: "Opportunity Discovery Engine — FAULTLINE",
    description: "Proactive security-specific opportunities across 8 categories: AI Leaders, Crypto Leaders, Emerging Breakouts, High Conviction Setups, and more.",
  });

  const [, navigate] = useLocation();
  const [assetFilter, setAssetFilter] = useState<"all" | "stock" | "crypto">("all");

  const { data, isLoading, error, refetch, isFetching } = trpc.outlook.getOpportunityDiscovery.useQuery(undefined, {
    staleTime: 8 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleTickerClick = (ticker: string, assetType: "stock" | "crypto") => {
    navigate(`/app/signal-outlook?symbol=${ticker}&type=${assetType}`);
  };

  return (
    <div style={{ background: "#050608", minHeight: "100vh", color: "#fff" }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,6,8,0.95)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/app/dashboard")}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px", cursor: "pointer", color: "rgba(255,255,255,0.5)",
              padding: "6px 10px", display: "flex", alignItems: "center", gap: "6px",
              fontSize: "11px", letterSpacing: "0.06em",
              transition: "all 0.18s",
            }}
          >
            <ArrowLeft size={12} /> BACK
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#FACC15", boxShadow: "0 0 6px #FACC15",
                animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: "13px", fontWeight: "800", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Opportunity Discovery Engine
              </span>
            </div>
            {data && (
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
                PRESSURE INDEX {data.pressureIndex} · {data.regime} · {data.buckets.length} CATEGORIES
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Asset filter */}
          <div style={{ display: "flex", gap: "4px" }}>
            {(["all", "stock", "crypto"] as const).map(f => (
              <button
                key={f}
                onClick={() => setAssetFilter(f)}
                style={{
                  background: assetFilter === f ? "rgba(255,255,255,0.1)" : "none",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "4px", cursor: "pointer",
                  color: assetFilter === f ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: "10px", padding: "4px 10px",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  transition: "all 0.18s",
                }}
              >
                {f === "all" ? "All" : f === "stock" ? "Stocks" : "Crypto"}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px", cursor: "pointer",
              color: "rgba(255,255,255,0.6)", padding: "6px 10px",
              display: "flex", alignItems: "center", gap: "6px",
              fontSize: "11px", letterSpacing: "0.06em",
              transition: "all 0.18s",
            }}
          >
            <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            REFRESH
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        {isLoading && <NarrativeLoader variant="opportunity-discovery" />}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "24px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", color: "#F87171" }}>
            <AlertTriangle size={18} />
            <div>
              <div style={{ fontWeight: "700", marginBottom: "4px" }}>Unable to load opportunities</div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>Market data may be temporarily unavailable. Try refreshing.</div>
            </div>
          </div>
        )}

        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
            {data.buckets.map((bucket, bucketIdx) => {
              const accent = CATEGORY_ACCENT[bucket.category as DiscoveryCategory];
              const filteredItems = assetFilter === "all"
                ? bucket.items
                : bucket.items.filter(i => i.assetType === assetFilter);

              if (filteredItems.length === 0) return null;

              return (
                <div
                  key={bucket.category}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "10px",
                    overflow: "hidden",
                    animation: `cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) ${bucketIdx * 60}ms both`,
                  }}
                >
                  {/* Bucket header */}
                  <div style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: `linear-gradient(90deg, ${accent}12 0%, transparent 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: accent }}>
                        {CATEGORY_ICONS[bucket.category as DiscoveryCategory]}
                      </span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: "800", letterSpacing: "0.06em", color: "#fff" }}>
                          {bucket.label}
                        </div>
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
                          {bucket.description}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: "9px", color: "rgba(255,255,255,0.2)",
                      letterSpacing: "0.06em", whiteSpace: "nowrap",
                    }}>
                      {filteredItems.length} SETUP{filteredItems.length !== 1 ? "S" : ""}
                    </span>
                  </div>

                  {/* Items */}
                  <div style={{ padding: "10px" }}>
                    {filteredItems.map((item, itemIdx) => (
                      <button
                        key={item.ticker}
                        onClick={() => handleTickerClick(item.ticker, item.assetType)}
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: "7px",
                          padding: "10px 12px",
                          cursor: "pointer",
                          textAlign: "left",
                          marginBottom: itemIdx < filteredItems.length - 1 ? "6px" : 0,
                          transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                          display: "block",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}40`;
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                        }}
                      >
                        {/* Row 1: Ticker + Score + Direction */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <ScoreRing score={item.opportunityScore} size={44} />
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                                <span style={{ fontSize: "15px", fontWeight: "900", color: "#fff", letterSpacing: "0.04em" }}>
                                  {item.ticker}
                                </span>
                                <span style={{
                                  fontSize: "9px", color: "rgba(255,255,255,0.35)",
                                  background: "rgba(255,255,255,0.05)",
                                  padding: "1px 5px", borderRadius: "3px",
                                  letterSpacing: "0.04em",
                                }}>
                                  {item.assetType.toUpperCase()}
                                </span>
                              </div>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                                {item.name}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                            <DirectionBadge direction={item.direction} />
                            <span style={{
                              fontSize: "9px", fontWeight: "700",
                              color: RISK_COLORS[item.riskLevel] ?? "#FACC15",
                              letterSpacing: "0.06em",
                            }}>
                              {item.riskLevel.toUpperCase()} RISK
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Time horizon */}
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                          <Clock size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>
                            Expected horizon: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{item.expectedTimeHorizon}</strong>
                          </span>
                        </div>

                        {/* Row 3: Catalyst */}
                        <div style={{
                          fontSize: "10px", color: "rgba(255,255,255,0.4)",
                          lineHeight: "1.5", letterSpacing: "0.02em",
                          borderLeft: `2px solid ${accent}60`,
                          paddingLeft: "8px",
                        }}>
                          {item.catalyst}
                        </div>

                        {/* Row 4: CTA */}
                        <div style={{
                          marginTop: "8px", display: "flex", alignItems: "center", gap: "4px",
                          color: accent, fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em",
                        }}>
                          ANALYZE {item.ticker} <ChevronRight size={10} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Generated timestamp */}
        {data && (
          <div style={{ textAlign: "center", marginTop: "24px", paddingBottom: "24px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
              GENERATED {new Date(data.generatedAt).toLocaleString()} · REFRESHES EVERY 10 MINUTES
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
