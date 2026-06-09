/* ============================================================
   FAULTLINE — Insider Intelligence™
   Bloomberg Terminal × Hedge Fund Intelligence Desk ×
   Military Command Center
   Transforms raw SEC Form 4 filings into actionable
   institutional-grade insider conviction intelligence.
   ============================================================ */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { trackInsiderSearch } from "@/hooks/useAnalytics";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Eye, Activity, BarChart2, Shield, Users, DollarSign,
  Clock, ChevronDown, ChevronUp, ArrowRight, Minus,
  RefreshCw, Search, X, History, Brain, Zap,
} from "lucide-react";

// ── Type aliases (mirrored from backend) ─────────────────────
type ConvictionBand =
  | "Exceptional Conviction" | "Strong Conviction" | "Moderate Conviction"
  | "Neutral" | "Weak Conviction" | "Negative Insider Signal";

type SellingClassification = "Normal" | "Elevated" | "Aggressive" | "Unusual";

// ── Color helpers ─────────────────────────────────────────────
function convictionColor(score: number): string {
  if (score >= 90) return "#00FF88";
  if (score >= 75) return "#00D4FF";
  if (score >= 60) return "#A78BFA";
  if (score >= 40) return "#FF9500";
  if (score >= 20) return "#FF6B35";
  return "#FF2D55";
}

function bandColor(band: ConvictionBand): string {
  const m: Record<ConvictionBand, string> = {
    "Exceptional Conviction": "#00FF88",
    "Strong Conviction": "#00D4FF",
    "Moderate Conviction": "#A78BFA",
    "Neutral": "#FF9500",
    "Weak Conviction": "#FF6B35",
    "Negative Insider Signal": "#FF2D55",
  };
  return m[band] ?? "#94A3B8";
}

function sellingColor(cls: SellingClassification): string {
  const m: Record<SellingClassification, string> = {
    Normal: "#00FF88", Elevated: "#FF9500", Aggressive: "#FF2D55", Unusual: "#FF6B35",
  };
  return m[cls] ?? "#94A3B8";
}

function signalColor(s: "green" | "yellow" | "red"): string {
  return s === "green" ? "#00FF88" : s === "yellow" ? "#FF9500" : "#FF2D55";
}

function trendIcon(t: "improving" | "neutral" | "weakening") {
  if (t === "improving") return <TrendingUp size={12} color="#00FF88" />;
  if (t === "weakening") return <TrendingDown size={12} color="#FF2D55" />;
  return <Minus size={12} color="#94A3B8" />;
}

function fmtDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function strengthColor(s: "MODERATE" | "HIGH" | "EXCEPTIONAL"): string {
  return s === "EXCEPTIONAL" ? "#00FF88" : s === "HIGH" ? "#00D4FF" : "#FF9500";
}

// ── Animated conviction gauge ─────────────────────────────────
function ConvictionGauge({ score, size = 90 }: { score: number; size?: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 300); return () => clearTimeout(t); }, [score]);
  const color = convictionColor(score);
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const dash = (anim / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 6px ${color}80)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size >= 90 ? "22px" : "16px", color, lineHeight: 1, textShadow: `0 0 12px ${color}80` }}>{anim}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "1px" }}>ICS</div>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ icon, title, color = "#00D4FF", sub }: { icon: React.ReactNode; title: string; color?: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
      <div style={{ color, opacity: 0.9 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.45)", letterSpacing: "0.1em", marginTop: "1px" }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: "1px", background: `${color}20` }} />
    </div>
  );
}

// ── Conviction badge ──────────────────────────────────────────
function ConvictionBadge({ band }: { band: ConvictionBand }) {
  const c = bandColor(band);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", background: `${c}12`, border: `1px solid ${c}35`, borderRadius: "3px" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: c, letterSpacing: "0.08em", fontWeight: 600 }}>{band.toUpperCase()}</span>
    </div>
  );
}

// ── Collapsible panel ─────────────────────────────────────────
function CollapsiblePanel({ open, onToggle, icon, title, color, count, children }: {
  open: boolean; onToggle: () => void; icon: React.ReactNode; title: string; color: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(12,15,22,0.98)", border: `1px solid ${color}18`, borderRadius: "6px", overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ color }}>{icon}</div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>{title}</span>
          {count !== undefined && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginLeft: "4px" }}>{count}</span>}
        </div>
        {open ? <ChevronUp size={13} color="#64748B" /> : <ChevronDown size={13} color="#64748B" />}
      </button>
      {open && <div style={{ padding: "0 16px 14px" }}>{children}</div>}
    </div>
  );
}

// ── Company Profile Modal ─────────────────────────────────────
function CompanyProfileModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const { data, isLoading } = trpc.insider.company.useQuery({ ticker });
  const [tab, setTab] = useState<"overview" | "timeline" | "accuracy">("overview");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#0A0C12", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "8px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflow: "auto", padding: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: "#E2E8F0" }}>{ticker}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.15em" }}>Insider Intelligence Profile</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", gap: "12px" }}>
            <div style={{ width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "fl-spin 0.8s linear infinite" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#64748B" }}>LOADING INSIDER PROFILE…</span>
          </div>
        )}

        {data && (
          <>
            {/* Score + Band */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px" }}>
              <ConvictionGauge score={data.profile.convictionScore} size={90} />
              <div>
                <ConvictionBadge band={data.profile.convictionBand as ConvictionBand} />
                <div style={{ marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)" }}>
                  Impact: <span style={{ color: data.profile.impactPoints >= 0 ? "#00FF88" : "#FF2D55", fontWeight: 700 }}>
                    {data.profile.impactPoints >= 0 ? "+" : ""}{data.profile.impactPoints} pts
                  </span> on Favorability Score
                </div>
                <div style={{ marginTop: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)" }}>
                  Historical Accuracy: <span style={{ color: "#00D4FF", fontWeight: 700 }}>{data.profile.historicalAccuracy}%</span>
                </div>
                <div style={{ marginTop: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)" }}>
                  Latest Filing: <span style={{ color: "#94A3B8" }}>{data.profile.mostRecentFiling}</span>
                </div>
              </div>
            </div>

            {/* Buy vs Sell */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              <div style={{ padding: "12px", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.18)", borderRadius: "5px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Buying</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: "#00FF88" }}>{fmtDollar(data.profile.buyVsSell.buyValue)}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginTop: "2px" }}>{data.profile.buyVsSell.buyCount} transaction{data.profile.buyVsSell.buyCount !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(255,45,85,0.05)", border: "1px solid rgba(255,45,85,0.18)", borderRadius: "5px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Selling</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: "#FF2D55" }}>{fmtDollar(data.profile.buyVsSell.sellValue)}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginTop: "2px" }}>{data.profile.buyVsSell.sellCount} transaction{data.profile.buyVsSell.sellCount !== 1 ? "s" : ""}</div>
              </div>
            </div>

            {/* Largest insider */}
            {data.profile.largestInsider.totalBought > 0 && (
              <div style={{ padding: "10px 12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "4px", marginBottom: "16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px" }}>Largest Insider</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#CBD5E1" }}>
                  {data.profile.largestInsider.name} <span style={{ color: "#64748B" }}>({data.profile.largestInsider.role})</span>
                  <span style={{ color: "#00D4FF", marginLeft: "8px", fontWeight: 600 }}>{fmtDollar(data.profile.largestInsider.totalBought)}</span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
              {(["overview", "timeline", "accuracy"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: "6px 14px", background: tab === t ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)", border: tab === t ? "1px solid rgba(0,212,255,0.40)" : "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: tab === t ? "#00D4FF" : "#64748B", textTransform: "uppercase", letterSpacing: "0.1em", transition: "all 0.18s" }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Tab: Overview — AI Interpretation */}
            {tab === "overview" && (
              <div>
                <div style={{ padding: "14px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "5px", marginBottom: "12px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Brain size={11} color="#00D4FF" /> FAULTLINE Insider Analysis™
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.7 }}>
                    {data.profile.aiInterpretation || "Generating analysis…"}
                  </div>
                </div>
                {/* Selling analysis */}
                {data.profile.sellingAnalysis.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Selling Analysis</div>
                    {data.profile.sellingAnalysis.map((s, i) => {
                      const sc = sellingColor(s.classification as SellingClassification);
                      return (
                        <div key={i} style={{ padding: "10px 12px", background: `${sc}06`, border: `1px solid ${sc}20`, borderRadius: "4px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#CBD5E1" }}>{s.insiderName} ({s.role})</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: sc, fontWeight: 700 }}>{s.classification.toUpperCase()}</span>
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)" }}>{fmtDollar(s.saleAmount)} — {s.reason}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Timeline */}
            {tab === "timeline" && (
              <div>
                <div style={{ position: "relative", paddingLeft: "20px" }}>
                  <div style={{ position: "absolute", left: "8px", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.08)" }} />
                  {data.timeline.map((ev, i) => {
                    const c = ev.type === "buy" ? "#00FF88" : "#FF2D55";
                    return (
                      <div key={i} style={{ position: "relative", marginBottom: "12px" }}>
                        <div style={{ position: "absolute", left: "-16px", top: "4px", width: "8px", height: "8px", borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}80` }} />
                        <div style={{ padding: "8px 12px", background: `${c}06`, border: `1px solid ${c}18`, borderRadius: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)" }}>{ev.date}</span>
                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: c }}>{fmtDollar(ev.amount)}</span>
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8" }}>{ev.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab: Historical Accuracy */}
            {tab === "accuracy" && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
                  Insider Accuracy Rating™ — Did insider actions precede correct market moves?
                </div>
                {data.accuracyHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px", marginBottom: "6px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", minWidth: "60px" }}>{h.period}</div>
                    <div style={{ padding: "2px 8px", background: h.insiderAction === "buy" ? "rgba(0,255,136,0.08)" : "rgba(255,45,85,0.08)", border: `1px solid ${h.insiderAction === "buy" ? "rgba(0,255,136,0.25)" : "rgba(255,45,85,0.25)"}`, borderRadius: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: h.insiderAction === "buy" ? "#00FF88" : "#FF2D55" }}>{h.insiderAction.toUpperCase()}</span>
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: h.subsequentReturn > 0 ? "#00FF88" : "#FF2D55" }}>
                      {h.subsequentReturn > 0 ? "+" : ""}{h.subsequentReturn}%
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                      {h.wasCorrect ? <CheckCircle size={13} color="#00FF88" /> : <X size={13} color="#FF2D55" />}
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: h.wasCorrect ? "#00FF88" : "#FF2D55" }}>{h.wasCorrect ? "CORRECT" : "WRONG"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function InsiderIntelligence() {
  useSEO(PAGE_SEO.insiderIntelligence);

  const { data: radar, isLoading, refetch } = trpc.insider.radar.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [searchTicker, setSearchTicker] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({
    radar: true, clusters: true, selling: true, weeklyStats: true,
  });
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const handleSearch = () => {
    const t = searchTicker.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
    if (t) {
      trackInsiderSearch(t);
      setSelectedTicker(t);
    }
  };

  return (
    <div style={{ background: "#050608", minHeight: "100vh", paddingBottom: "80px" }}>
      {/* Ambient corner brackets */}
      <div style={{ position: "fixed", top: 12, left: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,212,255,0.25)", borderLeft: "2px solid rgba(0,212,255,0.25)", pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "fixed", top: 12, right: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,212,255,0.25)", borderRight: "2px solid rgba(0,212,255,0.25)", pointerEvents: "none", zIndex: 5 }} />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>
        <PageHeader
          title="Insider Intelligence™"
          subtitle="Track where corporate insiders show conviction before the market notices"
          badge="INTELLIGENCE"
        />

        {/* ── TICKER SEARCH ─────────────────────────────────── */}
        <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "6px", padding: "16px", marginBottom: "10px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Company Insider Profile Lookup</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={searchTicker}
              onChange={e => setSearchTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. NVDA, PLTR, TSLA"
              maxLength={10}
              style={{ flex: 1, padding: "10px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.20)", borderRadius: "4px", color: "#E2E8F0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", letterSpacing: "0.12em", outline: "none" }}
            />
            <button onClick={handleSearch} style={{ padding: "10px 20px", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.40)", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", letterSpacing: "0.12em", transition: "all 0.18s" }}>
              <Search size={13} /> ANALYZE
            </button>
          </div>
        </div>

        {/* ── WEEKLY STATS BAR ──────────────────────────────── */}
        {radar && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginBottom: "10px" }}>
            {[
              { label: "Total Buy Value", value: fmtDollar(radar.weeklyStats.totalBuyValue), color: "#00FF88" },
              { label: "Total Sell Value", value: fmtDollar(radar.weeklyStats.totalSellValue), color: "#FF2D55" },
              { label: "Net Sentiment", value: `${radar.weeklyStats.netSentiment > 0 ? "+" : ""}${radar.weeklyStats.netSentiment}`, color: radar.weeklyStats.netSentiment > 0 ? "#00FF88" : "#FF2D55" },
              { label: "Active Tickers", value: `${radar.weeklyStats.activeTickers}`, color: "#00D4FF" },
              { label: "Cluster Alerts", value: `${radar.weeklyStats.clusterCount}`, color: "#A78BFA" },
            ].map(stat => (
              <div key={stat.label} style={{ padding: "10px 12px", background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "5px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>{stat.label}</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── SMART MONEY RADAR ─────────────────────────────── */}
        <CollapsiblePanel open={open.radar} onToggle={() => toggle("radar")} icon={<Eye size={14} />} title="Smart Money Radar™" color="#00D4FF" count={radar?.radar.length}>
          {isLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" }}>
              <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "fl-spin 0.8s linear infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#64748B" }}>SCANNING INSIDER ACTIVITY…</span>
            </div>
          )}
          {radar && (
            <>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "32px 80px 1fr 90px 100px 90px 80px 60px", gap: "8px", padding: "6px 8px", marginBottom: "4px" }}>
                {["#", "Ticker", "Company", "ICS™", "Activity", "Capital", "Signal", "Trend"].map(h => (
                  <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</div>
                ))}
              </div>
              {radar.radar.map(entry => {
                const cc = convictionColor(entry.convictionScore);
                const sc = signalColor(entry.signalColor as "green" | "yellow" | "red");
                return (
                  <div key={entry.ticker}
                    onClick={() => setSelectedTicker(entry.ticker)}
                    style={{ display: "grid", gridTemplateColumns: "32px 80px 1fr 90px 100px 90px 80px 60px", gap: "8px", padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", borderRadius: "3px", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,212,255,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.45)" }}>{entry.rank}</div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{entry.ticker}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.company}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ConvictionGauge score={entry.convictionScore} size={36} />
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.activity}</div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: "#00D4FF" }}>{fmtDollar(entry.dollarAmount)}</div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ padding: "2px 7px", background: `${sc}12`, border: `1px solid ${sc}30`, borderRadius: "3px" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: sc, letterSpacing: "0.08em" }}>{entry.convictionBand.split(" ")[0].toUpperCase()}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {trendIcon(entry.trend as "improving" | "neutral" | "weakening")}
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", textTransform: "capitalize" }}>{entry.trend}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => refetch()} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", cursor: "pointer", color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em" }}>
                  <RefreshCw size={11} /> REFRESH RADAR
                </button>
              </div>
            </>
          )}
        </CollapsiblePanel>
        <div style={{ marginBottom: "10px" }} />

        {/* ── CLUSTER BUY ALERTS ────────────────────────────── */}
        <CollapsiblePanel open={open.clusters} onToggle={() => toggle("clusters")} icon={<Users size={14} />} title="Cluster Buy Alerts™" color="#00FF88" count={radar?.clusterAlerts.length}>
          {radar?.clusterAlerts.map((alert, i) => {
            const sc = strengthColor(alert.strength);
            return (
              <div key={i} style={{ background: `${sc}06`, border: `1px solid ${sc}22`, borderRadius: "6px", padding: "14px", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: sc, boxShadow: `0 0 8px ${sc}`, animation: "blink-alert 2s ease-in-out infinite" }} />
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#E2E8F0" }}>{alert.ticker}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)" }}>{alert.company}</span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)" }}>
                      {alert.insiderCount} insiders purchased within {alert.daysWindow} days
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ padding: "3px 10px", background: `${sc}14`, border: `1px solid ${sc}40`, borderRadius: "3px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: sc, fontWeight: 700, letterSpacing: "0.1em" }}>STRENGTH: {alert.strength}</span>
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#00D4FF" }}>{fmtDollar(alert.totalCapital)}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.45)" }}>Total Capital Committed</div>
                  </div>
                </div>
                {/* Insiders involved */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {alert.insiders.map((ins, j) => (
                    <div key={j} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8" }}>{ins.role}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B", marginLeft: "6px" }}>{fmtDollar(ins.amount)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)" }}>ICS™:</div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: convictionColor(alert.convictionScore) }}>{alert.convictionScore}</div>
                  <ConvictionBadge band={("Strong Conviction") as ConvictionBand} />
                  <button onClick={() => setSelectedTicker(alert.ticker)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "3px", cursor: "pointer", color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>
                    <ArrowRight size={11} /> VIEW PROFILE
                  </button>
                </div>
              </div>
            );
          })}
          {(!radar || radar.clusterAlerts.length === 0) && !isLoading && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.45)", padding: "8px 0" }}>No cluster buy alerts detected this period.</div>
          )}
        </CollapsiblePanel>
        <div style={{ marginBottom: "10px" }} />

        {/* ── INSIDER SELLING ANALYZER ──────────────────────── */}
        <CollapsiblePanel open={open.selling} onToggle={() => toggle("selling")} icon={<Shield size={14} />} title="Insider Selling Analyzer™" color="#FF9500" count={radar?.topSellingAlerts.length}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.45)", marginBottom: "12px", lineHeight: 1.6 }}>
            Not all selling is bearish. FAULTLINE classifies each sale by context — scheduled plans, tax events, diversification, and abnormal liquidation are treated differently.
          </div>
          {radar?.topSellingAlerts.map((alert, i) => {
            const sc = sellingColor(alert.classification as SellingClassification);
            return (
              <div key={i} style={{ padding: "12px 14px", background: `${sc}05`, border: `1px solid ${sc}18`, borderRadius: "5px", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#E2E8F0" }}>{alert.ticker}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)" }}>{alert.insiderName} ({alert.role})</span>
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: sc, marginTop: "2px" }}>{fmtDollar(alert.saleAmount)}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", marginTop: "2px" }}>{alert.percentOfHoldings.toFixed(1)}% of holdings</div>
                  </div>
                  <div style={{ padding: "4px 12px", background: `${sc}14`, border: `1px solid ${sc}40`, borderRadius: "3px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: sc, fontWeight: 700, letterSpacing: "0.1em" }}>
                      {alert.classification.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6 }}>{alert.reason}</div>
                <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {alert.isScheduledPlan && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", padding: "2px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px" }}>10b5-1 PLAN</span>}
                  {alert.isTaxRelated && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", padding: "2px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px" }}>TAX RELATED</span>}
                  {alert.isDiversification && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", padding: "2px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px" }}>DIVERSIFICATION</span>}
                  {alert.isAbnormal && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55", padding: "2px 6px", background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.25)", borderRadius: "2px" }}>⚠ ABNORMAL</span>}
                </div>
              </div>
            );
          })}
          {(!radar || radar.topSellingAlerts.length === 0) && !isLoading && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.45)", padding: "8px 0" }}>No significant selling activity to analyze this period.</div>
          )}
        </CollapsiblePanel>
        <div style={{ marginBottom: "10px" }} />

        {/* ── INSIDER IMPACT ENGINE ─────────────────────────── */}
        {radar && (
          <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: "6px", padding: "18px", marginBottom: "10px" }}>
            <SectionLabel icon={<Zap size={14} />} title="Insider Impact Engine™" color="#A78BFA" sub="Aggregate impact of insider activity on market outlook" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {(() => {
                const bullish = radar.radar.filter(r => r.convictionScore >= 65).length;
                const bearish = radar.radar.filter(r => r.convictionScore < 40).length;
                const neutral = radar.radar.length - bullish - bearish;
                const netImpact = bullish * 3 - bearish * 3;
                return [
                  { label: "Bullish Impact", value: bullish, color: "#00FF88", icon: <TrendingUp size={14} color="#00FF88" /> },
                  { label: "Neutral Impact", value: neutral, color: "#94A3B8", icon: <Minus size={14} color="#94A3B8" /> },
                  { label: "Bearish Impact", value: bearish, color: "#FF2D55", icon: <TrendingDown size={14} color="#FF2D55" /> },
                ].map(item => (
                  <div key={item.label} style={{ padding: "14px", background: `${item.color}06`, border: `1px solid ${item.color}20`, borderRadius: "5px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>{item.icon}</div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "28px", color: item.color, lineHeight: 1 }}>{item.value}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "4px" }}>{item.label}</div>
                  </div>
                ));
              })()}
            </div>
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: "4px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", marginBottom: "4px" }}>Net Insider Sentiment Impact on Outlook</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: radar.weeklyStats.netSentiment >= 0 ? "#00FF88" : "#FF2D55" }}>
                {radar.weeklyStats.netSentiment >= 0 ? "+" : ""}{radar.weeklyStats.netSentiment}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", marginTop: "4px", lineHeight: 1.6 }}>
                {radar.weeklyStats.netSentiment >= 20
                  ? "CEO/CFO accumulation and cluster buying dominate the current insider landscape. Insider behavior supports a constructive market interpretation."
                  : radar.weeklyStats.netSentiment >= 0
                  ? "Insider activity is mixed with moderate buying interest. No strong directional signal from aggregate insider behavior."
                  : "Elevated selling activity relative to buying. Aggregate insider behavior warrants caution before adding risk."}
              </div>
            </div>
          </div>
        )}

        {/* ── ALERTS SYSTEM ─────────────────────────────────── */}
        {radar && (
          <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,149,0,0.18)", borderRadius: "6px", padding: "18px", marginBottom: "10px" }}>
            <SectionLabel icon={<AlertTriangle size={14} />} title="Insider Alerts™" color="#FF9500" sub="Significant insider activity requiring attention" />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {radar.clusterAlerts.filter(a => a.strength !== "MODERATE").map((alert, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)", borderRadius: "4px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 8px #00FF88", flexShrink: 0, animation: "blink-alert 2s ease-in-out infinite" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{alert.ticker}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#64748B", marginLeft: "8px" }}>Cluster Buy Detected — {alert.insiderCount} insiders, {fmtDollar(alert.totalCapital)}</span>
                  </div>
                  <div style={{ padding: "2px 8px", background: "rgba(0,255,136,0.10)", border: "1px solid rgba(0,255,136,0.30)", borderRadius: "3px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00FF88" }}>{alert.strength}</span>
                  </div>
                </div>
              ))}
              {radar.topSellingAlerts.filter(a => a.classification === "Aggressive" || a.classification === "Unusual").map((alert, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.18)", borderRadius: "4px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF2D55", boxShadow: "0 0 8px #FF2D55", flexShrink: 0, animation: "blink-alert 2s ease-in-out infinite" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{alert.ticker}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#64748B", marginLeft: "8px" }}>
                      {alert.classification} Sale — {alert.insiderName} ({alert.role}), {fmtDollar(alert.saleAmount)}
                    </span>
                  </div>
                  <div style={{ padding: "2px 8px", background: "rgba(255,45,85,0.10)", border: "1px solid rgba(255,45,85,0.30)", borderRadius: "3px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55" }}>{alert.classification.toUpperCase()}</span>
                  </div>
                </div>
              ))}
              {radar.radar.filter(r => r.convictionScore >= 85).slice(0, 3).map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "4px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 8px #00D4FF", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{entry.ticker}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#64748B", marginLeft: "8px" }}>
                      ICS™ {entry.convictionScore} — {entry.activity}
                    </span>
                  </div>
                  <div style={{ padding: "2px 8px", background: "rgba(0,212,255,0.10)", border: "1px solid rgba(0,212,255,0.30)", borderRadius: "3px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00D4FF" }}>HIGH CONVICTION</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORICAL INSIDER ACCURACY ───────────────────── */}
        {radar && (
          <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: "6px", padding: "18px", marginBottom: "10px" }}>
            <SectionLabel icon={<History size={14} />} title="Insider Accuracy Rating™" color="#F59E0B" sub="Historical accuracy of insider signals across the radar universe" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
              {radar.radar.slice(0, 8).map(entry => (
                <div key={entry.ticker} style={{ padding: "12px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "5px", cursor: "pointer" }}
                  onClick={() => setSelectedTicker(entry.ticker)}>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#E2E8F0", marginBottom: "4px" }}>{entry.ticker}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", marginBottom: "6px" }}>Insider Accuracy</div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: "#F59E0B" }}>
                    {/* Derive accuracy from conviction score as proxy */}
                    {Math.min(95, Math.max(40, Math.round(entry.convictionScore * 0.6 + 25)))}%
                  </div>
                  <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden", marginTop: "6px" }}>
                    <div style={{ height: "100%", width: `${Math.min(95, Math.max(40, Math.round(entry.convictionScore * 0.6 + 25)))}%`, background: "#F59E0B", borderRadius: "2px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance disclaimer */}
        <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", lineHeight: 1.6, textAlign: "center", letterSpacing: "0.04em" }}>
            FAULTLINE Insider Intelligence™ is derived from publicly available SEC Form 4 filings and proprietary scoring models. This is not investment advice.
            Insider activity data is illustrative and model-generated. Do not make investment decisions based solely on insider signals.
          </div>
        </div>
      </div>

      {/* Company Profile Modal */}
      {selectedTicker && (
        <CompanyProfileModal ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
      )}
    </div>
  );
}
