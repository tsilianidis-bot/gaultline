/**
 * PR #58 r6: the fully assembled PLATO prompts (asha.ask answer call and the daily greeting)
 * built from the real stored production snapshot shape carry no scenario or probability percent.
 * The only percents allowed through are an analog "% similarity" (regime resemblance, not a
 * probability) and the stated breadth threshold in the invalidation conditions. Mocked provider only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The gateway reads its env at import time: set a fake key before any module loads. No network.
vi.hoisted(() => {
  process.env.BUILT_IN_FORGE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
  process.env.BUILT_IN_FORGE_API_KEY = "AIzaSy_TEST_FAKE_KEY_000000000000000000";
});

const FIX = path.join(import.meta.dirname, "__fixtures__", "prod-2026-10-01");
const fixture = (name: string) => JSON.parse(readFileSync(path.join(FIX, name), "utf8"));
const marketState = fixture("market-state-current.json");
const canonical = fixture("canonical-current.json");

vi.mock("./marketStateService", async importOriginal => ({
  ...(await importOriginal<typeof import("./marketStateService")>()),
  getCanonicalMarketState: async () => structuredClone(marketState),
}));
vi.mock("./canonicalIntelligenceState", async importOriginal => ({
  ...(await importOriginal<typeof import("./canonicalIntelligenceState")>()),
  getAuthoritativeCanonicalIntelligenceState: async () => structuredClone(canonical),
}));

// The live prod systemic-regime reading (snapshot 2026-10-02 18:34Z, freshness CURRENT): the
// prompt must not carry its crisis/transition probability or regime confidence in any form.
const PROD_SYSTEMIC_READING = {
  systemicRiskScore: 0,
  crisisProbability: 0.0036016037127718343,
  stressBuildingProbability: null,
  transitionProbability: 0.030000000000000027,
  currentRegime: "NORMAL",
  regimeConfidence: 0.996398396287075,
  creditStressZ: 0.2579819458031539,
  volStressZ: -0.3194692564612353,
  ratesStressZ: -0.12031238964456506,
  pc1: null,
  factorArrows: { credit: "up", vol: "down", rates: "flat" },
  modelVersion: "sre-hmm2-v1.0.0",
  modelType: "gaussian-hmm-2state",
  pcaMethod: "standard_scaler_pca",
  nStates: 2,
  dataAsOf: "2026-09-30",
  computedAt: "2026-10-01T22:00:00.000Z",
  freshnessStatus: "CURRENT",
  historyClass: "LIVE_INFERENCE",
  contributesToPressureIndex: false,
};
const systemic = vi.hoisted(() => ({ reading: null as unknown, convergence: null as unknown }));
vi.mock("./systemicRegime/reader", async importOriginal => ({
  ...(await importOriginal<typeof import("./systemicRegime/reader")>()),
  getLatestSystemicRegimeReading: async () => systemic.reading,
  getLatestSignalConvergence: async () => systemic.convergence,
}));

import { askAsha, generateAshaDailyGreeting } from "./ashaEngine";
import { actForModel, outlookForModel, PLATO_SCENARIO_WITHHELD, withholdScenarioPercents, withholdScenarioPercentsDeep } from "./ashaGateway";

const ANSWER = JSON.stringify({
  reply: "Credit is calm.", directAnswer: "No.", executiveSummary: "Calm.", coreThesis: "t",
  keyFindings: ["a", "b", "c"], supportingEvidence: ["e1", "e2"], counterEvidence: ["c1"],
  confirmationConditions: ["x"], invalidationConditions: ["y"], whatToMonitor: ["m"], sourceCitations: [],
});
const bodies: Array<{ messages: unknown; response_format?: unknown; tools?: unknown }> = [];

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    const payload = JSON.parse(init.body);
    bodies.push(payload);
    const content = payload.response_format || payload.tools ? ANSWER : "Welcome back. Pressure is contained.";
    return new Response(JSON.stringify({
      id: "x", created: 1, model: payload.model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  bodies.length = 0;
  systemic.reading = structuredClone(PROD_SYSTEMIC_READING);
  systemic.convergence = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const PERCENT = /\d+(?:\.\d+)?\s*%/g;
/** Percents that are not scenario/probability claims. */
const ALLOWED = [/^\d+(?:\.\d+)?\s*%\s*similarity/i, /^\d+(?:\.\d+)?\s*% of sectors/i];

function percentsIn(prompt: string): string[] {
  return [...prompt.matchAll(PERCENT)].map(match => prompt.slice(match.index!, match.index! + match[0].length + 24));
}
function disallowedPercents(prompt: string): string[] {
  return percentsIn(prompt).filter(hit => !ALLOWED.some(rule => rule.test(hit)));
}
/** Any probability/confidence field with a numeric value, in raw or JSON-escaped form. */
const NUMERIC_PROBABILITY_FIELD = /\\?"(\w*(?:[Pp]robabilit\w*|[Cc]onfidence|[Ll]ikelihood|[Oo]dds)|bull|bear|neutral|crash|softLanding|stagflation|recession|remainInRegime|transitionTo\w+)\\?"\s*:\s*-?\d/;
/** The prod systemic-regime values, in any written form (decimal, rounded, or as a percent). */
const PROD_SYSTEMIC_VALUES = /0\.0036|0\.36\s*%|0\.030000|\b0\.03\b|\b3(?:\.0)?\s*%|0\.9963|0\.996\b|99\.6\s*%|\b100\s*%/;

function prompt(): string {
  return bodies.map(body => JSON.stringify(body.messages)).join("\n");
}

describe("fixture guard: the stored snapshot really carries scenario percents", () => {
  it("highestProbabilityPath and act.decisionSummary embed (60% historical frequency)", () => {
    expect(marketState.outlook.highestProbabilityPath).toContain("60% historical frequency");
    expect(marketState.act.decisionSummary).toContain("60% historical frequency");
    expect(marketState.outlook.probabilities.bull).toBe(64);
    expect(marketState.outlook.transitionProbabilities.remainInRegime).toBe(60);
  });
});

describe("each model-bound field from the prod 2026-10-01 snapshot, on its own", () => {
  it("outlook.highestProbabilityPath has its percent withheld", () => {
    const outlook = outlookForModel(marketState.outlook);
    expect(outlook.highestProbabilityPath).toContain(`(${PLATO_SCENARIO_WITHHELD})`);
    expect(disallowedPercents(JSON.stringify(outlook))).toEqual([]);
  });

  it("act.decisionSummary has its percent withheld; the rest of act is unchanged", () => {
    const act = actForModel(marketState.act);
    expect(act.decisionSummary).toContain(`(${PLATO_SCENARIO_WITHHELD})`);
    expect(act.decisionSummary).not.toMatch(/\d+(?:\.\d+)?\s*%/);
    expect({ ...act, decisionSummary: marketState.act.decisionSummary }).toEqual(marketState.act);
  });
});

describe("assembled PLATO prompts from the prod 2026-10-01 snapshot", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["daily greeting, no client readings", () => generateAshaDailyGreeting({ engineContext: {} })],
    ["daily greeting, canonical client readings", () => generateAshaDailyGreeting({ userName: "Ada", engineContext: { pressureScore: 33, regime: "MODERATE RISK", trend: "Elevated · Stable", keyDrivers: ["Credit"] } })],
    ["daily greeting, client sends regimeConfidence", () => generateAshaDailyGreeting({ engineContext: { regimeConfidence: 0.75, pressureScore: 33 } })],
    ["ask, plain", () => askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/now" } })],
    ["ask, client sends confidence and transition probability", () => askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/seismograph", regimeConfidence: 0.75, transitionProbability: 20 } })],
  ];

  for (const [name, run] of cases) {
    it(`${name}: no % other than similarity, no scenario numbers, no client confidence`, async () => {
      await run();
      expect(bodies.length).toBeGreaterThan(0);
      const text = prompt();
      expect(disallowedPercents(text)).toEqual([]);
      expect(text).not.toContain("historical frequency)");
      expect(text).not.toMatch(/\\?"(bull|bear|neutral|crash|softLanding|stagflation|recession|remainInRegime|transitionTo\w+|regimeConfidence|transitionProbability)\\?"\s*:\s*-?\d/);
      expect(text).not.toContain("0.75");
      expect(text).not.toMatch(NUMERIC_PROBABILITY_FIELD);
      expect(text).not.toMatch(PROD_SYSTEMIC_VALUES);
    });
  }

  it("ask: the systemic-regime block keeps the regime label, z-scores and freshness, and withholds the probabilities", async () => {
    await askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/now" } });
    const text = prompt();
    expect(text).toContain("SYSTEMIC REGIME ENGINE");
    expect(text).toMatch(/\\?"currentRegime\\?":\\?"NORMAL/);
    expect(text).toContain("0.2579819458031539");
    expect(text).toContain("-0.3194692564612353");
    expect(text).toContain("-0.12031238964456506");
    expect(text).toMatch(/\\?"freshnessStatus\\?":\\?"CURRENT/);
    expect(text).toContain(`crisisProbability, transitionProbability and regimeConfidence are ${PLATO_SCENARIO_WITHHELD}: do not state, estimate or imply a value for them.`);
    for (const key of ["crisisProbability", "transitionProbability", "regimeConfidence"]) {
      expect(text).toMatch(new RegExp(`\\\\?"${key}\\\\?":\\\\?"${PLATO_SCENARIO_WITHHELD}`));
    }
    expect(text).not.toMatch(PROD_SYSTEMIC_VALUES);
    expect(text).not.toMatch(NUMERIC_PROBABILITY_FIELD);
  });

  it("ask: a convergence summary cannot carry a probability", async () => {
    systemic.convergence = { methodology: "n-of-m-independent-votes-v1", level: "LOW", deterioratingCount: 1, availableCount: 5, voteCount: 5, thresholdMedium: 3, thresholdHigh: 4, votes: [], summary: "1 of 5 independent votes deteriorating; 30 percent chance of stress", computedAt: "2026-10-01T22:00:00.000Z", contributesToPressureIndex: false };
    await askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/now" } });
    const text = prompt();
    expect(text).toContain("1 of 5 independent votes deteriorating");
    expect(text).not.toContain("30 percent");
  });

  it("greeting: a client narrative carrying a probability is dropped; trend and drivers are filtered", async () => {
    await generateAshaDailyGreeting({ engineContext: { narrative: "Recession probability of 0.6 (60% historical frequency).", trend: "1 in 4 chance of crash", keyDrivers: ["bull 0.53", "Credit"] } });
    const text = prompt();
    expect(text).not.toContain("Recession probability of");
    expect(text).not.toMatch(/\b0\.6\b|\b0\.53\b|1 in 4/);
    expect(disallowedPercents(text)).toEqual([]);
  });

  it("greeting: the fixed evidence-quality line is still forwarded", async () => {
    await generateAshaDailyGreeting({ engineContext: { narrative: "Current evidence quality: healthy" } });
    expect(prompt()).toContain("Current evidence quality: healthy");
  });

  it("the greeting prompt keeps the decision summary, with the percent withheld", async () => {
    await generateAshaDailyGreeting({ engineContext: {} });
    const text = prompt();
    expect(text).toContain("Maintain a balanced posture while The highest-probability outcome");
    expect(text).toContain(`(${PLATO_SCENARIO_WITHHELD})`);
  });
});

describe("scenario withholding filter: hardened forms", () => {
  const withheld: Array<[string, string]> = [
    ["a 30 percent chance of recession", "a Uncalibrated chance of recession"],
    ["30 per cent probability", "Uncalibrated probability"],
    ["60%historical frequency", "Uncalibrated historical frequency"],
    ["probability of 0.6", "probability of Uncalibrated"],
    ["crisis probability: .03 and confidence 0.996", "crisis probability: Uncalibrated and confidence Uncalibrated"],
    ["recession 0.04", "recession Uncalibrated"],
    ["1 in 4 chance", "Uncalibrated chance"],
    ["odds of one in five", "odds of Uncalibrated"],
    ["chance of 1-in-4", "chance of Uncalibrated"],
    // r8: no-space connectors, one word between, fraction and frequency phrasing
    ["probability=0.64", "probability=Uncalibrated"],
    ["probability:0.64", "probability:Uncalibrated"],
    ["1/5 chance", "Uncalibrated chance"],
    ["chance of 1/5", "chance of Uncalibrated"],
    ["60% of the time", "Uncalibrated of the time"],
    ["Bull case 53%", "Bull case Uncalibrated"],
    ["crash risk 2%", "crash risk Uncalibrated"],
    ["stress: 20%", "stress: Uncalibrated"],
  ];
  for (const [input, output] of withheld) {
    it(`withholds: ${input}`, () => expect(withholdScenarioPercents(input)).toBe(output));
  }

  const kept = [
    "HY spreads 3.1% and CPI 2.9 percent",
    "CPI rose 0.3 last month",
    "Breadth expands materially — more than 70% of sectors participating",
    "83% of all historical months",
    "1 of 5 independent votes deteriorating",
    "creditStressZ 0.26, rates 4.25% and 10y 4.1 pct",
    "Dot-Com (78% similarity)",
    "Pressure 33/100, percentile 83",
    // r8: must still pass through unchanged
    "CPI 2.9 percent",
    "70% of sectors",
    "83% of months",
    "% similarity",
    "33/100",
    "neutral rate 2.5%",
    "confidence interval width 1.5",
    "Credit stress is building; spreads 3.1%",
  ];
  for (const text of kept) {
    it(`keeps: ${text}`, () => expect(withholdScenarioPercents(text)).toBe(text));
  }

  it("numeric probability fields in context objects are withheld; other numbers are kept", () => {
    expect(withholdScenarioPercentsDeep({
      crisisProbability: 0.0036, transitionProbability: 0.03, regimeConfidence: 0.996, complementaryProbability: 85,
      nested: [{ bull: 53, remainInRegime: 60, confidence: 41 }],
      creditStressZ: 0.26, systemicRiskScore: 0, similarity: 78, pressureScore: 33, observationCount: 5,
      confidenceOrEvidenceQuality: "HEALTHY",
    })).toEqual({
      crisisProbability: "Uncalibrated", transitionProbability: "Uncalibrated", regimeConfidence: "Uncalibrated", complementaryProbability: "Uncalibrated",
      nested: [{ bull: "Uncalibrated", remainInRegime: "Uncalibrated", confidence: "Uncalibrated" }],
      creditStressZ: 0.26, systemicRiskScore: 0, similarity: 78, pressureScore: 33, observationCount: 5,
      confidenceOrEvidenceQuality: "HEALTHY",
    });
  });

  it("only an explicit AVAILABLE contract status lets a probability number through", () => {
    expect(withholdScenarioPercentsDeep({ state: "AVAILABLE", percent: 41, probability: 41 })).toEqual({ state: "AVAILABLE", percent: 41, probability: 41 });
    expect(withholdScenarioPercentsDeep({ availability: "CALIBRATED", probability: 41 })).toEqual({ availability: "CALIBRATED", probability: "Uncalibrated" });
  });
});
