/**
 * PR #58 r9: display-only fail-closed fixes found by the #60 sweep in #58's files.
 *  1. No literal "\uXXXX" escape renders as JSX text (the PLATO overlay header showed "\u00b7").
 *  2. The PLATO briefing (OracleBriefing, e.g. on /app/time-machine) never shows a 50 default:
 *     pressure, bull and bear are null when missing and pressure reads NOT AVAILABLE.
 *  3. /app/portfolio intelligence: a missing vector score is null and renders "—", never 50.
 *     (The server side is in portfolioIntelligenceNull.test.ts.)
 */
import React, { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { insufficientHorizonMetadata } from "../shared/forecastMetadata";
import type { CanonicalMarketState } from "../shared/marketState";

const state = vi.hoisted(() => ({
  engine: null as null | { output: unknown; isLoading: boolean; marketMode: string },
  intelligence: null as unknown,
}));
vi.mock("@/contexts/EngineContext", () => ({ useEngine: () => state.engine }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, name: "Ada Lovelace" }, loading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    asha: { dailyGreeting: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) } },
    portfolio: {
      getIntelligence: {
        useQuery: () => ({ data: state.intelligence, isLoading: false, isError: false, error: null, refetch: vi.fn(), isFetching: false }),
      },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/app/now", vi.fn()] }));

import AshaLiveBriefing from "../client/src/components/AshaLiveBriefing";
import OracleBriefing, { pressureAvailable, type OracleBriefingData } from "../client/src/components/OracleBriefing";
import PortfolioIntelligence from "../client/src/components/PortfolioIntelligence";
import { InstitutionalCommentary } from "../client/src/components/PortfolioCommandCenter";

(globalThis as { React?: typeof React }).React = React;

const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

// #58's client .tsx files (git diff --name-only d1834a5 HEAD -- client), plus the portfolio consumers r9 touches.
const PR58_CLIENT_TSX = [
  "client/src/components/AshaDailyGreeting.tsx",
  "client/src/components/AshaLiveBriefing.tsx",
  "client/src/components/AshaPanel.tsx",
  "client/src/components/OracleBriefing.tsx",
  "client/src/contexts/AshaContext.tsx",
  "client/src/components/PortfolioIntelligence.tsx",
  "client/src/components/PortfolioCommandCenter.tsx",
];

/**
 * A \uXXXX escape is only decoded inside a JS string or template literal. Outside any quote it is
 * JSX text and renders literally. Flags escapes with an even count of each quote char before them
 * on the line (i.e. not inside a literal), ignoring // comments.
 */
function literalEscapesInJsxText(source: string): string[] {
  const hits: string[] = [];
  source.split("\n").forEach((line, index) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const match of line.matchAll(/\\u(\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/g)) {
      const before = line.slice(0, match.index).replace(/\\./g, "");
      const odd = (quote: string) => before.split(quote).length % 2 === 0;
      if (!odd('"') && !odd("'") && !odd("`")) hits.push(`${index + 1}: ${line.trim()}`);
    }
  });
  return hits;
}

function canonicalState(): CanonicalMarketState {
  return {
    version: "1.0",
    generatedAt: "2026-10-02T12:00:00.000Z",
    sourceUpdatedAt: "2026-10-02T11:55:00.000Z",
    freshness: { status: "fresh", ageMs: 300_000, asOf: "2026-10-02T11:55:00.000Z" },
    cache: { status: "fresh-cache", ageMs: 300_000, staleReason: null },
    sourceHealth: [],
    warnings: [],
    now: { pressureScore: 33, regime: "Moderate Risk", stressLevel: "Moderate", direction: "Stable", historicalPercentile: 40, headline: "Pressure is contained.", topDrivers: ["Credit"] },
    why: {
      story: "Credit is calm.", whyThisScore: "Mixed.", whyThisRegime: "No family is stressed.", keyDevelopments: [],
      narrative: { whatIsHappening: "Calm.", whyIsItHappening: "Liquidity.", whatHasChanged: "Little.", whatIsBuildingBeneathSurface: "Nothing." },
      evidenceFamilies: [], evidenceConsensus: "mixed",
    },
    outlook: {
      probabilities: { bull: 53, neutral: 30, bear: 17, confidence: 0, primaryDriver: "Credit", evidenceBasis: "Spreads", historicalBasis: "Analogs" },
      regimeProbabilities: { bull: 53, softLanding: 30, stagflation: 7, recession: 8, crash: 2 },
      transitionProbabilities: { remainInRegime: 60, transitionToElevated: 20, transitionToLow: 15, transitionToCrisis: 5, confidence: 0, historicalBasis: "Analogs", currentEvidence: [] },
      highestProbabilityPath: "Remain moderate", invalidationConditions: [], topAnalog: null,
    },
    watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false },
    act: { marketPosture: "neutral", decisionSummary: "Hold.", whatWouldInvalidate: "Credit widening.", riskControls: [] },
    history: { observationCount: 100, datasetSpan: "2018-present", currentStreakDescription: "Two weeks", lastMajorShift: null, analogSummary: "Mid-cycle" },
  } as CanonicalMarketState;
}

const MODES = {
  fallback: () => selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} }),
  simulation: () => selectBrowserMarketOutput({ marketState: canonicalState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: { vix: 40 } }),
  canonical: () => selectBrowserMarketOutput({ marketState: canonicalState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} }),
};

function tileValue(html: string, label: string): string | null {
  const match = new RegExp(`>${label}</div><div[^>]*>([^<]*)</div>`).exec(html);
  return match ? match[1] : null;
}

/** Rendered text only: drops tags, inline styles and the <style> block (CSS has left:50%). */
const visibleText = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ");

beforeEach(() => {
  state.engine = null;
  state.intelligence = null;
});

describe("1. no literal \\uXXXX in JSX text", () => {
  it("the scanner flags JSX-text escapes and ignores string literals (guards the scanner)", () => {
    expect(literalEscapesInJsxText('        <div>\n          PLATO \\u00b7 LAYER\n        </div>')).toHaveLength(1);
    expect(literalEscapesInJsxText('      icon: "\\u25c8",\n          PLATO {"\\u00b7"} LAYER\n  {x ? `\\u00b7 ${x}` : ""}')).toEqual([]);
  });

  for (const file of PR58_CLIENT_TSX) {
    it(`${file} has no literal \\uXXXX escape in JSX text`, () => {
      expect(literalEscapesInJsxText(read(file))).toEqual([]);
    });
  }

  for (const [mode, select] of Object.entries(MODES)) {
    it(`${mode}: the PLATO overlay header renders a real middle dot, never "\\u00b7"`, () => {
      const { output, mode: marketMode } = select();
      state.engine = { output, isLoading: false, marketMode };
      const html = renderToStaticMarkup(createElement(AshaLiveBriefing, { onContinue: () => {} }));
      expect(html).toContain("PLATO \u00b7 FAULTLINE INTELLIGENCE LAYER");
      expect(html).not.toMatch(/\\u[0-9a-fA-F]{4}/);
      // The overlay never renders a BULL or CRASH scenario %.
      for (const label of ["BULL", "CRASH"]) {
        const value = tileValue(html, label);
        expect(value).not.toBeNull();
        expect(value).not.toMatch(/\d\s*%/);
      }
    });
  }
});

function briefing(overrides: Partial<OracleBriefingData> = {}): OracleBriefingData {
  return {
    question: "Is credit stress building?",
    missionId: "M-1",
    timestamp: "Oct 2, 2026",
    executiveSummary: "Credit is calm.",
    marketBias: "NOT STATED",
    confidence: undefined,
    marketRegime: "Unknown",
    threatLevel: "NOT STATED",
    pressureIndex: null,
    riskLevel: "Not stated",
    bullProbability: null,
    bearProbability: null,
    keyFindings: ["Credit is calm."],
    supportingEvidence: [],
    riskFactors: [],
    missionRecommendation: "Hold.",
    finalVerdictAction: "NOT STATED",
    forecastMetadata: insufficientHorizonMetadata("oracle-briefing", "2026-10-02T12:00:00.000Z"),
    disclaimer: "Informational only.",
    followUpChips: [],
    ...overrides,
  } as OracleBriefingData;
}

describe("2. PLATO briefing: no 50 default for pressure, bull or bear", () => {
  const panel = read("client/src/components/AshaPanel.tsx");

  it("AshaPanel maps a missing pressure, bull and bear to null, never 50", () => {
    expect(panel).toContain("pressureIndex: response.pressureIndex ?? fullPageContext.pressureScore ?? null,");
    expect(panel).toContain("bullProbability: response.bullProbability ?? null,");
    expect(panel).toContain("bearProbability: response.bearProbability ?? null,");
    expect(panel).not.toMatch(/\?\?\s*50\b/);
    expect(panel).not.toMatch(/(pressureIndex|pressureScore|bullProbability|bearProbability)[^\n;]*\|\|\s*\d/);
  });

  it("a null, undefined or NaN pressure renders PRESSURE INDEX NOT AVAILABLE, never 50/100", () => {
    for (const pressureIndex of [null, undefined, Number.NaN]) {
      const html = renderToStaticMarkup(createElement(OracleBriefing, { data: briefing({ pressureIndex: pressureIndex as number | null }), visible: true, onAskAnother: () => {} }));
      expect(tileValue(html, "PRESSURE INDEX")).toBe("NOT AVAILABLE");
      const text = visibleText(html);
      expect(text).not.toMatch(/50\/100|NaN|undefined|null\/100/);
      expect(text).not.toMatch(/\b50\s*%/);
    }
    expect([null, undefined, Number.NaN, Infinity].map(pressureAvailable)).toEqual([false, false, false, false]);
  });

  it("a real pressure reading still renders", () => {
    const html = renderToStaticMarkup(createElement(OracleBriefing, { data: briefing({ pressureIndex: 33 }), visible: true, onAskAnother: () => {} }));
    expect(tileValue(html, "PRESSURE INDEX")).toBe("33/100");
  });
});

const metric = (id: string, score: number | null, level: string, color = "#64748B", trend: "rising" | "falling" | "stable" | null = "stable") => ({
  id, label: id.toUpperCase(), description: `${id} description`, score, level, driver: "", trend, color,
});
const TREND_ICON = /lucide-(minus|trending-up|trending-down)/g;

describe("3. /app/portfolio intelligence consumers render a null score as —", () => {
  const data = {
    regime: "Moderate Risk",
    metrics: [
      metric("ai-bubble-exposure", null, "Unavailable"),
      metric("rate-sensitivity", null, "Unavailable"),
      metric("liquidity-risk", null, "Unavailable"),
      metric("recession-exposure", null, "Unavailable"),
      metric("concentration-risk", 35, "Moderate", "#FFD60A"),
    ],
  };

  it("PortfolioIntelligence shows — and Unavailable for a null score, never 50 or null", () => {
    state.intelligence = data;
    const html = renderToStaticMarkup(createElement(PortfolioIntelligence));
    expect(html.split(">—</span>").length - 1).toBe(4);
    expect(html.split(">Unavailable</span>").length - 1).toBe(4);
    expect(html).toContain(">35</span>");
    expect(html).not.toMatch(/>(50|null|NaN)<\/span>/);
    expect(html).not.toContain("width:50%");
  });

  it("InstitutionalCommentary shows — for a null score and never ranks or quotes it", () => {
    state.intelligence = data;
    const html = renderToStaticMarkup(createElement(InstitutionalCommentary));
    expect(html.split(">—</span>").length - 1).toBe(4);
    expect(html).not.toMatch(/>(50|null|NaN)<\/span>/);
    expect(html).not.toMatch(/null\/100|50\/100/);
    expect(html).toContain("Highest risk factor: CONCENTRATION-RISK (35/100");
  });

  it("InstitutionalCommentary with only null scores quotes no risk factor", () => {
    state.intelligence = { regime: "Moderate Risk", metrics: data.metrics.slice(0, 4) };
    const html = renderToStaticMarkup(createElement(InstitutionalCommentary));
    expect(html).not.toContain("Highest risk factor");
    expect(html).not.toMatch(/\/100/);
  });

  it("r10: a null score or null trend shows no trend icon, and — instead of an empty bar", () => {
    state.intelligence = {
      regime: "Moderate Risk",
      metrics: [
        metric("ai-bubble-exposure", null, "Unavailable", "#64748B", null),
        metric("crash-vulnerability", null, "Unavailable", "#64748B", "stable"),
        metric("concentration-risk", null, "No positions", "#64748B", "stable"),
        metric("liquidity-risk", 40, "Elevated", "#FFD60A", null),
        metric("regime-alignment", 67, "High", "#FF6B35", "rising"),
      ],
    };
    const html = renderToStaticMarkup(createElement(PortfolioIntelligence));
    expect(html.match(TREND_ICON)).toEqual(["lucide-trending-up"]); // only the scored metric with a trend
    expect(html.split('data-gauge="unavailable"').length - 1).toBe(3);
    expect(html).toContain(">No positions</span>");
    expect(html).not.toContain("width:0%");
    const commentary = renderToStaticMarkup(createElement(InstitutionalCommentary));
    expect(commentary.split('data-gauge="unavailable"').length - 1).toBe(3);
    expect(commentary).not.toContain("width:0%");
  });
});
