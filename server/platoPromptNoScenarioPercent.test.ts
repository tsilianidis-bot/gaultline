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

import { askAsha, generateAshaDailyGreeting } from "./ashaEngine";
import { actForModel, outlookForModel, PLATO_SCENARIO_WITHHELD } from "./ashaGateway";

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
    });
  }

  it("the greeting prompt keeps the decision summary, with the percent withheld", async () => {
    await generateAshaDailyGreeting({ engineContext: {} });
    const text = prompt();
    expect(text).toContain("Maintain a balanced posture while The highest-probability outcome");
    expect(text).toContain(`(${PLATO_SCENARIO_WITHHELD})`);
  });
});
