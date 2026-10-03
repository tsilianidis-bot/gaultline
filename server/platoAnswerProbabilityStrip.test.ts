/**
 * PR #58, QA r10 B8: a PLATO answer or daily greeting never states a probability %.
 * - askAsha strips probability-% sentences from every model-written text field after validation
 *   (the same field list as #60's withoutModelProbabilities, plus PLATO's own answer fields).
 * - generateAshaDailyGreeting strips them from the greeting.
 * - Ordinary size statements ("A drawdown of 10% is typical") survive.
 * - The evidence packet the model sees (ALLOWED EVIDENCE CLAIMS, incl. "Scenario component … is N")
 *   is byte-identical to edb36648 for the same inputs (post-launch item, unchanged this round).
 * Mocked provider only (fetch stub); prod 2026-10-01 fixtures.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  // Fake key for the mocked provider only (fetch is stubbed below); no real call is made.
  process.env.BUILT_IN_FORGE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
  process.env.BUILT_IN_FORGE_API_KEY = "AIzaSy_TEST_FAKE_KEY_000000000000000000";
});

const FIX = path.join(import.meta.dirname, "__fixtures__", "prod-2026-10-01");
const fixture = (name: string) => JSON.parse(readFileSync(path.join(FIX, name), "utf8"));
const marketState = fixture("market-state-current.json");
const canonical = fixture("canonical-current.json");
const EVIDENCE_AT_EDB3664: string[] = fixture("plato-evidence-claims-edb3664.json");

vi.mock("./marketStateService", async importOriginal => ({
  ...(await importOriginal<typeof import("./marketStateService")>()),
  getCanonicalMarketState: async () => structuredClone(marketState),
}));
vi.mock("./canonicalIntelligenceState", async importOriginal => ({
  ...(await importOriginal<typeof import("./canonicalIntelligenceState")>()),
  getAuthoritativeCanonicalIntelligenceState: async () => structuredClone(canonical),
}));
vi.mock("./systemicRegime/reader", async importOriginal => ({
  ...(await importOriginal<typeof import("./systemicRegime/reader")>()),
  getLatestSystemicRegimeReading: async () => null,
  getLatestSignalConvergence: async () => null,
}));

import { askAsha, generateAshaDailyGreeting, stripPlatoProbabilityClaims, withoutPlatoProbabilityClaims } from "./ashaEngine";

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

const state = vi.hoisted(() => ({ answer: "" as string, greeting: "" as string }));
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
  state.answer = JSON.stringify(ANSWER);
  state.greeting = GREETING;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ask = () => askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/now" } } as never);
const greet = () => generateAshaDailyGreeting({ userName: "Ada", engineContext: {} } as never);

/** Every string in a value, with its path. */
function strings(value: unknown, at = "$"): Array<[string, string]> {
  if (typeof value === "string") return [[at, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${at}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, `${at}.${k}`));
  return [];
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

  it("the evidence packet for fixed inputs is byte-identical to edb36648 (ask, correction and greeting)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T20:00:00.000Z"));
    await ask();
    await greet();
    const evidence = bodies.map(body => body.messages.filter(m => m.role === "system").map(m => m.content.split("\n").filter(l => l.startsWith("ALLOWED EVIDENCE CLAIMS: ")).join("\n")).join("\n"));
    expect(evidence).toHaveLength(EVIDENCE_AT_EDB3664.length);
    expect(evidence).toEqual(EVIDENCE_AT_EDB3664);
    expect(evidence[0]).toContain("Scenario component bull is 43.");
  });
});
