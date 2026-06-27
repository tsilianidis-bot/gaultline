/* ============================================================
   FAULTLINE — Opportunity Radar™
   /app/opportunities
   Flagship feature: score securities MOST LIKELY to move NEXT
   using 14+ proprietary signals. Full card data. One-click
   Analyze / Watchlist / Situation Room.
   All 26 categories. Ranked by opportunity score.
   ============================================================ */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import NarrativeLoader from "@/components/NarrativeLoader";
import {
  TrendingUp, TrendingDown, Minus, Zap, Star, Target, Cpu,
  Bitcoin, Globe, BarChart2, Flame, ChevronRight, RefreshCw,
  Clock, AlertTriangle, Shield, Leaf, Heart, CreditCard,
  Building2, ShoppingBag, DollarSign,
  Link, Package, Activity, Scissors, LineChart, Layers,
  ArrowUpDown, BarChart, Rocket, Filter, Eye, Bookmark,
  ArrowLeft, TrendingUp as SmallCap,
} from "lucide-react";
import React from "react";

// ── Types ─────────────────────────────────────────────────────
interface DiscoveryItem {
  ticker: string;
  name: string;
  opportunityScore: number;
  expectedTimeHorizon: string;
  catalyst: string;
  riskLevel: string;
  assetType: string;
  direction: string;
  rationale: string;
  bullCase?: string;
  bearCase?: string;
  invalidationLevel?: string;
  whyFaultlineLikesIt?: string;
  institutionalConviction?: string;
  macroAlignment?: number;
  riskRewardRatio?: string;
  confidenceLevel?: number;
  topCatalyst?: string;
  actionBias?: string;
}

interface DiscoveryBucket {
  category: string;
  label: string;
  description: string;
  items: DiscoveryItem[];
}

// ── Category metadata ─────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  top_opportunity_today:      <Star size={13} />,
  emerging_breakouts:         <Zap size={13} />,
  high_conviction_setups:     <Target size={13} />,
  ai_leaders:                 <Cpu size={13} />,
  crypto_leaders:             <Bitcoin size={13} />,
  macro_beneficiaries:        <Globe size={13} />,
  undervalued_opportunities:  <BarChart2 size={13} />,
  high_risk_high_reward:      <Flame size={13} />,
  defense_geopolitical:       <Shield size={13} />,
  energy_transition:          <Leaf size={13} />,
  biotech_healthcare:         <Heart size={13} />,
  fintech_payments:           <CreditCard size={13} />,
  infrastructure_industrials: <Building2 size={13} />,
  consumer_discretionary:     <ShoppingBag size={13} />,
  dividend_income:            <DollarSign size={13} />,
  small_cap_growth:           <SmallCap size={13} />,
  defi_web3:                  <Link size={13} />,
  commodities_real_assets:    <Package size={13} />,
  volatility_plays:           <Activity size={13} />,
  short_squeeze_candidates:   <Scissors size={13} />,
  earnings_momentum:          <LineChart size={13} />,
  technical_reversals:        <ArrowUpDown size={13} />,
  institutional_accumulation: <Layers size={13} />,
  etf_flows:                  <BarChart size={13} />,
  global_macro:               <Globe size={13} />,
  space_deep_tech:            <Rocket size={13} />,
};

const CATEGORY_ACCENT: Record<string, string> = {
  top_opportunity_today:      "#FACC15",
  emerging_breakouts:         "#22D3EE",
  high_conviction_setups:     "#34D399",
  ai_leaders:                 "#A78BFA",
  crypto_leaders:             "#FB923C",
  macro_beneficiaries:        "#38BDF8",
  undervalued_opportunities:  "#A3E635",
  high_risk_high_reward:      "#F87171",
  defense_geopolitical:       "#94A3B8",
  energy_transition:          "#4ADE80",
  biotech_healthcare:         "#F472B6",
  fintech_payments:           "#60A5FA",
  infrastructure_industrials: "#FBBF24",
  consumer_discretionary:     "#FB7185",
  dividend_income:            "#6EE7B7",
  small_cap_growth:           "#2DD4BF",
  defi_web3:                  "#818CF8",
  commodities_real_assets:    "#D97706",
  volatility_plays:           "#FCA5A5",
  short_squeeze_candidates:   "#E879F9",
  earnings_momentum:          "#67E8F9",
  technical_reversals:        "#FDBA74",
  institutional_accumulation: "#93C5FD",
  etf_flows:                  "#C084FC",
  global_macro:               "#7DD3FC",
  space_deep_tech:            "#A5B4FC",
};

const RISK_COLORS: Record<string, string> = {
  Low:     "#34D399",
  Medium:  "#FACC15",
  High:    "#FB923C",
  Extreme: "#F87171",
};

const ACTION_BIAS_COLORS: Record<string, { color: string; bg: string }> = {
  BUY:   { color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  WATCH: { color: "#FFD700", bg: "rgba(255,215,0,0.12)" },
  AVOID: { color: "#FF2D55", bg: "rgba(255,45,85,0.12)" },
  HOLD:  { color: "#00D4FF", bg: "rgba(0,212,255,0.12)" },
};

// ── Sub-components ────────────────────────────────────────────
function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 65 ? "#34D399" : score >= 45 ? "#FACC15" : "#F87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1)" }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={10} fontWeight="800"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}>
        {score}
      </text>
    </svg>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const cfg = {
    Bullish: { icon: <TrendingUp size={9} />, color: "#34D399", bg: "rgba(52,211,153,0.12)" },
    Bearish: { icon: <TrendingDown size={9} />, color: "#F87171", bg: "rgba(248,113,113,0.12)" },
    Neutral: { icon: <Minus size={9} />, color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
    Avoid:   { icon: <Minus size={9} />, color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  }[direction] ?? { icon: <Minus size={9} />, color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: cfg.bg, color: cfg.color, fontSize: "9px", fontWeight: "700", letterSpacing: "0.06em", padding: "2px 5px", borderRadius: "3px" }}>
      {cfg.icon} {direction.toUpperCase()}
    </span>
  );
}

// ── Full Radar Card ───────────────────────────────────────────
function RadarCard({
  item, accent, onAnalyze, onWatchlist, onSituationRoom,
}: {
  item: DiscoveryItem;
  accent: string;
  onAnalyze: () => void;
  onWatchlist: () => void;
  onSituationRoom: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionBias = item.actionBias ?? "WATCH";
  const biasColors = ACTION_BIAS_COLORS[actionBias] ?? ACTION_BIAS_COLORS.WATCH;

  return (
    <div style={{
      background: "rgba(8,10,14,0.95)",
      border: `1px solid ${accent}18`,
      borderLeft: `3px solid ${accent}60`,
      borderRadius: "6px",
      overflow: "hidden",
      transition: "border-color 0.2s ease",
      marginBottom: "8px",
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}35`)}
    onMouseLeave={e => (e.currentTarget.style.borderColor = `${accent}18`)}
    >
      {/* Main row — always visible */}
      <div
        style={{ padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "10px" }}
        onClick={() => setExpanded(v => !v)}
      >
        <ScoreRing score={item.opportunityScore} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: ticker + badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "3px" }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "15px", color: "#F0F4FF", letterSpacing: "0.04em" }}>{item.ticker}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: "2px" }}>{item.assetType.toUpperCase()}</span>
            <DirectionBadge direction={item.direction} />
            {item.actionBias && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", color: biasColors.color, background: biasColors.bg, padding: "1px 5px", borderRadius: "2px" }}>{actionBias}</span>
            )}
          </div>
          {/* Row 2: name + time horizon */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", flexShrink: 0 }}>·</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", flexShrink: 0, display: "flex", alignItems: "center", gap: "3px" }}>
              <Clock size={8} />{item.expectedTimeHorizon}
            </span>
          </div>
          {/* Row 3: catalyst */}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)", lineHeight: 1.4, borderLeft: `2px solid ${accent}40`, paddingLeft: "6px" }}>
            {item.catalyst}
          </div>
        </div>
        {/* Right: risk + expand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: RISK_COLORS[item.riskLevel] ?? "#94A3B8", background: `${RISK_COLORS[item.riskLevel] ?? "#94A3B8"}15`, padding: "1px 5px", borderRadius: "2px" }}>{item.riskLevel.toUpperCase()}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${accent}12`, padding: "10px 12px" }}>
          {/* Key metrics bar */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}>
            {item.riskRewardRatio && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>R:R RATIO</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#22C55E" }}>{item.riskRewardRatio}</span>
              </div>
            )}
            {item.macroAlignment != null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>MACRO ALIGN</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: item.macroAlignment >= 65 ? "#22C55E" : item.macroAlignment >= 45 ? "#FFD700" : "#FF9500" }}>{item.macroAlignment}/100</span>
              </div>
            )}
            {item.institutionalConviction && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>INST. CONVICTION</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: item.institutionalConviction === "Very High" || item.institutionalConviction === "High" ? "#22C55E" : item.institutionalConviction === "Moderate" ? "#FFD700" : "#94A3B8" }}>{item.institutionalConviction}</span>
              </div>
            )}
            {item.confidenceLevel != null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>CONFIDENCE</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#B0C4D8" }}>{item.confidenceLevel}%</span>
              </div>
            )}
          </div>

          {/* Bull / Bear cases */}
          {(item.bullCase || item.bearCase) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
              {item.bullCase && (
                <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: "3px", padding: "7px 9px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(34,197,94,0.6)", letterSpacing: "0.12em", marginBottom: "4px" }}>BULL CASE</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5 }}>{item.bullCase}</div>
                </div>
              )}
              {item.bearCase && (
                <div style={{ background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.12)", borderRadius: "3px", padding: "7px 9px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,45,85,0.6)", letterSpacing: "0.12em", marginBottom: "4px" }}>BEAR CASE</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5 }}>{item.bearCase}</div>
                </div>
              )}
            </div>
          )}

          {/* Invalidation */}
          {item.invalidationLevel && (
            <div style={{ background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.15)", borderRadius: "3px", padding: "6px 9px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,149,0,0.7)", letterSpacing: "0.12em" }}>INVALIDATION: </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)" }}>{item.invalidationLevel}</span>
            </div>
          )}

          {/* Why FAULTLINE Likes It */}
          {item.whyFaultlineLikesIt && (
            <div style={{ background: `${accent}06`, border: `1px solid ${accent}20`, borderRadius: "3px", padding: "6px 9px", marginBottom: "10px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: `${accent}80`, letterSpacing: "0.12em" }}>WHY FAULTLINE LIKES IT: </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)" }}>{item.whyFaultlineLikesIt}</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={e => { e.stopPropagation(); onAnalyze(); }}
              style={{
                flex: 1, padding: "7px 10px", borderRadius: "3px", cursor: "pointer",
                background: `${accent}18`, border: `1px solid ${accent}35`,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700,
                color: accent, letterSpacing: "0.1em", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}28`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}18`; }}
            >
              <Eye size={10} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
              ANALYZE
            </button>
            <button
              onClick={e => { e.stopPropagation(); onSituationRoom(); }}
              style={{
                flex: 1, padding: "7px 10px", borderRadius: "3px", cursor: "pointer",
                background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.2)",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700,
                color: "#FFAA00", letterSpacing: "0.1em", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,170,0,0.15)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,170,0,0.08)"; }}
            >
              SITUATION ROOM
            </button>
            <button
              onClick={e => { e.stopPropagation(); onWatchlist(); }}
              style={{
                padding: "7px 10px", borderRadius: "3px", cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                color: "rgba(148,163,184,0.6)", letterSpacing: "0.08em", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.9)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)"; }}
            >
              <Bookmark size={10} style={{ display: "inline", marginRight: "3px", verticalAlign: "middle" }} />
              SAVE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bucket column ─────────────────────────────────────────────
function BucketColumn({ bucket, onAnalyze, onWatchlist, onSituationRoom }: {
  bucket: DiscoveryBucket;
  onAnalyze: (ticker: string, type: string) => void;
  onWatchlist: (ticker: string, name: string) => void;
  onSituationRoom: (ticker: string, type: string) => void;
}) {
  const accent = CATEGORY_ACCENT[bucket.category] ?? "#94A3B8";
  const icon = CATEGORY_ICONS[bucket.category] ?? <Star size={13} />;
  const topScore = bucket.items[0]?.opportunityScore ?? 0;

  return (
    <div style={{ background: "rgba(6,8,12,0.95)", border: `1px solid ${accent}15`, borderRadius: "6px", overflow: "hidden" }}>
      {/* Bucket header */}
      <div style={{
        padding: "10px 12px",
        background: `linear-gradient(90deg, ${accent}10 0%, transparent 100%)`,
        borderBottom: `1px solid ${accent}12`,
        display: "flex", alignItems: "center", gap: "8px",
      }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "3px", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: accent, letterSpacing: "0.1em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bucket.label.toUpperCase()}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bucket.description}
          </div>
        </div>
        {/* Top score badge */}
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: topScore >= 65 ? "#34D399" : topScore >= 45 ? "#FACC15" : "#F87171", flexShrink: 0, textShadow: `0 0 10px ${topScore >= 65 ? "#34D399" : topScore >= 45 ? "#FACC15" : "#F87171"}60` }}>
          {topScore}
        </div>
      </div>
      {/* Items */}
      <div style={{ padding: "8px" }}>
        {bucket.items.map(item => (
          <RadarCard
            key={item.ticker}
            item={item}
            accent={accent}
            onAnalyze={() => onAnalyze(item.ticker, item.assetType)}
            onWatchlist={() => onWatchlist(item.ticker, item.name)}
            onSituationRoom={() => onSituationRoom(item.ticker, item.assetType)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Opportunities() {
  useSEO({
    title: "Opportunity Radar — FAULTLINE",
    description: "Score securities most likely to move next using 14+ proprietary signals. All 26 categories ranked by opportunity score.",
  });

  const [, navigate] = useLocation();
  const [assetFilter, setAssetFilter] = useState<"all" | "stock" | "crypto">("all");
  const [sortBy, setSortBy] = useState<"score" | "risk" | "horizon">("score");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data, isLoading, error, refetch, isFetching } = trpc.outlook.getOpportunityDiscovery.useQuery(undefined, {
    staleTime: 8 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleAnalyze = (ticker: string, assetType: string) => {
    navigate(`/app/signal-outlook?symbol=${ticker}&type=${assetType}`);
  };
  const handleWatchlist = (_ticker: string, _name: string) => {
    // Watchlist integration — navigate to watchlist with pre-filled ticker
    navigate(`/app/watchlist`);
  };
  const handleSituationRoom = (ticker: string, assetType: string) => {
    navigate(`/app/situation-room?symbol=${ticker}&type=${assetType}`);
  };

  // Flatten all items for list view + sort
  const allItems = useMemo(() => {
    if (!data) return [];
    const items: Array<DiscoveryItem & { category: string; categoryLabel: string }> = [];
    data.buckets.forEach(b => {
      b.items.forEach(item => {
        if (assetFilter === "all" || item.assetType === assetFilter) {
          items.push({ ...item, category: b.category, categoryLabel: b.label });
        }
      });
    });
    if (sortBy === "score") return items.sort((a, b) => b.opportunityScore - a.opportunityScore);
    if (sortBy === "risk") {
      const riskOrder = { Low: 0, Medium: 1, High: 2, Extreme: 3 };
      return items.sort((a, b) => (riskOrder[a.riskLevel as keyof typeof riskOrder] ?? 1) - (riskOrder[b.riskLevel as keyof typeof riskOrder] ?? 1));
    }
    return items;
  }, [data, assetFilter, sortBy]);

  // Filtered buckets for grid view
  const filteredBuckets = useMemo(() => {
    if (!data) return [];
    return data.buckets
      .map(b => ({
        ...b,
        items: assetFilter === "all" ? b.items : b.items.filter(i => i.assetType === assetFilter),
      }))
      .filter(b => b.items.length > 0)
      .sort((a, b) => (b.items[0]?.opportunityScore ?? 0) - (a.items[0]?.opportunityScore ?? 0));
  }, [data, assetFilter]);

  // Top 3 highest-scoring items for the radar header
  const topItems = useMemo(() => allItems.slice(0, 3), [allItems]);

  return (
    <div style={{ background: "#050608", minHeight: "100vh", color: "#fff" }}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,6,8,0.97)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/app")}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "5px 9px", display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", letterSpacing: "0.08em", transition: "all 0.15s" }}
          >
            <ArrowLeft size={11} /> BACK
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FACC15", boxShadow: "0 0 8px #FACC15", animation: "blink-alert 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FACC15" }}>
                OPPORTUNITY RADAR
              </span>
            </div>
            {data && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>
                PRESSURE {data.pressureIndex} · {data.regime} · {data.buckets.length} CATEGORIES · {allItems.length} SETUPS
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Asset filter */}
          <div style={{ display: "flex", gap: "3px" }}>
            {(["all", "stock", "crypto"] as const).map(f => (
              <button key={f} onClick={() => setAssetFilter(f)} style={{ background: assetFilter === f ? "rgba(250,204,21,0.12)" : "none", border: `1px solid ${assetFilter === f ? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: "3px", cursor: "pointer", color: assetFilter === f ? "#FACC15" : "rgba(255,255,255,0.35)", fontSize: "9px", padding: "4px 9px", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.15s", fontFamily: "'IBM Plex Mono', monospace" }}>
                {f === "all" ? "ALL" : f === "stock" ? "STOCKS" : "CRYPTO"}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div style={{ display: "flex", gap: "3px" }}>
            {(["score", "risk"] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{ background: sortBy === s ? "rgba(255,255,255,0.08)" : "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", cursor: "pointer", color: sortBy === s ? "#fff" : "rgba(255,255,255,0.3)", fontSize: "9px", padding: "4px 9px", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.15s", fontFamily: "'IBM Plex Mono', monospace" }}>
                {s === "score" ? "BY SCORE" : "BY RISK"}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", gap: "3px" }}>
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ background: viewMode === v ? "rgba(255,255,255,0.08)" : "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", cursor: "pointer", color: viewMode === v ? "#fff" : "rgba(255,255,255,0.3)", fontSize: "9px", padding: "4px 9px", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.15s", fontFamily: "'IBM Plex Mono', monospace" }}>
                {v === "grid" ? "GRID" : "LIST"}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isFetching} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: "5px 9px", display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", letterSpacing: "0.08em", transition: "all 0.15s", fontFamily: "'IBM Plex Mono', monospace" }}>
            <RefreshCw size={10} style={{ animation: isFetching ? "fl-spin 1s linear infinite" : "none" }} />
            REFRESH
          </button>
        </div>
      </div>

      {/* ── TOP 3 RADAR STRIP ───────────────────────────────────── */}
      {data && topItems.length > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: "10px" }}>
          {topItems.map((item, i) => {
            const accent = CATEGORY_ACCENT[item.category] ?? "#94A3B8";
            const biasColors = ACTION_BIAS_COLORS[item.actionBias ?? "WATCH"] ?? ACTION_BIAS_COLORS.WATCH;
            return (
              <button
                key={item.ticker}
                onClick={() => handleAnalyze(item.ticker, item.assetType)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px", background: `${accent}08`,
                  border: `1px solid ${accent}25`, borderRadius: "5px",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}14`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accent}08`; }}
              >
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em", flexShrink: 0 }}>#{i + 1}</div>
                <ScoreRing score={item.opportunityScore} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "16px", color: accent, letterSpacing: "0.04em", textShadow: `0 0 12px ${accent}60` }}>{item.ticker}</span>
                    {item.actionBias && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", fontWeight: 700, color: biasColors.color, background: biasColors.bg, padding: "1px 5px", borderRadius: "2px" }}>{item.actionBias}</span>}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.catalyst}</div>
                </div>
                <ChevronRight size={12} color={`${accent}60`} />
              </button>
            );
          })}
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 20px 32px", maxWidth: "1400px", margin: "0 auto" }}>
        {isLoading && <NarrativeLoader variant="opportunity-discovery" />}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "20px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "6px", color: "#F87171" }}>
            <AlertTriangle size={16} />
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: "11px", marginBottom: "3px", letterSpacing: "0.1em" }}>UNABLE TO LOAD OPPORTUNITIES</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", opacity: 0.6 }}>Market data may be temporarily unavailable. Try refreshing.</div>
            </div>
          </div>
        )}

        {data && viewMode === "grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "14px" }}>
            {filteredBuckets.map((bucket, i) => (
              <div key={bucket.category} style={{ animation: `cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) ${i * 40}ms both` }}>
                <BucketColumn
                  bucket={bucket}
                  onAnalyze={handleAnalyze}
                  onWatchlist={handleWatchlist}
                  onSituationRoom={handleSituationRoom}
                />
              </div>
            ))}
          </div>
        )}

        {data && viewMode === "list" && (
          <div>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 80px 1fr 80px 80px 80px 80px 120px", gap: "8px", padding: "6px 12px", marginBottom: "4px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["RANK", "SCORE", "SECURITY", "DIRECTION", "RISK", "R:R", "CONFIDENCE", "ACTION"].map(h => (
                <span key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.14em" }}>{h}</span>
              ))}
            </div>
            {allItems.map((item, i) => {
              const accent = CATEGORY_ACCENT[item.category] ?? "#94A3B8";
              const biasColors = ACTION_BIAS_COLORS[item.actionBias ?? "WATCH"] ?? ACTION_BIAS_COLORS.WATCH;
              return (
                <div
                  key={`${item.ticker}-${i}`}
                  style={{
                    display: "grid", gridTemplateColumns: "40px 80px 1fr 80px 80px 80px 80px 120px",
                    gap: "8px", padding: "8px 12px", alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "background 0.12s ease",
                    animation: `cinematic-reveal 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 20}ms both`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}06`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  onClick={() => handleAnalyze(item.ticker, item.assetType)}
                >
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)" }}>#{i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <ScoreRing score={item.opportunityScore} size={28} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "14px", color: accent }}>{item.ticker}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.catalyst}</div>
                  </div>
                  <DirectionBadge direction={item.direction} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: RISK_COLORS[item.riskLevel] ?? "#94A3B8" }}>{item.riskLevel.toUpperCase()}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#22C55E" }}>{item.riskRewardRatio ?? "—"}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#B0C4D8" }}>{item.confidenceLevel != null ? `${item.confidenceLevel}%` : "—"}</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {item.actionBias && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", fontWeight: 700, color: biasColors.color, background: biasColors.bg, padding: "2px 6px", borderRadius: "2px" }}>{item.actionBias}</span>}
                    <ChevronRight size={10} color={`${accent}60`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {data && (
          <div style={{ textAlign: "center", marginTop: "24px", paddingBottom: "8px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
              GENERATED {new Date(data.generatedAt).toLocaleString()} · REFRESHES EVERY 10 MINUTES
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
