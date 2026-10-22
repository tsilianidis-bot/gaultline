import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { macroChartCards } from "../client/src/lib/chartData";

// QA r10 pin (#60): the /app/charts "Macro Stress Indicators" cards stay
// Unavailable. The hard-coded values (-42 bps, HY 342, VIX 22.4, -$180B, 8.6,
// 7.8), the buildSeries sparklines, the 10Y 4.68 overlay and the "API: FRED…"
// labels must not come back on a rebase. chartData.ts is #60's data path;
// Charts.tsx is #59's, so the page is rendered from whatever tree this runs on
// (the #60 head or the merged stack).
(globalThis as any).React = React;
const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const engineOutput = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} }).output;
vi.mock("@/contexts/EngineContext", () => ({
  useEngine: () => ({ output: engineOutput, isLive: false, lastUpdated: null, isLoading: false, marketMode: "deterministic-fallback", integrityLabel: { label: "UNAVAILABLE", tone: "unavailable", detail: "" } }),
}));
vi.mock("@/lib/trpc", () => {
  const leaf: any = new Proxy(() => undefined, {
    get: (_t, key) => (key === "useQuery" ? () => ({ data: undefined, isLoading: false, error: null, isError: false }) : key === "useUtils" ? () => leaf : leaf),
    apply: () => leaf,
  });
  return { trpc: leaf };
});
vi.mock("@/hooks/useSEO", () => ({ useSEO: () => undefined, PAGE_SEO: new Proxy({}, { get: () => ({}) }) }));
vi.mock("@/components/PageHeader", () => ({ default: () => null }));
vi.mock("@/components/MarketPreflight", () => ({ PreflightTrigger: () => null }));
const Charts = (await import("../client/src/pages/Charts")).default;

const FORBIDDEN = [/-42\b/, /\bHY 342\b|\b342\b/, /\b22\.4\b/, /-\$180B/, /\b8\.6\b/, /\b7\.8\b/, /\b4\.68\b/, /API: FRED/i, /FRED: T10Y2Y/];

describe("Charts macro stress cards stay Unavailable (QA r10 pin)", () => {
  it("data path: every macro card is Unavailable, has no history, no overlay and no vendor API label", () => {
    expect(macroChartCards).toHaveLength(6);
    for (const card of macroChartCards) {
      expect(card.currentValue).toBe("Unavailable");
      expect(card.changeLabel).toBe("Unavailable");
      expect(card.riskLevel).toBe("unavailable");
      expect(card.apiSource).toBe("No live data feed is connected to this card.");
      expect(Object.values(card.series).every(points => points.length === 0)).toBe(true);
      expect(card.secondarySeries).toBeUndefined();
    }
  });
  it("source: chartData.ts macro cards carry no fixed numbers or seeded series", () => {
    const s = read("client/src/lib/chartData.ts");
    const block = s.slice(s.indexOf("export const macroChartCards"), s.indexOf("// ---- Historical Overlay Data ----"));
    expect(block.length).toBeGreaterThan(100);
    expect(block).not.toMatch(/buildSeries\(/);
    for (const re of FORBIDDEN) expect(block).not.toMatch(re);
  });
  it("rendered /app/charts: the Macro Stress Indicators section shows Unavailable, not the old values", () => {
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, { client: new QueryClient() },
        createElement(Router, { ssrPath: "/app/charts" }, createElement(Charts))),
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const start = text.indexOf("Macro Stress Indicators");
    expect(start).toBeGreaterThan(-1);
    const section = text.slice(start, start + 6000);
    for (const card of macroChartCards) expect(section).toContain(card.title);
    expect((section.match(/Unavailable/g) ?? []).length).toBeGreaterThanOrEqual(6);
    // The source line is inside the collapsed "interpretation" panel; its text is pinned on the data path above.
    for (const re of FORBIDDEN) expect(section).not.toMatch(re);
  });
});
