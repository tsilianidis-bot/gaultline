/* ============================================================
// FAULTLINE — Opportunity Discovery Panel™
// Proactive 26-category opportunity feed displayed on the home screen
// before users search. Shows top 4 items per category.
// ============================================================ */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, Zap, Star, Target, Cpu,
  Bitcoin, Globe, BarChart2, Flame, ChevronRight, RefreshCw,
  Clock, AlertTriangle, Shield, Leaf, Heart, CreditCard,
  Building2, ShoppingBag, DollarSign, TrendingUp as SmallCap,
  Link, Package, Activity, Scissors, LineChart, Layers,
  ArrowUpDown, BarChart, Rocket,
} from "lucide-react";
import React from "react";

// Dynamic icon/accent lookup — covers all 26 categories
// Falls back to a sensible default for any unknown category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  top_opportunity_today:      <Star size={13} className="text-yellow-400" />,
  emerging_breakouts:         <Zap size={13} className="text-cyan-400" />,
  high_conviction_setups:     <Target size={13} className="text-emerald-400" />,
  ai_leaders:                 <Cpu size={13} className="text-violet-400" />,
  crypto_leaders:             <Bitcoin size={13} className="text-orange-400" />,
  macro_beneficiaries:        <Globe size={13} className="text-sky-400" />,
  undervalued_opportunities:  <BarChart2 size={13} className="text-lime-400" />,
  high_risk_high_reward:      <Flame size={13} className="text-red-400" />,
  defense_geopolitical:       <Shield size={13} className="text-slate-400" />,
  energy_transition:          <Leaf size={13} className="text-green-400" />,
  biotech_healthcare:         <Heart size={13} className="text-pink-400" />,
  fintech_payments:           <CreditCard size={13} className="text-blue-400" />,
  infrastructure_industrials: <Building2 size={13} className="text-amber-400" />,
  consumer_discretionary:     <ShoppingBag size={13} className="text-rose-400" />,
  dividend_income:            <DollarSign size={13} className="text-emerald-300" />,
  small_cap_growth:           <SmallCap size={13} className="text-teal-400" />,
  defi_web3:                  <Link size={13} className="text-indigo-400" />,
  commodities_real_assets:    <Package size={13} className="text-yellow-600" />,
  volatility_plays:           <Activity size={13} className="text-red-300" />,
  short_squeeze_candidates:   <Scissors size={13} className="text-fuchsia-400" />,
  earnings_momentum:          <LineChart size={13} className="text-cyan-300" />,
  technical_reversals:        <ArrowUpDown size={13} className="text-orange-300" />,
  institutional_accumulation: <Layers size={13} className="text-blue-300" />,
  etf_flows:                  <BarChart size={13} className="text-purple-400" />,
  global_macro:               <Globe size={13} className="text-sky-300" />,
  space_deep_tech:            <Rocket size={13} className="text-violet-300" />,
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

function getCategoryIcon(category: string): React.ReactNode {
  return CATEGORY_ICONS[category] ?? <Star size={13} className="text-gray-400" />;
}
function getCategoryAccent(category: string): string {
  return CATEGORY_ACCENT[category] ?? "#94A3B8";
}

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
}

interface DiscoveryBucket {
  category: string;
  label: string;
  description: string;
  items: DiscoveryItem[];
}

function BucketCard({ bucket, onNavigate }: { bucket: DiscoveryBucket; onNavigate: (ticker: string, type: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const accent = getCategoryAccent(bucket.category);
  const icon = getCategoryIcon(bucket.category);
  const topItem = bucket.items[0];

  return (
    <div
      style={{
        background: "rgba(8,10,14,0.9)",
        border: `1px solid ${accent}18`,
        borderLeft: `2px solid ${accent}50`,
        borderRadius: "4px",
        overflow: "hidden",
        transition: "border-color 0.2s ease",
        cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}35`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${accent}18`)}
      onClick={() => setExpanded(p => !p)}
    >
      {/* Header */}
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: "26px", height: "26px", borderRadius: "3px",
          background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: accent, letterSpacing: "0.1em", marginBottom: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bucket.label.toUpperCase()}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bucket.description}
          </div>
        </div>
        {topItem && <ScoreRing score={topItem.opportunityScore} size={32} />}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)", marginLeft: "2px" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Top item preview (always visible) */}
      {topItem && !expanded && (
        <div
          style={{ padding: "0 12px 10px", display: "flex", alignItems: "center", gap: "8px" }}
          onClick={e => { e.stopPropagation(); onNavigate(topItem.ticker, topItem.assetType); }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#F0F4FF" }}>{topItem.ticker}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100px" }}>{topItem.name}</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topItem.catalyst}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: RISK_COLORS[topItem.riskLevel] ?? "#94A3B8", background: `${RISK_COLORS[topItem.riskLevel] ?? "#94A3B8"}15`, padding: "1px 5px", borderRadius: "2px" }}>
              {topItem.riskLevel.toUpperCase()}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{topItem.expectedTimeHorizon}</span>
          </div>
          <ChevronRight size={12} style={{ color: accent, flexShrink: 0 }} />
        </div>
      )}

      {/* Expanded: all items */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${accent}12` }}>
          {bucket.items.map((item, idx) => (
            <div
              key={item.ticker}
              style={{
                padding: "8px 12px",
                display: "flex", alignItems: "center", gap: "8px",
                borderBottom: idx < bucket.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              onClick={e => { e.stopPropagation(); onNavigate(item.ticker, item.assetType); }}
            >
              <ScoreRing score={item.opportunityScore} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#F0F4FF" }}>{item.ticker}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }}>{item.name}</span>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.55)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.catalyst}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: RISK_COLORS[item.riskLevel] ?? "#94A3B8", background: `${RISK_COLORS[item.riskLevel] ?? "#94A3B8"}15`, padding: "1px 5px", borderRadius: "2px" }}>
                  {item.riskLevel.toUpperCase()}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.45)" }}>{item.expectedTimeHorizon}</span>
              </div>
              <ChevronRight size={11} style={{ color: `${accent}80`, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OpportunityDiscoveryPanel() {
  const [, navigate] = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, refetch } = trpc.outlook.getOpportunityDiscovery.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  function handleNavigate(ticker: string, assetType: string) {
    const type = assetType === "crypto" ? "crypto" : "stock";
    navigate(`/app/signal-outlook?symbol=${ticker}&type=${type}`);
  }

  function handleRefresh() {
    setRefreshKey(k => k + 1);
    refetch();
  }

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.18em", color: "rgba(0,212,255,0.7)", marginBottom: "2px" }}>
            OPPORTUNITY ENGINE™
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>
            {data ? `${data.buckets.length} categories · ${data.regime}` : "Scanning markets…"}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            background: "transparent", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "3px",
            padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
            color: "rgba(0,212,255,0.5)", transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,212,255,0.8)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,212,255,0.5)"; }}
        >
          <RefreshCw size={11} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em" }}>REFRESH</span>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: "64px", background: "rgba(255,255,255,0.02)", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div style={{ padding: "12px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={14} style={{ color: "#FF2D55", flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(255,45,85,0.7)" }}>
            Opportunity engine temporarily unavailable
          </span>
        </div>
      )}

      {/* Buckets grid */}
      {data && !isLoading && (
        <>
          {/* Metadata bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <Clock size={10} style={{ color: "rgba(100,116,139,0.5)", flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>
              {new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <div style={{ width: "1px", height: "12px", background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>
              PRESSURE: <span style={{ color: data.pressureIndex >= 70 ? "#FF2D55" : data.pressureIndex >= 50 ? "#FF9500" : "#00D4FF" }}>{data.pressureIndex.toFixed(0)}</span>
            </span>
            <div style={{ width: "1px", height: "12px", background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>
              {data.buckets.length} CATEGORIES
            </span>
          </div>

          {/* 2-column grid for all buckets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {data.buckets.map((bucket: DiscoveryBucket) => (
              <BucketCard key={bucket.category} bucket={bucket} onNavigate={handleNavigate} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
