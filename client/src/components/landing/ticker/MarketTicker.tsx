/**
 * Landing market ticker.
 *
 * Placement and styling restore the original landing status ticker
 * (a full-width strip above the navigation: 10px IBM Plex Mono, cyan
 * rules, edge fades, seamless marquee). Symbols and item styling restore
 * the original GlobalMarketTicker (02ec5d4). Data comes from the existing
 * public markets.getGlobalSnapshot contract; every quote shows its own
 * delayed / last-close / stale / unavailable state, and no price is ever
 * shown without a source value. With reduced motion the strip is static
 * and horizontally scrollable.
 */
import React from "react";
import { trpc } from "@/lib/trpc";
import { buildTickerView, type TickerQuoteView } from "./tickerModel";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const DIRECTION_COLOR = { up: "#00FF88", down: "#FF4D6A", flat: "#6B7A8D" } as const;
const STATE_COLOR = { live: "#6B7A8D", delayed: "#FACC15", closed: "#8A9AB0", stale: "#FFAA00", unavailable: "#FFAA00" } as const;

function Quote({ quote, duplicate }: { quote: TickerQuoteView; duplicate?: boolean }) {
  return (
    <li
      data-ticker-symbol={duplicate ? undefined : quote.symbol}
      data-ticker-state={quote.state}
      aria-hidden={duplicate ? true : undefined}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap pr-8"
      style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em" }}
    >
      <span style={{ color: "#8A9AB0" }}>{quote.label}</span>
      <span style={{ color: "#C8D8E8" }}>{quote.price ?? "—"}</span>
      {quote.change && quote.direction && (
        <span style={{ color: DIRECTION_COLOR[quote.direction] }}>
          {quote.direction === "up" ? "▲" : quote.direction === "down" ? "▼" : ""}{quote.change}
        </span>
      )}
      {quote.stateLabel && (
        <span style={{ color: STATE_COLOR[quote.state], fontSize: 8, letterSpacing: "0.08em" }}>{quote.stateLabel}</span>
      )}
      <span aria-hidden="true" style={{ color: "rgba(0,212,255,0.2)", paddingLeft: 8 }}>·</span>
    </li>
  );
}

function asOf(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

export default function MarketTicker() {
  const query = trpc.markets.getGlobalSnapshot.useQuery(undefined, {
    refetchInterval: 90_000,
    staleTime: 60_000,
    retry: 1,
  });
  const view = buildTickerView({ isLoading: query.isLoading, isError: query.isError, data: query.data });

  let status: string;
  if (view.status === "loading") status = "Market data loading";
  else if (view.status === "unavailable" || view.allUnavailable) status = "Market data unavailable";
  else status = `Market quotes as of ${asOf(view.fetchedAt)}. Each quote shows its own delayed, last-close, stale or unavailable state.`;

  return (
    <section
      aria-label="Market ticker"
      data-market-ticker={view.status === "available" && view.allUnavailable ? "unavailable" : view.status}
      className="fl-ticker relative w-full overflow-hidden border-b border-[rgba(0,212,255,0.15)] bg-[#050608]"
    >
      <style>{`
        @keyframes fl-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .fl-ticker-track { animation: fl-ticker-scroll 60s linear infinite; will-change: transform; }
        .fl-ticker:hover .fl-ticker-track, .fl-ticker:focus-within .fl-ticker-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .fl-ticker-track { animation: none !important; transform: none !important; }
          .fl-ticker-track [data-ticker-dup] { display: none; }
          .fl-ticker-viewport { overflow-x: auto; scrollbar-width: none; }
        }
      `}</style>
      <div className="flex h-8 items-center">
        <div
          className="flex h-full shrink-0 items-center border-r border-[rgba(0,212,255,0.1)] px-3"
          style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.14em", color: "rgba(0,212,255,0.5)" }}
        >
          MARKETS
        </div>
        <div className="fl-ticker-viewport relative h-full min-w-0 flex-1 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 z-10"
            aria-hidden="true"
            style={{ background: "linear-gradient(90deg, rgba(5,6,8,0.9) 0%, transparent 6%, transparent 94%, rgba(5,6,8,0.9) 100%)" }}
          />
          {view.status === "available" && !view.allUnavailable ? (
            <div className="fl-ticker-track flex h-full w-max items-center pl-4">
              <ul className="flex items-center" aria-label="Quotes">
                {view.quotes.map(q => <Quote key={q.symbol} quote={q} />)}
              </ul>
              <ul className="flex items-center" aria-hidden="true" data-ticker-dup>
                {view.quotes.map(q => <Quote key={`${q.symbol}-dup`} quote={q} duplicate />)}
              </ul>
            </div>
          ) : (
            <p className="flex h-full items-center px-4" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: view.status === "loading" ? "#8A9AB0" : "#FFAA00" }}>
              {view.status === "loading" ? "MARKET DATA LOADING — NO PRICES SHOWN UNTIL A QUOTE ARRIVES" : "MARKET DATA UNAVAILABLE — NO PRICES SHOWN"}
            </p>
          )}
        </div>
        {view.status === "available" && !view.allUnavailable && (
          <p
            aria-hidden="true"
            className="hidden h-full shrink-0 items-center border-l border-[rgba(0,212,255,0.1)] px-3 uppercase sm:flex"
            style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", color: "rgba(148,163,184,0.7)" }}
          >
            {`QUOTES AS OF ${asOf(view.fetchedAt)}`}
          </p>
        )}
        <span className="sr-only" role="status">{status}</span>
      </div>
    </section>
  );
}
