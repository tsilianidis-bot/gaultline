/**
 * App-side PLATO usage and cost limits (mocked providers only).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import type { TrpcContext } from "./_core/context";

const engine = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock("./ashaEngine", async importOriginal => ({
  ...(await importOriginal<typeof import("./ashaEngine")>()),
  askAsha: engine.ask,
}));

import { appRouter } from "./routers";
import { mapAshaProcedureError } from "./ashaProcedureError";
import { readPlatoConfig } from "./plato/config";
import { PlatoUnavailableError, unusableAnswerError } from "./plato/errors";
import {
  PLATO_DEFAULT_GLOBAL_DAILY_CALLS,
  PLATO_DEFAULT_MAX_OUTPUT_TOKENS,
  PLATO_DEFAULT_USER_DAILY_QUESTIONS,
  PlatoUsageCounter,
  platoUsage,
  readPlatoLimits,
} from "./plato/limits";
import { routePlatoCompletion } from "./plato/router";
import {
  PLATO_DAILY_LIMIT_MESSAGE,
  PLATO_USER_DAILY_LIMIT_MESSAGE,
  reduceAshaAskFailure,
} from "../shared/ashaPanelMachine";

const CHAIN = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
const config = () => ({ ...readPlatoConfig({ BUILT_IN_FORGE_API_URL: "https://generativelanguage.googleapis.com/v1beta/openai" }), models: CHAIN, retryBaseDelayMs: 0 });
const ok = (model: string): InvokeResult => ({
  id: "r", created: 1, model,
  choices: [{ index: 0, message: { role: "assistant", content: "{\"reply\":\"ok\"}" }, finish_reason: "stop" }],
});
const request = { messages: [{ role: "user" as const, content: "Is credit stress building?" }] };
const limits = (overrides: Partial<ReturnType<typeof readPlatoLimits>> = {}) => ({ ...readPlatoLimits({}), ...overrides });

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
function ctx(id: number): TrpcContext {
  const user = {
    id, openId: `user-${id}`, email: `u${id}@example.com`, name: "Test User", loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as AuthenticatedUser;
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}
const askInput = { userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/now" } };

beforeEach(() => {
  platoUsage.reset();
  engine.ask.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  platoUsage.reset();
});

describe("PLATO limit defaults and env overrides", () => {
  it("defaults live in code: 50 questions per user per day, 2000 calls per day, 8192 output tokens", () => {
    expect(readPlatoLimits({})).toEqual({ userDailyQuestions: 50, globalDailyCalls: 2000, maxOutputTokens: 8192 });
    expect([PLATO_DEFAULT_USER_DAILY_QUESTIONS, PLATO_DEFAULT_GLOBAL_DAILY_CALLS, PLATO_DEFAULT_MAX_OUTPUT_TOKENS]).toEqual([50, 2000, 8192]);
  });

  it("reads optional env overrides when present and ignores invalid ones", () => {
    expect(readPlatoLimits({ PLATO_USER_DAILY_QUESTION_LIMIT: "20", PLATO_GLOBAL_DAILY_CALL_LIMIT: "5000", PLATO_MAX_OUTPUT_TOKENS: "4096" }))
      .toEqual({ userDailyQuestions: 20, globalDailyCalls: 5000, maxOutputTokens: 4096 });
    expect(readPlatoLimits({ PLATO_USER_DAILY_QUESTION_LIMIT: "0", PLATO_GLOBAL_DAILY_CALL_LIMIT: "lots", PLATO_MAX_OUTPUT_TOKENS: "-1" }))
      .toEqual({ userDailyQuestions: 50, globalDailyCalls: 2000, maxOutputTokens: 8192 });
  });

  it("clamps the output-token cap to 1024–32768", () => {
    expect(readPlatoLimits({ PLATO_MAX_OUTPUT_TOKENS: "100" }).maxOutputTokens).toBe(1024);
    expect(readPlatoLimits({ PLATO_MAX_OUTPUT_TOKENS: "999999" }).maxOutputTokens).toBe(32768);
  });
});

describe("in-memory daily counter", () => {
  it("caps each user independently and resets at the UTC day boundary", () => {
    let now = Date.parse("2026-10-02T23:59:00.000Z");
    const counter = new PlatoUsageCounter(() => now);
    for (let i = 0; i < 3; i++) expect(counter.tryReserveUserQuestion(7, 3)).toBe(true);
    expect(counter.tryReserveUserQuestion(7, 3)).toBe(false);
    expect(counter.tryReserveUserQuestion(8, 3)).toBe(true);
    counter.releaseUserQuestion(7);
    expect(counter.tryReserveUserQuestion(7, 3)).toBe(true);
    now = Date.parse("2026-10-03T00:00:01.000Z");
    expect(counter.questionsUsed(7)).toBe(0);
    expect(counter.tryReserveUserQuestion(7, 3)).toBe(true);
  });

  it("caps global calls and resets the next UTC day", () => {
    let now = Date.parse("2026-10-02T12:00:00.000Z");
    const counter = new PlatoUsageCounter(() => now);
    expect(counter.tryConsumeGlobalCall(2)).toBe(true);
    expect(counter.tryConsumeGlobalCall(2)).toBe(true);
    expect(counter.tryConsumeGlobalCall(2)).toBe(false);
    now += 24 * 60 * 60 * 1000;
    expect(counter.tryConsumeGlobalCall(2)).toBe(true);
  });
});

describe("router: max output tokens on every PLATO call", () => {
  function capture() {
    const seen: Array<Pick<InvokeParams, "maxTokens" | "max_tokens" | "model">> = [];
    const invoke = vi.fn(async (params: InvokeParams) => {
      seen.push({ maxTokens: params.maxTokens, max_tokens: params.max_tokens, model: params.model });
      if (seen.length === 1) throw new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED");
      return ok(params.model ?? "");
    });
    return { seen, invoke };
  }

  it("sends max_tokens 8192 by default on the primary and on every fallback", async () => {
    const { seen, invoke } = capture();
    await routePlatoCompletion(request, { config: config(), invoke, usage: new PlatoUsageCounter() });
    expect(seen).toEqual([
      { maxTokens: 8192, max_tokens: undefined, model: "gemini-3-flash-preview" },
      { maxTokens: 8192, max_tokens: undefined, model: "gemini-3.1-flash-lite" },
    ]);
  });

  it("keeps a lower caller value and clamps a higher one", async () => {
    const low = capture();
    await routePlatoCompletion({ ...request, maxTokens: 2048 }, { config: config(), invoke: low.invoke, usage: new PlatoUsageCounter() });
    expect(low.seen.every(call => call.maxTokens === 2048)).toBe(true);
    const high = capture();
    await routePlatoCompletion({ ...request, max_tokens: 60000 }, { config: config(), invoke: high.invoke, usage: new PlatoUsageCounter(), limits: limits({ maxOutputTokens: 4096 }) });
    expect(high.seen.every(call => call.maxTokens === 4096 && call.max_tokens === undefined)).toBe(true);
  });
});

describe("router: global daily PLATO call cap", () => {
  it("stops before calling the provider once today's cap is reached", async () => {
    const usage = new PlatoUsageCounter();
    const invoke = vi.fn(async (params: InvokeParams) => ok(params.model ?? ""));
    await routePlatoCompletion(request, { config: config(), invoke, usage, limits: limits({ globalDailyCalls: 2 }) });
    await routePlatoCompletion(request, { config: config(), invoke, usage, limits: limits({ globalDailyCalls: 2 }) });
    const failure = await routePlatoCompletion(request, { config: config(), invoke, usage, limits: limits({ globalDailyCalls: 2 }) }).catch(error => error);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure.reason).toBe("daily_limit");
    const mapped = mapAshaProcedureError(failure);
    expect(mapped.code).toBe("TOO_MANY_REQUESTS");
    expect(mapped.message).toBe("PLATO has reached today's limit. Please try again tomorrow.");
  });

  it("counts retries and fallbacks, and does not fall back once the cap is hit mid-question", async () => {
    const usage = new PlatoUsageCounter();
    const invoke = vi.fn(async () => { throw new Error("LLM invoke failed: 503 Service Unavailable – high demand"); });
    const failure = await routePlatoCompletion(request, { config: config(), invoke, usage, limits: limits({ globalDailyCalls: 2 }) }).catch(error => error);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(failure.reason).toBe("daily_limit");
    expect(usage.snapshot().globalCalls).toBe(2);
  });
});

describe("asha.ask: per-signed-in-user daily question cap", () => {
  it("allows the configured number of questions, then returns the typed limit error without calling PLATO", async () => {
    vi.stubEnv("PLATO_USER_DAILY_QUESTION_LIMIT", "2");
    engine.ask.mockResolvedValue({ reply: "Credit is calm." });
    const caller = appRouter.createCaller(ctx(1));
    await caller.asha.ask(askInput);
    await caller.asha.ask(askInput);
    const failure = await caller.asha.ask(askInput).catch(error => error);
    expect(engine.ask).toHaveBeenCalledTimes(2);
    expect(failure).toMatchObject({ code: "TOO_MANY_REQUESTS", message: PLATO_USER_DAILY_LIMIT_MESSAGE });
    expect(JSON.stringify(failure)).not.toContain("Credit is calm");
    // Another user has their own allowance.
    await expect(appRouter.createCaller(ctx(2)).asha.ask(askInput)).resolves.toEqual({ reply: "Credit is calm." });
  });

  it("defaults to 50 questions per user per day", async () => {
    engine.ask.mockResolvedValue({ reply: "ok" });
    const caller = appRouter.createCaller(ctx(3));
    for (let i = 0; i < 50; i++) await caller.asha.ask(askInput);
    await expect(caller.asha.ask(askInput)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: PLATO_USER_DAILY_LIMIT_MESSAGE });
    expect(engine.ask).toHaveBeenCalledTimes(50);
  });

  it("a question PLATO could not answer does not count against the user", async () => {
    vi.stubEnv("PLATO_USER_DAILY_QUESTION_LIMIT", "1");
    engine.ask.mockRejectedValueOnce(unusableAnswerError("empty_response", "openai-compatible", "gemini-3-flash-preview"));
    engine.ask.mockResolvedValueOnce({ reply: "ok" });
    const caller = appRouter.createCaller(ctx(4));
    await expect(caller.asha.ask(askInput)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(caller.asha.ask(askInput)).resolves.toEqual({ reply: "ok" });
    await expect(caller.asha.ask(askInput)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("client: daily-limit card", () => {
  it("shows the honest limit copy with no Retry and no answer", () => {
    for (const message of [PLATO_DAILY_LIMIT_MESSAGE, PLATO_USER_DAILY_LIMIT_MESSAGE]) {
      const state = reduceAshaAskFailure({ message, data: { code: "TOO_MANY_REQUESTS" } });
      expect(state).toMatchObject({ kind: "daily_limit", showRetry: false, showSignIn: false });
      expect(state.detail).toContain(message);
    }
  });

  it("a provider 429 keeps the existing retryable rate-limit card", () => {
    const state = reduceAshaAskFailure({ message: "PLATO is temporarily unavailable: the language model's usage limit has been reached. Please try again later.", data: { code: "TOO_MANY_REQUESTS" } });
    expect(state).toMatchObject({ kind: "rate_limit", showRetry: true });
  });
});
