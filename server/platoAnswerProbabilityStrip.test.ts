/**
 * PR #58, QA r10 B8: a PLATO answer or daily greeting never states a probability %.
 * - askAsha strips probability-% sentences from every model-written text field after validation
 *   (the same field list as #60's withoutModelProbabilities, plus PLATO's own answer fields).
 * - generateAshaDailyGreeting strips them from the greeting.
 * - Ordinary size statements ("A drawdown of 10% is typical") survive.
 * - The evidence packet and delivered citations are bound to one immutable
 *   canonical state, not model- or client-authored market facts.
 * QA r13 B8a: every string the model wrote is stripped at any depth (citation name/observedAt,
 * missionRecommendationStructured.timeHorizon, invented keys), and integrity.validation.normalizedOutput
 * carries only the known answer fields, from the final stripped and normalized answer.
 * Explicit MOCK fixture and mocked provider transport only; no live call is made.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { assembleCanonicalMarketState, type CanonicalMarketStateSource } from "./marketStateService";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { AshaPageContext } from "../shared/ashaContext";
import type { CanonicalMarketState } from "../shared/marketState";

vi.hoisted(() => {
  // Fake key for the mocked provider only (fetch is stubbed below); no real call is made.
  process.env.BUILT_IN_FORGE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
  process.env.BUILT_IN_FORGE_API_KEY = "AIzaSy_TEST_FAKE_KEY_000000000000000000";
});

const state = vi.hoisted(() => ({
  answer: "" as string,
  greeting: "" as string,
  marketState: null as CanonicalMarketState | null,
  canonical: null as CanonicalIntelligenceState | null,
}));

const MOCK_STATE_ID = "state:mock-plato-provenance-2026-10-01";
const MOCK_INPUT_SNAPSHOT_ID = "inputs:mock-plato-provenance-2026-10-01";
const MOCK_STATE_HASH = "e50750fd59b6e8d8958db2d5fab3db0406e3caed1f7b574570a493ed625ea246";
const MOCK_OBSERVED_AT = "2026-10-01T16:00:00.000Z";
const MOCK_GENERATED_AT = "2026-10-01T16:05:00.000Z";

/**
 * Test-only data. It is deliberately labelled MOCK and never represents a
 * provider call or a production observation.  The source ids and timestamps
 * model the complete Pressure v1 input vector so provenance remains explicit.
 */
const MOCK_PROVIDER_METADATA = Object.freeze({
  sourceType: "MOCK",
  fixture: "plato-answer-probability-strip",
  provider: "FRED fixture records",
  observedAt: MOCK_OBSERVED_AT,
  retrievedAt: MOCK_GENERATED_AT,
  operationalUse: false,
});
const MOCK_PROVIDER_OBSERVATIONS = Object.freeze({
  "fred:SOFR": { ...MOCK_PROVIDER_METADATA, seriesId: "SOFR", value: 4.82 },
  "fred:BAMLH0A0HYM2": { ...MOCK_PROVIDER_METADATA, seriesId: "BAMLH0A0HYM2", value: 3.21 },
  "fred:DGS10": { ...MOCK_PROVIDER_METADATA, seriesId: "DGS10", value: 4.12 },
  "fred:DGS2": { ...MOCK_PROVIDER_METADATA, seriesId: "DGS2", value: 3.88 },
  "fred:CPIAUCSL": { ...MOCK_PROVIDER_METADATA, seriesId: "CPIAUCSL", value: 2.7 },
  "fred:PPIACO": { ...MOCK_PROVIDER_METADATA, seriesId: "PPIACO", value: 2.1 },
  "fred:FEDFUNDS": { ...MOCK_PROVIDER_METADATA, seriesId: "FEDFUNDS", value: 4.75 },
  "fred:UNRATE": { ...MOCK_PROVIDER_METADATA, seriesId: "UNRATE", value: 4.2 },
  "market:SPX-ADVANCE-DECLINE": { ...MOCK_PROVIDER_METADATA, seriesId: "SPX-ADVANCE-DECLINE", value: 52 },
});

const canonical = buildCanonicalIntelligenceState({
  stateId: MOCK_STATE_ID,
  generatedAt: MOCK_GENERATED_AT,
  championVersion: "champion-v1-frozen",
  modelVersion: "mock-canonical-model-v1",
  // This regression proves fixture/provenance changes do not change the
  // frozen Pressure v1 score identity or its six-vector values.
  scoringVersion: "faultline-pressure-v1-frozen",
  configurationVersion: "mock-provenance-fixture-v1",
  inputSnapshotId: MOCK_INPUT_SNAPSHOT_ID,
  stateHash: MOCK_STATE_HASH,
  pressureIndex: 33,
  regime: "MODERATE RISK",
  engineValues: {
    "liquidity-stress": 22,
    "credit-contagion": 22,
    "volatility-regime": 40,
    "macro-sensitivity": 43,
    "market-breadth": 28,
    "ai-bubble": 44,
  },
  engineDirections: {
    "liquidity-stress": "stable",
    "credit-contagion": "stable",
    "volatility-regime": "stable",
    "macro-sensitivity": "stable",
    "market-breadth": "stable",
    "ai-bubble": "unknown",
  },
  domains: { fixture: MOCK_PROVIDER_METADATA, providerObservations: MOCK_PROVIDER_OBSERVATIONS },
  scenarioOutputs: { bull: 43, neutral: 43, bear: 14 },
  probabilityClaimIds: [],
  analogClaimIds: [],
  historicalDatasetVersion: "mock-historical-dataset-v1",
  researchDatasetVersion: "mock-research-dataset-v1",
  coherenceStatus: "COHERENT",
  coherenceNotes: ["MOCK fixture only; no operational market conclusion."],
  dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
  staleInputs: [],
  unavailableInputs: [],
  fallbackInputs: [],
  inputQuality: [
    { inputId: "fred:SOFR", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress"], ...MOCK_PROVIDER_OBSERVATIONS["fred:SOFR"] },
    { inputId: "fred:BAMLH0A0HYM2", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress", "credit-contagion"], ...MOCK_PROVIDER_OBSERVATIONS["fred:BAMLH0A0HYM2"] },
    { inputId: "fred:DGS10", freshnessStatus: "LIVE", contributesTo: ["credit-contagion", "volatility-regime", "market-breadth"], ...MOCK_PROVIDER_OBSERVATIONS["fred:DGS10"] },
    { inputId: "fred:DGS2", freshnessStatus: "LIVE", contributesTo: ["volatility-regime"], ...MOCK_PROVIDER_OBSERVATIONS["fred:DGS2"] },
    { inputId: "fred:CPIAUCSL", freshnessStatus: "LIVE", contributesTo: ["macro-sensitivity"], ...MOCK_PROVIDER_OBSERVATIONS["fred:CPIAUCSL"] },
    { inputId: "fred:PPIACO", freshnessStatus: "LIVE", contributesTo: ["macro-sensitivity"], ...MOCK_PROVIDER_OBSERVATIONS["fred:PPIACO"] },
    { inputId: "fred:FEDFUNDS", freshnessStatus: "LIVE", contributesTo: ["macro-sensitivity"], ...MOCK_PROVIDER_OBSERVATIONS["fred:FEDFUNDS"] },
    { inputId: "fred:UNRATE", freshnessStatus: "LIVE", contributesTo: ["credit-contagion", "market-breadth"], ...MOCK_PROVIDER_OBSERVATIONS["fred:UNRATE"] },
    { inputId: "market:SPX-ADVANCE-DECLINE", freshnessStatus: "LIVE", contributesTo: ["ai-bubble"], ...MOCK_PROVIDER_OBSERVATIONS["market:SPX-ADVANCE-DECLINE"] },
  ],
});

const MOCK_MARKET_SOURCE: CanonicalMarketStateSource = {
  canonicalStateId: MOCK_STATE_ID,
  stateHash: MOCK_STATE_HASH,
  inputSnapshotId: MOCK_INPUT_SNAPSHOT_ID,
  currentScore: 33,
  currentRegime: "MODERATE RISK",
  currentStressLevel: "Elevated",
  currentDirection: "Stable",
  currentPercentile: 50,
  dataFreshness: "live",
  lastUpdated: MOCK_OBSERVED_AT,
  providerProvenance: { fred: { status: "live", detail: "MOCK fixture provider records; no live provider claim.", asOf: Date.parse(MOCK_OBSERVED_AT) } },
  todayStory: "MOCK canonical state is available for provenance testing only.",
  keyDevelopments: ["MOCK fixture preserves immutable canonical identity."],
  whyThisScore: "A fixed mock Pressure v1 vector is supplied only to test provenance.",
  whyThisRegime: "The regime is read only from the mock canonical state.",
  probabilities: { bull: 0, neutral: 0, bear: 0, confidence: 0, primaryDriver: "Not established", evidenceBasis: "MOCK fixture only", historicalBasis: "Not established" },
  evidenceFamilies: [
    { name: "Liquidity Conditions", signal: "recovering", strength: 22, currentValue: "22/100", historicalContext: "MOCK fixture context.", trend: "stable", whyItMatters: "Fixture-only vector." },
    { name: "Credit Markets", signal: "bullish", strength: 22, currentValue: "22/100", historicalContext: "MOCK fixture context.", trend: "stable", whyItMatters: "Fixture-only vector." },
    { name: "Yield Curve", signal: "neutral", strength: 40, currentValue: "40/100", historicalContext: "MOCK fixture context.", trend: "stable", whyItMatters: "Fixture-only vector." },
    { name: "Macro Sensitivity", signal: "bullish", strength: 43, currentValue: "43/100", historicalContext: "MOCK fixture context.", trend: "stable", whyItMatters: "Fixture-only vector." },
    { name: "Labor & Rates", signal: "bullish", strength: 28, currentValue: "28/100", historicalContext: "MOCK fixture context.", trend: "stable", whyItMatters: "Fixture-only vector." },
  ],
  evidenceConsensus: "weak",
  topAnalog: null,
  analogSummary: "No governed historical analog is supplied by this mock fixture.",
  transitionProbabilities: { remainInRegime: 0, transitionToElevated: 0, transitionToLow: 0, transitionToCrisis: 0, confidence: 0, historicalBasis: "Not established", currentEvidence: [] },
  evolution: { sevenDayTrend: "Not established", thirtyDayTrend: "Not established", ninetyDayTrend: "Not established", yearTrend: "Not established", accelerating: false, buildingPressure: false, whatChanged: [], whatToWatch: [], invalidationConditions: [], sparkline90d: [] },
  memory: { observationCount: 0, datasetSpan: "Unavailable", currentStreakDescription: "Not established", longestStreak: 0, regimeHistory: [], keyThresholdsCrossed: [], lastMajorShift: null, historicalStats: { avgPressure: 0, maxPressure: 0, minPressure: 0, criticalMonths: 0, highRiskMonths: 0, elevatedMonths: 0, moderateMonths: 0, lowMonths: 0 } },
  regimeProbabilities5way: { bull: 0, softLanding: 0, stagflation: 0, recession: 0, crash: 0 },
  developingConditions: [],
  marketNarrative: { whatIsHappening: "MOCK fixture only.", whyIsItHappening: "Not established.", whatHasChanged: "Not established.", whatIsBuildingBeneathSurface: "Not established.", highestProbabilityPath: "No governed forecast available.", whatWouldInvalidate: "No governed invalidation condition is currently defined." },
  activePatterns: [],
};

const marketState = assembleCanonicalMarketState(MOCK_MARKET_SOURCE, {
  generatedAt: MOCK_GENERATED_AT,
  cacheStatus: "fresh-cache",
  cacheAgeMs: 0,
  canonicalQuality: canonical.confidenceOrEvidenceQuality,
  canonicalEngines: canonical.engines.map(engine => ({ engineId: engine.engineId, value: engine.value, direction: engine.direction })),
  canonicalAsOf: canonical.generatedAt,
  probabilityContract: canonical.probabilityContract ?? null,
  cryptoOverlay: null,
});

vi.mock("./marketStateService", async importOriginal => ({
  ...(await importOriginal<typeof import("./marketStateService")>()),
  getCanonicalMarketState: async () => {
    if (!state.marketState) throw new Error("MOCK MarketState unavailable");
    return structuredClone(state.marketState);
  },
}));
vi.mock("./canonicalIntelligenceState", async importOriginal => ({
  ...(await importOriginal<typeof import("./canonicalIntelligenceState")>()),
  getAuthoritativeCanonicalIntelligenceState: async () => structuredClone(state.canonical),
}));
vi.mock("./systemicRegime/reader", async importOriginal => ({
  ...(await importOriginal<typeof import("./systemicRegime/reader")>()),
  getLatestSystemicRegimeReading: async () => null,
  getLatestSignalConvergence: async () => null,
}));

import {
  askAsha,
  deepStripPlatoProbabilityClaims,
  generateAshaDailyGreeting,
  PLATO_ANSWER_KNOWN_FIELDS,
  platoKnownAnswerFields,
  stripPlatoProbabilityClaims,
  withoutPlatoProbabilityClaims,
} from "./ashaEngine";

const CLAIM_A = "There is a 23% probability of recession.";
const CLAIM_B = "The likelihood: 40% for a bear market.";
const KEEP = "A drawdown of 10% is typical.";
const CLAIMS = /23% probability of recession|likelihood: 40%/;
const both = (text: string) => `${text} ${CLAIM_A} ${KEEP} ${CLAIM_B}`;

const ANSWER = {
  reply: `${both("Credit spreads remain tight across investment grade issuers.")}\n\nFunding markets look orderly this week. ${CLAIM_A}`,
  directAnswer: both("No, stress is not building beneath today's readings."),
  executiveSummary: both("Summary: volatility subdued while liquidity stays ample overall."),
  coreThesis: both("Thesis: monetary conditions neutral, earnings steady, breadth healthy."),
  marketBias: "NEUTRAL",
  marketRegime: "Moderate Risk",
  threatLevel: "LOW",
  pressureIndex: 33,
  riskLevel: both("Moderate."),
  suggestedBias: both("Neutral."),
  bullProbability: null,
  bearProbability: null,
  keyFindings: [both("Finding one."), CLAIM_A, CLAIM_B, KEEP],
  supportingEvidence: [both("Evidence.")],
  crossEngineSynthesis: [{ engine: "Credit", currentSignal: both("Calm."), relevance: both("High.") }],
  historicalAnalog: both("2019."),
  riskFactors: [both("Risk.")],
  confirmationConditions: [both("Confirm.")],
  invalidationConditions: [both("Invalidate.")],
  missionRecommendation: both("Recommendation: maintain allocations, rebalance quarterly, watch yields."),
  missionRecommendationStructured: { verdict: "HOLD", timeHorizon: "Not established", rationale: both("Because."), decisionPaths: [{ scenario: both("Calm."), response: both("Hold.") }, { scenario: CLAIM_A, response: CLAIM_B }] },
  sourceCitations: [{ name: "FAULTLINE", claim: both("Pressure Index is 33."), observedAt: "2026-10-01", freshness: "RECENT" }],
  limitations: [both("Limited.")],
  disclaimer: "Informational only.",
  finalVerdictAction: "HOLD",
  expectedTimeframe: "Not established",
  followUpChips: [both("Ask more."), CLAIM_A],
};
const GREETING = `Welcome back. ${CLAIM_A} ${KEEP}\nCredit is calm. ${CLAIM_B}`;

const bodies: Array<{ messages: Array<{ role: string; content: string }>; response_format?: unknown; tools?: unknown }> = [];

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    const payload = JSON.parse(init.body);
    bodies.push(payload);
    const content = payload.response_format || payload.tools ? state.answer : state.greeting;
    return new Response(JSON.stringify({
      id: "x", created: 1, model: payload.model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  bodies.length = 0;
  state.marketState = structuredClone(marketState);
  state.canonical = structuredClone(canonical);
  state.answer = JSON.stringify(ANSWER);
  state.greeting = GREETING;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ask = (pageContext: AshaPageContext = { page: "/app/now" }) => askAsha({ userMessage: "Is credit stress building?", history: [], pageContext });
const greet = () => generateAshaDailyGreeting({ userName: "Ada", engineContext: {} });

/** Every string in a value, with its path. */
function strings(value: unknown, at = "$"): Array<[string, string]> {
  if (typeof value === "string") return [[at, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${at}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, `${at}.${k}`));
  return [];
}

type PromptEvidenceClaim = {
  claimId: string;
  class: string;
  statement: string;
  value: unknown;
  unit: string | null;
  evidenceStrength: string;
  dataQuality: string;
  limitations: string[];
};

function evidenceClaimsIn(body: (typeof bodies)[number]): PromptEvidenceClaim[] {
  const system = body.messages.find(message => message.role === "system")?.content ?? "";
  const line = system.split("\n").find(entry => entry.startsWith("ALLOWED EVIDENCE CLAIMS: "));
  if (!line) throw new Error("PLATO prompt omitted its canonical evidence packet");
  return JSON.parse(line.slice("ALLOWED EVIDENCE CLAIMS: ".length)) as PromptEvidenceClaim[];
}

function expectedServerCitations() {
  const base = (claimId: string, name: string, claim: string, observedAt: string) => ({
    name, claim, claimId, evidenceClass: "DERIVED", observedAt, freshness: "ESTIMATED" as const,
  });
  return [
    ...canonical.engines.map(engine => base(
      `${canonical.stateId}:derived:engine:${engine.engineId}`,
      engine.sourceInputIds.join(", ") || `canonical-engine:${engine.engineId}`,
      `${engine.engineName} model score is ${engine.value}.`,
      engine.calculatedAt ?? canonical.effectiveAt,
    )),
    ...(canonical.pressureIndex === null ? [] : [base(
      `${canonical.stateId}:derived:pressure-index`, canonical.stateId,
      `Canonical Pressure Index is ${canonical.pressureIndex}.`, canonical.effectiveAt,
    )]),
    ...(canonical.regime === null ? [] : [base(
      `${canonical.stateId}:derived:regime`, canonical.stateId,
      `Canonical regime classification is ${canonical.regime}.`, canonical.effectiveAt,
    )]),
    ...Object.entries(canonical.scenarioOutputs).map(([label, value]) => base(
      `${canonical.stateId}:derived:scenario:${label}`, "canonical-scenario-output",
      `Scenario component ${label} is ${value}.`, canonical.effectiveAt,
    )),
  ];
}

describe("QA r10 B8: stripPlatoProbabilityClaims", () => {
  it("strips '23% probability of recession' and 'likelihood: 40%' sentences and keeps ordinary size statements", () => {
    expect(stripPlatoProbabilityClaims(both("Credit is calm."))).toBe(`Credit is calm. ${KEEP}`);
    for (const keep of [KEEP, "CPI rose 2.9 percent.", "Spreads widened 15% this year.", "Upside of 15% is possible."]) {
      expect(stripPlatoProbabilityClaims(keep)).toBe(keep);
    }
    for (const claim of [CLAIM_A, CLAIM_B, "Odds of a crash are 12%.", "Bull case 53%.", "Recession risk is 30 percent."]) {
      expect(stripPlatoProbabilityClaims(claim)).toBe("");
    }
  });

  it("returns text without a claim byte-for-byte, and keeps paragraphs when it strips", () => {
    const clean = "Line one.  Two spaces.\n\n  Indented line.\n- bullet 10% drawdown.";
    expect(stripPlatoProbabilityClaims(clean)).toBe(clean);
    expect(stripPlatoProbabilityClaims(`Para one. ${CLAIM_A}\n\nPara two.\n${CLAIM_B}`)).toBe("Para one.\n\nPara two.");
    expect(stripPlatoProbabilityClaims(42)).toBe(42);
  });

  it("withoutPlatoProbabilityClaims covers every answer text field, nested rows included", () => {
    const out = withoutPlatoProbabilityClaims(structuredClone(ANSWER) as Record<string, unknown>);
    const hits = strings(out).filter(([, text]) => CLAIMS.test(text));
    expect(hits).toEqual([]);
    expect(out.keyFindings).toEqual([`Finding one. ${KEEP}`, KEEP]);
    expect((out.missionRecommendationStructured as { decisionPaths: unknown[] }).decisionPaths[1]).toEqual({ scenario: "", response: "" });
  });
});

describe("QA r10 B8: askAsha answer text", () => {
  it("no text field of the PLATO answer states a probability %; ordinary lines survive", async () => {
    const response = await ask();
    const hits = strings(response).filter(([, text]) => CLAIMS.test(text));
    expect(hits).toEqual([]);
    expect(JSON.stringify(response)).not.toMatch(CLAIMS);
    for (const field of ["reply", "directAnswer", "executiveSummary", "coreThesis", "historicalAnalog", "missionRecommendation", "riskLevel", "suggestedBias"] as const) {
      expect(response[field], field).toContain(KEEP);
    }
    expect(response.reply).toBe(`Credit spreads remain tight across investment grade issuers. ${KEEP}\n\nFunding markets look orderly this week.`);
    expect(response.keyFindings).toEqual([`Finding one. ${KEEP}`, KEEP]);
    expect(response.followUpChips).toEqual([`Ask more. ${KEEP}`]);
    expect(response.missionRecommendationStructured?.decisionPaths).toEqual([{ scenario: `Calm. ${KEEP}`, response: `Hold. ${KEEP}` }]);
    expect(response.integrity.validation.normalizedOutput.reply).toBe(response.reply);
  });

  it("an answer whose reply is only probability claims is a typed failure, not an empty answer", async () => {
    state.answer = JSON.stringify({
      ...ANSWER,
      reply: `${CLAIM_A} ${CLAIM_B}`,
      directAnswer: "No, stress is not building beneath today's readings.",
      executiveSummary: "Summary: volatility subdued while liquidity stays ample overall.",
      coreThesis: "Thesis: monetary conditions neutral, earnings steady, breadth healthy.",
      missionRecommendation: "Recommendation: maintain allocations, rebalance quarterly, watch yields.",
    });
    await expect(ask()).rejects.toMatchObject({ message: expect.stringMatching(/empty_response|unusable|PLATO/i) });
  });

  it("an answer with no probability claim passes through unchanged", async () => {
    const reply = `Credit spreads remain tight across issuers.\n\n${KEEP}`;
    state.answer = JSON.stringify({ ...ANSWER, reply, directAnswer: "No, stress is not building today.", coreThesis: `Thesis: conditions neutral, breadth healthy. ${KEEP}`, keyFindings: ["a", KEEP] });
    const response = await ask();
    expect(response.reply).toBe(reply);
    expect(response.directAnswer).toBe("No, stress is not building today.");
    expect(response.coreThesis).toBe(`Thesis: conditions neutral, breadth healthy. ${KEEP}`);
    expect(response.keyFindings).toEqual(["a", KEEP]);
  });
});

describe("QA r10 B8: daily greeting", () => {
  it("the greeting states no probability %; ordinary lines survive", async () => {
    const greeting = await greet();
    expect(greeting).not.toMatch(CLAIMS);
    expect(greeting).toBe(`Welcome back. ${KEEP}\nCredit is calm.`);
  });

  it("a greeting that is only probability claims is a typed failure", async () => {
    state.greeting = `${CLAIM_A} ${CLAIM_B}`;
    await expect(greet()).rejects.toBeInstanceOf(Error);
  });
});

describe("QA r10 B8: prompt and evidence", () => {
  it("the ask prompt no longer asks about recession probability", async () => {
    await ask();
    const system = bodies[0].messages[0].content;
    expect(system).not.toContain("about recession probability");
    expect(system).toContain("What does the spread between 2Y and 10Y indicate as a historical recession warning sign (no probability)?");
  });

  it("binds every model call to one immutable canonical packet while preserving the frozen Pressure v1 values", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T20:00:00.000Z"));
    await ask();
    await greet();
    const packets = bodies.map(evidenceClaimsIn);
    expect(packets).toHaveLength(3);
    expect(packets.every(packet => packet.every(claim => claim.claimId.startsWith(`${MOCK_STATE_ID}:`)))).toBe(true);
    expect(packets.every(packet => packet.every(claim => claim.class === "DERIVED"))).toBe(true);
    expect(packets.every(packet => packet.every(claim => !/forecast|probability/i.test(claim.class)))).toBe(true);
    expect(packets.slice(1)).toEqual([packets[0], packets[0]]);
    expect(canonical.scoringVersion).toBe("faultline-pressure-v1-frozen");
    expect(packets[0].filter(claim => claim.claimId.includes(":derived:engine:")).map(claim => [claim.claimId.split(":").at(-1), claim.value]))
      .toEqual(canonical.engines.map(engine => [engine.engineId, engine.value]));
    expect(packets[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ claimId: `${MOCK_STATE_ID}:derived:pressure-index`, statement: "Canonical Pressure Index is 33.", value: 33 }),
      expect.objectContaining({ claimId: `${MOCK_STATE_ID}:derived:scenario:bull`, statement: "Scenario component bull is 43.", value: 43 }),
    ]));
  });

  it("rejects client-authored market facts and uses only the shared canonical identity", async () => {
    const response = await ask({
      page: "/app/now",
      pressureScore: 99,
      regime: "CLIENT-INVENTED-CRISIS",
      regimeConfidence: 1,
      transitionProbability: 100,
      additionalContext: { fabricatedFact: "CLIENT-INVENTED-MARKET-FACT" },
    });
    const system = bodies[0].messages[0].content;
    expect(system).toContain(MOCK_STATE_ID);
    expect(system).not.toContain("CLIENT-INVENTED-CRISIS");
    expect(system).not.toContain("CLIENT-INVENTED-MARKET-FACT");
    expect(response.pressureIndex).toBe(canonical.pressureIndex);
    expect(response.marketRegime).toBe(canonical.regime);
    expect(response.integrity.transaction.originatingStateId).toBe(MOCK_STATE_ID);
  });

  it("withholds current-market output when the canonical state is unavailable", async () => {
    state.canonical = null;
    const response = await ask();
    expect(response.reply).toBe("Canonical state unavailable. Insufficient evidence for a current market interpretation.");
    expect(response.pressureIndex).toBeUndefined();
    expect(response.marketRegime).toBeUndefined();
    expect(response.sourceCitations).toEqual([]);
    expect(response.integrity.transaction.originatingStateId).toBeNull();
  });
});

// ── QA r13 B8a ────────────────────────────────────────────────
const INVENTED = {
  headline: both("Headline: credit calm."),
  sections: [{ title: both("Section."), body: [both("Body one."), CLAIM_B] }],
  suggestedQuestions: [both("What next?"), CLAIM_A],
  followUps: { first: both("Follow up."), nested: [{ text: CLAIM_B }] },
};
const B8A_ANSWER = {
  ...ANSWER,
  marketBias: "VERY BULLISH (70% likely)",
  threatLevel: "HIGH",
  missionRecommendationStructured: { ...ANSWER.missionRecommendationStructured, timeHorizon: `3-6 months. ${CLAIM_A}` },
  sourceCitations: [
    { name: `FAULTLINE Pressure Index. ${CLAIM_A}`, claim: both("Pressure Index is 33."), observedAt: `2026-10-01. ${CLAIM_B}`, freshness: "RECENT" },
    { name: CLAIM_B, claim: "Credit spreads are tight.", observedAt: "2026-10-01", freshness: "RECENT" },
  ],
  ...INVENTED,
};
/** Strings a strip would still change: any left is a probability-% sentence that got through. */
const unstripped = (value: unknown) => strings(value).filter(([, text]) => stripPlatoProbabilityClaims(text) !== text);

describe("QA r13 B8a: recursive stripping", () => {
  it("deepStripPlatoProbabilityClaims strips every string at any depth: citation name/observedAt, timeHorizon, unknown keys", () => {
    const out = deepStripPlatoProbabilityClaims(structuredClone(B8A_ANSWER)) as Record<string, any>;
    expect(unstripped(out)).toEqual([]);
    expect(JSON.stringify(out)).not.toMatch(CLAIMS);
    expect(out.sourceCitations[0]).toEqual({ name: "FAULTLINE Pressure Index.", claim: `Pressure Index is 33. ${KEEP}`, observedAt: "2026-10-01.", freshness: "RECENT" });
    expect(out.sourceCitations[1].name).toBe("");
    expect(out.missionRecommendationStructured.timeHorizon).toBe("3-6 months.");
    expect(out.marketBias).toBe("");
    expect(out.headline).toBe(`Headline: credit calm. ${KEEP}`);
    expect(out.sections).toEqual([{ title: `Section. ${KEEP}`, body: [`Body one. ${KEEP}`] }]);
    expect(out.suggestedQuestions).toEqual([`What next? ${KEEP}`]);
    expect(out.followUps).toEqual({ first: `Follow up. ${KEEP}`, nested: [{ text: "" }] });
    // Non-strings untouched; clean text byte-identical.
    expect(out.pressureIndex).toBe(33);
    expect(out.bullProbability).toBeNull();
    expect(out.disclaimer).toBe(ANSWER.disclaimer);
    expect(withoutPlatoProbabilityClaims(structuredClone(B8A_ANSWER))).toEqual(out);
  });

  it("askAsha: citation labels, observedAt, timeHorizon and every other answer string carry no probability %", async () => {
    state.answer = JSON.stringify(B8A_ANSWER);
    const response = await ask();
    expect(unstripped(response)).toEqual([]);
    expect(JSON.stringify(response)).not.toMatch(CLAIMS);
    expect(JSON.stringify(response)).not.toContain("70% likely");
    // Citations are reconstructed from the server-owned canonical packet. The
    // model's invented/stripped citation strings never become source metadata.
    expect(response.sourceCitations).toEqual(expectedServerCitations());
    expect(response.sourceCitations?.map(citation => citation.claimId)).toEqual(evidenceClaimsIn(bodies[0]).map(claim => claim.claimId));
    expect(JSON.stringify(response.sourceCitations)).not.toContain("FAULTLINE Pressure Index");
    expect(JSON.stringify(response.sourceCitations)).not.toContain("Credit spreads are tight");
    expect(response.missionRecommendationStructured?.timeHorizon).toBe("3-6 months.");
  });
});

describe("QA r13 B8a: normalizedOutput", () => {
  it("normalizedOutput holds only known, stripped, normalized fields: no invented keys, no raw enums", async () => {
    state.answer = JSON.stringify(B8A_ANSWER);
    const response = await ask();
    const normalized = response.integrity.validation.normalizedOutput as Record<string, unknown>;
    expect(Object.keys(normalized).every(key => (PLATO_ANSWER_KNOWN_FIELDS as readonly string[]).includes(key))).toBe(true);
    for (const key of ["headline", "sections", "suggestedQuestions", "followUps"]) {
      expect(normalized, key).not.toHaveProperty(key);
      expect(response, key).not.toHaveProperty(key);
    }
    // Raw "VERY BULLISH (70% likely)" is not a valid bias: absent, as in the response. Valid enums pass.
    expect(response.marketBias).toBeUndefined();
    expect(normalized).not.toHaveProperty("marketBias");
    expect(normalized.threatLevel).toBe("HIGH");
    expect(unstripped(normalized)).toEqual([]);
    expect(normalized).toEqual(platoKnownAnswerFields(response as unknown as Record<string, unknown>));
    for (const [key, value] of Object.entries(normalized)) expect(value, key).toEqual((response as unknown as Record<string, unknown>)[key]);
    expect(normalized.sourceCitations).toEqual(response.sourceCitations);
    expect(normalized.reply).toBe(response.reply);
  });

  it("an all-claims reply is still a typed failure when invented keys are present", async () => {
    // Distinct lead texts elsewhere, as in the r10 case: the validator's duplicate-text check would
    // otherwise replace the reply with its safe reply before the strip runs.
    state.answer = JSON.stringify({
      ...B8A_ANSWER,
      reply: `${CLAIM_A} ${CLAIM_B}`,
      directAnswer: "No, stress is not building beneath today's readings.",
      executiveSummary: "Summary: volatility subdued while liquidity stays ample overall.",
      coreThesis: "Thesis: monetary conditions neutral, earnings steady, breadth healthy.",
      missionRecommendation: "Recommendation: maintain allocations, rebalance quarterly, watch yields.",
    });
    await expect(ask()).rejects.toMatchObject({ message: expect.stringMatching(/empty_response|unusable|PLATO/i) });
  });
});
