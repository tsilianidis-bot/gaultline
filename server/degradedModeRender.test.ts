/**
 * QA delta gate on 89e5e7a (fix-up 4): render-level checks of the degraded
 * mode (marketState.current failing, canonical OK or partly missing). The
 * browser engine then runs on DEFAULT_INDICATORS demo inputs; none of its
 * domains, scores or colours may reach a mounted customer page.
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INDICATORS, type EngineOutput } from "../client/src/lib/engine";
import {
  UNAVAILABLE_DISPLAY_COLOR,
  canonicalDisplayRiskLevel,
  canonicalRegimeDisplayColor,
  projectCanonicalMarketState,
  selectBrowserMarketOutput,
} from "../client/src/lib/marketStateProjection";
import { getRiskColor } from "../client/src/components/RiskBadge";

(globalThis as any).React = React;

const demo = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
const demoOutput = demo.output;

type Canonical = { pressureIndex: number | null; regime: string | null; [k: string]: unknown };
const engine: { output: EngineOutput; marketMode: string; marketState: any; canonicalState: Canonical | null } = {
  output: demoOutput,
  marketMode: "deterministic-fallback",
  marketState: null,
  canonicalState: null,
};
function canonical(pressureIndex: number | null, regime: string | null): Canonical {
  return { pressureIndex, regime, stateId: "state:degraded", generatedAt: "2026-10-03T20:00:00.000Z", confidenceOrEvidenceQuality: "LIMITED", dataQualitySummary: { status: "PARTIAL", staleInputCount: 0, delayedInputCount: 0, unavailableInputCount: 0, fallbackInputCount: 0 }, inputQuality: [], staleInputs: [], unavailableInputs: [], fallbackInputs: [], scenarioOutputs: {} };
}

vi.mock("@/contexts/EngineContext", () => ({
  useEngine: () => ({
    output: engine.output,
    marketState: engine.marketState,
    canonicalState: engine.canonicalState,
    marketMode: engine.marketMode,
    sourceHealth: [],
    isLoading: false,
    isRefreshing: false,
    isLive: false,
    lastUpdated: null,
    dataError: null,
    refresh: () => undefined,
    integrityLabel: "FALLBACK",
  }),
}));
vi.mock("@/lib/trpc", () => {
  const make = (path: string[]): any => new Proxy(() => undefined, {
    get: (_t, key) => {
      if (key === "useQuery") {
        return () => ({ data: path.join(".") === "marketState.canonicalCurrent" ? engine.canonicalState ?? undefined : undefined, isLoading: false, error: null, isError: false, refetch: () => undefined });
      }
      if (key === "useMutation") return () => ({ data: undefined, isPending: false, mutate: () => undefined, mutateAsync: async () => undefined, reset: () => undefined });
      if (key === "useUtils") return () => make([]);
      return make([...path, String(key)]);
    },
    apply: () => make(path),
  });
  return { trpc: make([]) };
});
vi.mock("@/hooks/useSEO", () => ({ useSEO: () => undefined, PAGE_SEO: new Proxy({}, { get: () => ({}) }) }));
vi.mock("@/components/MarketPreflight", () => ({ PreflightTrigger: () => null }));

const Why = (await import("../client/src/pages/Why")).default;
const Watch = (await import("../client/src/pages/Watch")).default;
const MarketContextStrip = (await import("../client/src/components/MarketContextStrip")).default;
const ShareCard = (await import("../client/src/components/ShareCard")).default;
const TradePreflight = (await import("../client/src/pages/TradePreflight")).default;
const { TickerStoreProvider } = await import("../client/src/contexts/TickerStore");

function render(el: React.ReactElement, ssrPath = "/app/why"): string {
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Router, { ssrPath }, el)),
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// Every demo-engine value that used to leak (labels, 0–100 scores and driver strings).
const DEMO_TOKENS = [
  ...demoOutput.domains.map(d => d.label),
  ...demoOutput.domains.flatMap(d => d.drivers),
  ...demoOutput.domains.map(d => `${Math.round(d.score * 100) / 10}/100`),
  "Banking System Stress", "58.7/100", "56.6/100", "Bank liquidity stress 68/100", "CRE", "Recession Risk", "21.3/100",
];
function expectNoDemo(t: string) {
  for (const token of DEMO_TOKENS) expect(t, `demo token "${token}"`).not.toContain(token);
}

beforeEach(() => {
  engine.output = demoOutput;
  engine.marketMode = "deterministic-fallback";
  engine.marketState = null;
  engine.canonicalState = canonical(34, "MODERATE RISK");
});

describe("degraded /app/why (marketState missing, canonical OK)", () => {
  it("renders no demo evidence: drivers, fault map, evidence families and positioning read Unavailable", () => {
    expect(demo.mode).toBe("deterministic-fallback");
    expect(demoOutput.domains.length).toBeGreaterThan(0); // the demo engine still has domains to leak
    const html = render(createElement(Why));
    const t = text(html);
    expectNoDemo(t);
    expect(t).toContain("These drivers come from the same canonical state as NOW");
    for (const id of ["contributors", "drivers", "fault-map", "evidence-families", "positioning"]) {
      expect(html).toContain(`data-why-unavailable="${id}"`);
    }
    expect(t).toContain("Synthesis unavailable");
    expect(t).toContain("Unavailable evidence consensus");
    expect(t).not.toContain("fallback evidence consensus");
    expect(t).not.toContain("Key developments");
    expect(t).not.toContain("Market effect");
    // The canonical pressure is still the one being explained.
    expect(html).toContain('data-why-pressure="34"');
    expect(t).toContain("34/100");
  });

  it("without a canonical pressure the explained pressure is Unavailable, not the demo composite", () => {
    engine.canonicalState = canonical(null, "MODERATE RISK");
    const html = render(createElement(Why));
    const t = text(html);
    expect(html).toContain('data-why-pressure="unavailable"');
    expect(t).not.toContain(`${Math.round(demoOutput.overall.score * 100) / 10}/100`);
    expectNoDemo(t);
  });
});

describe("degraded /app/watch (marketState missing, canonical OK)", () => {
  it("renders no demo-domain conditions, indicators or monitor items: Unavailable instead", () => {
    const html = render(createElement(Watch), "/app/watch");
    const t = text(html);
    expectNoDemo(t);
    for (const id of ["threshold-meters", "leading-indicators", "monitor-next", "duration-trend", "expected-impact"]) {
      expect(html).toContain(`data-watch-unavailable="${id}"`);
    }
    expect(t).toContain("Regime MODERATE RISK");
    expect(t).toContain("34/100");
    expect(t).not.toContain("Deterministic risk domains are shown below");
  });
});

describe("degraded MarketContextStrip colours", () => {
  const attrs = (html: string) => ({
    regime: html.match(/data-strip-regime-color="([^"]+)"/)?.[1],
    pressure: html.match(/data-strip-pressure-color="([^"]+)"/)?.[1],
  });

  it("regime and pressure colours come from the canonical pressure (healthy-mode mapping), not the demo engine", () => {
    engine.canonicalState = canonical(72, "HIGH STRESS");
    const html = render(createElement(MarketContextStrip), "/app/why");
    const c = attrs(html);
    expect(c.regime).toBe("#ff6b35");
    expect(c.pressure).toBe(getRiskColor("high"));
    expect(c.regime).not.toBe(demoOutput.regime.color);
    expect(c.pressure).not.toBe(getRiskColor(demoOutput.overall.riskLevel));
    const t = text(html);
    expect(t).toContain("HIGH STRESS");
    expect(t).toContain("72/100");
    expect(t).toContain("Synthesis unavailable");
    expect(t).toContain("UNAVAILABLE"); // verdict
    expect(t).not.toContain(demoOutput.regime.sublabel);
  });

  it("regime label only (no pressure) still maps through the canonical regime", () => {
    engine.canonicalState = canonical(null, "ELEVATED RISK");
    const c = attrs(render(createElement(MarketContextStrip)));
    expect(c.regime).toBe(canonicalRegimeDisplayColor(null, "ELEVATED RISK"));
    expect(c.regime).toBe("#ffb020");
    expect(c.pressure).toBe(getRiskColor("elevated"));
  });

  it("no canonical value → neutral #64748B, neutral trend icon and no demo regime label", () => {
    engine.canonicalState = canonical(null, null);
    const html = render(createElement(MarketContextStrip));
    const c = attrs(html);
    expect(c.regime).toBe("#64748B");
    expect(c.pressure).toBe("#64748B");
    expect(html).toContain('data-strip-trend="unavailable"');
    const t = text(html);
    expect(t).toContain("REGIME UNAVAILABLE");
    expect(t).not.toContain(demoOutput.regime.label);
    expect(html).not.toContain(demoOutput.regime.color);
  });
});

describe("ShareCard without an analog (current prod state)", () => {
  it("renders without the analog line instead of crashing", () => {
    engine.marketMode = "canonical";
    engine.output = { ...demoOutput, analogs: [] };
    let html = "";
    expect(() => { html = render(createElement(ShareCard, { onClose: () => undefined }), "/app/now/deep"); }).not.toThrow();
    expect(html).not.toContain("data-share-analog");
    expect(text(html)).not.toContain("Closest Historical Analog");
    expect(text(html)).toContain("NOT FINANCIAL ADVICE");
  });
  it("still renders the analog line when a canonical analog exists", () => {
    engine.marketMode = "canonical";
    engine.output = { ...demoOutput, analogs: [{ id: "a", era: "Dot-com", year: "2000", similarity: 61, matchReasons: [] } as any] };
    const html = render(createElement(ShareCard, { onClose: () => undefined }), "/app/now/deep");
    expect(html).toContain("data-share-analog");
    expect(text(html)).toContain("Dot-com 2000");
  });
});

describe("degraded expert tabs (Pressure ?tab=scores, Decision Engine trade-preflight)", () => {
  it("Scores withholds every demo score (client-mounted page: source pin)", () => {
    // Scores renders only after a mount effect, which static rendering never runs.
    const src = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Scores.tsx"), "utf8");
    const gate = src.indexOf("if (marketMode === 'deterministic-fallback') {");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(src.indexOf("const color = getRiskColor(overall.riskLevel);"));
    expect(src).toContain('data-scores-canonical="unavailable"');
  });
  it("Trade Preflight shows the canonical pressure/regime and no demo domain chips", () => {
    engine.canonicalState = canonical(41, "ELEVATED RISK");
    let t = text(render(createElement(TickerStoreProvider, null, createElement(TradePreflight)), "/app/decision-engine"));
    expect(t).toContain("41");
    expect(t).toContain("ELEVATED RISK");
    expect(t).toContain("Domain conditions unavailable");
    expect(t).not.toContain(demoOutput.regime.label);
    // Demo domain chips (first word of each demo domain label) are not rendered.
    for (const chip of ["Treasury/Debt", "Inflation/Fed", "Banking", "Recession", "Liquidity"]) expect(t).not.toContain(chip);
    engine.canonicalState = canonical(null, null);
    const html = render(createElement(TickerStoreProvider, null, createElement(TradePreflight)), "/app/decision-engine");
    t = text(html);
    expect(html).toContain('data-preflight-pressure="unavailable"');
    expect(t).not.toContain(String(Math.round(demoOutput.overall.score * 10)) + " /100");
    expect(t).not.toContain(demoOutput.regime.label);
  });
});

describe("shared canonical display helpers and projection", () => {
  it("colour/risk mapping mirrors healthy mode; nothing canonical → neutral/null", () => {
    expect(canonicalRegimeDisplayColor(90, null)).toBe("#ff2d55");
    expect(canonicalRegimeDisplayColor(72, "LOW RISK")).toBe("#ff6b35"); // pressure wins, as in healthy mode
    expect(canonicalRegimeDisplayColor(10, null)).toBe("#00e599");
    expect(canonicalRegimeDisplayColor(null, "SYSTEMIC CRISIS")).toBe("#ff2d55");
    expect(canonicalRegimeDisplayColor(null, "HIGH STRESS")).toBe("#ff6b35");
    expect(canonicalRegimeDisplayColor(null, "MODERATE RISK")).toBe("#00d4ff");
    expect(canonicalRegimeDisplayColor(Number.NaN, null)).toBe(UNAVAILABLE_DISPLAY_COLOR);
    expect(canonicalRegimeDisplayColor(null, "SOMETHING ELSE")).toBe("#64748B");
    expect(canonicalDisplayRiskLevel(72, null)).toBe("high");
    expect(canonicalDisplayRiskLevel(null, "LOW RISK")).toBe("low");
    expect(canonicalDisplayRiskLevel(null, null)).toBeNull();
  });
  it("a canonical MarketState without evidence families projects no domains (never the demo domains)", () => {
    const state: any = {
      now: { pressureScore: 40, regime: "MODERATE RISK", stressLevel: "Moderate", direction: "stable", headline: "h", topDrivers: [] },
      why: { evidenceFamilies: [], whyThisRegime: "w", story: "s" },
      watch: { whatToWatch: [] },
      outlook: { topAnalog: null },
      cache: { status: "refreshed", staleReason: null },
    };
    const projected = projectCanonicalMarketState(state, demoOutput);
    expect(projected.domains).toEqual([]);
  });
});

describe("other mounted degraded-mode consumers (source pins)", () => {
  const src = (rel: string) => readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");
  it("DayTrade fallback, Crypto Signals, Signals, Pressure domain tab, Preflight modal, PLATO orb, ACT", () => {
    const day = src("client/src/pages/DayTradeIntelligence.tsx");
    expect(day).toContain('const regimeLabel = degraded ? (canonicalState?.regime ?? "Unavailable")');
    expect(day).toContain("const pressure = degraded ? (canonicalPressure === null ? null : canonicalPressure / 10)");
    const crypto = src("client/src/pages/CryptoSignals.tsx");
    expect(crypto).toContain("const regimeSourceLabel = degraded ? (engine?.canonicalState?.regime ?? null)");
    expect(crypto).toContain("? canonicalRegimeDisplayColor(canonicalPressure100, engine?.canonicalState?.regime)");
    expect(crypto).toContain("const regimeScoreText = degraded\n    ? (canonicalPressure100 === null ? score100Value(null) : String(Math.round(canonicalPressure100)))");
    const signals = src("client/src/pages/Signals.tsx");
    expect(signals).toContain("if (!canonicalRegimeAvailable) return UNAVAILABLE_DISPLAY_COLOR;");
    const pressure = src("client/src/pages/Pressure.tsx");
    expect(pressure).toContain("const domains = marketMode === 'deterministic-fallback' ? [] : (output?.domains ?? []);");
    const preflight = src("client/src/components/MarketPreflight.tsx");
    expect(preflight).toContain('const displayRegimeLabel = degraded ? (canonicalState?.regime ?? "Unavailable") : regimeLabel;');
    expect(preflight).toContain("buildMarketScenarios(output, degraded, canonicalState?.pressureIndex)");
    expect(preflight).not.toContain("Math.round(score * 10)");
    expect(src("client/src/components/AshaPanel.tsx")).toContain(": canonicalEngine?.overall?.score ?? 0;");
    expect(src("client/src/pages/Act.tsx")).toContain('{marketState?.history.observationCount ?? "Unavailable"}');
  });
});
