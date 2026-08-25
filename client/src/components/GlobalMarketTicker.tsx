/**
 * Canonical Global Markets ticker. It consumes the single normalized
 * `markets.getGlobalSnapshot` contract used by the Markets page.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { MarketQuoteItem, GlobalSession } from "../../../server/routers/markets";

type TickerFilter = "ALL" | "US" | "EUROPE" | "ASIA" | "RATES" | "FX" | "COMMODITIES" | "CRYPTO";

const FILTERS: Array<{ id: TickerFilter; label: string; categories: MarketQuoteItem["category"][] }> = [
  { id: "ALL", label: "ALL", categories: [] },
  { id: "US", label: "US", categories: ["us_equity", "volatility"] },
  { id: "EUROPE", label: "EUROPE", categories: ["europe"] },
  { id: "ASIA", label: "ASIA", categories: ["asia"] },
  { id: "RATES", label: "RATES", categories: ["rates"] },
  { id: "FX", label: "FX", categories: ["fx"] },
  { id: "COMMODITIES", label: "COMMODITIES", categories: ["commodity"] },
  { id: "CRYPTO", label: "CRYPTO", categories: ["crypto"] },
];

const SESSION_PRIORITY: Record<GlobalSession, MarketQuoteItem["category"][]> = {
  ASIA: ["asia", "fx", "crypto", "commodity", "rates", "europe", "us_equity", "volatility"],
  EUROPE: ["europe", "fx", "rates", "commodity", "crypto", "asia", "us_equity", "volatility"],
  US: ["us_equity", "volatility", "rates", "fx", "commodity", "crypto", "europe", "asia"],
  OFF_HOURS: ["crypto", "fx", "commodity", "rates", "us_equity", "volatility", "europe", "asia"],
};

function displayPrice(item: MarketQuoteItem) {
  if (item.price == null) return "—";
  if (item.unit === "percent") return `${item.price.toFixed(2)}%`;
  if (item.unit === "bps") return `${item.price >= 0 ? "+" : ""}${item.price.toFixed(0)}bp`;
  if (item.unit === "percent_of_market") return `${item.price.toFixed(1)}%`;
  if (item.unit === "usd_trillions") return `$${item.price.toFixed(2)}T`;
  if (item.price >= 10_000) return item.price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (item.price >= 1_000) return item.price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (item.price >= 100) return item.price.toFixed(2);
  if (item.price >= 1) return item.price.toFixed(4);
  return item.price.toFixed(6);
}

function movement(item: MarketQuoteItem) {
  if (item.changePercent == null) return { text: "—", color: "#64748B" };
  const sign = item.changePercent > 0 ? "+" : "";
  return { text: `${item.changePercent > 0 ? "▲" : item.changePercent < 0 ? "▼" : "—"} ${sign}${item.changePercent.toFixed(2)}%`, color: item.changePercent > 0.05 ? "#00FF88" : item.changePercent < -0.05 ? "#FF6B6B" : "#94A3B8" };
}

function stateTone(item: MarketQuoteItem) {
  if (item.freshnessState === "STALE" || item.freshnessState === "UNAVAILABLE") return "#FFAA00";
  if (item.freshnessState === "DELAYED") return "#FACC15";
  return "#64748B";
}

function humanState(item: MarketQuoteItem) {
  if (item.freshnessState === "STALE") return "STALE";
  if (item.freshnessState === "UNAVAILABLE") return "UNAVAILABLE";
  if (item.sessionStatus === "CLOSED") return "CLOSED · LAST SESSION";
  if (item.freshnessState === "DELAYED") return `${item.sessionStatus} · DELAYED`;
  if (item.freshnessState === "LATEST_VERIFIED") return "LATEST VERIFIED";
  return item.sessionStatus;
}

function observedTime(item: MarketQuoteItem) {
  if (item.observedAt == null) return "AS OF —";
  return `AS OF ${new Date(item.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function TickerQuote({ item, onOpen }: { item: MarketQuoteItem; onOpen: () => void }) {
  const move = movement(item);
  return <button onClick={onOpen} title={`${item.label} — ${humanState(item)} — ${observedTime(item)}`} style={{ appearance: "none", textAlign: "left", border: "none", borderRight: "1px solid rgba(0,212,255,0.10)", background: "transparent", cursor: "pointer", minWidth: 150, padding: "4px 10px", color: "#F0F4FF", flexShrink: 0 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}><strong style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.05em", color: "#C8D8E8" }}>{item.shortLabel}</strong><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#F0F4FF" }}>{displayPrice(item)}</span></div>
    <div style={{ marginTop: 2, display: "flex", justifyContent: "space-between", gap: 6 }}><span style={{ color: move.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700 }}>{move.text}</span><span style={{ color: stateTone(item), fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{humanState(item)}</span></div>
    <div style={{ marginTop: 1, color: "rgba(148,163,184,0.42)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.05em" }}>{observedTime(item)}</div>
  </button>;
}

export default function GlobalMarketTicker() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<TickerFilter>("ALL");
  const query = trpc.markets.getGlobalSnapshot.useQuery(undefined, { refetchInterval: 90_000, staleTime: 60_000, retry: 2, retryDelay: attempt => Math.min(1_000 * (attempt + 1), 3_000) });
  const snapshot = query.data;
  const currentFilter = FILTERS.find(entry => entry.id === filter)!;
  const items = useMemo(() => {
    if (!snapshot) return [];
    const candidates = currentFilter.categories.length ? snapshot.items.filter(item => currentFilter.categories.includes(item.category)) : snapshot.items;
    const priority = SESSION_PRIORITY[snapshot.activeSession];
    return [...candidates].sort((left, right) => {
      const sessionOrder = priority.indexOf(left.category) - priority.indexOf(right.category);
      return sessionOrder || left.shortLabel.localeCompare(right.shortLabel);
    });
  }, [snapshot, currentFilter.categories]);

  if (!snapshot && !query.isError) return null;

  return <section aria-label="Global Markets ticker" style={{ background: "rgba(2,5,9,0.96)", borderBottom: "1px solid rgba(0,212,255,0.10)", color: "#F0F4FF" }}>
    <div style={{ height: 25, display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <button onClick={() => navigate("/app/markets")} style={{ flexShrink: 0, height: "100%", padding: "0 9px", border: "none", borderRight: "1px solid rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.05)", color: "#00D4FF", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.13em" }}>GLOBAL MARKETS</button>
      {FILTERS.map(entry => <button key={entry.id} onClick={() => setFilter(entry.id)} style={{ height: "100%", padding: "0 8px", border: "none", borderBottom: filter === entry.id ? "2px solid #00D4FF" : "2px solid transparent", background: "transparent", color: filter === entry.id ? "#E7F8FF" : "rgba(148,163,184,0.58)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.07em", flexShrink: 0 }}>{entry.label}</button>)}
      <span style={{ marginLeft: "auto", padding: "0 9px", flexShrink: 0, color: "rgba(148,163,184,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.08em" }}>{snapshot ? `${snapshot.activeSession} SESSION` : "DATA UNAVAILABLE"}</span>
    </div>
    <div style={{ display: "flex", minHeight: 53, overflowX: "auto", overscrollBehaviorX: "contain", scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" as never }}>
      {query.isError ? <div style={{ padding: "12px", color: "#FBBF24", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>MARKET DATA TEMPORARILY UNAVAILABLE — RETRYING</div> : items.map(item => <TickerQuote key={item.symbol} item={item} onOpen={() => navigate(item.destination)} />)}
    </div>
  </section>;
}
