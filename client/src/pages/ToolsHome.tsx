/**
 * ToolsHome — secondary FAULTLINE tool hub
 *
 * The Case File / Five Questions remain the primary experience.
 * This page exposes deeper Intelligence, Market Tools, and Research Lab workspaces
 * without making users reconstruct the core market answer themselves.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Search, Activity, BarChart3, TrendingUp, Shield, Bitcoin, FileText,
  Target, Radio, Eye, History, Sparkles, ChevronRight, ArrowLeft, RotateCcw,
  Users, BookOpen, Newspaper, Crosshair,
} from "lucide-react";
import { useExperience } from "@/contexts/ExperienceContext";
import { CANONICAL_DESTINATION_BY_ID } from "@shared/routeRegistry";

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
  // Intelligence
  { id: "global-markets", label: "Global Markets", description: "Cross-asset market context around the current FAULTLINE state", path: "/app/markets", category: "Intelligence", icon: BarChart3 },
  { id: "seismograph", label: "Seismograph Intelligence", description: "Inspect systemic pressure engines and their historical context", path: "/app/seismograph-command-center", category: "Intelligence", icon: Activity },
  { id: "daily-brief", label: "Daily Brief", description: "The current written market briefing from the FAULTLINE intelligence stack", path: "/daily-brief", category: "Intelligence", icon: Newspaper },
  { id: "intelligence-library", label: "Intelligence Library", description: "Curated FAULTLINE research and published intelligence", path: "/intelligence-library", category: "Intelligence", icon: BookOpen },
  { id: "social-intelligence", label: "Social Intelligence", description: "Inspect market narratives and social evidence as a supporting input", path: "/app/social-intelligence", category: "Intelligence", icon: Users },
  { id: "insider-intelligence", label: "Insider Intelligence", description: "Inspect insider activity as a supporting evidence surface", path: "/app/insider-intelligence", category: "Intelligence", icon: Eye },
  { id: "plato", label: "PLATO Intelligence", description: "Continue the current market interpretation in the conversational intelligence layer", path: "/app/asha", category: "Intelligence", icon: Sparkles },

  // Market Tools — intentionally preserved as subscription-value utilities.
  { id: "watchlist", label: "Watchlist", description: "Monitor selected assets and conditions in the context of the current regime", path: "/app/watchlist", category: "Market Tools", icon: Eye },
  { id: "alerts", label: "Alerts", description: "Track thresholds and conditions that deserve attention", path: "/app/alerts", category: "Market Tools", icon: Radio },
  { id: "symbol-intelligence", label: "Symbol Intelligence", description: "Deep-dive analysis for a specific stock, ETF, or crypto asset", path: "/app/symbol-intelligence", category: "Market Tools", icon: Crosshair },
  { id: "day-trade", label: "Day Trade Intelligence", description: "Short-horizon market intelligence and intraday setup context", path: "/app/day-trade-intelligence", category: "Market Tools", icon: Target },
  { id: "rising-stars", label: "Rising Stars", description: "Surface strengthening assets and emerging relative leaders", path: "/app/rising-stars", category: "Market Tools", icon: TrendingUp },
  { id: "signals", label: "Signals", description: "Review multi-asset signal and momentum conditions", path: "/app/signals", category: "Market Tools", icon: BarChart3 },
  { id: "crypto-hub", label: "Crypto Hub", description: "Crypto market intelligence in the broader FAULTLINE regime context", path: "/app/crypto", category: "Market Tools", icon: Bitcoin },
  { id: "crypto-signals", label: "Crypto Signals", description: "Crypto-specific signal, momentum, and regime context", path: "/app/crypto-signals", category: "Market Tools", icon: Bitcoin },
  { id: "trade-journal", label: "Trade Journal", description: "Record and review trading decisions against the market state", path: "/app/trade-journal", category: "Market Tools", icon: BookOpen },

  // Research Lab
  { id: "time-machine", label: "TIME MACHINE™", description: "Inspect earlier market states and historical context", path: "/app/time-machine", category: "Research Lab", icon: History },
  { id: "historical-analogs", label: "Historical Analogs", description: "Compare the current evidence profile with prior reference periods", path: "/app/historical-analogs", category: "Research Lab", icon: History },
  { id: "simulate-pressure", label: "Simulate Pressure", description: "Explore how hypothetical input changes affect pressure", path: "/app/simulate-pressure", category: "Research Lab", icon: RotateCcw },
  { id: "track-record", label: "Track Record", description: "Review recorded FAULTLINE outcomes and historical evidence", path: "/app/track-record", category: "Research Lab", icon: FileText },
  { id: "validation-lab", label: "Validation Lab", description: "Inspect validation work and signal-quality research", path: "/app/validation-lab", category: "Research Lab", icon: Shield },
  { id: "decision-ledger", label: "Decision Ledger", description: "Review recorded decisions and the evidence present at the time", path: "/app/decision-ledger", category: "Research Lab", icon: FileText },
  { id: "methodology", label: "Methodology", description: "Inspect how FAULTLINE data, models, scoring, and limitations are defined", path: "/methodology", category: "Research Lab", icon: BookOpen },
];

const CATEGORIES = [
  { label: "Intelligence", icon: Activity, color: "#00D4FF" },
  { label: "Market Tools", icon: Target, color: "#4ECDC4" },
  { label: "Research Lab", icon: History, color: "#FFD93D" },
];

const PLATO_RECOMMENDATIONS = [
  { id: "seismograph", reason: "Inspect the pressure evidence beneath the current Case File" },
  { id: "symbol-intelligence", reason: "Apply the market context to a specific asset" },
  { id: "signals", reason: "Check whether market signals confirm or diverge from the macro read" },
  { id: "historical-analogs", reason: "Compare the current evidence profile with prior periods" },
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

  const platoTools = useMemo(() =>
    PLATO_RECOMMENDATIONS.map(r => ({ ...ALL_TOOLS.find(t => t.id === r.id)!, reason: r.reason })).filter(Boolean),
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
            RETURN TO CASE FILE
          </button>
          <div style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, letterSpacing: "0.12em" }}>
            MARKET & RESEARCH TOOLS
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ ...MONO, fontSize: "22px", fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "0.1em", margin: "0 0 6px" }}>
            TOOLS & FEATURES
          </h1>
          <p style={{ ...SANS, fontSize: "13px", color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
            The Case File stays primary. These {ALL_TOOLS.length} deeper workspaces are organized into {CATEGORIES.length} clear layers for market analysis, trading utility, and research.
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
        {/* PLATO recommendations (shown when no search/filter active) */}
        {!search && !activeCategory && (
          <div style={{ marginBottom: "36px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Sparkles size={14} color={ACCENT} />
              <span style={{ ...MONO, fontSize: "10px", fontWeight: 700, color: ACCENT, letterSpacing: "0.15em" }}>
                PLATO RECOMMENDS
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
              {platoTools.map(tool => (
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
            Return to the FAULTLINE Case File for the conclusion-first market read organized around the Five Questions.
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
            RETURN TO CASE FILE →
          </button>
        </div>
      </div>
    </div>
  );
}
