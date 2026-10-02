/**
 * End-to-end (mocked provider) checks that PLATO never fabricates an answer.
 * Real askAsha → invokeAshaGateway → PLATO router → adapter; only invokeLLM
 * (the HTTP call) and the canonical context builders are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvokeParams, InvokeResult } from "./_core/llm";

const llm = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./_core/llm", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/llm")>()),
  invokeLLM: llm.invoke,
}));

const gateway = vi.hoisted(() => ({ createContext: vi.fn(), buildContextBlock: vi.fn(), getProvenance: vi.fn() }));
vi.mock("./ashaGateway", async importOriginal => ({
  ...(await importOriginal<typeof import("./ashaGateway")>()),
  createAshaGatewayContext: gateway.createContext,
  buildAshaCanonicalContextBlock: gateway.buildContextBlock,
  getAshaContextProvenance: gateway.getProvenance,
}));

import { askAsha, generateAshaDailyGreeting } from "./ashaEngine";
import { mapAshaProcedureError } from "./ashaProcedureError";
import { PlatoUnavailableError } from "./plato/errors";

const gatewayContext = {
  version: "1.0", destination: "now", page: { page: "/app/now" },
  marketState: {
    sourceUpdatedAt: "2026-10-01T18:00:00.000Z", sourceHealth: [], now: { pressureScore: 33, regime: "Moderate" },
    history: { observationCount: 0 }, outlook: { probabilities: { bull: 25, bear: 35, confidence: 72 } }, why: { evidenceFamilies: [] },
  },
} as any;
const provenance = { contextVersion: "1.0", marketStateVersion: "1.0", generatedAt: "2026-10-01T18:00:00.000Z", sourceUpdatedAt: "2026-10-01T18:00:00.000Z", freshness: "live", cacheStatus: "fresh-cache", sourceHealth: [], warnings: [] } as any;

type Step = InvokeResult | Error;
function result(content: unknown, finish: string | null = "stop", choices = true): InvokeResult {
  return {
    id: "r", created: 1, model: "m",
    choices: choices ? [{ index: 0, message: { role: "assistant", content: content as string }, finish_reason: finish }] : [],
  } as InvokeResult;
}
const fullBriefing = (reply: string) => JSON.stringify({
  reply, directAnswer: "Pressure is moderate.", executiveSummary: "Pressure is moderate. Credit is calm.", coreThesis: "Credit is calm.",
  keyFindings: ["a", "b", "c"], riskFactors: ["x", "y", "z"], invalidationConditions: ["i1", "i2"],
});
const replyOnly = (reply: string) => JSON.stringify({ reply });
const http = (status: number, body: string) => new Error(`LLM invoke failed: ${status} Status – ${body}`);

function script(steps: Step[]) {
  const models: string[] = [];
  llm.invoke.mockImplementation(async (params: InvokeParams) => {
    models.push(params.model ?? "");
    const next = steps.shift() ?? http(503, "UNAVAILABLE");
    if (next instanceof Error) throw next;
    return next;
  });
  return models;
}

const ask = () => askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/why" } });

beforeEach(() => {
  vi.clearAllMocks();
  gateway.createContext.mockResolvedValue(gatewayContext);
  gateway.buildContextBlock.mockReturnValue("\nCONTEXT");
  gateway.getProvenance.mockReturnValue(provenance);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function expectTypedUnavailable(promise: Promise<unknown>, errorClass: string) {
  const failure = await promise.catch(error => error);
  expect(failure).toBeInstanceOf(PlatoUnavailableError);
  expect((failure as PlatoUnavailableError).attempts.every(attempt => attempt.errorClass === errorClass)).toBe(true);
  const mapped = mapAshaProcedureError(failure);
  expect(mapped.code).toBe("SERVICE_UNAVAILABLE");
  expect(mapped.message).toMatch(/^PLATO is temporarily unavailable/);
  return failure as PlatoUnavailableError;
}

describe("PLATO never fabricates an answer from an answerless 200", () => {
  it("no choices on every model: typed unavailable after trying each model once", async () => {
    const models = script([result(null, "stop", false), result(null, "stop", false), result(null, "stop", false)]);
    await expectTypedUnavailable(ask(), "empty_response");
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
  });

  it("empty content with a safety / content_filter stop: typed unavailable", async () => {
    script([result("", "content_filter"), result("", "safety"), result("", "content_filter")]);
    await expectTypedUnavailable(ask(), "empty_response");
  });

  it("null content: typed unavailable", async () => {
    script([result(null), result(null), result(null)]);
    await expectTypedUnavailable(ask(), "empty_response");
  });

  it("prose instead of the briefing JSON is never shown as the answer", async () => {
    script([result("Credit stress looks fine to me."), result("Still prose."), result("More prose.")]);
    const failure = await expectTypedUnavailable(ask(), "malformed_response");
    expect(JSON.stringify(failure)).not.toContain("Credit stress looks fine");
  });

  it("truncated JSON (finish_reason=length) is a failure, not an answer", async () => {
    script([result('{"reply":"Credit stress is', "length"), result('{"reply":"Credit', "length"), result('{"re', "length")]);
    await expectTypedUnavailable(ask(), "malformed_response");
  });

  it("JSON with an empty reply is a failure", async () => {
    script([result(replyOnly("")), result(replyOnly("  ")), result(JSON.stringify({ directAnswer: "x" }))]);
    await expectTypedUnavailable(ask(), "empty_response");
  });

  it("an answerless primary falls back to the next model and returns only what the model said", async () => {
    const models = script([result(null, "stop", false), result(fullBriefing("Credit is calm and stable."))]);
    const response = await ask();
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(response.modelTrace.selectedModel).toBe("gemini-3.1-flash-lite");
    expect(response.reply).not.toContain("I was unable to generate a response");
    // Fields the model did not supply stay undefined: no invented ELEVATED / Moderate / NEUTRAL / WATCH.
    expect(response.threatLevel).toBeUndefined();
    expect(response.riskLevel).toBeUndefined();
    expect(response.marketBias).toBeUndefined();
    expect(response.finalVerdictAction).toBeUndefined();
  });
});

describe("one question, one budget", () => {
  it("the correction retry shares the answer's 4-call budget", async () => {
    // Answer succeeds on call 1 but fails structural validation (reply only) → correction.
    // Correction: 503, same-model retry 503, next model 503 → cap of 4 reached → keep the first answer.
    const models = script([result(replyOnly("Credit is calm.")), http(503, "UNAVAILABLE"), http(503, "UNAVAILABLE"), http(503, "UNAVAILABLE"), result(fullBriefing("never reached"))]);
    const response = await ask();
    expect(models).toHaveLength(4);
    // No canonical evidence packet in this fixture, so the integrity layer withholds the claim; the point is
    // that the 5th scripted response is never requested.
    expect(response.reply).not.toContain("never reached");
  });

  it("an answer that used 3 calls leaves exactly 1 for the correction", async () => {
    const models = script([result(null, "stop", false), result("prose"), result(replyOnly("Credit is calm.")), http(503, "UNAVAILABLE"), result(fullBriefing("never reached"))]);
    const response = await ask();
    expect(models).toHaveLength(4);
    expect(response.reply).not.toContain("never reached");
  });

  it("skips the correction entirely when the answer used the whole budget", async () => {
    const models = script([http(503, "UNAVAILABLE"), http(503, "UNAVAILABLE"), result(null, "stop", false), result(replyOnly("Credit is calm.")), result(fullBriefing("never reached"))]);
    const response = await ask();
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
    expect(response.reply).not.toContain("never reached");
    expect(JSON.stringify((console.warn as any).mock.calls)).toContain("Correction skipped");
  });

  it("a failed correction logs only class and status, never the upstream body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    script([result(replyOnly("Credit is calm.")), http(400, "SECRET-UPSTREAM-BODY prompt echo")]);
    await ask();
    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    expect(logged).toContain("Correction failed");
    expect(logged).toContain("bad_request");
    expect(logged).not.toContain("SECRET-UPSTREAM-BODY");
  });
});

describe("daily greeting", () => {
  it("an answerless 200 on every model is a typed failure, never the canned greeting", async () => {
    script([result(""), result(null), result(null, "stop", false)]);
    const failure = await generateAshaDailyGreeting({ engineContext: { pressureScore: 33, regime: "Moderate", regimeConfidence: 0.7, narrative: "n", trend: "stable", keyDrivers: [] } }).catch(e => e);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(String(failure.message)).not.toContain("Canonical state unavailable");
  });
});
