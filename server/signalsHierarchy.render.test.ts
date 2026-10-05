/**
 * SIGNALS hierarchy — rendered DOM order (static render, mocked data).
 * Movers (signal content) must render before Data Integrity and Pre-Flight.
 * The Pre-Flight score must be labelled PRE-FLIGHT COMPLETION, never as a bare 0/100.
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as any).React = React;

const NOW_ISO = new Date(Date.now() - 5 * 60_000).toISOString();
const env: { integrityLabel: string; canonical: any } = {
  integrityLabel: "DELAYED",
  canonical: {
    regime: "MODERATE RISK", pressureIndex: 34,
    engines: [
      { engineId: "liquidity-stress", sourceInputIds: ["hy_credit_spread", "secured_overnight_financing_rate"] },
      { engineId: "labor-rates", sourceInputIds: ["unemployment_rate", "ten_year_treasury_yield"] },
      { engineId: "inflation", sourceInputIds: ["consumer_price_index_yoy"] },
      { engineId: "ai-bubble", sourceInputIds: ["ai_concentration_static_baseline"] },
    ],
    delayedInputs: ["consumer_price_index_yoy", "unemployment_rate"], staleInputs: [], unavailableInputs: [], fallbackInputs: [],
  },
};

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, name: "QA" }, loading: false }) }));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => ["/app/now/deep", () => undefined] };
});
vi.mock("@/hooks/useAnalytics", () => ({ trackPreflightLaunch: () => undefined }));
vi.mock("@/contexts/EngineContext", () => ({
  useEngine: () => ({
    marketMode: "canonical",
    output: {
      overall: { score: 3.4, source: "canonical-market-state" },
      regime: { label: "MODERATE RISK" },
      domains: [
        { id: "credit", label: "Credit", score: 6.2, riskLevel: "elevated" },
        { id: "liquidity", label: "Liquidity", score: 2.3, riskLevel: "low" },
      ],
    },
    rawFred: { DGS10: 4.1 },
    isLoading: false,
    isLive: false,
    integrityLabel: env.integrityLabel,
    lastUpdated: new Date(Date.now() - 1286 * 60_000),
    dataError: null,
    forceRefresh: () => undefined,
    canonicalState: env.canonical,
    sourceHealth: [{ id: "fred", status: "healthy", required: true, asOf: new Date(Date.now() - 1286 * 60_000).toISOString(), detail: "", label: "Macro and Credit Evidence" }],
  }),
}));
vi.mock("@/lib/trpc", () => {
  const make = (path: string[]): any => new Proxy(() => undefined, {
    get: (_t, key) => {
      const p = path.join(".");
      if (key === "useQuery") return () => {
        if (p === "marketState.canonicalCurrent") return { data: env.canonical, isLoading: false };
        if (p === "crypto.getTopMarkets") return {
          data: [
            { id: "bitcoin", symbol: "btc", name: "Bitcoin", image: "", currentPrice: 62000, marketCap: 1.2e12, totalVolume: 3.1e10, priceChangePercent24h: 2.4, priceChangePercent24hDisplay: 2.4, priceChangePercent7d: 5.1, lastUpdated: NOW_ISO },
            { id: "ethereum", symbol: "eth", name: "Ethereum", image: "", currentPrice: 2400, marketCap: 2.9e11, totalVolume: 1.4e10, priceChangePercent24h: -3.6, priceChangePercent24hDisplay: -3.6, priceChangePercent7d: -6, lastUpdated: NOW_ISO },
          ],
          isLoading: false, isError: false, dataUpdatedAt: Date.now() - 60_000,
        };
        if (p === "altRotation.getData") return {
          data: { btcDominance: { current: 56.2, trend: "rising", pressure: "high" }, regimeKey: "btc_season", aiCommentary: "BTC leadership persists.", sectors: [{ name: "AI", momentum: "Rising", score: 61, color: "#00E5FF" }] },
          isLoading: false, dataUpdatedAt: Date.now() - 60_000,
        };
        if (p === "awareness.getScore") return { data: { score: 0, rating: { color: "#ef4444", label: "Limited Awareness", statusLabel: "Review Recommended" }, completedKeys: [], lastPreflightAt: null, categoryBreakdown: {} }, isLoading: false };
        if (p === "awareness.getPreflightMode") return { data: { mode: "full_guidance" }, isLoading: false };
        return { data: undefined, isLoading: false };
      };
      if (key === "useMutation") return () => ({ mutate: () => undefined, mutateAsync: async () => undefined, isPending: false });
      if (key === "useUtils") return () => make([]);
      return make([...path, String(key)]);
    },
    apply: () => make(path),
  });
  return { trpc: make([]) };
});

const { default: SignalsMode } = await import("../client/src/components/dashboard/SignalsMode");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("SignalsMode rendered hierarchy (Crypto default tab)", () => {
  const html = renderToStaticMarkup(createElement(SignalsMode));
  const t = text(html);

  it("renders movers → integrity → preflight in DOM order", () => {
    const movers = html.indexOf('data-signals-hierarchy="movers"');
    const integrity = html.indexOf('data-signals-hierarchy="integrity"');
    const preflight = html.indexOf('data-signals-hierarchy="preflight"');
    expect(movers).toBeGreaterThan(-1);
    expect(integrity).toBeGreaterThan(movers);
    expect(preflight).toBeGreaterThan(integrity);
  });

  it("answers what / how strong / why / current / watch for each mover", () => {
    expect(t).toContain("TOP CRYPTO BY VOLUME");
    expect(t).toMatch(/BTC.*UP.*\+2\.40%/);
    expect(t).toMatch(/ETH.*DOWN.*-3\.60%/);
    expect(t).toContain("TURNOVER 2.6% (VOL/MCAP)");
    expect(t).not.toMatch(/REL VOL|relative volume/i);
    expect(t).toContain("7D -6.00%");
    expect(t).toContain("CATALYST UNCLEAR");
    expect(t).toMatch(/AS OF .* ET/);
    expect(t).toContain("REGIME · MODERATE RISK");
    expect(t).not.toMatch(/watch next/i);
    expect(html).not.toContain('data-signals-field="watch-next"');
  });

  it("labels the preflight score explicitly, never as a bare Pressure-style 0/100", () => {
    expect(t).toContain("PRE-FLIGHT COMPLETION · 0/100");
    expect(t).toContain("MARKET AWARENESS CHECK · 0/13 COMPLETED");
    expect(t).toContain("not Pressure Index");
    expect(html).toContain('data-preflight-card="compact"');
    expect(html).not.toContain('data-preflight-card="full"');
    expect(t).not.toContain("Complete Market Awareness™");
  });

  it("DELAYED integrity shows affected feeds, last observation, age, usability, withheld", () => {
    expect(html).toContain('data-integrity-state="DELAYED"');
    expect(t).toContain("DELAYED · CONFIDENCE REDUCED");
    expect(t).toContain("usable at reduced confidence");
    expect(t).toMatch(/Last successful observation: .* ET · age 21h 26m ago/);
    expect(t).toContain("CPI YoY·delayed");
    expect(t).toContain("Unemployment·delayed");
    // Count comes from canonical inputs, not the always-empty client rawFred map.
    expect(t).toContain("6 INPUTS · 2 DELAYED");
    expect(t).not.toMatch(/\b0\/10\b/);
    expect(html).toContain('data-integrity-feeds-reported="canonical"');
    expect(t).toContain("Metrics withheld / not current:");
  });

  it("STALE integrity withholds and never presents readings as current", () => {
    env.integrityLabel = "STALE";
    env.canonical = { ...env.canonical, staleInputs: ["hy_credit_spread"] };
    const h = renderToStaticMarkup(createElement(SignalsMode));
    const s = text(h);
    expect(h).toContain('data-integrity-state="STALE"');
    expect(s).toContain("stale observations are not shown as current");
    expect(s).toContain("HY Spread (stale)");
    expect(s).toContain("1 STALE");
    env.integrityLabel = "DELAYED";
    env.canonical = { ...env.canonical, staleInputs: [] };
  });

  it("UNAVAILABLE integrity marks signals withheld", () => {
    env.integrityLabel = "UNAVAILABLE";
    const s = text(renderToStaticMarkup(createElement(SignalsMode)));
    expect(s).toContain("Signals withheld or non-authoritative until feeds recover");
    env.integrityLabel = "DELAYED";
  });

  it("no canonical inputs → feed status UNAVAILABLE / not reported (never a false 0/10)", () => {
    const saved = env.canonical;
    env.canonical = { regime: "MODERATE RISK", pressureIndex: 34, engines: [], delayedInputs: [], staleInputs: [], unavailableInputs: [], fallbackInputs: [] };
    const h = renderToStaticMarkup(createElement(SignalsMode));
    const s = text(h);
    expect(s).toContain("FEED STATUS UNAVAILABLE · not reported to this view");
    expect(s).toContain("Affected inputs: feed status not reported to this view");
    expect(h).toContain('data-integrity-feeds-reported="not-reported"');
    expect(s).not.toMatch(/\b0\/10\b/);
    env.canonical = saved;
  });

  it("still renders movers when canonical state is missing (no blank SignalsMode)", () => {
    const saved = env.canonical;
    env.canonical = undefined;
    const s = text(renderToStaticMarkup(createElement(SignalsMode)));
    expect(s).toContain("TOP CRYPTO BY VOLUME");
    expect(s).toContain("REGIME CONTEXT UNAVAILABLE");
    env.canonical = saved;
  });
});
