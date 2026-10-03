/**
 * PR #58, QA r13 B10: /app/asha (PLATO Intelligence Center) model text never states a probability %.
 * - synthesizeMarketThesis, getFollowUpQuestions and getWhatChangedSummary strip probability-%
 *   sentences (the same helper as asha.ask); nothing left reads unavailable, never an empty card.
 * - getWhatChangedSummary sends canonical pressure as "N/100", or unavailable when it is missing
 *   (never the 0-10 overall.score); the page sends canonical pressure and regime only, bands 70/45.
 * Mocked model (invokeLLM) and database (getDb) only; prod 2026-10-01 market-state fixture.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ content: "" as unknown, calls: [] as Array<{ messages: Array<{ role: string; content: string }> }> }));
const db = vi.hoisted(() => ({ queue: [] as unknown[][] }));

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

import { ashaMemoryRouter, platoMemoryQuestions, platoMemoryText, whatChangedMarketStateClause } from "./routers/ashaMemory";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { buildIntelligenceCenterMarketState, INTELLIGENCE_CENTER_UNAVAILABLE_COLOR } from "../client/src/lib/ashaBriefingContext";
import type { CanonicalMarketState } from "../shared/marketState";

const CLAIM_A = "There is a 23% probability of recession.";
const CLAIM_B = "The likelihood: 40% for a bear market.";
const KEEP = "A drawdown of 10% is typical.";
const CLAIMS = /23% probability of recession|likelihood: 40%|Odds of a crash/;

const STARTED = new Date("2026-10-01T14:00:00.000Z");
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

  it("canonical pressure is sent as N/100, never as the 0-10 score", async () => {
    whatChangedRows();
    llm.content = "Since we last spoke, credit stayed calm.";
    await whatChanged({ currentPressureScore: 33.4, currentRegime: "MODERATE RISK" });
    expect(userPrompt()).toContain("the current market regime (MODERATE RISK) and pressure level (33/100).");
    expect(userPrompt()).not.toMatch(/\/10\)/);
    expect(userPrompt()).not.toContain("unavailable");
  });

  it("a missing pressure or regime is sent as unavailable, never estimated", async () => {
    whatChangedRows();
    llm.content = "Since we last spoke, credit stayed calm.";
    await whatChanged({ currentPressureScore: null, currentRegime: "MODERATE RISK" });
    expect(userPrompt()).toContain("Be specific about the current market regime (MODERATE RISK). The pressure level is unavailable: do not state or estimate it.");
    whatChangedRows();
    await whatChanged({});
    expect(userPrompt()).toContain("The current market regime and pressure level are unavailable: do not state or estimate them.");
    expect(userPrompt()).not.toMatch(/\/100|\/10\b/);
    expect(whatChangedMarketStateClause("  ", Number.NaN)).toBe("The current market regime and pressure level are unavailable: do not state or estimate them.");
  });

  it("a pressure outside 0-100 is rejected at the input", async () => {
    await expect(whatChanged({ currentPressureScore: 101, currentRegime: "MODERATE RISK" })).rejects.toThrow();
    await expect(whatChanged({ currentPressureScore: -1, currentRegime: "MODERATE RISK" })).rejects.toThrow();
  });
});

describe("QA r13 B10: Intelligence Center page sends and bands canonical 0-100 pressure", () => {
  const fixture = JSON.parse(readFileSync(path.join(import.meta.dirname, "__fixtures__", "prod-2026-10-01", "market-state-current.json"), "utf8")) as CanonicalMarketState;
  const withPressure = (pressureScore: number) => {
    const marketState = structuredClone(fixture);
    marketState.now.pressureScore = pressureScore;
    return selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
  };

  it("canonical: pressure 0-100 and regime from the canonical state; bands at 70 and 45", () => {
    const { output, mode } = withPressure(33);
    expect(mode).toBe("canonical");
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
    expect(page).toContain("currentPressureScore: marketState.pressure100,");
    expect(page).toContain("currentRegime: marketState.regime,");
    expect(page).not.toMatch(/overall\.score/);
    for (const marker of ['data-plato-unavailable="thesis"', 'data-plato-unavailable="follow-ups"', 'data-plato-unavailable="what-changed"']) {
      expect(page).toContain(marker);
    }
  });
});
