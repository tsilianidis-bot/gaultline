// ============================================================
// FAULTLINE — Stock Heatmap (Uniform Grid, Crypto-style)
// client/src/pages/StockHeatmap.tsx
//
// Tabs:
//   1. GAINERS / LOSERS  — split-screen side-by-side grids
//   2. TOP GAINERS       — uniform grid, green
//   3. TOP LOSERS        — uniform grid, red
//   4. HIGHEST VOLUME    — uniform grid, red/green by direction
//   5. 52-WEEK HIGHS     — uniform grid, gold
//   6. 52-WEEK LOWS      — uniform grid, pink
//   7. MOST VOLATILE     — uniform grid, orange
//   8. SMALL-CAP RUNNERS — uniform grid, purple
//
// Grid style matches the CryptoSearch heatmap: equal-sized cells
// in an auto-fill responsive grid, colored by % change intensity.
// ============================================================

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { PremiumGateFull } from "@/components/PremiumGate";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { TickerChip } from "@/components/TickerActionMenu";
import {
  BarChart2, RefreshCw, TrendingUp, TrendingDown, Activity,
  Filter, Volume2, Zap, ArrowUpCircle, ArrowDownCircle, Layers,
  Grid3X3,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtVol(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Types ─────────────────────────────────────────────────────

interface StockPerformer {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  sector: string | null;
  avgVolume: number | null;
}

type TabId = "split" | "gainers" | "losers" | "volume" | "highs52" | "lows52" | "volatile" | "smallcap";

// ── Sector colors ─────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  "Technology":             "#00D4FF",
  "Healthcare":             "#00FF88",
  "Financial Services":     "#FFD700",
  "Consumer Cyclical":      "#FF9500",
  "Industrials":            "#94A3B8",
  "Communication Services": "#A78BFA",
  "Energy":                 "#FF6B35",
  "Consumer Defensive":     "#34D399",
  "Real Estate":            "#F472B6",
  "Basic Materials":        "#FCD34D",
  "Utilities":              "#60A5FA",
};

function getSectorColor(sector: string | null): string {
  if (!sector) return "#374151";
  return SECTOR_COLORS[sector] ?? "#64748B";
}

// ── Tab definitions ───────────────────────────────────────────

const TABS: {
  id: TabId;
  label: string;
  shortLabel: string;
  accentColor: string;
  description: string;
  Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
}[] = [
  { id: "split",    label: "GAINERS / LOSERS",   shortLabel: "G/L",      accentColor: "#00FF88", description: "Side-by-side top gainers and top losers",         Icon: Grid3X3       },
  { id: "gainers",  label: "TOP GAINERS",         shortLabel: "GAINERS",  accentColor: "#00FF88", description: "Top 100 daily % gainers",                        Icon: TrendingUp    },
  { id: "losers",   label: "TOP LOSERS",          shortLabel: "LOSERS",   accentColor: "#FF2D55", description: "Top 100 daily % losers",                         Icon: TrendingDown  },
  { id: "volume",   label: "HIGHEST VOLUME",      shortLabel: "VOLUME",   accentColor: "#00D4FF", description: "Top 100 by volume — colored by price direction", Icon: Volume2       },
  { id: "highs52",  label: "52-WEEK HIGHS",       shortLabel: "52W HIGH", accentColor: "#FFD700", description: "Stocks at or near 52-week highs",                Icon: ArrowUpCircle },
  { id: "lows52",   label: "52-WEEK LOWS",        shortLabel: "52W LOW",  accentColor: "#F472B6", description: "Stocks at or near 52-week lows",                 Icon: ArrowDownCircle },
  { id: "volatile", label: "MOST VOLATILE",       shortLabel: "VOLATILE", accentColor: "#FF9500", description: "Highest intraday range (H-L/Open %)",            Icon: Zap           },
  { id: "smallcap", label: "SMALL-CAP RUNNERS",   shortLabel: "SM-CAP",   accentColor: "#A78BFA", description: "Small-cap gainers with strong momentum",         Icon: Activity      },
];

// ── Heat Cell (matches CryptoSearch style) ────────────────────

function HeatCell({
  stock,
  tabId,
  rank,
  isSelected,
  onClick,
}: {
  stock: StockPerformer;
  tabId: TabId;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const pct = stock.changePercent;
  const positive = pct >= 0;

  let color: string;
  let intensity: number;
  let displayValue: string;

  if (tabId === "volume") {
    color = positive ? "#00FF88" : "#FF2D55";
    intensity = Math.min(stock.volume / 5e7, 1);
    displayValue = fmtVol(stock.volume);
  } else if (tabId === "losers" || tabId === "lows52") {
    color = "#FF2D55";
    intensity = Math.min(Math.abs(pct) / 15, 1);
    displayValue = fmtPct(pct);
  } else if (tabId === "highs52") {
    color = "#FFD700";
    intensity = Math.min(Math.abs(pct) / 15, 1);
    displayValue = fmtPct(pct);
  } else if (tabId === "volatile") {
    color = "#FF9500";
    intensity = Math.min(Math.abs(pct) / 15, 1);
    displayValue = fmtPct(pct);
  } else if (tabId === "smallcap") {
    color = "#A78BFA";
    intensity = Math.min(Math.abs(pct) / 15, 1);
    displayValue = fmtPct(pct);
  } else {
    // gainers, split
    color = positive ? "#00FF88" : "#FF2D55";
    intensity = Math.min(Math.abs(pct) / 15, 1);
    displayValue = fmtPct(pct);
  }

  const alpha = Math.round(intensity * 200).toString(16).padStart(2, "0");

  return (
    <div
      onClick={onClick}
      title={`${stock.name} (${stock.ticker})\n${fmtPct(pct)} | $${stock.price.toFixed(2)}\nVol: ${fmtVol(stock.volume)}\nMkt Cap: ${fmt(stock.marketCap)}${stock.sector ? `\nSector: ${stock.sector}` : ""}`}
      style={{
        background: `${color}${alpha}`,
        border: `1px solid ${isSelected ? color : color + "30"}`,
        borderRadius: "4px",
        padding: "6px 4px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: isSelected ? `0 0 0 2px ${color}` : "none",
        outline: "none",
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B", marginBottom: "1px" }}>#{rank}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "11px", color: "#F0F4FF", lineHeight: 1.1 }}>{stock.ticker}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color, fontWeight: 600, lineHeight: 1.2 }}>{displayValue}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", marginTop: "1px" }}>${stock.price.toFixed(2)}</div>
    </div>
  );
}

// ── Uniform Grid ──────────────────────────────────────────────

function HeatGrid({
  data,
  tabId,
  sectorFilter,
  sortBy,
}: {
  data: StockPerformer[];
  tabId: TabId;
  sectorFilter: string;
  sortBy: "default" | "volume" | "marketCap";
}) {
  const [selectedStock, setSelectedStock] = useState<{ stock: StockPerformer; rank: number } | null>(null);

  const filtered = useMemo(() => {
    let list = sectorFilter === "ALL" ? data : data.filter(p => p.sector === sectorFilter);
    if (sortBy === "volume") list = [...list].sort((a, b) => b.volume - a.volume);
    else if (sortBy === "marketCap") list = [...list].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    return list;
  }, [data, sectorFilter, sortBy]);

  return (
    <>
      {selectedStock && (
        <DetailPanel
          stock={selectedStock.stock}
          rank={selectedStock.rank}
          tabId={tabId}
          onClose={() => setSelectedStock(null)}
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: "4px" }}>
        {filtered.map((stock, i) => (
          <HeatCell
            key={stock.ticker}
            stock={stock}
            tabId={tabId}
            rank={i + 1}
            isSelected={selectedStock?.stock.ticker === stock.ticker}
            onClick={() => setSelectedStock(
              selectedStock?.stock.ticker === stock.ticker ? null : { stock, rank: i + 1 }
            )}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151" }}>
            No data matches the current filter.
          </div>
        )}
      </div>
      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", margin: "8px 0 0", textAlign: "right" }}>
        Click any cell for detail · {filtered.length} stocks shown
      </p>
    </>
  );
}

// ── Sector Heatmap Sub-View ───────────────────────────────────

function SectorHeatmap({ data, tabId }: { data: StockPerformer[]; tabId: TabId }) {
  const sectorGroups = useMemo(() => {
    const map = new Map<string, StockPerformer[]>();
    for (const s of data) {
      const key = s.sector ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const result: {
      sector: string; count: number; avgPct: number;
      totalVol: number; topTicker: string; color: string;
    }[] = [];
    map.forEach((stocks, sector) => {
      const avgPct = stocks.reduce((s, p) => s + p.changePercent, 0) / stocks.length;
      const totalVol = stocks.reduce((s, p) => s + p.volume, 0);
      const top = [...stocks].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];
      result.push({ sector, count: stocks.length, avgPct, totalVol, topTicker: top.ticker, color: getSectorColor(sector) });
    });
    if (tabId === "losers" || tabId === "lows52") return result.sort((a, b) => a.avgPct - b.avgPct);
    if (tabId === "volume") return result.sort((a, b) => b.totalVol - a.totalVol);
    return result.sort((a, b) => b.avgPct - a.avgPct);
  }, [data, tabId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" }}>
      {sectorGroups.map(g => {
        const isPos = g.avgPct >= 0;
        const baseColor = tabId === "volume" ? "#00D4FF" : isPos ? "#00FF88" : "#FF2D55";
        const intensity = tabId === "volume" ? Math.min(g.totalVol / 5e8, 1) : Math.min(Math.abs(g.avgPct) / 10, 1);
        const alpha = Math.max(0x18, Math.round(intensity * 0xCC)).toString(16).padStart(2, "0");
        return (
          <div
            key={g.sector}
            title={`${g.sector}\n${g.count} stocks\nAvg: ${fmtPct(g.avgPct)}\nTotal Vol: ${fmtVol(g.totalVol)}\nTop: ${g.topTicker}`}
            style={{ background: `${baseColor}${alpha}`, border: `1px solid ${baseColor}40`, borderLeft: `3px solid ${g.color}`, borderRadius: "4px", padding: "10px 10px 8px" }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: g.color, letterSpacing: "0.08em", marginBottom: "4px" }}>
              {g.sector}
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: baseColor }}>
              {tabId === "volume" ? fmtVol(g.totalVol) : fmtPct(g.avgPct)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B" }}>{g.count} stocks</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B" }}>Top: {g.topTicker}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────

function DetailPanel({ stock, rank, tabId, onClose }: { stock: StockPerformer; rank: number; tabId: TabId; onClose: () => void }) {
  const pct = stock.changePercent;
  const tab = TABS.find(t => t.id === tabId)!;
  const color = (tabId === "volume" || tabId === "split") ? (pct >= 0 ? "#00FF88" : "#FF2D55") : tab.accentColor;

  return (
    <div style={{ background: "rgba(8,10,16,0.99)", border: `1px solid ${color}35`, borderLeft: `3px solid ${color}`, borderRadius: "6px", padding: "16px", marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.15em", marginBottom: "4px" }}>RANK #{rank} — {tab.label}</div>
          <TickerChip ticker={stock.ticker} name={stock.name} />
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color }}>
            {tabId === "volume" ? fmtVol(stock.volume) : fmtPct(pct)}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8" }}>${stock.price.toFixed(2)}</div>
          <button onClick={onClose} style={{ marginTop: "6px", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "3px 10px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B", letterSpacing: "0.1em" }}>CLOSE ✕</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
        {[
          { label: "Change %",   value: fmtPct(pct),                                                                                          color: pct >= 0 ? "#00FF88" : "#FF2D55" },
          { label: "Change $",   value: `${stock.change >= 0 ? "+" : ""}$${stock.change.toFixed(2)}`,                                         color: pct >= 0 ? "#00FF88" : "#FF2D55" },
          { label: "Volume",     value: fmtVol(stock.volume),                                                                                  color: "#00D4FF" },
          { label: "Avg Volume", value: fmtVol(stock.avgVolume),                                                                               color: "#64748B" },
          { label: "Market Cap", value: fmt(stock.marketCap),                                                                                  color: "#94A3B8" },
          { label: "Sector",     value: stock.sector ?? "—",                                                                                   color: getSectorColor(stock.sector) },
          { label: "Vol / Avg",  value: stock.avgVolume && stock.volume ? `${(stock.volume / stock.avgVolume).toFixed(1)}x` : "—",             color: stock.avgVolume && stock.volume && stock.volume > stock.avgVolume * 2 ? "#FF9500" : "#64748B" },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.12em", marginBottom: "3px" }}>{label.toUpperCase()}</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: c }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Split Gainers/Losers View ─────────────────────────────────

function SplitView({
  gainers,
  losers,
  sectorFilter,
  sortBy,
}: {
  gainers: StockPerformer[];
  losers: StockPerformer[];
  sectorFilter: string;
  sortBy: "default" | "volume" | "marketCap";
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          <TrendingUp size={11} style={{ color: "#00FF88" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", letterSpacing: "0.1em" }}>TOP GAINERS</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", marginLeft: "auto" }}>{gainers.length} stocks</span>
        </div>
        <HeatGrid data={gainers} tabId="gainers" sectorFilter={sectorFilter} sortBy={sortBy} />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          <TrendingDown size={11} style={{ color: "#FF2D55" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55", letterSpacing: "0.1em" }}>TOP LOSERS</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", marginLeft: "auto" }}>{losers.length} stocks</span>
        </div>
        <HeatGrid data={losers} tabId="losers" sectorFilter={sectorFilter} sortBy={sortBy} />
      </div>
    </div>
  );
}

// ── Cross-Tab Comparison Strip ────────────────────────────────

function CrossTabStrip({ gainers, losers, volume }: { gainers?: StockPerformer[]; losers?: StockPerformer[]; volume?: StockPerformer[] }) {
  const topGainer = gainers?.[0];
  const topLoser  = losers?.[0];
  const topVol    = volume?.[0];
  if (!topGainer && !topLoser && !topVol) return null;

  const items = [
    topGainer && { label: "TOP GAINER", ticker: topGainer.ticker, value: fmtPct(topGainer.changePercent), sub: `$${topGainer.price.toFixed(2)}`, color: "#00FF88" },
    topLoser  && { label: "TOP LOSER",  ticker: topLoser.ticker,  value: fmtPct(topLoser.changePercent),  sub: `$${topLoser.price.toFixed(2)}`,  color: "#FF2D55" },
    topVol    && { label: "TOP VOLUME", ticker: topVol.ticker,    value: fmtVol(topVol.volume),           sub: `${topVol.changePercent >= 0 ? "+" : ""}${topVol.changePercent.toFixed(2)}%`, color: topVol.changePercent >= 0 ? "#00FF88" : "#FF2D55" },
  ].filter(Boolean) as { label: string; ticker: string; value: string; sub: string; color: string }[];

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: "6px", marginBottom: "12px" }}>
      {items.map(item => (
        <div key={item.label} title={`${item.label}: ${item.ticker} — ${item.value}`} style={{ background: `${item.color}08`, border: `1px solid ${item.color}25`, borderRadius: "5px", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.12em", marginBottom: "2px" }}>{item.label}</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#F0F4FF" }}>{item.ticker}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: item.color }}>{item.value}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B" }}>{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Auto-Refresh Countdown ────────────────────────────────────

function RefreshCountdown({ onRefresh, isFetching, accentColor, cacheSecs }: { onRefresh: () => void; isFetching: boolean; accentColor: string; cacheSecs: number }) {
  const [secsLeft, setSecsLeft] = useState(cacheSecs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) { onRefresh(); return cacheSecs; }
        return s - 1;
      });
    }, 1000);
  }, [onRefresh, cacheSecs]);

  useEffect(() => { setSecsLeft(cacheSecs); startTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [cacheSecs, startTimer]);
  useEffect(() => { if (isFetching) setSecsLeft(cacheSecs); }, [isFetching, cacheSecs]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span title="Data is cached server-side for 3 minutes. Countdown shows time until next auto-refresh." style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: secsLeft <= 30 ? "#FF9500" : "#374151", letterSpacing: "0.08em", cursor: "help" }}>
        {isFetching ? "REFRESHING…" : `REFRESHES IN ${fmtSeconds(secsLeft)}`}
      </span>
      <button
        onClick={() => { onRefresh(); setSecsLeft(cacheSecs); }}
        disabled={isFetching}
        style={{ display: "flex", alignItems: "center", gap: "6px", background: `${accentColor}08`, border: `1px solid ${accentColor}30`, borderRadius: "6px", padding: "7px 13px", cursor: isFetching ? "default" : "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: isFetching ? "#374151" : accentColor, letterSpacing: "0.1em", transition: "all 0.15s ease" }}
      >
        <RefreshCw size={11} style={{ animation: isFetching ? "spin 0.8s linear infinite" : "none" }} />
        REFRESH
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

function StockHeatmapInner() {
  const [activeTab, setActiveTab] = useState<TabId>("split");
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"default" | "volume" | "marketCap">("default");
  const [viewMode, setViewMode] = useState<"grid" | "sector">("grid");

  const CACHE_SECS = 180;

  const gainersQuery  = trpc.stocks.getTopPerformers.useQuery({ limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false });
  const losersQuery   = trpc.stocks.getTopLosers.useQuery(    { limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false });
  const volumeQuery   = trpc.stocks.getTopByVolume.useQuery(  { limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false });
  const highs52Query  = trpc.stocks.getNear52WeekHigh.useQuery({ limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false, enabled: activeTab === "highs52" });
  const lows52Query   = trpc.stocks.getNear52WeekLow.useQuery( { limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false, enabled: activeTab === "lows52"  });
  const volatileQuery = trpc.stocks.getMostVolatile.useQuery(  { limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false, enabled: activeTab === "volatile" });
  const smallcapQuery = trpc.stocks.getSmallCapRunners.useQuery({ limit: 100 }, { staleTime: CACHE_SECS * 1000, refetchOnWindowFocus: false, enabled: activeTab === "smallcap" });

  const queryMap: Record<TabId, typeof gainersQuery> = {
    split:    gainersQuery,
    gainers:  gainersQuery,
    losers:   losersQuery,
    volume:   volumeQuery,
    highs52:  highs52Query,
    lows52:   lows52Query,
    volatile: volatileQuery,
    smallcap: smallcapQuery,
  };

  const activeQuery = queryMap[activeTab];
  const activeData  = activeQuery.data ?? [];
  const accentColor = TABS.find(t => t.id === activeTab)!.accentColor;

  const sectors = useMemo(() => {
    const allData = activeTab === "split"
      ? [...(gainersQuery.data ?? []), ...(losersQuery.data ?? [])]
      : activeData;
    const s = new Set(allData.map(p => p.sector).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [activeData, activeTab, gainersQuery.data, losersQuery.data]);

  function refetchAll() {
    gainersQuery.refetch(); losersQuery.refetch(); volumeQuery.refetch();
    if (activeTab === "highs52")  highs52Query.refetch();
    if (activeTab === "lows52")   lows52Query.refetch();
    if (activeTab === "volatile") volatileQuery.refetch();
    if (activeTab === "smallcap") smallcapQuery.refetch();
  }

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    setSectorFilter("ALL");
    setSortBy("default");
    setViewMode("grid");
  }

  const isFetching = activeQuery.isFetching || (activeTab === "split" && losersQuery.isFetching);
  const isLoading  = activeQuery.isLoading  || (activeTab === "split" && losersQuery.isLoading);

  return (
    <div style={{ background: "#050608", minHeight: "100vh", color: "#F0F4FF", fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(160deg, #070910 0%, #0A0D14 50%, #050608 100%)", borderBottom: `1px solid ${accentColor}20`, padding: "20px 16px 16px", position: "relative", overflow: "hidden", transition: "border-color 0.3s ease" }}>
        <div style={{ position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)", width: "500px", height: "200px", background: `radial-gradient(ellipse, ${accentColor}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <BarChart2 size={16} style={{ color: accentColor }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.2em" }}>EQUITY INTELLIGENCE TERMINAL</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "clamp(22px, 5vw, 32px)", color: "#F0F4FF", letterSpacing: "0.04em", lineHeight: 1.1, margin: "0 0 4px" }}>Stock Heatmap</h1>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
                {TABS.find(t => t.id === activeTab)!.description} · 15-min delayed data.
              </p>
            </div>
            <RefreshCountdown onRefresh={refetchAll} isFetching={isFetching} accentColor={accentColor} cacheSecs={CACHE_SECS} />
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "14px 16px 40px" }}>

        {/* Cross-tab strip */}
        <CrossTabStrip gainers={gainersQuery.data} losers={losersQuery.data} volume={volumeQuery.data} />

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            const TabIcon = tab.Icon;
            return (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)} title={tab.description} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.08em", padding: "10px 12px", borderRadius: "4px 4px 0 0", border: "1px solid transparent", borderBottom: isActive ? `2px solid ${tab.accentColor}` : "2px solid transparent", background: isActive ? `${tab.accentColor}0C` : "transparent", color: isActive ? tab.accentColor : "#4B5563", cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap", flexShrink: 0 }}>
                <TabIcon size={10} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
          {/* View mode (not for split) */}
          {activeTab !== "split" && (
            <div style={{ display: "flex", gap: "4px" }}>
              {([
                { key: "grid"   as const, label: "GRID",   icon: <BarChart2 size={9} /> },
                { key: "sector" as const, label: "SECTOR", icon: <Layers size={9} />    },
              ]).map(({ key, label, icon }) => (
                <button key={key} onClick={() => setViewMode(key)} title={key === "grid" ? "Uniform grid view" : "Grouped sector view"} style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: "3px", border: `1px solid ${viewMode === key ? accentColor : "rgba(255,255,255,0.08)"}`, background: viewMode === key ? `${accentColor}18` : "transparent", color: viewMode === key ? accentColor : "#4B5563", cursor: "pointer", transition: "all 0.15s ease" }}>
                  {icon}{label}
                </button>
              ))}
            </div>
          )}

          {/* Sector filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <Filter size={10} style={{ color: "#374151" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.1em" }}>SECTOR:</span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {["ALL", ...sectors].map(s => (
                <button key={s} onClick={() => setSectorFilter(s)} title={s === "ALL" ? "Show all sectors" : s} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", padding: "3px 8px", borderRadius: "3px", border: `1px solid ${sectorFilter === s ? getSectorColor(s === "ALL" ? null : s) : "rgba(255,255,255,0.08)"}`, background: sectorFilter === s ? `${getSectorColor(s === "ALL" ? null : s)}18` : "transparent", color: sectorFilter === s ? getSectorColor(s === "ALL" ? null : s) : "#4B5563", cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.15s ease" }}>
                  {s === "ALL" ? "ALL" : s.split(" ").map(w => w[0]).join("")}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.1em" }}>SORT:</span>
            {([
              { key: "default"   as const, label: "DEFAULT"  },
              { key: "volume"    as const, label: "VOLUME"   },
              { key: "marketCap" as const, label: "MKT CAP"  },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key)} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", padding: "3px 8px", borderRadius: "3px", border: `1px solid ${sortBy === key ? accentColor : "rgba(255,255,255,0.08)"}`, background: sortBy === key ? `${accentColor}18` : "transparent", color: sortBy === key ? accentColor : "#4B5563", cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.15s ease" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div style={{ background: "rgba(10,12,18,0.98)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "14px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <BarChart2 size={12} style={{ color: accentColor }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.15em" }}>
              STOCK HEATMAP — {TABS.find(t => t.id === activeTab)!.label}
              {viewMode === "sector" && " · SECTOR VIEW"}
            </span>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "12px" }}>
              <div style={{ width: "20px", height: "20px", border: `2px solid ${accentColor}30`, borderTopColor: accentColor, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151", letterSpacing: "0.12em", margin: 0 }}>LOADING DATA…</p>
            </div>
          ) : activeQuery.error ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Activity size={20} style={{ color: "#FF2D55", marginBottom: "8px" }} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", margin: "0 0 6px" }}>SCREENER UNAVAILABLE</p>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#4B5563", margin: 0 }}>Yahoo Finance screener is temporarily unavailable. Try refreshing.</p>
            </div>
          ) : activeTab === "split" ? (
            <SplitView gainers={gainersQuery.data ?? []} losers={losersQuery.data ?? []} sectorFilter={sectorFilter} sortBy={sortBy} />
          ) : viewMode === "sector" ? (
            <SectorHeatmap data={activeData} tabId={activeTab} />
          ) : (
            <HeatGrid data={activeData} tabId={activeTab} sectorFilter={sectorFilter} sortBy={sortBy} />
          )}
        </div>

        <DisclaimerBanner variant="compact" />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 640px) { .hidden.sm\\:inline { display: inline !important; } .sm\\:hidden { display: none !important; } }
        @media (max-width: 639px) { .hidden.sm\\:inline { display: none !important; } .sm\\:hidden { display: inline !important; } }
      `}</style>
    </div>
  );
}

export default function StockHeatmap() {
  return (
    <PremiumGateFull variant="signals">
      <StockHeatmapInner />
    </PremiumGateFull>
  );
}
