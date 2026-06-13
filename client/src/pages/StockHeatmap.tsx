// ============================================================
// FAULTLINE — Stock Heatmap
// client/src/pages/StockHeatmap.tsx
//
// Top 100 daily stock performers (gainers) visualized as a
// color-coded heatmap. Data from Yahoo Finance screener with
// Polygon.io fallback. Refreshes every 3 minutes.
// ============================================================

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { PremiumGateFull } from "@/components/PremiumGate";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { BarChart2, RefreshCw, TrendingUp, Activity, Filter } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number | null, decimals = 2): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
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

// ── HeatCell ─────────────────────────────────────────────────

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

function HeatCell({
  stock,
  rank,
  size,
  onClick,
}: {
  stock: StockPerformer;
  rank: number;
  size: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = stock.changePercent;
  const intensity = Math.min(Math.abs(pct) / 20, 1);
  const color = pct >= 0 ? "#00FF88" : "#FF2D55";
  const alpha = Math.round(intensity * 220).toString(16).padStart(2, "0");

  const padding = size === "lg" ? "10px 8px" : size === "md" ? "8px 6px" : "6px 4px";
  const symSize = size === "lg" ? "13px" : size === "md" ? "11px" : "9px";
  const pctSize = size === "lg" ? "11px" : size === "md" ? "10px" : "9px";
  const priceSize = size === "lg" ? "9px" : "8px";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${stock.name}\n${fmtPct(pct)} | $${stock.price.toFixed(2)}\nVol: ${fmtVol(stock.volume)}${stock.sector ? `\nSector: ${stock.sector}` : ""}${stock.marketCap ? `\nMkt Cap: ${fmt(stock.marketCap)}` : ""}`}
      style={{
        background: hovered ? `${color}${alpha}` : `${color}${alpha}`,
        border: `1px solid ${hovered ? color : color + "40"}`,
        borderRadius: "4px",
        padding,
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.15s ease",
        transform: hovered ? "scale(1.04)" : "scale(1)",
        boxShadow: hovered ? `0 0 12px ${color}40` : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#94A3B8", marginBottom: "1px" }}>#{rank}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: symSize, color: "#F0F4FF", letterSpacing: "0.03em" }}>{stock.ticker}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: pctSize, color, fontWeight: 600 }}>{fmtPct(pct)}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: priceSize, color: "#64748B", marginTop: "1px" }}>${stock.price.toFixed(stock.price < 10 ? 2 : 2)}</div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────

function DetailPanel({ stock, rank, onClose }: { stock: StockPerformer; rank: number; onClose: () => void }) {
  const pct = stock.changePercent;
  const color = pct >= 0 ? "#00FF88" : "#FF2D55";

  return (
    <div style={{
      background: "rgba(8,10,16,0.99)",
      border: `1px solid ${color}35`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "6px",
      padding: "16px",
      marginBottom: "14px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.15em", marginBottom: "4px" }}>
            RANK #{rank} — DAILY PERFORMER
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "22px", color: "#F0F4FF", letterSpacing: "0.04em" }}>
            {stock.ticker}
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
            {stock.name}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color }}>
            {fmtPct(pct)}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8" }}>
            ${stock.price.toFixed(2)}
          </div>
          <button
            onClick={onClose}
            style={{ marginTop: "6px", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "3px 10px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B", letterSpacing: "0.1em" }}
          >
            CLOSE
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
        {[
          { label: "Change", value: `${stock.change >= 0 ? "+" : ""}$${stock.change.toFixed(2)}`, color },
          { label: "Volume", value: fmtVol(stock.volume), color: "#00D4FF" },
          { label: "Avg Volume", value: fmtVol(stock.avgVolume), color: "#64748B" },
          { label: "Market Cap", value: fmt(stock.marketCap), color: "#94A3B8" },
          { label: "Sector", value: stock.sector ?? "—", color: "#94A3B8" },
          { label: "Vol / Avg", value: stock.avgVolume && stock.volume ? `${(stock.volume / stock.avgVolume).toFixed(1)}x` : "—", color: stock.avgVolume && stock.volume && stock.volume > stock.avgVolume * 2 ? "#FF9500" : "#64748B" },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.12em", marginBottom: "3px" }}>{label.toUpperCase()}</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: c }}>{value}</div>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", margin: "12px 0 0", lineHeight: 1.6 }}>
        DATA SOURCE: YAHOO FINANCE SCREENER (15-MIN DELAYED) · NOT FINANCIAL ADVICE · PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS
      </p>
    </div>
  );
}

// ── Sector Filter ─────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  "Technology":            "#00D4FF",
  "Healthcare":            "#00FF88",
  "Financial Services":    "#FFD700",
  "Consumer Cyclical":     "#FF9500",
  "Industrials":           "#94A3B8",
  "Communication Services":"#A78BFA",
  "Energy":                "#FF6B35",
  "Consumer Defensive":    "#34D399",
  "Real Estate":           "#F472B6",
  "Basic Materials":       "#FCD34D",
  "Utilities":             "#60A5FA",
};

function getSectorColor(sector: string | null): string {
  if (!sector) return "#374151";
  return SECTOR_COLORS[sector] ?? "#64748B";
}

// ── Main Component ────────────────────────────────────────────

function StockHeatmapInner() {
  const [selectedStock, setSelectedStock] = useState<{ stock: StockPerformer; rank: number } | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"change" | "volume" | "marketCap">("change");

  const { data: performers, isLoading, error, refetch, isFetching } = trpc.stocks.getTopPerformers.useQuery(
    { limit: 100 },
    { staleTime: 3 * 60_000, refetchOnWindowFocus: false }
  );

  // Derive unique sectors
  const sectors = useMemo(() => {
    if (!performers) return [];
    const s = new Set(performers.map(p => p.sector).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [performers]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!performers) return [];
    let list = sectorFilter === "ALL" ? performers : performers.filter(p => p.sector === sectorFilter);
    if (sortBy === "volume") list = [...list].sort((a, b) => b.volume - a.volume);
    else if (sortBy === "marketCap") list = [...list].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    // default: already sorted by changePercent desc from server
    return list;
  }, [performers, sectorFilter, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const avg = filtered.reduce((s, p) => s + p.changePercent, 0) / filtered.length;
    const top = filtered[0];
    const totalVol = filtered.reduce((s, p) => s + p.volume, 0);
    return { avg, top, totalVol };
  }, [filtered]);

  // Determine cell size based on count
  const cellSize: "sm" | "md" | "lg" = filtered.length > 60 ? "sm" : filtered.length > 30 ? "md" : "lg";

  return (
    <div style={{ background: "#050608", minHeight: "100vh", color: "#F0F4FF", fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(160deg, #070910 0%, #0A0D14 50%, #050608 100%)",
        borderBottom: "1px solid rgba(0,255,136,0.15)",
        padding: "20px 16px 16px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)", width: "500px", height: "200px", background: "radial-gradient(ellipse, rgba(0,255,136,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <TrendingUp size={16} style={{ color: "#00FF88" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.2em" }}>EQUITY INTELLIGENCE TERMINAL</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "clamp(22px, 5vw, 32px)", color: "#F0F4FF", letterSpacing: "0.04em", lineHeight: 1.1, margin: "0 0 4px" }}>
                Stock Heatmap
              </h1>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
                Top 100 daily performers ranked by gain. 15-minute delayed data from Yahoo Finance.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(0,255,136,0.06)",
                border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: "6px",
                padding: "8px 14px",
                cursor: isFetching ? "default" : "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: isFetching ? "#374151" : "#00FF88",
                letterSpacing: "0.1em",
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw size={11} style={{ animation: isFetching ? "spin 0.8s linear infinite" : "none" }} />
              {isFetching ? "REFRESHING…" : "REFRESH"}
            </button>
          </div>

          {/* Summary stats */}
          {stats && (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "14px" }}>
              {[
                { label: "Showing",       value: `${filtered.length} stocks`,           color: "#00D4FF" },
                { label: "Avg Gain",      value: fmtPct(stats.avg),                     color: stats.avg >= 0 ? "#00FF88" : "#FF2D55" },
                { label: "Top Gainer",    value: `${stats.top.ticker} ${fmtPct(stats.top.changePercent)}`, color: "#00FF88" },
                { label: "Total Volume",  value: fmtVol(stats.totalVol),                color: "#94A3B8" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.1em" }}>{label.toUpperCase()}</span>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "14px 16px 40px" }}>

        {/* Detail panel */}
        {selectedStock && (
          <DetailPanel
            stock={selectedStock.stock}
            rank={selectedStock.rank}
            onClose={() => setSelectedStock(null)}
          />
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
          {/* Sector filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Filter size={10} style={{ color: "#374151" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.1em" }}>SECTOR:</span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {["ALL", ...sectors].map(s => (
                <button
                  key={s}
                  onClick={() => setSectorFilter(s)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "8px",
                    padding: "3px 8px",
                    borderRadius: "3px",
                    border: `1px solid ${sectorFilter === s ? getSectorColor(s === "ALL" ? null : s) : "rgba(255,255,255,0.08)"}`,
                    background: sectorFilter === s ? `${getSectorColor(s === "ALL" ? null : s)}18` : "transparent",
                    color: sectorFilter === s ? getSectorColor(s === "ALL" ? null : s) : "#4B5563",
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                    transition: "all 0.15s ease",
                  }}
                >
                  {s === "ALL" ? "ALL" : s.split(" ").map(w => w[0]).join("")}
                </button>
              ))}
            </div>
          </div>

          {/* Sort control */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.1em" }}>SORT:</span>
            {[
              { key: "change" as const,    label: "% GAIN" },
              { key: "volume" as const,    label: "VOLUME" },
              { key: "marketCap" as const, label: "MKT CAP" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "8px",
                  padding: "3px 8px",
                  borderRadius: "3px",
                  border: `1px solid ${sortBy === key ? "#00D4FF" : "rgba(255,255,255,0.08)"}`,
                  background: sortBy === key ? "rgba(0,212,255,0.1)" : "transparent",
                  color: sortBy === key ? "#00D4FF" : "#4B5563",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Heatmap grid */}
        <div style={{ background: "rgba(10,12,18,0.98)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "14px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <BarChart2 size={12} style={{ color: "#00FF88" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.15em" }}>
              STOCK HEATMAP — TOP 100 DAILY PERFORMERS
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", marginLeft: "auto" }}>
              15-MIN DELAYED · CLICK CELL FOR DETAIL
            </span>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: "12px" }}>
              <div style={{ width: "20px", height: "20px", border: "2px solid rgba(0,255,136,0.2)", borderTopColor: "#00FF88", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151", letterSpacing: "0.12em", margin: 0 }}>LOADING TOP PERFORMERS…</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "30px 20px" }}>
              <Activity size={20} style={{ color: "#FF2D55", marginBottom: "8px" }} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", margin: "0 0 6px" }}>SCREENER UNAVAILABLE</p>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#4B5563", margin: 0 }}>Yahoo Finance screener is temporarily unavailable. Try refreshing.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151", textAlign: "center", padding: "20px 0" }}>
              No performers match the current filter.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${cellSize === "lg" ? "90px" : cellSize === "md" ? "76px" : "64px"}, 1fr))`, gap: "4px" }}>
              {filtered.map((stock, i) => (
                <HeatCell
                  key={stock.ticker}
                  stock={stock}
                  rank={i + 1}
                  size={cellSize}
                  onClick={() => setSelectedStock(selectedStock?.stock.ticker === stock.ticker ? null : { stock, rank: i + 1 })}
                />
              ))}
            </div>
          )}

          {/* Sector legend */}
          {performers && sectors.length > 0 && (
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#1F2937", letterSpacing: "0.12em", marginBottom: "6px" }}>SECTOR LEGEND</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {sectors.map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "1px", background: getSectorColor(s) }} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.06em" }}>
                      {s.split(" ").map(w => w[0]).join("")} = {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Color scale legend */}
        <div style={{ background: "rgba(10,12,18,0.98)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "12px 14px", marginBottom: "14px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.12em", marginBottom: "8px" }}>COLOR SCALE — DAILY CHANGE %</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {[
              { pct: "+20%+", color: "#00FF88", alpha: "FF" },
              { pct: "+10%",  color: "#00FF88", alpha: "BB" },
              { pct: "+5%",   color: "#00FF88", alpha: "77" },
              { pct: "+2%",   color: "#00FF88", alpha: "44" },
              { pct: "0%",    color: "#374151", alpha: "FF" },
              { pct: "-2%",   color: "#FF2D55", alpha: "44" },
              { pct: "-5%",   color: "#FF2D55", alpha: "77" },
              { pct: "-10%",  color: "#FF2D55", alpha: "BB" },
              { pct: "-20%+", color: "#FF2D55", alpha: "FF" },
            ].map(({ pct, color, alpha }) => (
              <div key={pct} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                <div style={{ width: "28px", height: "16px", borderRadius: "2px", background: `${color}${alpha}`, border: `1px solid ${color}30` }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151" }}>{pct}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <DisclaimerBanner variant="compact" />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function StockHeatmap() {
  return (
    <PremiumGateFull variant="signals">
      <StockHeatmapInner />
    </PremiumGateFull>
  );
}
