/* ============================================================
   FAULTLINE — Smart Discovery™
   True dispatcher: Ask → Route → Execute. Zero extra clicks.

   Input → Routing → Engine Execution → Answer
   ============================================================ */
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search, ArrowRight, Sparkles, Telescope, Target, Crosshair,
  BookOpen, TrendingUp, Shield, Radio, Bitcoin, Briefcase,
  Zap, ChevronRight, Clock, X, RotateCcw,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

// ── Types ─────────────────────────────────────────────────────
interface DispatchResult {
  intent: string;
  confidence: number;
  destinationLabel: string;
  destinationPath: string;
  ticker?: string;
  assetType?: "stock" | "crypto";
  /** Extra URL params to pass to the destination */
  params?: Record<string, string>;
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

// ── Known crypto tickers ──────────────────────────────────────
const CRYPTO_TICKERS = new Set([
  "BTC","ETH","SOL","BNB","XRP","DOGE","LINK","TAO","ONDO","ADA",
  "AVAX","DOT","MATIC","ATOM","LTC","UNI","AAVE","COMP","MKR","SNX",
  "NEAR","FTM","ALGO","HBAR","ICP","VET","EOS","TRX","XLM","ETC",
]);

// ── Core dispatcher ───────────────────────────────────────────
function dispatch(query: string): DispatchResult {
  const q = query.toLowerCase().trim();

  // Extract ticker — 1-5 uppercase letters, not common English words
  const SKIP = new Set(["I","A","IS","IN","IT","AT","TO","DO","BE","MY","OR","VS","AI","US","UK","EU"]);
  const tickerMatch = query.match(/\b([A-Z]{1,5})\b/g);
  const ticker = tickerMatch?.find(t => !SKIP.has(t));
  const isCrypto = ticker ? CRYPTO_TICKERS.has(ticker) : false;
  const assetType: "stock" | "crypto" = isCrypto ? "crypto" : "stock";

  // ── Decision Engine: buy/sell/should I/worth it ──
  if (ticker && (q.includes("buy") || q.includes("sell") || q.includes("should i") || q.includes("worth it") || q.includes("good time"))) {
    const move = q.includes("sell") ? "sell_specific_asset" : "buy_specific_asset";
    return {
      intent: "decision_engine",
      confidence: 92,
      ticker,
      assetType,
      destinationLabel: "Decision Engine",
      destinationPath: "/app/decision-engine",
      params: { symbol: ticker, type: assetType, move, autorun: "1" },
    };
  }

  // ── Day Trade: intraday/scalp/day trade ──
  if (ticker && (q.includes("day trade") || q.includes("intraday") || q.includes("scalp") || q.includes("today") && q.includes("trade"))) {
    return {
      intent: "day_trade",
      confidence: 90,
      ticker,
      assetType,
      destinationLabel: "Day Trade Intel",
      destinationPath: "/app/day-trade-intelligence",
      params: { symbol: ticker, type: assetType, autorun: "1" },
    };
  }

  // ── Symbol Intelligence: analyze / what is / extended / overvalued ──
  if (ticker && (q.includes("analyz") || q.includes("what is") || q.includes("extended") || q.includes("overvalued") || q.includes("undervalued") || q.includes("outlook") || q.includes("target"))) {
    return {
      intent: "symbol_analysis",
      confidence: 88,
      ticker,
      assetType,
      destinationLabel: "Symbol Intelligence",
      destinationPath: "/app/symbol-intelligence",
      params: { symbol: ticker, type: assetType, autorun: "1" },
    };
  }

  // ── Signal Outlook: signal / signals for ──
  if (ticker && (q.includes("signal") || q.includes("outlook") || q.includes("forecast"))) {
    return {
      intent: "signals",
      confidence: 86,
      ticker,
      assetType,
      destinationLabel: "Signal Outlook",
      destinationPath: "/app/signal-outlook",
      params: { symbol: ticker, type: assetType },
    };
  }

  // ── Any ticker without a specific action → Symbol Intelligence ──
  if (ticker) {
    return {
      intent: "symbol_analysis",
      confidence: 85,
      ticker,
      assetType,
      destinationLabel: "Symbol Intelligence",
      destinationPath: "/app/symbol-intelligence",
      params: { symbol: ticker, type: assetType, autorun: "1" },
    };
  }

  // ── No ticker — route by topic ──

  if (q.includes("crash") || q.includes("recession") || q.includes("dangerous") || q.includes("risk") || q.includes("stress") || q.includes("how bad")) {
    return { intent: "market_stress", confidence: 88, destinationLabel: "Market Stress", destinationPath: "/app/pressure" };
  }

  if (q.includes("today") || q.includes("happened") || q.includes("overnight") || q.includes("story") || q.includes("what changed") || q.includes("morning")) {
    return { intent: "todays_story", confidence: 90, destinationLabel: "Today's Story", destinationPath: "/app/todays-story", params: { autorun: "1" } };
  }

  if (q.includes("opportunit") || q.includes("swing trade") || q.includes("best trade") || q.includes("what to buy") || q.includes("best setup") || q.includes("find me")) {
    return { intent: "opportunities", confidence: 87, destinationLabel: "Opportunity Radar", destinationPath: "/app/opportunities" };
  }

  if (q.includes("institution") || q.includes("smart money") || q.includes("insider") || q.includes("whale") || q.includes("wall street")) {
    return { intent: "command_center", confidence: 82, destinationLabel: "Command Center", destinationPath: "/app/command" };
  }

  if (q.includes("crypto") || q.includes("bitcoin") || q.includes("ethereum") || q.includes("btc") || q.includes("eth") || q.includes("defi")) {
    return { intent: "crypto", confidence: 88, destinationLabel: "Crypto Hub", destinationPath: "/app/crypto" };
  }

  if (q.includes("sector") || q.includes("rotation") || q.includes("flow") || q.includes("capital")) {
    return { intent: "sector_rotation", confidence: 85, destinationLabel: "Sector Rotation", destinationPath: "/app/alt-rotation" };
  }

  if (q.includes("portfolio") || q.includes("position") || q.includes("holding") || q.includes("rebalance")) {
    return { intent: "portfolio", confidence: 85, destinationLabel: "Portfolio", destinationPath: "/app/portfolio" };
  }

  if (q.includes("macro") || q.includes("economy") || q.includes("fed") || q.includes("inflation") || q.includes("rates")) {
    return { intent: "market_stress", confidence: 80, destinationLabel: "Market Stress", destinationPath: "/app/pressure" };
  }

  // Default: Command Center
  return { intent: "command_center", confidence: 70, destinationLabel: "Command Center", destinationPath: "/app/command" };
}

// ── Build destination URL with params ────────────────────────
function buildUrl(path: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return path;
  const qs = new URLSearchParams(params).toString();
  return `${path}?${qs}`;
}

// ── Main Page ─────────────────────────────────────────────────
export default function SmartDiscovery() {
  useSEO({
    title: "Smart Discovery — FAULTLINE",
    description: "Ask any market question. FAULTLINE routes you to the right intelligence engine and executes instantly.",
  });

  const [query, setQuery] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [lastDispatch, setLastDispatch] = useState<{ label: string; ticker?: string } | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("sd-history") ?? "[]"); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  // Focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setIsDispatching(true);

    // Save to history
    const newHistory = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, 8);
    setHistory(newHistory);
    try { sessionStorage.setItem("sd-history", JSON.stringify(newHistory)); } catch { /* ignore */ }

    // Route
    const result = dispatch(trimmed);

    // Brief visual feedback (80ms) so user sees the dispatch happening
    await new Promise(r => setTimeout(r, 80));

    // Show brief "dispatching to X" feedback
    setLastDispatch({ label: result.destinationLabel, ticker: result.ticker });

    // Dispatch cross-page events for pages that listen (DayTradeIntelligence)
    if (result.ticker) {
      const detail = { symbol: result.ticker, assetType: result.assetType ?? "stock" };
      window.dispatchEvent(new CustomEvent("si-search", { detail }));
      window.dispatchEvent(new CustomEvent("dt-search", { detail }));
      window.dispatchEvent(new CustomEvent("de-search", { detail: { ...detail, move: result.params?.move, autorun: true } }));
    }

    // Navigate immediately with URL params
    const url = buildUrl(result.destinationPath, result.params);
    navigate(url);

    setIsDispatching(false);
  }, [history, navigate]);

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
          Ask a question → FAULTLINE routes and executes the right engine instantly
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px", maxWidth: "680px", margin: "0 auto" }}>

        {/* Dispatch feedback strip */}
        {lastDispatch && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 14px", marginBottom: "12px",
            background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)",
            borderRadius: "5px", animation: "fl-fade-in 0.15s ease-out",
          }}>
            <Zap size={11} style={{ color: "#00D4FF", flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.7)" }}>
              Dispatched to {lastDispatch.label}{lastDispatch.ticker ? ` — ${lastDispatch.ticker}` : ""}
            </span>
            <button
              onClick={() => setLastDispatch(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: "2px", display: "flex" }}
            >
              <X size={11} />
            </button>
          </div>
        )}

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
            placeholder="Should I buy NVDA? Best swing trades. What changed overnight?"
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
            <button onClick={() => { setQuery(""); setLastDispatch(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: "2px", display: "flex" }}>
              <X size={13} />
            </button>
          )}
          <button
            onClick={() => handleSubmit(query)}
            disabled={!query.trim() || isDispatching}
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
            {isDispatching ? (
              <><RotateCcw size={10} style={{ animation: "fl-spin 0.6s linear infinite" }} /> ROUTING…</>
            ) : (
              <>DISCOVER <ArrowRight size={10} /></>
            )}
          </button>
        </div>

        {/* ── Suggested questions ─────────────────────────── */}
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.14em", marginBottom: "10px" }}>
            SUGGESTED QUESTIONS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(q)}
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

        {/* ── History ─────────────────────────────────────── */}
        {history.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.14em", marginBottom: "8px" }}>
              RECENT SEARCHES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleSubmit(h)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "4px 10px", borderRadius: "3px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(100,116,139,0.6)", cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.2)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.6)"; }}
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
