/**
 * PR #58, QA r13 B10: /app/asha (PLATO Intelligence Center) model text never states a probability %.
 * - synthesizeMarketThesis, getFollowUpQuestions and getWhatChangedSummary strip probability-%
 *   sentences (the same helper as asha.ask); nothing left reads unavailable, never an empty card.
 * - getWhatChangedSummary obtains canonical pressure from its server-owned immutable state (never client
 *   page supplements) as "N/100", or is unavailable when that state is missing; it never uses 0-10 score.
 * - the page sends canonical pressure and regime only, bands 70/45.
 * Mocked model, database, and explicit MOCK canonical-state lookup only; no live provider evidence is claimed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ content: "" as unknown, calls: [] as Array<{ messages: Array<{ role: string; content: string }> }> }));
const db = vi.hoisted(() => ({ queue: [] as unknown[][] }));
const canonical = vi.hoisted(() => ({ state: null as CanonicalIntelligenceState | null, read: vi.fn() }));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (params: { messages: Array<{ role: string; content: string }> }) => {
    llm.calls.push(params);
    return { choices: [{ message: { role: "assistant", content: llm.content } }] };
  }),
}));
vi.mock("./db", () => {
  /** A drizzle-like chain; awaiting it yields the next queued row set. */
  const query = (): Record<string, unknown> => {
    const q: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy", "limit"]) q[method] = () => q;
    q.then = (resolve: (rows: unknown[]) => unknown, reject: (err: unknown) => unknown) =>
      Promise.resolve(db.queue.shift() ?? []).then(resolve, reject);
    return q;
  };
  return { getDb: async () => ({ select: () => query() }), getUserTier: async () => "free" };
});
vi.mock("./canonicalIntelligenceState", async () => {
  // Keep every non-reader production helper real; only the canonical lookup is a MOCK fixture seam.
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: canonical.read };
});

import { ashaMemoryRouter, platoMemoryQuestions, platoMemoryText, whatChangedMarketStateClause } from "./routers/ashaMemory";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { buildIntelligenceCenterMarketState, INTELLIGENCE_CENTER_UNAVAILABLE_COLOR } from "../client/src/lib/ashaBriefingContext";
import type { CanonicalMarketState } from "../shared/marketState";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

const CLAIM_A = "There is a 23% probability of recession.";
const CLAIM_B = "The likelihood: 40% for a bear market.";
const KEEP = "A drawdown of 10% is typical.";
const CLAIMS = /23% probability of recession|likelihood: 40%|Odds of a crash/;

const STARTED = new Date("2026-10-01T14:00:00.000Z");
const CANONICAL_AS_OF = "2026-10-16T20:30:00.000Z";
const CANONICAL_STATE_ID = "state:mock-plato-intelligence-center-v1";
const CANONICAL_INPUT_SNAPSHOT_ID = "input:mock-plato-intelligence-center-v1";
const CANONICAL_STATE_HASH = "sha256:mock-plato-intelligence-center-v1";
const VECTOR_IDS = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"] as const;
/** Explicit MOCK provider observations only. This test makes no provider, database, or credential call. */
const MOCK_PROVIDER_OBSERVATIONS = [
  { inputId: "fred:hy-spread", provider: "FRED", seriesId: "BAMLH0A0HYM2", value: 320, observedAt: "2026-10-15T20:30:00.000Z" },
  { inputId: "fred:yield-curve", provider: "FRED", seriesId: "T10Y2Y", value: 0.5, observedAt: "2026-10-15T20:30:00.000Z" },
  { inputId: "market:vix", provider: "Market price adapter", seriesId: "^VIX", value: 18, observedAt: "2026-10-16T20:00:00.000Z" },
  { inputId: "fred:cpi", provider: "FRED", seriesId: "CPIAUCSL", value: 2.8, observedAt: "2026-10-01T12:30:00.000Z" },
  { inputId: "market:breadth", provider: "Market breadth adapter", seriesId: "NYSE-ADV-DECL", value: 45, observedAt: "2026-10-16T20:00:00.000Z" },
  { inputId: "market:ai", provider: "Market price adapter", seriesId: "AI-BASKET", value: 35, observedAt: "2026-10-16T20:00:00.000Z" },
] as const;

/**
 * A server-owned canonical packet, deliberately labeled MOCK. The identity, hash,
 * snapshot, complete vector set, provider observation times, and quality status make
 * it impossible for the page input to impersonate market evidence in this test.
 */
function serverCanonicalMock(): CanonicalIntelligenceState {
  return {
    schemaVersion: "phase2-canonical-state-v1",
    stateId: CANONICAL_STATE_ID,
    generatedAt: CANONICAL_AS_OF,
    effectiveAt: CANONICAL_AS_OF,
    calculationStartedAt: CANONICAL_AS_OF,
    calculationCompletedAt: CANONICAL_AS_OF,
    championVersion: "champion-v1-frozen",
    modelVersion: "mock-source-fixture-v1",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "mock-source-fixture-v1",
    inputSnapshotId: CANONICAL_INPUT_SNAPSHOT_ID,
    stateHash: CANONICAL_STATE_HASH,
    regime: "MODERATE RISK",
    pressureIndex: 33,
    pressureLevel: "Moderate",
    pressureDirection: "Stable",
    pressureAcceleration: null,
    pressurePersistence: null,
    engines: VECTOR_IDS.map((engineId, index) => ({
      engineId,
      engineName: engineId,
      value: [17, 30, 40, 35, 45, 31][index]!,
      unit: "score_0_to_100",
      classification: null,
      direction: "Stable" as const,
      acceleration: null,
      persistence: null,
      observedAt: MOCK_PROVIDER_OBSERVATIONS[index]!.observedAt,
      calculatedAt: CANONICAL_AS_OF,
      sourceInputIds: [MOCK_PROVIDER_OBSERVATIONS[index]!.inputId],
      qualityStatus: "HEALTHY" as const,
      freshnessStatus: "CURRENT",
      fallbackStatus: "NONE" as const,
      modelVersion: "mock-source-fixture-v1",
      calculationVersion: "faultline-pressure-v1-frozen",
      contributionToComposite: true,
    })),
    domains: { fixtureSource: "MOCK", providerObservations: MOCK_PROVIDER_OBSERVATIONS },
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: {
      canonicalLiveHistory: "MOCK fixture only — no operational history asserted",
      reconstructedResearch: "MOCK fixture only",
      historicalAnalogOutput: "MOCK fixture only",
      patternResolution: "MOCK fixture only",
    },
    dataQualitySummary: { source: "MOCK", providerObservations: MOCK_PROVIDER_OBSERVATIONS, liveProviderCall: false },
    confidenceOrEvidenceQuality: "HEALTHY",
    staleInputs: [],
    delayedInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    warnings: [],
    conflicts: [],
    historicalDatasetVersion: "mock-history-v1",
    researchDatasetVersion: "mock-research-v1",
    provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "mock-source-fixture-v1", coherenceStatus: "COHERENT" },
  };
}

/** Browser contract fixture mirrors the server mock identity and has no forecast claim contract. */
function browserCanonicalMock(): CanonicalMarketState {
  const families = MOCK_PROVIDER_OBSERVATIONS.map((observation, index) => ({
    name: VECTOR_IDS[index]!,
    signal: "neutral" as const,
    strength: [17, 30, 40, 35, 45, 31][index]!,
    trend: "stable" as const,
    currentValue: `${[17, 30, 40, 35, 45, 31][index]!}/100`,
    historicalContext: `MOCK ${observation.provider} observation at ${observation.observedAt}`,
    whyItMatters: "MOCK fixture only; no operational financial claim.",
  }));
  return {
    version: "1.0",
    canonicalStateId: CANONICAL_STATE_ID,
    stateHash: CANONICAL_STATE_HASH,
    inputSnapshotId: CANONICAL_INPUT_SNAPSHOT_ID,
    generatedAt: CANONICAL_AS_OF,
    sourceUpdatedAt: CANONICAL_AS_OF,
    freshness: "live",
    cache: { status: "fresh-cache", ageMs: 0, staleReason: null },
    sourceHealth: [
      { id: "seismograph", label: "Canonical Seismograph", status: "healthy", required: true, asOf: CANONICAL_AS_OF, detail: "MOCK source fixture." },
      { id: "historical-memory", label: "Historical Market Memory", status: "healthy", required: true, asOf: CANONICAL_AS_OF, detail: "MOCK source fixture." },
      { id: "fred", label: "Macro and Credit Evidence", status: "healthy", required: true, asOf: MOCK_PROVIDER_OBSERVATIONS[0].observedAt, detail: "MOCK FRED observation metadata." },
      { id: "coingecko", label: "Crypto Market Overlay", status: "unavailable", required: false, asOf: CANONICAL_AS_OF, detail: "Optional MOCK source unavailable." },
    ],
    warnings: [],
    now: { pressureScore: 33, regime: "MODERATE RISK", stressLevel: "Elevated", direction: "Stable", historicalPercentile: 0, headline: "MOCK canonical state — no operational claim.", topDrivers: VECTOR_IDS.map(id => `${id}: MOCK`), threats: [], supports: [] },
    why: {
      story: "MOCK canonical state — no operational claim.",
      whyThisScore: "MOCK fixture only.",
      whyThisRegime: "MOCK fixture only.",
      keyDevelopments: [],
      narrative: { whatIsHappening: "MOCK fixture only.", whyIsItHappening: "MOCK fixture only.", whatHasChanged: "MOCK fixture only.", whatIsBuildingBeneathSurface: "MOCK fixture only." },
      evidenceFamilies: families,
      evidenceConsensus: "weak",
      evidenceAsOfMonth: null,
    },
    outlook: {
      probabilities: { bull: Number.NaN, neutral: Number.NaN, bear: Number.NaN, confidence: Number.NaN, primaryDriver: "Unavailable", evidenceBasis: "MOCK fixture has no forecast claim.", historicalBasis: "Unavailable" },
      regimeProbabilities: { bull: Number.NaN, softLanding: Number.NaN, stagflation: Number.NaN, recession: Number.NaN, crash: Number.NaN },
      transitionProbabilities: { remainInRegime: Number.NaN, transitionToElevated: Number.NaN, transitionToLow: Number.NaN, transitionToCrisis: Number.NaN, confidence: Number.NaN, historicalBasis: "Unavailable", currentEvidence: [] },
      highestProbabilityPath: "Unavailable — MOCK fixture does not assert a forecast.",
      invalidationConditions: [],
      topAnalog: null,
      probabilityContract: null,
    },
    watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false },
    act: { marketPosture: "balanced", decisionSummary: "Unavailable — MOCK fixture.", whatWouldInvalidate: "Unavailable — MOCK fixture.", riskControls: [] },
    history: { observationCount: 0, datasetSpan: "MOCK fixture only", currentStreakDescription: "Unavailable", lastMajorShift: null, analogSummary: "Unavailable" },
  };
}

const caller = () => ashaMemoryRouter.createCaller({ user: { id: 7, isQaSession: false }, req: {}, res: {} } as never);
const thesisRows = () => { db.queue = [[{ id: 1, topics: "credit", symbolsMentioned: "SPY", startedAt: STARTED }], [{ content: "Is credit stress building?" }]]; };
const followUpRows = () => { db.queue = [[{ id: 1, startedAt: STARTED }], [{ role: "user", content: "Is credit stress building?" }, { role: "assistant", content: "Credit is calm." }]]; };
const whatChangedRows = () => { db.queue = [[{ id: 1, topics: "credit", symbolsMentioned: "SPY", startedAt: STARTED }], [{ content: "Is credit stress building?" }]]; };
const whatChanged = (input: { currentPressureScore?: number | null; currentRegime?: string | null } = { currentPressureScore: 33, currentRegime: "MODERATE RISK" }) =>
  caller().getWhatChangedSummary(input);
const userPrompt = () => llm.calls.at(-1)!.messages.find(m => m.role === "user")!.content;
const systemPrompt = () => llm.calls.at(-1)!.messages.find(m => m.role === "system")!.content;

beforeEach(() => {
  llm.calls.length = 0;
  llm.content = "";
  db.queue = [];
  canonical.state = serverCanonicalMock();
  canonical.read.mockReset();
  canonical.read.mockImplementation(async () => canonical.state);
});

describe("QA r13 B10: strip helpers", () => {
  it("platoMemoryText strips probability-% sentences, keeps ordinary ones, and is null when nothing is left", () => {
    expect(platoMemoryText(`Credit is calm. ${CLAIM_A} ${KEEP} ${CLAIM_B}`)).toBe(`Credit is calm. ${KEEP}`);
    expect(platoMemoryText(`  ${KEEP}  `)).toBe(KEEP);
    expect(platoMemoryText(`${CLAIM_A} ${CLAIM_B}`)).toBeNull();
    expect(platoMemoryText("   ")).toBeNull();
    expect(platoMemoryText(42)).toBeNull();
  });

  it("platoMemoryQuestions strips each question, drops empty ones and keeps at most 4", () => {
    expect(platoMemoryQuestions([`What moves credit? ${CLAIM_A}`, CLAIM_B, "Where are spreads heading?", "Odds of a crash are 12%.", "Q4?", "Q5?", "Q6?"]))
      .toEqual(["What moves credit?", "Where are spreads heading?", "Q4?", "Q5?"]);
    expect(platoMemoryQuestions([CLAIM_A, CLAIM_B])).toEqual([]);
    expect(platoMemoryQuestions("not a list")).toEqual([]);
  });
});

describe("QA r13 B10: synthesizeMarketThesis", () => {
  it("the thesis carries no probability %; ordinary sentences survive", async () => {
    thesisRows();
    llm.content = `Based on our recent discussions, you watch credit. ${CLAIM_A} ${KEEP}\n${CLAIM_B}`;
    const result = await caller().synthesizeMarketThesis();
    expect(result.thesis).toBe(`Based on our recent discussions, you watch credit. ${KEEP}`);
    expect(result).toMatchObject({ unavailable: false });
    expect(systemPrompt()).toContain("Never state a probability");
  });

  it("a thesis that is only probability claims reads unavailable, not an empty thesis", async () => {
    thesisRows();
    llm.content = `${CLAIM_A} ${CLAIM_B}`;
    const result = await caller().synthesizeMarketThesis();
    expect(result.thesis).toBeNull();
    expect(result).toMatchObject({ unavailable: true });
  });
});

describe("QA r13 B10: getFollowUpQuestions", () => {
  it("every question is stripped and questions left empty are dropped", async () => {
    followUpRows();
    llm.content = JSON.stringify({ questions: [`What moves credit? ${CLAIM_A}`, CLAIM_B, "Where are spreads heading?", "Odds of a crash are 12%."] });
    const result = await caller().getFollowUpQuestions();
    expect(result.questions).toEqual(["What moves credit?", "Where are spreads heading?"]);
    expect(JSON.stringify(result)).not.toMatch(CLAIMS);
    expect(result).toMatchObject({ unavailable: false });
    expect(systemPrompt()).toContain("Never state a probability");
  });

  it("questions that are all probability claims read unavailable", async () => {
    followUpRows();
    llm.content = JSON.stringify({ questions: [CLAIM_A, CLAIM_B] });
    const result = await caller().getFollowUpQuestions();
    expect(result).toEqual({ questions: [], unavailable: true });
  });
});

describe("QA r13 B10: getWhatChangedSummary", () => {
  it("the summary carries no probability %; ordinary sentences survive", async () => {
    whatChangedRows();
    llm.content = `Since we last spoke, credit stayed calm. ${CLAIM_A} ${KEEP}`;
    const result = await whatChanged();
    expect(result.summary).toBe(`Since we last spoke, credit stayed calm. ${KEEP}`);
    expect(result).toMatchObject({ unavailable: false });
    expect(systemPrompt()).toContain("Never state a probability");
  });

  it("a summary that is only probability claims reads unavailable", async () => {
    whatChangedRows();
    llm.content = `${CLAIM_A} ${CLAIM_B}`;
    const result = await whatChanged();
    expect(result.summary).toBeNull();
    expect(result).toMatchObject({ unavailable: true });
  });

  it("uses the server canonical state as N/100 and rejects client-authored regime or pressure facts", async () => {
    whatChangedRows();
    llm.content = "Since we last spoke, credit stayed calm.";
    await whatChanged({ currentPressureScore: 99, currentRegime: "CLIENT-AUTHORED CRISIS" });
    expect(canonical.read).toHaveBeenCalledOnce();
    expect(userPrompt()).toContain(`Canonical state ${CANONICAL_STATE_ID}, effective ${CANONICAL_AS_OF}`);
    expect(userPrompt()).toContain("the current market regime (MODERATE RISK) and pressure level (33/100).");
    expect(userPrompt()).not.toContain("CLIENT-AUTHORED CRISIS");
    expect(userPrompt()).not.toContain("99/100");
    expect(userPrompt()).not.toMatch(/\/10\)/);
    expect(userPrompt()).not.toContain("unavailable");
  });

  it("missing client fields do not erase server evidence; an absent server state is unavailable and does not invoke PLATO", async () => {
    whatChangedRows();
    llm.content = "Since we last spoke, credit stayed calm.";
    await whatChanged({ currentPressureScore: null, currentRegime: "CLIENT-AUTHORED CRISIS" });
    expect(userPrompt()).toContain("the current market regime (MODERATE RISK) and pressure level (33/100).");
    expect(userPrompt()).not.toContain("CLIENT-AUTHORED CRISIS");
    llm.calls.length = 0;
    canonical.state = null;
    whatChangedRows();
    await expect(whatChanged({})).resolves.toEqual({ summary: null, unavailable: true });
    expect(llm.calls).toHaveLength(0);
    expect(whatChangedMarketStateClause("  ", Number.NaN)).toBe("The current market regime and pressure level are unavailable: do not state or estimate them.");
  });

  it("a pressure outside 0-100 is rejected at the input", async () => {
    await expect(whatChanged({ currentPressureScore: 101, currentRegime: "MODERATE RISK" })).rejects.toThrow();
    await expect(whatChanged({ currentPressureScore: -1, currentRegime: "MODERATE RISK" })).rejects.toThrow();
  });
});

describe("QA r13 B10: Intelligence Center page sends and bands canonical 0-100 pressure", () => {
  const fixture = browserCanonicalMock();
  const withPressure = (pressureScore: number) => {
    const marketState = structuredClone(fixture);
    marketState.now.pressureScore = pressureScore;
    return selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
  };

  it("canonical: pressure 0-100 and regime from the canonical state; bands at 70 and 45", () => {
    const { output, mode } = withPressure(33);
    expect(mode).toBe("canonical");
    expect(fixture).toMatchObject({ canonicalStateId: CANONICAL_STATE_ID, stateHash: CANONICAL_STATE_HASH, inputSnapshotId: CANONICAL_INPUT_SNAPSHOT_ID });
    expect(fixture.why.evidenceFamilies).toHaveLength(VECTOR_IDS.length);
    expect(fixture.outlook.probabilityContract).toBeNull();
    expect(buildIntelligenceCenterMarketState(output, mode)).toEqual({ pressure100: 33, regime: output.regime.label, color: "#00E5FF", orbState: "calm" });
    for (const [score, color, orbState] of [[72, "#FF2D55", "critical"], [70, "#FF2D55", "critical"], [50, "#FF9500", "rising"], [45, "#FF9500", "rising"], [44, "#00E5FF", "calm"]] as const) {
      const selected = withPressure(score);
      expect(buildIntelligenceCenterMarketState(selected.output, selected.mode), String(score)).toMatchObject({ pressure100: score, color, orbState });
    }
  });

  it("no canonical state: pressure and regime are null (sent as unavailable), neutral colour; the demo baseline never binds", () => {
    const { output, mode } = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(mode).toBe("deterministic-fallback");
    expect(buildIntelligenceCenterMarketState(output, mode)).toEqual({ pressure100: null, regime: null, color: INTELLIGENCE_CENTER_UNAVAILABLE_COLOR, orbState: "calm" });
  });

  it("the page sends the canonical market state and renders unavailable states", () => {
    const page = readFileSync(path.join(import.meta.dirname, "..", "client", "src", "pages", "AshaIntelligenceCenter.tsx"), "utf8");
    expect(page).toContain("const marketState = buildIntelligenceCenterMarketState(output, marketMode);");
    expect(page).toContain("currentPressureScore: marketState.pressure100,");
    expect(page).toContain("currentRegime: marketState.regime,");
    expect(page).not.toMatch(/current(?:PressureScore|Regime):\s*output\./);
    expect(page).not.toMatch(/overall\.score/);
    for (const marker of ['data-plato-unavailable="thesis"', 'data-plato-unavailable="follow-ups"', 'data-plato-unavailable="what-changed"']) {
      expect(page).toContain(marker);
    }
  });
});
