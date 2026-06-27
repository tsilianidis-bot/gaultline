/* ============================================================
   FAULTLINE — Smart Discovery™
   Natural language question router.
   Ask anything → FAULTLINE routes to the correct engine.
   ============================================================ */
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search, ArrowRight, Sparkles, Telescope, Target, Crosshair,
  BookOpen, TrendingUp, Shield, Radio, Bitcoin, Briefcase,
  Zap, ChevronRight, Clock, X, RotateCcw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";

// ── Types ─────────────────────────────────────────────────────
interface DiscoveryResult {
  intent: string;
  confidence: number;
  destination: string;
  destinationLabel: string;
  destinationPath: string;
  destinationIcon: React.ReactNode;
  summary: string;
  ticker?: string;
  assetType?: "stock" | "crypto";
  suggestedQuestions?: string[];
}

// ── Intent routing map ────────────────────────────────────────
const INTENT_ROUTES: Record<string, { label: string; path: string; icon: React.ReactNode; description: string }> = {
  "symbol_analysis":    { label: "Symbol Intelligence",    path: "/app/symbol-intelligence",    icon: <Telescope size={14} />,    description: "Full intelligence report for this security" },
  "day_trade":          { label: "Day Trade Intel",         path: "/app/day-trade-intelligence", icon: <Target size={14} />,       description: "Intraday setup and day trade analysis" },
  "decision_engine":    { label: "Decision Engine",         path: "/app/decision-engine",        icon: <Crosshair size={14} />,    description: "BUY/HOLD/REDUCE verdict with full context" },
  "opportunities":      { label: "Opportunity Radar",       path: "/app/opportunities",          icon: <Sparkles size={14} />,     description: "Top-ranked opportunities by score" },
  "todays_story":       { label: "Today's Story",           path: "/app/todays-story",           icon: <BookOpen size={14} />,     description: "AI-written market narrative for today" },
  "market_stress":      { label: "Market Stress",           path: "/app/pressure",               icon: <Shield size={14} />,       description: "Macro risk and pressure indicators" },
  "signals":            { label: "Signals",                 path: "/app/signals",                icon: <Radio size={14} />,        description: "Stock and market signal analysis" },
  "crypto":             { label: "Crypto Hub",              path: "/app/crypto",                 icon: <Bitcoin size={14} />,      description: "Crypto intelligence and signals" },
  "portfolio":          { label: "Portfolio",               path: "/app/portfolio",              icon: <Briefcase size={14} />,    description: "Portfolio tracking and guidance" },
  "sector_rotation":    { label: "Sector Rotation",         path: "/app/alt-rotation",           icon: <RotateCcw size={14} />,    description: "Sector rotation and capital flow analysis" },
  "command_center":     { label: "Command Center",          path: "/app/command",                icon: <TrendingUp size={14} />,   description: "Full market overview and intelligence" },
};

// ── Suggested questions ───────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  "Should I buy NVDA right now?",
  "What are institutions buying today?",
  "Best swing trade setups this week",
  "Is the market about to crash?",
  "What's the best crypto opportunity?",
  "How exposed is my portfolio to macro risk?",
  "What happened in markets today?",
  "Is TSLA a buy or sell?",
  "Where is smart money flowing?",
  "What sectors are rotating up?",
];

// ── Local intent detection (fast, no API call needed for obvious cases) ──
function detectLocalIntent(query: string): Partial<DiscoveryResult> | null {
  const q = query.toLowerCase().trim();

  // Ticker detection — 1-5 uppercase letters, possibly with "buy", "sell", "should I"
  const tickerMatch = query.match(/\b([A-Z]{1,5})\b/);
  const ticker = tickerMatch?.[1];
  const isCrypto = ticker && ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "LINK", "TAO", "ONDO", "ADA"].includes(ticker);

  if (ticker && (q.includes("buy") || q.includes("sell") || q.includes("should i") || q.includes("worth it"))) {
    return {
      intent: "decision_engine",
      confidence: 92,
      ticker,
      assetType: isCrypto ? "crypto" : "stock",
      destination: "Decision Engine",
      destinationLabel: "Decision Engine",
      destinationPath: "/app/decision-engine",
      destinationIcon: <Crosshair size={14} />,
      summary: `Routing to Decision Engine for ${ticker} — you'll get a BUY/HOLD/REDUCE verdict with full context.`,
    };
  }

  if (ticker && (q.includes("day trade") || q.includes("intraday") || q.includes("scalp"))) {
    return {
      intent: "day_trade",
      confidence: 90,
      ticker,
      assetType: isCrypto ? "crypto" : "stock",
      destination: "Day Trade Intel",
      destinationLabel: "Day Trade Intel",
      destinationPath: "/app/day-trade-intelligence",
      destinationIcon: <Target size={14} />,
      summary: `Routing to Day Trade Intelligence for ${ticker} — intraday setup, entry/exit levels, and favorability score.`,
    };
  }

  if (ticker) {
    return {
      intent: "symbol_analysis",
      confidence: 85,
      ticker,
      assetType: isCrypto ? "crypto" : "stock",
      destination: "Symbol Intelligence",
      destinationLabel: "Symbol Intelligence",
      destinationPath: "/app/symbol-intelligence",
      destinationIcon: <Telescope size={14} />,
      summary: `Routing to Symbol Intelligence for ${ticker} — full analysis including signals, outlook, and AI diagnostic.`,
    };
  }

  if (q.includes("crash") || q.includes("recession") || q.includes("risk") || q.includes("stress")) {
    return {
      intent: "market_stress",
      confidence: 88,
      destination: "Market Stress",
      destinationLabel: "Market Stress",
      destinationPath: "/app/pressure",
      destinationIcon: <Shield size={14} />,
      summary: "Routing to Market Stress — live FAULTLINE pressure index, risk vectors, and historical analogs.",
    };
  }

  if (q.includes("today") || q.includes("happened") || q.includes("overnight") || q.includes("story")) {
    return {
      intent: "todays_story",
      confidence: 90,
      destination: "Today's Story",
      destinationLabel: "Today's Story",
      destinationPath: "/app/todays-story",
      destinationIcon: <BookOpen size={14} />,
      summary: "Routing to Today's Story — AI-written market narrative with what happened, what changed, and what matters next.",
    };
  }

  if (q.includes("opportunit") || q.includes("swing trade") || q.includes("best trade") || q.includes("what to buy")) {
    return {
      intent: "opportunities",
      confidence: 87,
      destination: "Opportunity Radar",
      destinationLabel: "Opportunity Radar",
      destinationPath: "/app/opportunities",
      destinationIcon: <Sparkles size={14} />,
      summary: "Routing to Opportunity Radar — top-ranked opportunities scored across 14+ signals.",
    };
  }

  if (q.includes("institution") || q.includes("smart money") || q.includes("insider") || q.includes("whale")) {
    return {
      intent: "command_center",
      confidence: 82,
      destination: "Command Center",
      destinationLabel: "Command Center",
      destinationPath: "/app/command",
      destinationIcon: <TrendingUp size={14} />,
      summary: "Routing to Command Center — institutional positioning, regime indicators, and intelligence overview.",
    };
  }

  if (q.includes("crypto") || q.includes("bitcoin") || q.includes("ethereum") || q.includes("btc") || q.includes("eth")) {
    return {
      intent: "crypto",
      confidence: 88,
      destination: "Crypto Hub",
      destinationLabel: "Crypto Hub",
      destinationPath: "/app/crypto",
      destinationIcon: <Bitcoin size={14} />,
      summary: "Routing to Crypto Hub — crypto intelligence, signals, and market analysis.",
    };
  }

  if (q.includes("sector") || q.includes("rotation") || q.includes("flow")) {
    return {
      intent: "sector_rotation",
      confidence: 85,
      destination: "Sector Rotation",
      destinationLabel: "Sector Rotation",
      destinationPath: "/app/alt-rotation",
      destinationIcon: <RotateCcw size={14} />,
      summary: "Routing to Sector Rotation — capital flow analysis and sector momentum.",
    };
  }

  if (q.includes("portfolio") || q.includes("position") || q.includes("holding")) {
    return {
      intent: "portfolio",
      confidence: 85,
      destination: "Portfolio",
      destinationLabel: "Portfolio",
      destinationPath: "/app/portfolio",
      destinationIcon: <Briefcase size={14} />,
      summary: "Routing to Portfolio — track your positions with AI guidance and exposure analysis.",
    };
  }

  return null;
}

// ── Main Page ─────────────────────────────────────────────────
export default function SmartDiscovery() {
  useSEO({
    title: "Smart Discovery — FAULTLINE",
    description: "Ask any market question. FAULTLINE routes you to the right intelligence engine instantly.",
  });

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  // Focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setIsAnalyzing(true);
    setResult(null);

    // Add to history
    setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 5));

    // Try local detection first (instant)
    const local = detectLocalIntent(q);
    if (local && (local.confidence ?? 0) >= 85) {
      setResult({
        intent: local.intent ?? "symbol_analysis",
        confidence: local.confidence ?? 80,
        destination: local.destination ?? "Symbol Intelligence",
        destinationLabel: local.destinationLabel ?? "Symbol Intelligence",
        destinationPath: local.destinationPath ?? "/app/symbol-intelligence",
        destinationIcon: local.destinationIcon ?? <Telescope size={14} />,
        summary: local.summary ?? "",
        ticker: local.ticker,
        assetType: local.assetType,
        suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3),
      });
      setIsAnalyzing(false);
      return;
    }

    // Fallback: use a simulated delay + local detection with lower threshold
    await new Promise(r => setTimeout(r, 600));
    const fallback: Partial<DiscoveryResult> = detectLocalIntent(q) ?? {
      intent: "command_center",
      confidence: 70,
      destination: "Command Center",
      destinationLabel: "Command Center",
      destinationPath: "/app/command",
      destinationIcon: <TrendingUp size={14} />,
      summary: "Routing to Command Center — the best starting point for any market question.",
      ticker: undefined,
      assetType: undefined,
    };

    setResult({
      intent: fallback.intent ?? "command_center",
      confidence: fallback.confidence ?? 70,
      destination: fallback.destination ?? "Command Center",
      destinationLabel: fallback.destinationLabel ?? "Command Center",
      destinationPath: fallback.destinationPath ?? "/app/command",
      destinationIcon: fallback.destinationIcon ?? <TrendingUp size={14} />,
      summary: fallback.summary ?? "",
      ticker: fallback.ticker,
      assetType: fallback.assetType,
      suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3),
    });
    setIsAnalyzing(false);
  }, []);

  const handleNavigate = useCallback(() => {
    if (!result) return;
    if (result.ticker) {
      navigate(result.destinationPath);
      const assetType = result.assetType ?? "stock";
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol: result.ticker, assetType } }));
        window.dispatchEvent(new CustomEvent("dt-search", { detail: { symbol: result.ticker, assetType } }));
        window.dispatchEvent(new CustomEvent("de-search", { detail: { symbol: result.ticker, assetType } }));
      }, 200);
    } else {
      navigate(result.destinationPath);
    }
  }, [result, navigate]);

  return (
    <div style={{ minHeight: "100vh", background: "#050608" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding: "24px 16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(6,8,12,0.98)",
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "6px" }}>
          <Sparkles size={14} style={{ color: "#00D4FF" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em" }}>SMART DISCOVERY</span>
        </div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "clamp(20px, 4vw, 28px)", color: "#E2E8F0", letterSpacing: "0.04em", margin: "0 0 6px" }}>
          Ask FAULTLINE Anything
        </h1>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)", margin: 0 }}>
          Natural language → instant routing to the right intelligence engine
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px", maxWidth: "680px", margin: "0 auto" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 16px",
          background: "rgba(6,8,12,0.95)",
          border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: "8px",
          boxShadow: "0 0 0 1px rgba(0,212,255,0.05)",
          marginBottom: "16px",
        }}>
          <Search size={16} style={{ color: "#00D4FF", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(query); }}
            placeholder="Should I buy NVDA? What are institutions doing? Best swing trades..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#F0F4FF",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              letterSpacing: "0.03em",
            }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setResult(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: "2px", display: "flex" }}>
              <X size={13} />
            </button>
          )}
          <button
            onClick={() => handleSubmit(query)}
            disabled={!query.trim() || isAnalyzing}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "6px 12px", borderRadius: "4px",
              background: query.trim() ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${query.trim() ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: query.trim() ? "#00D4FF" : "#6B7280",
              cursor: query.trim() ? "pointer" : "default",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em",
              transition: "all 0.15s ease", flexShrink: 0,
            }}
          >
            {isAnalyzing ? (
              <><RotateCcw size={10} style={{ animation: "fl-spin 1s linear infinite" }} /> ROUTING…</>
            ) : (
              <>DISCOVER <ArrowRight size={10} /></>
            )}
          </button>
        </div>

        {/* ── Result ─────────────────────────────────────── */}
        {result && !isAnalyzing && (
          <div style={{
            padding: "16px 18px",
            background: "rgba(6,8,12,0.95)",
            border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: "8px",
            marginBottom: "16px",
            animation: "fl-fade-in 0.2s ease-out",
          }}>
            {/* Intent header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#00D4FF" }}>{result.destinationIcon}</span>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#E2E8F0", letterSpacing: "0.06em" }}>{result.destinationLabel}</span>
                {result.ticker && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FFD700", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", padding: "1px 6px", borderRadius: "2px" }}>
                    {result.ticker}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)" }}>
                {result.confidence}% MATCH
              </span>
            </div>

            {/* Summary */}
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", lineHeight: 1.6, margin: "0 0 12px" }}>
              {result.summary}
            </p>

            {/* CTA */}
            <button
              onClick={handleNavigate}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "9px 16px", borderRadius: "4px",
                background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                color: "#00D4FF", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.12em",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.12)"; }}
            >
              <Zap size={11} />
              OPEN {result.destinationLabel.toUpperCase()}
              <ChevronRight size={11} />
            </button>
          </div>
        )}

        {/* ── Suggested questions ─────────────────────────── */}
        {!result && !isAnalyzing && (
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.14em", marginBottom: "10px" }}>
              SUGGESTED QUESTIONS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(q); handleSubmit(q); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", borderRadius: "5px",
                    background: "rgba(6,8,12,0.95)", border: "1px solid rgba(255,255,255,0.06)",
                    color: "#94A3B8", cursor: "pointer", textAlign: "left",
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.2)"; (e.currentTarget as HTMLElement).style.color = "#E2E8F0"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                >
                  <Search size={11} style={{ color: "rgba(100,116,139,0.4)", flexShrink: 0 }} />
                  {q}
                  <ChevronRight size={10} style={{ marginLeft: "auto", color: "rgba(100,116,139,0.3)", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── History ─────────────────────────────────────── */}
        {history.length > 0 && !result && !isAnalyzing && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.14em", marginBottom: "8px" }}>
              RECENT SEARCHES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(h); handleSubmit(h); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "4px 10px", borderRadius: "3px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(100,116,139,0.6)", cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Clock size={9} />
                  {h.length > 40 ? h.slice(0, 40) + "…" : h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── All engines ─────────────────────────────────── */}
        <div style={{ marginTop: "24px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.14em", marginBottom: "10px" }}>
            ALL INTELLIGENCE ENGINES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
            {Object.entries(INTENT_ROUTES).map(([key, route]) => (
              <button
                key={key}
                onClick={() => navigate(route.path)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "8px",
                  padding: "10px 12px", borderRadius: "5px",
                  background: "rgba(6,8,12,0.95)", border: "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)"; }}
              >
                <span style={{ color: "rgba(100,116,139,0.5)", flexShrink: 0, marginTop: "1px" }}>{route.icon}</span>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", marginBottom: "2px" }}>{route.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", lineHeight: 1.3 }}>{route.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fl-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
