/**
 * FAULTLINE — GlobalMarketTicker
 * A slim 24px horizontal scrolling ticker showing live market prices.
 * Placed below AppMarketHeader (FAULTLINE intelligence metrics row).
 * Calls trpc.markets.getGlobalSnapshot with 90s refetch interval.
 * Pause on hover. Click → navigate to /app/markets.
 */
import React, { useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { MarketQuoteItem } from "../../../server/routers/markets";

// Instruments to show in the ticker (ordered by importance)
const TICKER_SYMBOLS = [
  "^GSPC",    // S&P 500
  "^DJI",     // Dow Jones
  "^IXIC",    // NASDAQ
  "^RUT",     // Russell 2000
  "^VIX",     // VIX
  "DX-Y.NYB", // DXY
  "^TNX",     // 10Y Yield
  "GC=F",     // Gold
  "CL=F",     // WTI Oil
  "BTC-USD",  // Bitcoin
  "ETH-USD",  // Ethereum
  "^FTSE",    // FTSE 100
  "^GDAXI",   // DAX
  "^N225",    // Nikkei
];

function fmtTickerPrice(price: number | null, symbol: string): string {
  if (price === null) return "—";
  if (["^TNX","^FVX","^IRX","^TYX"].includes(symbol)) {
    return `${(price / 10).toFixed(2)}%`;
  }
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price >= 100) return price.toFixed(2);
  return price.toFixed(2);
}

function fmtPct(v: number | null): string {
  if (v === null) return "";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctColor(v: number | null): string {
  if (v === null) return "#6B7A8D";
  if (v > 0.05) return "#00FF88";
  if (v < -0.05) return "#FF4D6A";
  return "#6B7A8D";
}

function pctGlyph(v: number | null): string {
  if (v === null) return "";
  if (v > 0.05) return "▲";
  if (v < -0.05) return "▼";
  return "—";
}

interface TickerItemProps {
  item: MarketQuoteItem;
  onClick: () => void;
}

function TickerItem({ item, onClick }: TickerItemProps) {
  const color = pctColor(item.changePercent);
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        paddingRight: "32px",
        cursor: "pointer",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10px",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}
    >
      {/* Symbol label */}
      <span style={{ color: "#8A9AB0" }}>{item.shortLabel}</span>
      {/* Price */}
      <span style={{ color: "#C8D8E8" }}>{fmtTickerPrice(item.price, item.symbol)}</span>
      {/* Change */}
      {item.changePercent !== null && (
        <span style={{ color }}>
          {pctGlyph(item.changePercent)}{fmtPct(item.changePercent)}
        </span>
      )}
      {/* Separator */}
      <span style={{ color: "rgba(0,212,255,0.2)", paddingLeft: "8px" }}>·</span>
    </span>
  );
}

export default function GlobalMarketTicker() {
  const [, navigate] = useLocation();
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: snapshot } = trpc.markets.getGlobalSnapshot.useQuery(undefined, {
    refetchInterval: 90_000,
    staleTime: 60_000,
    retry: 2,
  });

  const items: MarketQuoteItem[] = snapshot
    ? TICKER_SYMBOLS
        .map(sym => snapshot.items.find(i => i.symbol === sym))
        .filter((i): i is MarketQuoteItem => i !== undefined)
    : [];

  // Don't render if no data yet
  if (items.length === 0) return null;

  const handleClick = () => navigate("/app/markets");

  return (
    <div
      style={{
        height: "24px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        background: "rgba(0, 0, 0, 0.35)",
        borderBottom: "1px solid rgba(0, 212, 255, 0.06)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      title="Click to open Global Markets"
    >
      {/* Left label */}
      <div style={{
        flexShrink: 0,
        padding: "0 8px",
        borderRight: "1px solid rgba(0, 212, 255, 0.1)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "8px",
        letterSpacing: "0.14em",
        color: "rgba(0, 212, 255, 0.5)",
        textTransform: "uppercase",
        height: "100%",
        display: "flex",
        alignItems: "center",
      }}>
        MARKETS
      </div>

      {/* Scrolling content */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            animation: paused ? "none" : "ticker-scroll 60s linear infinite",
            willChange: "transform",
            whiteSpace: "nowrap",
          }}
        >
          {/* Duplicate for seamless loop */}
          {[...items, ...items].map((item, idx) => (
            <TickerItem key={`${item.symbol}-${idx}`} item={item} onClick={handleClick} />
          ))}
        </div>
      </div>
    </div>
  );
}
