import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ORIGINAL_TICKER_SYMBOLS, buildTickerView, toTickerQuote } from "../client/src/components/landing/ticker/tickerModel";
import AmberSeismograph from "../client/src/components/landing/AmberSeismograph";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const base = { shortLabel: "SPX", unit: undefined, proxySymbol: undefined, sessionStatus: "OPEN" as const };

describe("landing market ticker", () => {
  it("uses the original ticker symbol set in the original order (10Y via FRED:DGS10 in place of ^TNX)", () => {
    expect(ORIGINAL_TICKER_SYMBOLS.map(s => s.symbol)).toEqual([
      "^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX", "DX-Y.NYB", "FRED:DGS10", "GC=F", "CL=F", "BTC-USD", "ETH-USD", "^FTSE", "^GDAXI", "^N225",
    ]);
  });

  it("shows loading and unavailable states with no prices", () => {
    expect(buildTickerView({ isLoading: true, isError: false, data: undefined })).toEqual({ status: "loading" });
    expect(buildTickerView({ isLoading: false, isError: true, data: undefined })).toEqual({ status: "unavailable" });
  });

  it("marks symbols missing from the snapshot, or with no price, as unavailable instead of inventing a value", () => {
    const view = buildTickerView({ isLoading: false, isError: false, data: { fetchedAt: 1, items: [
      { ...base, symbol: "^GSPC", price: null, changePercent: null, freshnessState: "UNAVAILABLE" },
    ] } });
    expect(view.status).toBe("available");
    if (view.status !== "available") return;
    expect(view.allUnavailable).toBe(true);
    for (const q of view.quotes) {
      expect(q.state).toBe("unavailable");
      expect(q.price).toBeNull();
      expect(q.change).toBeNull();
      expect(q.stateLabel).toBe("UNAVAILABLE");
    }
  });

  it("labels delayed, last-close and stale quotes; only a true live print is untagged", () => {
    const mk = (freshnessState: any, extra: Record<string, unknown> = {}) =>
      toTickerQuote({ ...base, symbol: "^GSPC", price: 5012.34, changePercent: -0.42, freshnessState, ...extra } as any, "SPX", "^GSPC");
    expect(mk("LIVE")).toMatchObject({ state: "live", stateLabel: null, price: "5,012.34", change: "-0.42%", direction: "down" });
    expect(mk("DELAYED")).toMatchObject({ state: "delayed", stateLabel: "DELAYED" });
    expect(mk("LIVE", { proxySymbol: "SPY" })).toMatchObject({ state: "delayed", stateLabel: "SPY PROXY · DELAYED" });
    expect(mk("LATEST_VERIFIED")).toMatchObject({ state: "closed", stateLabel: "LAST CLOSE" });
    expect(mk("DELAYED", { sessionStatus: "CLOSED" })).toMatchObject({ state: "closed", stateLabel: "LAST CLOSE" });
    expect(mk("STALE")).toMatchObject({ state: "stale", stateLabel: "STALE" });
  });

  it("sits above the navigation and pauses the marquee under reduced motion", () => {
    const page = read("client/src/pages/MarketingSite.tsx");
    expect(page.indexOf("<MarketTicker />")).toBeGreaterThan(-1);
    expect(page.indexOf("<MarketTicker />")).toBeLessThan(page.indexOf("<Header />"));
    const ticker = read("client/src/components/landing/ticker/MarketTicker.tsx");
    expect(ticker).toContain("trpc.markets.getGlobalSnapshot.useQuery");
    expect(ticker).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });
});

describe("amber-gold seismograph trace", () => {
  it("is decorative, amber-gold, and static under reduced motion", () => {
    const html = renderToStaticMarkup(createElement(AmberSeismograph));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("#E8B04B");
    expect(html).toMatch(/prefers-reduced-motion: reduce\)[^}]*\{[^}]*animation: none/);
  });

  it("renders behind the hero and the thesis section, leaving the cyan underlay in place", () => {
    const page = read("client/src/pages/MarketingSite.tsx");
    const hero = page.slice(page.indexOf("function Hero()"), page.indexOf("function Pressure()"));
    expect(hero).toContain("<SeismicUnderlay");
    expect(hero).toContain("<AmberSeismograph");
    expect(read("client/src/components/landing/thesis/ThesisSection.tsx")).toContain("<AmberSeismograph");
    const main = page.slice(page.indexOf('<main id="main">'));
    expect(main.indexOf("<Hero />")).toBeLessThan(main.indexOf("<PentagonalThesis />"));
    expect(main.slice(main.indexOf("<Hero />"), main.indexOf("<PentagonalThesis />")).trim()).toBe("<Hero />");
  });
});
