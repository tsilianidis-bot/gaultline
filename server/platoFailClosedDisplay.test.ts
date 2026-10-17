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

/**
 * MOCK FIXTURE ONLY — this file makes no provider request. These are recorded,
 * timestamped provider-observation identifiers so the display fixture cannot be
 * mistaken for live market evidence.
 */
const MOCK_SOURCE_METADATA = Object.freeze({
  sourceType: "MOCK" as const,
  fixtureId: "plato-fail-closed-display-2026-10-02",
  recordedAt: "2026-10-02T12:00:00.000Z",
  providerObservations: [
    { provider: "FRED", observationId: "BAMLH0A0HYM2", observedAt: "2026-10-02T11:55:00.000Z" },
    { provider: "Yahoo Finance", observationId: "^VIX", observedAt: "2026-10-02T11:55:00.000Z" },
    { provider: "CoinGecko", observationId: "bitcoin-usd", observedAt: "2026-10-02T11:55:00.000Z" },
  ],
});

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

type MockCanonicalMarketState = CanonicalMarketState & {
  /** Test-only provenance, deliberately outside the production display contract. */
  fixtureSource: typeof MOCK_SOURCE_METADATA;
};

function canonicalState(): MockCanonicalMarketState {
  return {
    fixtureSource: MOCK_SOURCE_METADATA,
    version: "1.0",
    canonicalStateId: "state:plato-display-fixture:2026-10-02T12:00:00.000Z",
    stateHash: "hash:plato-display-fixture:9d1a04e6",
    inputSnapshotId: "input:plato-display-fixture:2026-10-02T11:55:00.000Z",
    generatedAt: "2026-10-02T12:00:00.000Z",
    sourceUpdatedAt: "2026-10-02T11:55:00.000Z",
    freshness: "live",
    cache: { status: "fresh-cache", ageMs: 300_000, staleReason: null },
    sourceHealth: [
      { id: "seismograph", label: "Canonical Seismograph", status: "healthy", required: true, asOf: "2026-10-02T11:55:00.000Z", detail: "MOCK fixture assembled from recorded provider observations." },
      { id: "historical-memory", label: "Historical Market Memory", status: "healthy", required: true, asOf: "2026-10-02T11:55:00.000Z", detail: "MOCK fixture history; not a live provider claim." },
      { id: "fred", label: "Macro and Credit Evidence", status: "healthy", required: true, asOf: "2026-10-02T11:55:00.000Z", detail: "MOCK fixture of recorded FRED observation BAMLH0A0HYM2." },
      { id: "coingecko", label: "Crypto Market Overlay", status: "healthy", required: false, asOf: "2026-10-02T11:55:00.000Z", detail: "MOCK fixture of recorded CoinGecko observation bitcoin-usd." },
    ],
    warnings: [],
    now: {
      pressureScore: 33,
      regime: "Moderate Risk",
      stressLevel: "Moderate",
      direction: "Stable",
      historicalPercentile: 40,
      headline: "Mocked canonical display fixture.",
      topDrivers: ["Credit Markets", "Liquidity Conditions", "Volatility Regime"],
      threats: ["Credit Markets"],
      supports: ["Liquidity Conditions"],
    },
    why: {
      story: "Mocked display fixture only.",
      whyThisScore: "Recorded mock vector values are displayed only in this isolated test.",
      whyThisRegime: "The canonical fixture is bound to one immutable mock state identity.",
      keyDevelopments: [],
      narrative: {
        whatIsHappening: "Mocked fixture.",
        whyIsItHappening: "Recorded provider-observation metadata.",
        whatHasChanged: "Not assessed by this display test.",
        whatIsBuildingBeneathSurface: "Not assessed by this display test.",
      },
      evidenceFamilies: [
        ["Liquidity Conditions", "recovering", 24, "improving", "MOCK FRED liquidity observation"],
        ["Credit Markets", "neutral", 33, "stable", "MOCK FRED credit-spread observation"],
        ["Yield Curve & Rates", "neutral", 38, "stable", "MOCK FRED rates observation"],
        ["Macro Sensitivity", "neutral", 35, "stable", "MOCK FRED macro observation"],
        ["Market Breadth", "neutral", 36, "stable", "MOCK Yahoo Finance breadth observation"],
        ["AI Bubble Risk", "neutral", 32, "stable", "MOCK provider observation"],
      ].map(([name, signal, strength, trend, currentValue]) => ({
        name,
        signal: signal as "bullish" | "bearish" | "neutral" | "stressed" | "recovering",
        strength,
        trend: trend as "improving" | "deteriorating" | "stable",
        currentValue,
        historicalContext: "Mocked fixture context only.",
        whyItMatters: "Included to keep the fixture's canonical vector set complete.",
      })),
      evidenceConsensus: "moderate",
      evidenceAsOfMonth: "2026-10",
    },
    outlook: {
      // Unsupported forecasts remain withheld even in a fully identified mock state.
      probabilities: { bull: Number.NaN, neutral: Number.NaN, bear: Number.NaN, confidence: Number.NaN, primaryDriver: "Not established", evidenceBasis: "Mocked fixture", historicalBasis: "Not established" },
      regimeProbabilities: { bull: Number.NaN, softLanding: Number.NaN, stagflation: Number.NaN, recession: Number.NaN, crash: Number.NaN },
      transitionProbabilities: { remainInRegime: Number.NaN, transitionToElevated: Number.NaN, transitionToLow: Number.NaN, transitionToCrisis: Number.NaN, confidence: Number.NaN, historicalBasis: "Not established", currentEvidence: [] },
      probabilityContract: null,
      highestProbabilityPath: "Not established", invalidationConditions: [], topAnalog: null,
    },
    watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false },
    act: { marketPosture: "balanced", decisionSummary: "No operational guidance is asserted by this display fixture.", whatWouldInvalidate: "Not established", riskControls: [] },
    history: { observationCount: 100, datasetSpan: "MOCK fixture history", currentStreakDescription: "Not established", lastMajorShift: null, analogSummary: "Not established" },
  };
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

  it("AshaPanel accepts only server-response facts and citations; missing fields stay withheld", () => {
    // Isolate the object that crosses the panel-to-Oracle boundary instead of
    // pinning a whole source line. This makes the test resistant to safe
    // formatting/provenance edits while retaining the no-client-authority guard.
    const match = /const data: OracleBriefingData = \{([\s\S]*?)\n\s*\};\n\s*setBriefingData\(data\)/.exec(panel);
    expect(match, "Oracle briefing mapping must remain explicit").not.toBeNull();
    const mapping = match?.[1] ?? "";

    for (const field of ["pressureIndex", "bullProbability", "bearProbability"]) {
      expect(mapping).toMatch(new RegExp(`\\b${field}:\\s*response\\.${field}\\s*\\?\\?\\s*null\\b`));
    }
    // The browser/page context is request context only — it cannot supplement
    // an absent response fact or become an Oracle citation.
    expect(mapping).not.toMatch(/fullPageContext\.|canonicalState\.|canonicalEngine\./);
    expect(mapping).toMatch(/\bsourceCitations:\s*response\.sourceCitations\b/);
    expect(mapping).toMatch(/\bsupportingEvidence:\s*response\.supportingEvidence\?\.length\s*\?\s*response\.supportingEvidence\s*:\s*response\.sources\b/);
    // Response confidence and horizon are not manufactured from a numeric default.
    expect(mapping).toMatch(/\bconfidence:\s*undefined\b/);
    expect(mapping).toMatch(/\bforecastMetadata:\s*insufficientHorizonMetadata\(/);
    expect(mapping).not.toMatch(/\?\?\s*50\b|\|\|\s*50\b/);
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

  it("r11: a null regime reads Regime unavailable / Current regime: Unavailable, never undefined", () => {
    state.intelligence = { regime: null, dataSource: "live", metrics: [metric("portfolio-pressure", null, "Unavailable", "#64748B", null)] };
    const html = renderToStaticMarkup(createElement(PortfolioIntelligence));
    expect(html).toContain("Regime unavailable");
    const commentary = renderToStaticMarkup(createElement(InstitutionalCommentary));
    expect(commentary).toContain("Current regime: Unavailable.");
    for (const out of [html, commentary]) expect(out).not.toMatch(/undefined|null/);
  });
});
