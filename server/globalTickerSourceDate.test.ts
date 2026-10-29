import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalMarketSnapshot, MarketQuoteItem } from "./routers/markets";

const query = vi.hoisted(() => ({ data: undefined as GlobalMarketSnapshot | undefined }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    markets: {
      getGlobalSnapshot: {
        useQuery: () => ({ data: query.data, isError: false }),
      },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/app/markets", vi.fn()] }));

// The client test transform uses the classic JSX runtime; assign React before
// dynamically loading the component's JSX module graph.
(globalThis as { React?: typeof React }).React = React;
const GlobalMarketTicker = (await import("../client/src/components/GlobalMarketTicker")).default;

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
function fredItem(overrides: Partial<MarketQuoteItem> = {}): MarketQuoteItem {
  return {
    symbol: "FRED:DGS10",
    label: "US 10-Year Treasury",
    shortLabel: "10Y",
    category: "rates",
    unit: "percent",
    price: 4.25,
    prevClose: 4.2,
    open: null,
    high: null,
    low: null,
    change: 0.05,
    changePercent: 1.19,
    marketState: "CLOSED",
    sessionStatus: "CLOSED",
    freshnessState: "LATEST_VERIFIED",
    isDelayed: true,
    observedAt: null,
    observedDate: "2026-10-28",
    fetchedAt: NOW - 60_000,
    cacheState: "FRESH",
    source: "fred",
    destination: "/app/markets?group=rates",
    ...overrides,
  };
}
function render(item: MarketQuoteItem): string {
  query.data = {
    items: [item],
    fetchedAt: NOW,
    activeSession: "US",
    summary: {
      usEquities: "unavailable",
      europe: "unavailable",
      asia: "unavailable",
      volatility: "unavailable",
      dollar: "unavailable",
      rates: "unavailable",
      commodities: "unavailable",
      crypto: "unavailable",
    },
    strongest: [],
    weakest: [],
  };
  return renderToStaticMarkup(createElement(GlobalMarketTicker));
}

beforeEach(() => {
  query.data = undefined;
});

describe("Global Markets ticker source-date labels", () => {
  it("renders a FRED observation date verbatim in both the visible label and human-readable title", () => {
    const html = render(fredItem());
    const label = "AS OF 2026-10-28";
    const title = "US 10-Year Treasury — CLOSED · LAST SESSION — AS OF 2026-10-28";

    expect(html).toContain(label);
    expect(html).toContain(`title="${title}"`);
    expect(html).not.toContain("AS OF Oct 28");
    expect(html).not.toContain("AS OF 2026-10-28 ET");
  });

  it("renders a precise ET time only when observedAt is supplied", () => {
    const html = render(fredItem({ observedAt: Date.parse("2026-10-28T17:05:00.000Z") }));
    const label = "AS OF Oct 28, 1:05 PM ET";
    const title = "US 10-Year Treasury — CLOSED · LAST SESSION — AS OF Oct 28, 1:05 PM ET";

    expect(html).toContain(label);
    expect(html).toContain(`title="${title}"`);
  });
});
