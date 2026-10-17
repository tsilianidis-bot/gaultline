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
import type { AshaGatewayContext, AshaPageContext } from "../shared/ashaContext";
import type { CanonicalMarketState } from "../shared/marketState";
import { buildAshaCanonicalContextBlock, outlookForModel, pageSupplementForModel, withholdScenarioPercents, withholdScenarioPercentsDeep } from "./ashaGateway";

const engine = vi.hoisted(() => ({ value: null as null | { output: unknown; isLoading: boolean; marketMode: string } }));
vi.mock("@/contexts/EngineContext", () => ({ useEngine: () => engine.value }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Ada Lovelace" }, loading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: { asha: { dailyGreeting: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) } } },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/app/now", vi.fn()] }));

import AshaLiveBriefing from "../client/src/components/AshaLiveBriefing";

/**
 * Static test double only: this fixture is not a live-provider assertion. Fake
 * values are explicitly MOCK and retain provider observation/receipt timestamps.
 */
const MOCK_CANONICAL_PROVENANCE = {
  sourceKind: "MOCK",
  fixtureId: "plato-briefing-canonical-gate/2026-10-02",
  providerObservations: [
    { provider: "seismograph", adapter: "seismographAdapters", observedAt: "2026-10-02T11:55:00.000Z", receivedAt: "2026-10-02T11:56:00.000Z" },
    { provider: "FRED", adapter: "fred", observedAt: "2026-10-02T11:50:00.000Z", receivedAt: "2026-10-02T11:56:00.000Z" },
    { provider: "CoinGecko", adapter: "coingecko", observedAt: "2026-10-02T11:54:00.000Z", receivedAt: "2026-10-02T11:56:00.000Z" },
  ],
} as const;

type MockCanonicalMarketState = CanonicalMarketState & {
  fixtureProvenance: typeof MOCK_CANONICAL_PROVENANCE;
};

function canonicalState(): MockCanonicalMarketState {
  return {
    version: "1.0",
    canonicalStateId: "mock-state:plato-briefing-2026-10-02T12:00:00.000Z",
    stateHash: "mock-sha256:plato-briefing-canonical-gate-v1",
    inputSnapshotId: "mock-input:plato-briefing-2026-10-02T11:56:00.000Z",
    generatedAt: "2026-10-02T12:00:00.000Z",
    sourceUpdatedAt: "2026-10-02T11:55:00.000Z",
    freshness: "live",
    cache: { status: "fresh-cache", ageMs: 300_000, staleReason: null },
    sourceHealth: [
      { id: "seismograph", label: "Seismograph [MOCK]", status: "healthy", required: true, asOf: "2026-10-02T11:55:00.000Z", detail: "MOCK fixture observation; not a provider connectivity claim." },
      { id: "historical-memory", label: "Historical memory [MOCK]", status: "healthy", required: false, asOf: "2026-10-02T11:50:00.000Z", detail: "MOCK fixture observation; not a historical-data claim." },
      { id: "fred", label: "FRED [MOCK]", status: "healthy", required: true, asOf: "2026-10-02T11:50:00.000Z", detail: "MOCK fixture observation; not a provider connectivity claim." },
      { id: "coingecko", label: "CoinGecko [MOCK]", status: "healthy", required: false, asOf: "2026-10-02T11:54:00.000Z", detail: "MOCK fixture observation; not a provider connectivity claim." },
    ],
    warnings: [],
    now: { pressureScore: 33, regime: "Moderate Risk", stressLevel: "Moderate", direction: "Stable", historicalPercentile: 40, headline: "Pressure is contained.", topDrivers: ["Credit"], threats: [], supports: ["Credit"] },
    why: {
      story: "Credit is calm while rates are steady.",
      whyThisScore: "Evidence is mixed.",
      whyThisRegime: "No family is stressed.",
      keyDevelopments: [],
      narrative: { whatIsHappening: "Calm.", whyIsItHappening: "Liquidity ample.", whatHasChanged: "Little.", whatIsBuildingBeneathSurface: "Nothing notable." },
      evidenceFamilies: [{ name: "Credit", signal: "neutral", strength: 30, trend: "stable", currentValue: "Spreads tight", historicalContext: "Below median", whyItMatters: "Credit transmits stress." }],
      evidenceConsensus: "moderate",
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
    act: { marketPosture: "balanced", decisionSummary: "Hold.", whatWouldInvalidate: "Credit widening.", riskControls: [] },
    history: { observationCount: 100, datasetSpan: "2018-present", currentStreakDescription: "Two weeks", lastMajorShift: null, analogSummary: "Mid-cycle" },
    fixtureProvenance: MOCK_CANONICAL_PROVENANCE,
  };
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

  it("the canonical fixture declares MOCK provenance, immutable identity, and timestamped provider observations", () => {
    const state = canonicalState();
    expect(state.fixtureProvenance.sourceKind).toBe("MOCK");
    expect(state.canonicalStateId).toMatch(/^mock-state:/);
    expect(state.stateHash).toMatch(/^mock-sha256:/);
    expect(state.inputSnapshotId).toMatch(/^mock-input:/);
    expect(state.fixtureProvenance.providerObservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "seismograph", adapter: "seismographAdapters", observedAt: state.sourceUpdatedAt }),
      expect.objectContaining({ provider: "FRED", adapter: "fred", observedAt: "2026-10-02T11:50:00.000Z" }),
      expect.objectContaining({ provider: "CoinGecko", adapter: "coingecko", observedAt: "2026-10-02T11:54:00.000Z" }),
    ]));
    expect(state.sourceHealth.every(source => source.detail.includes("MOCK fixture"))).toBe(true);
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
    expect(display.badgeLabel).toBe("MODERATE RISK"); // canonical 33/100 → 25–44 band
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
  const clientAuthoredPage: AshaPageContext = {
    page: "/app/outlook",
    pressureScore: 91,
    regime: "CLIENT-FABRICATED CRISIS",
    regimeConfidence: 0.99,
    narrative: "Client-provided market claim",
    trend: "Client-provided trend",
    keyDrivers: ["Client-provided driver"],
    historicalAnalog: "Client-provided analog",
    transitionProbability: 88,
    additionalContext: { unsupportedMarketClaim: "Client-provided claim" },
  };

  const context = (): AshaGatewayContext => ({
    version: "1.1" as const,
    destination: "outlook" as const,
    page: clientAuthoredPage,
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

  it("the full context block takes market facts from server canonical state and drops every client-authored supplement claim", () => {
    const block = buildAshaCanonicalContextBlock(context());
    const json = JSON.parse(block.slice(block.indexOf("{"), block.indexOf("\n\nSCOPE RULE")));
    expect(json.outlook.scenarioProbabilities).toBe("Uncalibrated");
    expect(json.pageSupplement).toEqual({ page: "/app/outlook" });
    expect(Object.keys(json.pageSupplement)).toEqual(["page"]);
    expect(json.now.pressureScore).toBe(33);
    expect(json.now.regime).toBe("Moderate Risk");
    expect(JSON.stringify(json.outlook)).not.toMatch(PERCENT);
    expect(block).not.toMatch(/"bull":\s*53|"crash":\s*2\b|53%/);
    for (const clientOnlyValue of ["CLIENT-FABRICATED CRISIS", "Client-provided market claim", "Client-provided trend", "Client-provided driver", "Client-provided analog", "unsupportedMarketClaim"]) {
      expect(block).not.toContain(clientOnlyValue);
    }
    expect(json.pageSupplement).not.toHaveProperty("pressureScore");
    expect(json.pageSupplement).not.toHaveProperty("transitionProbability");
    expect(json.pageSupplement).not.toHaveProperty("regimeConfidence");
  });

  it("percents embedded in outlook prose are withheld; analog similarity is kept", () => {
    expect(withholdScenarioPercents("The highest-probability outcome (60% historical frequency) is continuation. The closest analog — Dot-Com (78% similarity) — resolved."))
      .toBe("The highest-probability outcome (Uncalibrated) is continuation. The closest analog — Dot-Com (78% similarity) — resolved.");
    expect(withholdScenarioPercents("a transition toward elevated stress (25% historical frequency), driven by credit")).not.toMatch(PERCENT);
    expect(withholdScenarioPercents("bull 53% and crash 2.5 % probability")).toBe("bull Uncalibrated and crash Uncalibrated probability");
    expect(withholdScenarioPercents("probability of 60% and confidence: 41%")).toBe("probability of Uncalibrated and confidence: Uncalibrated");
    expect(withholdScenarioPercents("53% bull / 17% bear")).toBe("Uncalibrated bull / Uncalibrated bear");
  });

  it("observed values and thresholds keep their percent", () => {
    for (const text of ["Breadth expands materially — more than 70% of sectors participating", "HY spreads 3.1% and CPI 2.9%"]) {
      expect(withholdScenarioPercents(text)).toBe(text);
    }
  });

  it("act.decisionSummary goes to the model with its embedded percent withheld", () => {
    const state = canonicalState();
    state.act.decisionSummary = "Maintain a balanced posture while The highest-probability outcome (60% historical frequency) is continuation.";
    const block = buildAshaCanonicalContextBlock({ ...context(), marketState: state } as Parameters<typeof buildAshaCanonicalContextBlock>[0]);
    expect(block).toContain("Maintain a balanced posture while The highest-probability outcome (Uncalibrated) is continuation.");
    expect(block).not.toContain("60%");
  });

  it("every other string in the block is filtered too", () => {
    expect(withholdScenarioPercentsDeep({ a: ["bull 53%"], b: { c: "(25% probability)" }, n: 53 })).toEqual({ a: ["bull Uncalibrated"], b: { c: "(Uncalibrated)" }, n: 53 });
    const state = canonicalState();
    state.watch.whatToWatch = ["Crash odds near 20%"];
    state.why.story = "Recession probability is 30%.";
    const block = buildAshaCanonicalContextBlock({ ...context(), marketState: state } as Parameters<typeof buildAshaCanonicalContextBlock>[0]);
    expect(block).not.toMatch(/20%|30%/);
  });

  it("the page supplement preserves only the route, never client-authored market facts", () => {
    expect(pageSupplementForModel(clientAuthoredPage)).toEqual({ page: "/app/outlook" });
  });
});
