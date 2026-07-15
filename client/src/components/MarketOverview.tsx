/* ============================================================
   FAULTLINE — Market Overview
   Universal search, live ticker ribbon, market snapshot,
   most active / gainers / losers, trending stocks & crypto,
   watchlist preview, scrolling ticker.
   All data from existing FAULTLINE APIs — no new endpoints.
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Search, TrendingUp, TrendingDown, Minus, Activity, Star, ChevronRight, Zap } from "lucide-react";

// ── Color helpers ─────────────────────────────────────────────
function changeColor(pct: number): string {
  if (pct > 0) return "#00FF88";
  if (pct < 0) return "#FF2D55";
  return "#64748B";
}
function changeBg(pct: number): string {
  if (pct > 0) return "rgba(0,255,136,0.07)";
  if (pct < 0) return "rgba(255,45,85,0.07)";
  return "transparent";
}
function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}
function fmtPrice(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}
function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}
function fmtMktCap(v: number | null): string {
  if (!v) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ label, sub, icon }: { label: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
      {icon && <span style={{ color: "#00E5FF", opacity: 0.7 }}>{icon}</span>}
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: "#00E5FF", textTransform: "uppercase" }}>{label}</div>
        {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.45)", marginTop: "1px" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Scrolling ticker ribbon ───────────────────────────────────
function TickerRibbon({ quotes }: { quotes: Array<{ ticker: string; price: number; changePercent: number }> }) {
  const ribbonRef = useRef<HTMLDivElement>(null);
  const items = [...quotes, ...quotes]; // double for seamless loop

  return (
    <div style={{ overflow: "hidden", borderBottom: "1px solid rgba(0,229,255,0.14)", background: "rgba(0,0,0,0.3)", position: "relative" }}>
      <div
        ref={ribbonRef}
        style={{
          display: "flex",
          gap: "0",
          animation: "ticker-scroll 60s linear infinite",
          whiteSpace: "nowrap",
        }}
      >
        {items.map((q, i) => (
          <a
            key={`${q.ticker}-${i}`}
            href={`/app/symbol-intelligence?symbol=${q.ticker}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRight: "1px solid rgba(255,255,255,0.14)",
              textDecoration: "none",
              transition: "background 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.06)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: "#A8B8CC" }}>{q.ticker}</span>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "11px", color: "#E2E8F0" }}>{fmtPrice(q.price)}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: changeColor(q.changePercent) }}>{fmtPct(q.changePercent)}</span>
          </a>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ── Universal search ──────────────────────────────────────────
interface SearchResult { ticker: string; name: string; market: string; type: string; }

function UniversalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/signals/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { results?: SearchResult[] };
      setResults(data.results ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 280);
  };

  const handleSelect = (ticker: string) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    navigate(`/app/symbol-intelligence?symbol=${ticker}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
    if (e.key === "Enter" && query.trim()) {
      navigate(`/app/symbol-intelligence?symbol=${query.trim().toUpperCase()}`);
      setQuery(""); setOpen(false);
    }
  };

  return (
    <div style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(0,212,255,0.18)",
        borderRadius: "6px",
        padding: "8px 12px",
        transition: "border-color 0.15s ease",
      }}>
        <Search size={13} color="rgba(0,229,255,0.65)" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Search any ticker, stock, crypto, ETF…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            color: "#E2E8F0",
            letterSpacing: "0.05em",
          }}
        />
        {loading && (
          <div style={{ width: "10px", height: "10px", border: "1.5px solid rgba(0,229,255,0.45)", borderTopColor: "#00E5FF", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#0A0E1A",
          border: "1px solid rgba(0,212,255,0.18)",
          borderRadius: "6px",
          zIndex: 100,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {results.map(r => (
            <button
              key={r.ticker}
              onMouseDown={() => handleSelect(r.ticker)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.14)",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#00E5FF", minWidth: "52px" }}>{r.ticker}</span>
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8" }}>{r.name}</span>
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.1em", color: "rgba(100,116,139,0.5)", textTransform: "uppercase" }}>{r.type}</span>
            </button>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Market snapshot tile ──────────────────────────────────────
function SnapshotTile({ label, price, changePct, sub }: { label: string; price: string; changePct: number; sub?: string }) {
  const color = changeColor(changePct);
  return (
    <div style={{
      flex: "1 1 120px",
      padding: "10px 12px",
      background: changeBg(changePct),
      border: `1px solid ${changePct > 0 ? "rgba(0,255,136,0.12)" : changePct < 0 ? "rgba(255,45,85,0.12)" : "rgba(255,255,255,0.11)"}`,
      borderRadius: "6px",
      minWidth: "100px",
    }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.15em", color: "rgba(148,163,184,0.5)", marginBottom: "4px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#E2E8F0", lineHeight: 1, marginBottom: "3px" }}>{price}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {changePct > 0 ? <TrendingUp size={9} color={color} /> : changePct < 0 ? <TrendingDown size={9} color={color} /> : <Minus size={9} color={color} />}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color }}>{fmtPct(changePct)}</span>
      </div>
      {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

// ── Mover row ─────────────────────────────────────────────────
function MoverRow({ ticker, name, price, changePct, volume, marketCap, rank }: {
  ticker: string; name: string; price: number; changePct: number;
  volume?: number; marketCap?: number | null; rank?: number;
}) {
  const color = changeColor(changePct);
  return (
    <a
      href={`/app/symbol-intelligence?symbol=${ticker}`}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        textDecoration: "none",
        transition: "background 0.12s ease",
        gap: "8px",
        cursor: "pointer",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      {rank !== undefined && (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.35)", minWidth: "14px", textAlign: "right" }}>{rank}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.05em" }}>{ticker}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "9px", color: "rgba(148,163,184,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>{name}</div>
      </div>
      <div style={{ textAlign: "right", minWidth: "60px" }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "12px", color: "#E2E8F0" }}>{fmtPrice(price)}</div>
        {volume !== undefined && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)" }}>{fmtVol(volume)}</div>}
      </div>
      <div style={{ textAlign: "right", minWidth: "52px" }}>
        <span style={{
          display: "inline-block",
          padding: "2px 5px",
          background: changeBg(changePct),
          borderRadius: "3px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          color,
          fontWeight: 700,
        }}>{fmtPct(changePct)}</span>
        {marketCap !== undefined && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)", marginTop: "2px" }}>{fmtMktCap(marketCap ?? null)}</div>}
      </div>
    </a>
  );
}

// ── Crypto row ────────────────────────────────────────────────
function CryptoRow({ rank, symbol, name, price, changePct24h, volume, marketCap }: {
  rank: number; symbol: string; name: string; price: number; changePct24h: number;
  volume: number; marketCap: number;
}) {
  const color = changeColor(changePct24h);
  return (
    <a
      href={`/app/crypto?coin=${symbol.toLowerCase()}`}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        textDecoration: "none",
        gap: "8px",
        cursor: "pointer",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.35)", minWidth: "14px", textAlign: "right" }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.05em" }}>{symbol.toUpperCase()}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "9px", color: "rgba(148,163,184,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100px" }}>{name}</div>
      </div>
      <div style={{ textAlign: "right", minWidth: "60px" }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "12px", color: "#E2E8F0" }}>{fmtPrice(price)}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)" }}>{fmtVol(volume)}</div>
      </div>
      <div style={{ textAlign: "right", minWidth: "52px" }}>
        <span style={{
          display: "inline-block",
          padding: "2px 5px",
          background: changeBg(changePct24h),
          borderRadius: "3px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          color,
          fontWeight: 700,
        }}>{fmtPct(changePct24h)}</span>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)", marginTop: "2px" }}>{fmtMktCap(marketCap)}</div>
      </div>
    </a>
  );
}

// ── Watchlist row ─────────────────────────────────────────────
function WatchlistRow({ symbol, name, type, quote }: {
  symbol: string; name: string; type: string;
  quote?: { price: number; changePercent: number } | null;
}) {
  const href = type === "crypto" ? `/app/crypto?coin=${symbol.toLowerCase()}` : `/app/symbol-intelligence?symbol=${symbol}`;
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        textDecoration: "none",
        gap: "8px",
        cursor: "pointer",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      <Star size={9} color="rgba(255,215,0,0.4)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.05em" }}>{symbol}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "9px", color: "rgba(148,163,184,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>{name}</div>
      </div>
      {quote ? (
        <>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "12px", color: "#E2E8F0", minWidth: "60px", textAlign: "right" }}>{fmtPrice(quote.price)}</div>
          <span style={{
            display: "inline-block",
            padding: "2px 5px",
            background: changeBg(quote.changePercent),
            borderRadius: "3px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            color: changeColor(quote.changePercent),
            fontWeight: 700,
            minWidth: "52px",
            textAlign: "right",
          }}>{fmtPct(quote.changePercent)}</span>
        </>
      ) : (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.3)" }}>—</span>
      )}
    </a>
  );
}

// ── Tab selector ──────────────────────────────────────────────
function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "0", marginBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.11)" }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "5px 10px",
            background: "transparent",
            border: "none",
            borderBottom: active === t ? "2px solid #00E5FF" : "2px solid transparent",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.15em",
            color: active === t ? "#00E5FF" : "rgba(148,163,184,0.45)",
            cursor: "pointer",
            textTransform: "uppercase",
            transition: "color 0.15s ease",
            marginBottom: "-1px",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MarketOverview() {
  const { user } = useAuth();
  const [moverTab, setMoverTab] = useState<"GAINERS" | "LOSERS" | "ACTIVE">("GAINERS");

  // ── Live quotes (for ribbon + snapshot) ──────────────────────
  const [quotes, setQuotes] = useState<Array<{ ticker: string; price: number; changePercent: number }>>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/signals/quotes")
      .then(r => r.json())
      .then((data: { quotes?: Array<{ ticker: string; price: number; changePercent: number }> }) => {
        if (!cancelled && data.quotes) setQuotes(data.quotes);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Snapshot tickers (indexes + commodities) ──────────────────
  const SNAPSHOT_TICKERS = ["SPY", "QQQ", "IWM", "GLD", "XOM", "IBIT"];
  const snapshotQuotes = SNAPSHOT_TICKERS.map(t => quotes.find(q => q.ticker === t)).filter(Boolean) as Array<{ ticker: string; price: number; changePercent: number }>;

  // Snapshot label map
  const SNAPSHOT_LABELS: Record<string, string> = {
    SPY: "S&P 500", QQQ: "NASDAQ", IWM: "RUSSELL 2000",
    GLD: "GOLD", XOM: "ENERGY", IBIT: "BITCOIN ETF",
  };

  // ── Gainers / Losers / Most Active ───────────────────────────
  const gainersQ = trpc.stocks.getTopPerformers.useQuery({ limit: 10 }, { enabled: !!user, staleTime: 3 * 60_000 });
  const losersQ = trpc.stocks.getTopLosers.useQuery({ limit: 10 }, { enabled: !!user, staleTime: 3 * 60_000 });
  const activeQ = trpc.stocks.getTopByVolume.useQuery({ limit: 10 }, { enabled: !!user, staleTime: 3 * 60_000 });

  // ── Top crypto ────────────────────────────────────────────────
  const cryptoQ = trpc.crypto.getTopMarkets.useQuery({ limit: 10 }, { enabled: !!user, staleTime: 5 * 60_000 });

  // ── Watchlist ─────────────────────────────────────────────────
  const watchlistQ = trpc.mobileWatchlist.getItems.useQuery(undefined, { enabled: !!user, staleTime: 60_000 });
  const watchlistItems = watchlistQ.data ?? [];
  // Build quote map for watchlist
  const quoteMap = new Map(quotes.map(q => [q.ticker, q]));

  // ── Active mover data ─────────────────────────────────────────
  const moverData = moverTab === "GAINERS" ? (gainersQ.data ?? []) :
    moverTab === "LOSERS" ? (losersQ.data ?? []) :
    (activeQ.data ?? []);
  const moverLoading = moverTab === "GAINERS" ? gainersQ.isLoading :
    moverTab === "LOSERS" ? losersQ.isLoading :
    activeQ.isLoading;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* ── Scrolling ticker ribbon ─────────────────────────── */}
      {quotes.length > 0 && <TickerRibbon quotes={quotes} />}

      {/* ── Search + header ─────────────────────────────────── */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgba(0,212,255,0.07)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity size={13} color="#00E5FF" />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: "#00E5FF", textTransform: "uppercase" }}>Market Overview</span>
        </div>
        <UniversalSearch />
        <a
          href="/app/symbol-intelligence"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "7px 12px",
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,229,255,0.32)",
            borderRadius: "5px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.12em",
            color: "#00E5FF",
            textDecoration: "none",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,229,255,0.20)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.06)"; }}
        >
          Symbol Intel <ChevronRight size={9} />
        </a>
      </div>

      {/* ── Market snapshot ─────────────────────────────────── */}
      {snapshotQuotes.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
          <SectionHeader label="Market Snapshot" sub="Live index & commodity readings" />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {snapshotQuotes.map(q => (
              <SnapshotTile
                key={q.ticker}
                label={SNAPSHOT_LABELS[q.ticker] ?? q.ticker}
                price={fmtPrice(q.price)}
                changePct={q.changePercent}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid: movers + crypto + watchlist ──────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "0",
        borderBottom: "1px solid rgba(0,212,255,0.07)",
      }}>
        {/* Movers panel */}
        <div style={{ padding: "12px 16px", borderRight: "1px solid rgba(0,212,255,0.07)" }}>
          <SectionHeader label="Market Movers" sub="Top gainers, losers, and most active" icon={<Zap size={11} />} />
          <TabBar tabs={["GAINERS", "LOSERS", "ACTIVE"]} active={moverTab} onChange={v => setMoverTab(v as typeof moverTab)} />
          {moverLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: "34px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : moverData.length === 0 ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", padding: "20px 0", textAlign: "center" }}>
              {user ? "Loading market data…" : "Sign in to view market movers"}
            </div>
          ) : (
            moverData.slice(0, 8).map((s, i) => (
              <MoverRow
                key={s.ticker}
                ticker={s.ticker}
                name={s.name}
                price={s.price}
                changePct={s.changePercent}
                volume={s.volume}
                marketCap={s.marketCap}
                rank={i + 1}
              />
            ))
          )}
          {!user && (
            <a href="/app/account" style={{ display: "block", marginTop: "10px", padding: "8px 10px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,229,255,0.20)", borderRadius: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00E5FF", textDecoration: "none", textAlign: "center", letterSpacing: "0.1em" }}>
              SIGN IN TO VIEW MOVERS →
            </a>
          )}
        </div>

        {/* Crypto panel */}
        <div style={{ padding: "12px 16px", borderRight: "1px solid rgba(0,212,255,0.07)" }}>
          <SectionHeader label="Crypto Markets" sub="Top 10 by market cap" icon={<TrendingUp size={11} />} />
          {cryptoQ.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: "34px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : (cryptoQ.data ?? []).length === 0 ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", padding: "20px 0", textAlign: "center" }}>
              {user ? "Loading crypto data…" : "Sign in to view crypto markets"}
            </div>
          ) : (
            (cryptoQ.data ?? []).slice(0, 8).map((c, i) => (
              <CryptoRow
                key={c.id}
                rank={i + 1}
                symbol={c.symbol}
                name={c.name}
                price={c.currentPrice}
                changePct24h={c.priceChangePercent24h}
                volume={c.totalVolume}
                marketCap={c.marketCap}
              />
            ))
          )}
          <a href="/app/crypto" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "10px", padding: "7px", background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.14)", borderRadius: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,229,255,0.65)", textDecoration: "none", letterSpacing: "0.1em", transition: "all 0.15s ease" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#00E5FF"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,229,255,0.65)"; }}
          >
            FULL CRYPTO INTELLIGENCE <ChevronRight size={9} />
          </a>
        </div>

        {/* Watchlist panel */}
        <div style={{ padding: "12px 16px" }}>
          <SectionHeader label="My Watchlist" sub={watchlistItems.length > 0 ? `${watchlistItems.length} symbols tracked` : "Track your symbols"} icon={<Star size={11} />} />
          {!user ? (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", marginBottom: "10px" }}>Sign in to view your watchlist</div>
              <a href="/app/account" style={{ display: "inline-block", padding: "7px 14px", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00E5FF", textDecoration: "none", letterSpacing: "0.1em" }}>SIGN IN →</a>
            </div>
          ) : watchlistQ.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: "34px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : watchlistItems.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", marginBottom: "10px" }}>No symbols in watchlist yet</div>
              <a href="/app/watchlist" style={{ display: "inline-block", padding: "7px 14px", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00E5FF", textDecoration: "none", letterSpacing: "0.1em" }}>ADD SYMBOLS →</a>
            </div>
          ) : (
            <>
              {watchlistItems.slice(0, 8).map(item => (
                <WatchlistRow
                  key={item.id}
                  symbol={item.symbol}
                  name={item.name}
                  type={item.type}
                  quote={item.type === "stock" ? (quoteMap.get(item.symbol) ?? null) : null}
                />
              ))}
              <a href="/app/watchlist" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "10px", padding: "7px", background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.14)", borderRadius: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,229,255,0.65)", textDecoration: "none", letterSpacing: "0.1em", transition: "all 0.15s ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#00E5FF"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,229,255,0.65)"; }}
              >
                MANAGE WATCHLIST <ChevronRight size={9} />
              </a>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
