import { describe, expect, it, vi } from "vitest";
import type { CanonicalMarketState } from "../shared/marketState";
import {
  buildAshaCanonicalContextBlock,
  createAshaGatewayContext,
  getAshaContextProvenance,
  invokeAshaGateway,
} from "./ashaGateway";
import { readPlatoConfig, type PlatoConfig } from "./plato/config";
import { PlatoUnavailableError } from "./plato/errors";

function testConfig(models: string[]): PlatoConfig {
  return { ...readPlatoConfig({}), models, retryBaseDelayMs: 0 };
}

const marketState = {
  version: "1.0",
  generatedAt: "2026-07-23T13:00:00.000Z",
  sourceUpdatedAt: "2026-07-23T12:59:00.000Z",
  freshness: "stale",
  cache: { status: "stale-if-error", ageMs: 60_000, staleReason: "Provider timeout" },
  sourceHealth: [
    { id: "seismograph", label: "Canonical Seismograph", status: "degraded", required: true, asOf: "2026-07-23T12:59:00.000Z", detail: "Serving last known-good state." },
    { id: "historical-memory", label: "Historical Market Memory", status: "healthy", required: true, asOf: "2026-07-23T12:59:00.000Z", detail: "Available." },
    { id: "fred", label: "Macro and Credit Evidence", status: "healthy", required: true, asOf: "2026-07-23T12:59:00.000Z", detail: "Available." },
    { id: "coingecko", label: "Crypto Market Overlay", status: "unavailable", required: false, asOf: "2026-07-23T12:59:00.000Z", detail: "Unavailable." },
  ],
  warnings: ["Provider timeout"],
  now: { pressureScore: 62, regime: "Late Cycle", stressLevel: "Elevated", direction: "Deteriorating", historicalPercentile: 78, headline: "Pressure is elevated.", topDrivers: ["Credit"] },
  why: { story: "Credit is tightening.", whyThisScore: "Credit and liquidity.", whyThisRegime: "Growth is slowing.", keyDevelopments: ["Spreads widened"], narrative: { whatIsHappening: "Pressure is rising.", whyIsItHappening: "Liquidity is tighter.", whatHasChanged: "Credit weakened.", whatIsBuildingBeneathSurface: "Funding stress." }, evidenceFamilies: [{ name: "Credit", signal: "stressed", strength: 80, trend: "deteriorating", currentValue: "Wider", historicalContext: "Above median", whyItMatters: "Financing risk" }], evidenceConsensus: "moderate" },
  outlook: { probabilities: { bull: 25, neutral: 40, bear: 35, confidence: 68, primaryDriver: "Credit", evidenceBasis: "Spreads", historicalBasis: "Late-cycle analogs" }, regimeProbabilities: { bull: 15, softLanding: 35, stagflation: 20, recession: 25, crash: 5 }, transitionProbabilities: { remainInRegime: 55, transitionToElevated: 25, transitionToLow: 15, transitionToCrisis: 5, confidence: 68, historicalBasis: "Analogs", currentEvidence: ["Credit"] }, highestProbabilityPath: "A slower, more volatile expansion.", invalidationConditions: ["Credit improves"], topAnalog: null },
  watch: { developingConditions: [], activePatterns: [], whatChanged: ["Credit weakened"], whatToWatch: ["Funding markets"], accelerating: false, buildingPressure: true },
  act: { marketPosture: "balanced", decisionSummary: "Maintain balance.", whatWouldInvalidate: "Credit recovery.", riskControls: ["Size risk conservatively"] },
  history: { observationCount: 100, datasetSpan: "2020-2026", currentStreakDescription: "Three weeks elevated", lastMajorShift: null, analogSummary: "Late-cycle periods" },
} satisfies CanonicalMarketState;

describe("ASHA canonical context gateway", () => {
  it("enriches a lightweight page payload with canonical MarketState and destination ownership", async () => {
    const context = await createAshaGatewayContext(
      { page: "/app/outlook", narrative: "Client supplement" },
      { getMarketState: async () => marketState },
    );

    expect(context.destination).toBe("outlook");
    expect(context.marketState).toBe(marketState);
    expect(getAshaContextProvenance(context)).toMatchObject({
      marketStateVersion: "1.0",
      freshness: "stale",
      cacheStatus: "stale-if-error",
    });
  });

  it("serializes stale warnings and unavailable sources into the bounded prompt contract", async () => {
    const context = await createAshaGatewayContext(
      { page: "dashboard" },
      { getMarketState: async () => marketState },
    );
    const block = buildAshaCanonicalContextBlock(context);

    expect(context.destination).toBe("now");
    expect(block).toContain("stale-if-error");
    expect(block).toContain("Crypto Market Overlay");
    expect(block).toContain("Do not invent missing values");
  });

  it("bounds variable-length evidence before it crosses the model boundary", async () => {
    const verboseState: CanonicalMarketState = {
      ...marketState,
      why: {
        ...marketState.why,
        keyDevelopments: Array.from({ length: 8 }, (_, index) => `Development ${index + 1}`),
        evidenceFamilies: Array.from({ length: 12 }, (_, index) => ({
          ...marketState.why.evidenceFamilies[0],
          name: `Evidence ${index + 1}`,
        })),
      },
      watch: {
        ...marketState.watch,
        developingConditions: Array.from({ length: 8 }, (_, index) => ({
          id: `condition-${index + 1}`,
          label: `Condition ${index + 1}`,
          status: "building" as const,
          trend: "deteriorating" as const,
          duration: `${index + 1} days`,
          evidence: ["Observed"],
          expectedImpact: "Higher volatility",
          invalidation: "Condition resolves",
          confidence: 60,
        })),
        activePatterns: Array.from({ length: 8 }, (_, index) => ({
          id: `pattern-${index + 1}`,
          name: `Pattern ${index + 1}`,
          description: "Observed pattern",
          historicalFrequency: "Occasional",
          expectedImpact: "Higher volatility",
          confidence: 60,
        })),
        whatChanged: Array.from({ length: 8 }, (_, index) => `Change ${index + 1}`),
        whatToWatch: Array.from({ length: 8 }, (_, index) => `Watch ${index + 1}`),
      },
    };
    const context = await createAshaGatewayContext(
      { page: "/app/watch" },
      { getMarketState: async () => verboseState },
    );
    const block = buildAshaCanonicalContextBlock(context);

    expect(block).toContain("Development 6");
    expect(block).not.toContain("Development 7");
    expect(block).toContain("Evidence 10");
    expect(block).not.toContain("Evidence 11");
    expect(block).toContain("Condition 6");
    expect(block).not.toContain("Condition 7");
    expect(block).toContain("Pattern 6");
    expect(block).not.toContain("Pattern 7");
    expect(block).toContain("Change 6");
    expect(block).not.toContain("Change 7");
  });

  it("routes through the PLATO model chain and records the fallback in the boundary trace", async () => {
    const invokeModel = vi.fn()
      .mockRejectedValueOnce(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce({
        id: "response-1",
        created: 1,
        model: "gemini-3.1-flash-lite",
        choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
      });

    const result = await invokeAshaGateway(
      { messages: [{ role: "user", content: "What is happening?" }] },
      { invokeModel, config: testConfig(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]), sleep: async () => {} },
    );

    expect(result.trace).toMatchObject({
      selectedModel: "gemini-3.1-flash-lite",
      attemptedModels: ["gemini-3-flash-preview", "gemini-3.1-flash-lite"],
      resolutionSource: "router-default",
    });
    expect(invokeModel.mock.calls.map(([params]) => params.model)).toEqual([
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
    ]);
  });

  it("throws a typed PlatoUnavailableError after every model in the chain fails", async () => {
    const invokeModel = vi.fn()
      .mockRejectedValueOnce(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"))
      .mockRejectedValueOnce(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"));

    const failure = await invokeAshaGateway(
      { messages: [{ role: "user", content: "What is happening?" }] },
      { invokeModel, config: testConfig(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]), sleep: async () => {} },
    ).catch(error => error);

    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure).toMatchObject({ reason: "quota", attemptedModels: ["gemini-3-flash-preview", "gemini-3.1-flash-lite"] });
  });

  it("propagates canonical MarketState acquisition failures before invoking a model", async () => {
    await expect(createAshaGatewayContext(
      { page: "/app/now" },
      { getMarketState: async () => { throw new Error("market state unavailable"); } },
    )).rejects.toThrow("market state unavailable");
  });
});
