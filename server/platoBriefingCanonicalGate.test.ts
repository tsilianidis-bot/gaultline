/**
 * PR #58 r3: the post-login PLATO briefing and the daily greeting must never render the
 * DEFAULT_INDICATORS demo baseline as data or send it to the model. Only canonical values bind.
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INDICATORS, type EngineOutput } from "../client/src/lib/engine";
import { selectBrowserMarketOutput, type BrowserMarketMode } from "../client/src/lib/marketStateProjection";
import {
  BRIEFING_NOT_AVAILABLE,
  buildBriefingDisplay,
  buildBriefingGreetingContext,
  buildDailyGreetingContext,
} from "../client/src/lib/ashaBriefingContext";
import type { CanonicalMarketState } from "../shared/marketState";

const engine = vi.hoisted(() => ({ value: null as null | { output: unknown; isLoading: boolean; marketMode: string } }));
vi.mock("@/contexts/EngineContext", () => ({ useEngine: () => engine.value }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Ada Lovelace" }, loading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: { asha: { dailyGreeting: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) } } },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/app/now", vi.fn()] }));

import AshaLiveBriefing from "../client/src/components/AshaLiveBriefing";

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
      story: "Credit is calm while rates are steady.",
      whyThisScore: "Evidence is mixed.",
      whyThisRegime: "No family is stressed.",
      keyDevelopments: [],
      narrative: { whatIsHappening: "Calm.", whyIsItHappening: "Liquidity ample.", whatHasChanged: "Little.", whatIsBuildingBeneathSurface: "Nothing notable." },
      evidenceFamilies: [{ name: "Credit", signal: "calm", strength: 30, trend: "stable", currentValue: "Spreads tight", historicalContext: "Below median", whyItMatters: "Credit transmits stress." }],
      evidenceConsensus: "mixed",
    },
    outlook: {
      probabilities: { bull: 53, neutral: 30, bear: 17, confidence: 0, primaryDriver: "Credit", evidenceBasis: "Spreads", historicalBasis: "Analogs" },
      regimeProbabilities: { bull: 53, softLanding: 30, stagflation: 7, recession: 8, crash: 2 },
      transitionProbabilities: { remainInRegime: 60, transitionToElevated: 20, transitionToLow: 15, transitionToCrisis: 5, confidence: 0, historicalBasis: "Analogs", currentEvidence: [] },
      highestProbabilityPath: "Remain moderate",
      invalidationConditions: [],
      topAnalog: null,
    },
    watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: ["Credit spreads"], accelerating: false, buildingPressure: false },
    act: { marketPosture: "neutral", decisionSummary: "Hold.", whatWouldInvalidate: "Credit widening.", riskControls: [] },
    history: { observationCount: 100, datasetSpan: "2018-present", currentStreakDescription: "Two weeks", lastMajorShift: null, analogSummary: "Mid-cycle" },
  } as CanonicalMarketState;
}

const fallback = () => selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
const simulation = () => selectBrowserMarketOutput({ marketState: canonicalState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: { vix: 40 } });
const canonical = () => selectBrowserMarketOutput({ marketState: canonicalState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });

// The demo baseline QA saw on /app/now with no canonical state.
const DEMO_VALUES = ["44.6", "46%", "54%", "Dot-Com", "MODERATE RISK"];

function render(selected: { output: EngineOutput; mode: BrowserMarketMode }): string {
  engine.value = { output: selected.output, isLoading: false, marketMode: selected.mode };
  return renderToStaticMarkup(createElement(AshaLiveBriefing, { onContinue: () => {} }));
}

// The client build uses the classic JSX runtime under vitest's esbuild transform.
(globalThis as { React?: typeof React }).React = React;

beforeEach(() => {
  engine.value = null;
});

describe("demo baseline facts (guards the fixture)", () => {
  it("the deterministic fallback really is the 44.6 / 46% / 54% / Dot-Com demo baseline", () => {
    const { output, mode } = fallback();
    expect(mode).toBe("deterministic-fallback");
    expect((output.overall.score * 10).toFixed(1)).toBe("44.6");
    expect(output.probability.bullProbability).toBe(46);
    expect(output.probability.crashProbability).toBe(54);
    expect(output.analogs[0]?.era).toMatch(/Dot-Com/);
  });
});

describe("AshaLiveBriefing outside canonical mode", () => {
  for (const [name, select] of [["deterministic-fallback", fallback], ["simulation", simulation]] as const) {
    it(`${name}: tiles and badge read NOT AVAILABLE and no demo value renders`, () => {
      const html = render(select());
      for (const value of DEMO_VALUES) expect(html).not.toContain(value);
      expect(html).not.toMatch(/\d+(\.\d+)?\/100/);
      expect(html.split(BRIEFING_NOT_AVAILABLE).length - 1).toBeGreaterThanOrEqual(6); // badge + 5 tiles
      const display = buildBriefingDisplay(select().output, select().mode);
      expect(display.available).toBe(false);
      expect(display.badgeRegime).toBeNull();
      expect(display.stats.map(stat => stat.value)).toEqual(Array(5).fill(BRIEFING_NOT_AVAILABLE));
    });

    it(`${name}: nothing from the engine reaches the model`, () => {
      const context = buildBriefingGreetingContext(select().output, select().mode);
      expect(context).toEqual({});
      const serialized = JSON.stringify(context);
      for (const value of ["44.6", "regimeConfidence", "0.75", "Dot-Com", "pressureScore"]) expect(serialized).not.toContain(value);
    });
  }
});

describe("AshaLiveBriefing in canonical mode", () => {
  it("tiles and badge bind to canonical values (33/100, bull 53%, crash 2%)", () => {
    const html = render(canonical());
    expect(html).toContain("33/100");
    expect(html).toContain("53%");
    expect(html).toContain("2%");
    expect(html).toContain("Moderate Risk");
    for (const value of ["44.6", "46%", "54%", "Dot-Com"]) expect(html).not.toContain(value);
    expect(html).not.toContain(BRIEFING_NOT_AVAILABLE);
  });

  it("sends only canonical values and no confidence", () => {
    const context = buildBriefingGreetingContext(canonical().output, canonical().mode);
    expect(context).toEqual({
      pressureScore: 33,
      regime: "Moderate Risk",
      narrative: "Credit is calm while rates are steady.",
      trend: "Moderate · Stable",
      keyDrivers: ["Credit"],
    });
    expect(context).not.toHaveProperty("regimeConfidence");
  });

  it("does not send demo domains when the canonical state has no evidence families", () => {
    const state = canonicalState();
    state.why.evidenceFamilies = [];
    const selected = selectBrowserMarketOutput({ marketState: state, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(buildBriefingGreetingContext(selected.output, selected.mode)).not.toHaveProperty("keyDrivers");
  });
});

describe("AshaDailyGreeting context", () => {
  it("never sends a default pressure, a hard-coded confidence or non-canonical engine text", () => {
    const context = buildDailyGreetingContext({ pressureIndex: null, regime: null, confidenceOrEvidenceQuality: null }, fallback().output, fallback().mode);
    expect(context).toEqual({ narrative: "Current evidence quality: unavailable" });
  });

  it("binds canonical pressure and regime, and engine text only in canonical mode", () => {
    const context = buildDailyGreetingContext({ pressureIndex: 33, regime: "Moderate Risk", confidenceOrEvidenceQuality: "HEALTHY" }, canonical().output, canonical().mode);
    expect(context).toEqual({
      pressureScore: 33,
      regime: "Moderate Risk",
      narrative: "Current evidence quality: healthy",
      trend: "Moderate · Stable",
      keyDrivers: ["Credit spreads"],
    });
    expect(context).not.toHaveProperty("regimeConfidence");
  });

  it("the components no longer hard-code regimeConfidence 0.75 or a default narrative", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    for (const file of ["AshaLiveBriefing.tsx", "AshaDailyGreeting.tsx"]) {
      const source = readFileSync(path.resolve(import.meta.dirname, "..", "client/src/components", file), "utf8");
      expect(source).not.toMatch(/regimeConfidence:\s*0\.75/);
      expect(source).not.toContain("Markets are in a period of mixed signals.");
      expect(source).not.toMatch(/pressureIndex \?\? 0\) \/ 10/);
    }
  });
});
