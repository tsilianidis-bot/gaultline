/**
 * ToolsHome — Tools & Features Hub
 *
 * The canonical landing page for the Tools & Features experience.
 * Provides:
 *  - Search across all tools
 *  - 12-category navigation grid
 *  - Recently used tools (localStorage)
 *  - ASHA-recommended tools
 *  - Quick-access favorites
 *  - Cross-experience link back to Guided Intelligence
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Search, Activity, Brain, BarChart3, TrendingUp, TrendingDown,
  Shield, Bitcoin, FileText, Telescope, Crosshair, BookOpen,
  Newspaper, Target, Radio, Gauge, Eye, History, Briefcase,
  Sparkles, ChevronRight, ArrowLeft, RotateCcw, Users,
} from "lucide-react";
import { useExperience } from "@/contexts/ExperienceContext";

// ── Design tokens ──────────────────────────────────────────────
const BG = "#0A0C10";
const SURFACE = "rgba(255,255,255,0.03)";
const SURFACE_HOVER = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.07)";
const BORDER_HOVER = "rgba(0,212,255,0.3)";
const ACCENT = "#00D4FF";
const TEXT_PRIMARY = "#F0F4FF";
const TEXT_SECONDARY = "rgba(255,255,255,0.55)";
const TEXT_MUTED = "rgba(255,255,255,0.3)";
const MONO = { fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" } as React.CSSProperties;
const SANS = { fontFamily: "'Inter', sans-serif" } as React.CSSProperties;

// ── Tool catalog ───────────────────────────────────────────────
interface Tool {
  id: string;
  label: string;
  description: string;
  path: string;
  category: string;
  icon: React.ElementType;
  isNew?: boolean;
}

const ALL_TOOLS: Tool[] = [
  // Market Intelligence
  { id: "now", label: "NOW — What Is Happening", description: "Real-time market regime and pressure synthesis", path: "/app/now", category: "Market Intelligence", icon: Activity },
  { id: "why", label: "WHY — Why It Is Happening", description: "Macro driver analysis and causal intelligence", path: "/app/why", category: "Market Intelligence", icon: Brain },
  { id: "outlook", label: "OUTLOOK — What Is Likely Next", description: "Probabilistic scenario and regime forecasting", path: "/app/outlook", category: "Market Intelligence", icon: Telescope },
  { id: "watch", label: "WATCH — What To Monitor", description: "Key indicators and threshold alerts", path: "/app/watch", category: "Market Intelligence", icon: Eye },
  { id: "act", label: "ACT — Decision Framework", description: "Actionable intelligence for your decisions", path: "/app/act", category: "Market Intelligence", icon: Target },
  { id: "seismograph", label: "Seismograph Command Center", description: "Systemic pressure building over time — the signature FAULTLINE visualization", path: "/app/seismograph", category: "Market Intelligence", icon: Activity },
  { id: "todays-story", label: "Today's Story", description: "Narrative synthesis of today's market conditions", path: "/app/todays-story", category: "Market Intelligence", icon: Newspaper },
  // Pressure & Risk
  { id: "pressure", label: "Pressure Engine", description: "Full systemic pressure index with component breakdown", path: "/app/pressure", category: "Pressure & Risk", icon: Gauge },
  { id: "pressure-index", label: "Pressure Index", description: "Historical pressure index visualization", path: "/app/pressure-index", category: "Pressure & Risk", icon: BarChart3 },
  { id: "simulate", label: "Stress Test Simulator", description: "Simulate macro shocks and their systemic impact", path: "/app/simulate", category: "Pressure & Risk", icon: RotateCcw },
  { id: "intelligence-validation", label: "Intelligence Validation", description: "Validate signals and intelligence quality", path: "/app/intelligence-validation", category: "Pressure & Risk", icon: Shield },
  { id: "validation-lab", label: "Validation Lab", description: "Advanced signal validation and backtesting", path: "/app/validation-lab", category: "Pressure & Risk", icon: Shield },
  // Signals & Outlook
  { id: "signals", label: "Signal Outlook Center", description: "Multi-asset signal dashboard and trend analysis", path: "/app/signal-outlook", category: "Signals & Outlook", icon: Radio },
  { id: "day-trade", label: "Day Trade Intelligence", description: "Intraday signals and short-term regime analysis", path: "/app/day-trade", category: "Signals & Outlook", icon: TrendingUp },
  { id: "market-movers", label: "Market Movers", description: "Top movers, volume surges, and momentum leaders", path: "/app/market-movers", category: "Signals & Outlook", icon: TrendingUp },
  { id: "decision-engine", label: "Decision Engine", description: "Structured decision support with risk-adjusted scoring", path: "/app/decision-engine", category: "Signals & Outlook", icon: Crosshair },
  // Historical & Analogs
  { id: "analogs", label: "Historical Analog Engine", description: "Find the closest historical market analogs to today", path: "/app/analogs", category: "Historical & Analogs", icon: History },
  { id: "track-record", label: "Track Record", description: "FAULTLINE signal performance and accuracy history", path: "/app/track-record", category: "Historical & Analogs", icon: FileText },
  { id: "archive", label: "Intelligence Archive", description: "Full archive of past intelligence reports", path: "/app/archive", category: "Historical & Analogs", icon: BookOpen },
  // Watchlist & Monitoring
  { id: "watchlist", label: "Watchlist Intelligence", description: "AI-powered monitoring for your tracked symbols", path: "/app/watchlist", category: "Watchlist & Monitoring", icon: Eye },
  { id: "alerts", label: "Alerts & Thresholds", description: "Custom threshold alerts and notification rules", path: "/app/alerts", category: "Watchlist & Monitoring", icon: Radio },
  { id: "ai-watch", label: "AI Watch", description: "AI-generated market monitoring and anomaly detection", path: "/app/ai-watch", category: "Watchlist & Monitoring", icon: Sparkles },
  // Social Intelligence
  { id: "smart-discovery", label: "Smart Discovery", description: "AI-curated market narratives and social signals", path: "/app/discover", category: "Social Intelligence", icon: Users },
  { id: "phoenix", label: "Phoenix Systems", description: "Sentiment and social intelligence aggregation", path: "/app/phoenix", category: "Social Intelligence", icon: Sparkles },
  // Symbol Intelligence
  { id: "symbol", label: "Symbol Intelligence", description: "Deep-dive analysis for any stock, ETF, or crypto", path: "/app/analysis", category: "Symbol Intelligence", icon: Crosshair },
  { id: "signals-page", label: "Signals Dashboard", description: "Multi-symbol signal and momentum dashboard", path: "/app/signals", category: "Symbol Intelligence", icon: BarChart3 },
  // Portfolio & Risk
  { id: "portfolio", label: "Portfolio Risk Review", description: "Portfolio-level risk analysis and regime exposure", path: "/app/portfolio", category: "Portfolio & Risk", icon: Briefcase },
  { id: "sim-portfolio", label: "Simulated Portfolio", description: "Simulate portfolio performance under different regimes", path: "/app/sim-portfolio", category: "Portfolio & Risk", icon: RotateCcw },
  { id: "decision-ledger", label: "Decision Ledger", description: "Track and review your investment decisions", path: "/app/decision-ledger", category: "Portfolio & Risk", icon: FileText },
  { id: "trade-journal", label: "Trade Journal", description: "Structured trade logging and performance review", path: "/app/trade-journal", category: "Portfolio & Risk", icon: BookOpen },
  // Crypto Intelligence
  { id: "crypto-hub", label: "Crypto Intelligence Hub", description: "Full crypto market intelligence dashboard", path: "/app/crypto", category: "Crypto Intelligence", icon: Bitcoin },
  { id: "crypto-search", label: "Crypto Search", description: "Search and analyze any cryptocurrency", path: "/app/crypto/search", category: "Crypto Intelligence", icon: Search },
  { id: "crypto-watchlist", label: "Crypto Watchlist", description: "Monitor your crypto positions with AI intelligence", path: "/app/crypto/watchlist", category: "Crypto Intelligence", icon: Eye },
  { id: "crypto-signals", label: "Crypto Signals", description: "Crypto-specific signal and momentum analysis", path: "/app/crypto/signals", category: "Crypto Intelligence", icon: Radio },
  // Reports & Research
  { id: "daily-brief-archive", label: "Daily Brief Archive", description: "Full archive of ASHA's daily market briefings", path: "/app/daily-brief", category: "Reports & Research", icon: Newspaper },
  { id: "intelligence-library", label: "Intelligence Library", description: "Curated research and intelligence reports", path: "/app/intelligence-library", category: "Reports & Research", icon: BookOpen },
  { id: "methodology", label: "Methodology", description: "How FAULTLINE's intelligence is built and scored", path: "/app/methodology", category: "Reports & Research", icon: FileText },
  { id: "guide", label: "Platform Guide", description: "How to use FAULTLINE effectively", path: "/app/guide", category: "Reports & Research", icon: BookOpen },
  // ASHA Intelligence
  { id: "asha-center", label: "ASHA Intelligence Center", description: "Full conversational intelligence with ASHA", path: "/app/asha", category: "ASHA Intelligence", icon: Sparkles },
  { id: "fmos", label: "FMOS Health Dashboard", description: "FAULTLINE Market Operating System diagnostics", path: "/app/fmos", category: "ASHA Intelligence", icon: Activity, isNew: true },
  { id: "situation-room", label: "Situation Room", description: "Real-time crisis monitoring and systemic risk alerts", path: "/app/now", category: "ASHA Intelligence", icon: Shield },
];

const CATEGORIES = [
  { label: "Market Intelligence", icon: Activity, color: "#00D4FF" },
  { label: "Pressure & Risk", icon: Gauge, color: "#FF6B6B" },
  { label: "Signals & Outlook", icon: Radio, color: "#4ECDC4" },
  { label: "Historical & Analogs", icon: History, color: "#FFD93D" },
  { label: "Watchlist & Monitoring", icon: Eye, color: "#A8E6CF" },
  { label: "Social Intelligence", icon: Users, color: "#C3B1E1" },
  { label: "Symbol Intelligence", icon: Crosshair, color: "#FF8B94" },
  { label: "Portfolio & Risk", icon: Briefcase, color: "#F7DC6F" },
  { label: "Crypto Intelligence", icon: Bitcoin, color: "#F7931A" },
  { label: "Reports & Research", icon: FileText, color: "#85C1E9" },
  { label: "ASHA Intelligence", icon: Sparkles, color: "#D7BDE2" },
];

const ASHA_RECOMMENDATIONS = [
  { id: "seismograph", reason: "Visualizes systemic pressure building over time" },
  { id: "now", reason: "Start here for today's market regime" },
  { id: "analogs", reason: "Find historical parallels to current conditions" },
  { id: "pressure", reason: "Full breakdown of what is driving pressure today" },
  { id: "smart-discovery", reason: "AI-curated narratives shaping market sentiment" },
];

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={tool.path}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? SURFACE_HOVER : SURFACE,
          border: `1px solid ${hovered ? BORDER_HOVER : BORDER}`,
          borderRadius: "10px",
          padding: "14px 16px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
        }}
      >
        {tool.isNew && (
          <div style={{
            position: "absolute", top: 10, right: 10,
            ...MONO, fontSize: "8px", color: ACCENT,
            background: "rgba(0,212,255,0.1)", padding: "2px 6px",
            borderRadius: "4px", letterSpacing: "0.1em",
          }}>NEW</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon size={14} color={hovered ? ACCENT : TEXT_SECONDARY} style={{ flexShrink: 0 }} />
          <span style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: hovered ? TEXT_PRIMARY : TEXT_SECONDARY, letterSpacing: "0.04em", lineHeight: 1.3 }}>
            {tool.label}
          </span>
        </div>
        <p style={{ ...SANS, fontSize: "11px", color: TEXT_MUTED, lineHeight: 1.5, margin: 0 }}>
          {tool.description}
        </p>
      </div>
    </Link>
  );
}

export default function ToolsHome() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { setExperience } = useExperience();

  const filteredTools = useMemo(() => {
    let tools = ALL_TOOLS;
    if (activeCategory) tools = tools.filter(t => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      tools = tools.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return tools;
  }, [search, activeCategory]);

  const ashaTools = useMemo(() =>
    ASHA_RECOMMENDATIONS.map(r => ({ ...ALL_TOOLS.find(t => t.id === r.id)!, reason: r.reason })).filter(Boolean),
    []
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT_PRIMARY, padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ padding: "28px 24px 0", maxWidth: "1100px", margin: "0 auto" }}>
        {/* Cross-experience link */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <button
            onClick={() => setExperience("guided")}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "rgba(0,212,255,0.08)", border: `1px solid rgba(0,212,255,0.2)`,
              borderRadius: "6px", padding: "6px 12px", cursor: "pointer",
              ...MONO, fontSize: "10px", color: ACCENT, letterSpacing: "0.08em",
              transition: "all 0.15s ease",
            }}
          >
            <ArrowLeft size={12} />
            RETURN TO GUIDED INTELLIGENCE
          </button>
          <div style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, letterSpacing: "0.12em" }}>
            TOOLS & FEATURES
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ ...MONO, fontSize: "22px", fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "0.1em", margin: "0 0 6px" }}>
            TOOLS & FEATURES
          </h1>
          <p style={{ ...SANS, fontSize: "13px", color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
            Direct access to FAULTLINE's complete analytical platform. {ALL_TOOLS.length} tools across {CATEGORIES.length} categories.
          </p>
        </div>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: "10px", padding: "10px 16px", marginBottom: "28px",
        }}>
          <Search size={16} color={TEXT_MUTED} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tools, features, categories…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              ...MONO, fontSize: "13px", color: TEXT_PRIMARY, letterSpacing: "0.04em",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_MUTED, padding: 0 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>
        {/* ASHA Recommendations (shown when no search/filter active) */}
        {!search && !activeCategory && (
          <div style={{ marginBottom: "36px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Sparkles size={14} color={ACCENT} />
              <span style={{ ...MONO, fontSize: "10px", fontWeight: 700, color: ACCENT, letterSpacing: "0.15em" }}>
                ASHA RECOMMENDS
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
              {ashaTools.map(tool => (
                <Link key={tool.id} href={tool.path}>
                  <div style={{
                    background: "rgba(0,212,255,0.04)", border: `1px solid rgba(0,212,255,0.15)`,
                    borderRadius: "10px", padding: "12px 14px", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}>
                    <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: TEXT_PRIMARY, marginBottom: "4px" }}>
                      {tool.label}
                    </div>
                    <div style={{ ...SANS, fontSize: "10px", color: TEXT_MUTED, lineHeight: 1.4 }}>
                      {tool.reason}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Category filter pills */}
        {!search && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, letterSpacing: "0.15em", marginBottom: "10px" }}>
              CATEGORIES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => setActiveCategory(null)}
                style={{
                  ...MONO, fontSize: "10px", letterSpacing: "0.08em",
                  padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                  background: !activeCategory ? "rgba(0,212,255,0.15)" : SURFACE,
                  border: `1px solid ${!activeCategory ? ACCENT : BORDER}`,
                  color: !activeCategory ? ACCENT : TEXT_SECONDARY,
                  transition: "all 0.15s ease",
                }}
              >
                ALL TOOLS
              </button>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.label;
                const count = ALL_TOOLS.filter(t => t.category === cat.label).length;
                return (
                  <button
                    key={cat.label}
                    onClick={() => setActiveCategory(isActive ? null : cat.label)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      ...MONO, fontSize: "10px", letterSpacing: "0.06em",
                      padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                      background: isActive ? `${cat.color}18` : SURFACE,
                      border: `1px solid ${isActive ? cat.color : BORDER}`,
                      color: isActive ? cat.color : TEXT_SECONDARY,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={11} />
                    {cat.label}
                    <span style={{ opacity: 0.5, fontSize: "9px" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tool grid */}
        {filteredTools.length > 0 ? (
          <>
            {activeCategory || search ? (
              <div>
                <div style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, letterSpacing: "0.15em", marginBottom: "14px" }}>
                  {search ? `${filteredTools.length} RESULTS` : activeCategory?.toUpperCase()}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                  {filteredTools.map(tool => <ToolCard key={tool.id} tool={tool} />)}
                </div>
              </div>
            ) : (
              /* Group by category when no filter */
              CATEGORIES.map(cat => {
                const catTools = ALL_TOOLS.filter(t => t.category === cat.label);
                if (!catTools.length) return null;
                const Icon = cat.icon;
                return (
                  <div key={cat.label} style={{ marginBottom: "32px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Icon size={13} color={cat.color} />
                        <span style={{ ...MONO, fontSize: "10px", fontWeight: 700, color: cat.color, letterSpacing: "0.12em" }}>
                          {cat.label.toUpperCase()}
                        </span>
                        <span style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED }}>{catTools.length}</span>
                      </div>
                      <button
                        onClick={() => setActiveCategory(cat.label)}
                        style={{
                          display: "flex", alignItems: "center", gap: "4px",
                          background: "none", border: "none", cursor: "pointer",
                          ...MONO, fontSize: "9px", color: TEXT_MUTED, letterSpacing: "0.08em",
                        }}
                      >
                        VIEW ALL <ChevronRight size={10} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                      {catTools.slice(0, 4).map(tool => <ToolCard key={tool.id} tool={tool} />)}
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_MUTED }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: "12px" }} />
            <div style={{ ...MONO, fontSize: "12px", letterSpacing: "0.1em" }}>NO TOOLS FOUND</div>
            <div style={{ ...SANS, fontSize: "12px", marginTop: "6px" }}>Try a different search term</div>
          </div>
        )}

        {/* Footer — return to Guided Intelligence */}
        <div style={{
          marginTop: "48px", padding: "20px", borderRadius: "12px",
          background: "rgba(0,212,255,0.04)", border: `1px solid rgba(0,212,255,0.12)`,
          textAlign: "center",
        }}>
          <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: ACCENT, letterSpacing: "0.1em", marginBottom: "8px" }}>
            GUIDED INTELLIGENCE
          </div>
          <p style={{ ...SANS, fontSize: "12px", color: TEXT_SECONDARY, margin: "0 0 14px", lineHeight: 1.6 }}>
            Prefer conclusion-first answers? Switch to Guided Intelligence for ASHA-guided analysis organized around five essential market questions.
          </p>
          <button
            onClick={() => setExperience("guided")}
            style={{
              ...MONO, fontSize: "11px", letterSpacing: "0.08em",
              padding: "8px 20px", borderRadius: "6px", cursor: "pointer",
              background: "rgba(0,212,255,0.12)", border: `1px solid rgba(0,212,255,0.3)`,
              color: ACCENT, transition: "all 0.15s ease",
            }}
          >
            SWITCH TO GUIDED INTELLIGENCE →
          </button>
        </div>
      </div>
    </div>
  );
}
