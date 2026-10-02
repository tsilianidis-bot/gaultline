/**
 * PR #58 r3: the post-login PLATO briefing and the daily greeting must never render the
 * DEFAULT_INDICATORS demo baseline as data or send it to the model. Only canonical values bind.
 *
 * Scenario tiles (BULL, CRASH) follow the owner-approved probability rule: a scenario or
 * probability % shows only when its contract status is explicitly AVAILABLE (none is today);
 * otherwise the tile reads "Uncalibrated". No scenario % is sent to the model.
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeEngine, DEFAULT_INDICATORS, type EngineOutput } from "../client/src/lib/engine";
import { selectBrowserMarketOutput, type BrowserMarketMode } from "../client/src/lib/marketStateProjection";
import {
  BRIEFING_NOT_AVAILABLE,
  BRIEFING_SCENARIO_UNCALIBRATED,
  buildBriefingDisplay,
  buildBriefingGreetingContext,
  buildDailyGreetingContext,
} from "../client/src/lib/ashaBriefingContext";
import type { CanonicalMarketState } from "../shared/marketState";
import { buildAshaCanonicalContextBlock, outlookForModel, withholdScenarioPercents } from "./ashaGateway";

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

/** Rendered value of a briefing tile, read from the label/value pair in the markup. */
function tileValue(html: string, label: string): string | null {
  const match = new RegExp(`>${label}</div><div[^>]*>([^<]*)</div>`).exec(html);
  return match ? match[1] : null;
}

const PERCENT = /\d+(\.\d+)?\s*%/;

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
  it("the browser engine's demo baseline is 44.6 / 46% / 54% / Dot-Com", () => {
    // Raw engine numbers, before any display gate (the probability contract may withhold them later).
    const output = computeEngine(DEFAULT_INDICATORS);
    expect((output.overall.score * 10).toFixed(1)).toBe("44.6");
    expect(output.probability.bullProbability).toBe(46);
    expect(output.probability.crashProbability).toBe(54);
    expect(output.analogs[0]?.era).toMatch(/Dot-Com/);
    const { output: selected, mode } = fallback();
    expect(mode).toBe("deterministic-fallback");
    expect((selected.overall.score * 10).toFixed(1)).toBe("44.6");
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
  it("pressure, regime and badge bind to canonical values", () => {
    const html = render(canonical());
    const display = buildBriefingDisplay(canonical().output, canonical().mode);
    expect(display.available).toBe(true);
    expect(display.badgeRegime).toBe("Moderate Risk");
    expect(display.badgeLabel).toBe("STABLE"); // canonical 33/100
    expect(tileValue(html, "PRESSURE")).toBe("33/100");
    expect(tileValue(html, "STATE")).toBe("Moderate");
    expect(html).toContain("Moderate Risk");
    for (const value of ["44.6", "Dot-Com"]) expect(html).not.toContain(value);
    expect(html).not.toContain(BRIEFING_NOT_AVAILABLE);
  });

  it("a missing or non-finite canonical pressure reads NOT AVAILABLE and never prints NaN", () => {
    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      const base = canonical().output;
      const output = { ...base, overall: { ...base.overall, score } } as EngineOutput;
      const display = buildBriefingDisplay(output, "canonical");
      expect(display.stats.find(stat => stat.label === "PRESSURE")?.value).toBe(BRIEFING_NOT_AVAILABLE);
      expect(display.badgeLabel).toBe(BRIEFING_NOT_AVAILABLE);
      expect(display.pressureScore10).toBeNull();
      expect(display.badgeRegime).toBe("Moderate Risk");
      engine.value = { output, isLoading: false, marketMode: "canonical" };
      const html = renderToStaticMarkup(createElement(AshaLiveBriefing, { onContinue: () => {} }));
      expect(html).not.toContain("NaN");
      expect(tileValue(html, "PRESSURE")).toBe(BRIEFING_NOT_AVAILABLE);
    }
  });

  it("a pressure score not sourced from the canonical MarketState does not bind", () => {
    const base = canonical().output;
    const output = { ...base, overall: { ...base.overall, source: "browser-engine" } } as EngineOutput;
    expect(buildBriefingDisplay(output, "canonical").stats.find(stat => stat.label === "PRESSURE")?.value).toBe(BRIEFING_NOT_AVAILABLE);
  });

  it("no tile or badge ever prints NaN in any mode", () => {
    for (const select of [fallback, simulation, canonical]) {
      const html = render(select());
      expect(html).not.toContain("NaN");
    }
  });

  it("scenario tiles show Uncalibrated and never a raw percent", () => {
    const html = render(canonical());
    for (const label of ["BULL", "CRASH"]) {
      expect(tileValue(html, label)).toBe(BRIEFING_SCENARIO_UNCALIBRATED);
    }
    const stats = buildBriefingDisplay(canonical().output, canonical().mode).stats;
    for (const stat of stats) expect(stat.value).not.toMatch(PERCENT);
    // The canonical state carries bull 53 / crash 2 and the demo baseline 46 / 54: none renders.
    for (const value of ["53%", "46%", "54%"]) expect(html).not.toContain(value);
  });

  it("scenario tiles ignore raw engine numbers even when they are finite", () => {
    const output = { ...canonical().output, probability: { ...canonical().output.probability, bullProbability: 53, crashProbability: 2 } };
    const stats = buildBriefingDisplay(output as EngineOutput, "canonical").stats;
    expect(stats.find(stat => stat.label === "BULL")?.value).toBe(BRIEFING_SCENARIO_UNCALIBRATED);
    expect(stats.find(stat => stat.label === "CRASH")?.value).toBe(BRIEFING_SCENARIO_UNCALIBRATED);
  });

  it("a scenario % shows only with an explicit AVAILABLE contract status", () => {
    const base = canonical().output;
    const withStatus = (state: string, percent: number | null) => ({
      ...base,
      probabilityDisplay: {
        bullProbability: { state, text: state === "AVAILABLE" ? `${percent}%` : "Uncalibrated", percent },
        crashProbability: { state: "NOT_OFFERED", text: "Not offered", percent: null },
      },
    }) as unknown as EngineOutput;
    const available = buildBriefingDisplay(withStatus("AVAILABLE", 41), "canonical").stats;
    expect(available.find(stat => stat.label === "BULL")?.value).toBe("41%");
    expect(available.find(stat => stat.label === "CRASH")?.value).toBe(BRIEFING_SCENARIO_UNCALIBRATED);
    for (const state of ["UNCALIBRATED", "INSUFFICIENT_DATA", "UNAVAILABLE", "NOT_OFFERED"]) {
      const stats = buildBriefingDisplay(withStatus(state, 41), "canonical").stats;
      expect(stats.find(stat => stat.label === "BULL")?.value).toBe(BRIEFING_SCENARIO_UNCALIBRATED);
    }
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
    expect(JSON.stringify(context)).not.toMatch(PERCENT);
    expect(JSON.stringify(context)).not.toMatch(/probabilit|bull|crash/i);
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

describe("PLATO model context carries no scenario percent", () => {
  const context = () => ({
    version: "1.1" as const,
    destination: "outlook" as const,
    page: { page: "/app/outlook", transitionProbability: 20, pressureScore: 33 },
    marketState: canonicalState(),
  });

  it("outlook goes to the model as status text, without scenario, regime or transition numbers", () => {
    const outlook = outlookForModel(canonicalState().outlook);
    const serialized = JSON.stringify(outlook);
    expect(outlook.scenarioProbabilities).toBe("Uncalibrated");
    expect(outlook.transitionProbabilities).toBe("Uncalibrated");
    expect(outlook).not.toHaveProperty("probabilities");
    expect(outlook).not.toHaveProperty("regimeProbabilities");
    for (const key of ["bull", "neutral", "bear", "crash", "softLanding", "stagflation", "recession", "remainInRegime", "transitionToElevated", "confidence"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    // Non-numeric evidence still goes.
    expect(serialized).toContain("Remain moderate");
    expect(serialized).toContain("Spreads");
  });

  it("the full context block has no scenario percent and drops the page transition probability", () => {
    const block = buildAshaCanonicalContextBlock(context() as Parameters<typeof buildAshaCanonicalContextBlock>[0]);
    const json = JSON.parse(block.slice(block.indexOf("{"), block.indexOf("\n\nSCOPE RULE")));
    expect(json.outlook.scenarioProbabilities).toBe("Uncalibrated");
    expect(json.pageSupplement).not.toHaveProperty("transitionProbability");
    expect(json.pageSupplement.pressureScore).toBe(33);
    expect(json.now.pressureScore).toBe(33);
    expect(json.now.regime).toBe("Moderate Risk");
    expect(JSON.stringify(json.outlook)).not.toMatch(PERCENT);
    expect(block).not.toMatch(/"bull":\s*53|"crash":\s*2\b|53%/);
  });

  it("percents embedded in outlook prose are withheld; analog similarity is kept", () => {
    expect(withholdScenarioPercents("The highest-probability outcome (60% historical frequency) is continuation. The closest analog — Dot-Com (78% similarity) — resolved."))
      .toBe("The highest-probability outcome (Uncalibrated) is continuation. The closest analog — Dot-Com (78% similarity) — resolved.");
    expect(withholdScenarioPercents("a transition toward elevated stress (25% historical frequency), driven by credit")).not.toMatch(PERCENT);
    expect(withholdScenarioPercents("bull 53% and crash 2.5 % probability")).toBe("bull Uncalibrated and crash Uncalibrated");
  });
});
