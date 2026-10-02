import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvokeParams, InvokeResult } from "../_core/llm";
import { log } from "../logger";
import { readPlatoConfig, type PlatoConfig } from "./config";
import { classifyTransportError, PlatoUnavailableError, redactProviderMessage } from "./errors";
import { createPlatoBudget, platoBudgetExhausted, routePlatoCompletion } from "./router";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const CHAIN = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
const USER_QUESTION = "Should I sell my house to buy NVDA? My account is 123-45-6789";

function config(overrides: Partial<PlatoConfig> = {}): PlatoConfig {
  return {
    ...readPlatoConfig({ BUILT_IN_FORGE_API_URL: GEMINI_BASE }),
    models: CHAIN,
    retryBaseDelayMs: 0,
    ...overrides,
  };
}

function ok(model: string, content = "{\"reply\":\"ok\"}"): InvokeResult {
  return {
    id: `resp-${model}`,
    created: 1,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

const err = (status: number, body: string) => new Error(`LLM invoke failed: ${status} Status – ${body}`);
const quota = () => err(429, '{"error":{"code":429,"message":"You exceeded your current quota. Quota limit: 20","status":"RESOURCE_EXHAUSTED"}}');
const highDemand = () => err(503, '{"error":{"code":503,"message":"This model is currently experiencing high demand. Please try again later.","status":"UNAVAILABLE"}}');
const request = { messages: [{ role: "system" as const, content: "context" }, { role: "user" as const, content: USER_QUESTION }] };

function scripted(script: Record<string, Array<Error | "ok" | "hang">>) {
  const calls: string[] = [];
  const invoke = vi.fn(async (params: InvokeParams) => {
    const model = params.model ?? "";
    calls.push(model);
    const next = script[model]?.shift() ?? "ok";
    if (next === "ok") return ok(model);
    if (next === "hang") {
      return await new Promise<InvokeResult>((_, reject) => {
        params.signal?.addEventListener("abort", () => {
          const abort = new Error("This operation was aborted");
          abort.name = "AbortError";
          reject(abort);
        });
      });
    }
    throw next;
  });
  return { invoke, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("PLATO router: provider and model selection", () => {
  it("serves the primary model on the approved OpenAI-compatible provider with no fallback", async () => {
    const { invoke, calls } = scripted({});
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview"]);
    expect(result.trace).toMatchObject({ provider: "openai-compatible", selectedModel: "gemini-3-flash-preview", fallbackUsed: false, fallbackReason: null });
    expect(result.response.choices[0].message.content).toBe("{\"reply\":\"ok\"}");
  });

  it("strips the Gemini models/ prefix before calling chat", async () => {
    const { invoke, calls } = scripted({});
    await routePlatoCompletion(request, { config: config({ models: ["models/gemini-3-flash-preview"] }), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview"]);
  });
});

describe("PLATO router: each failure class", () => {
  it("quota / 429: moves straight to the next model without retrying the exhausted one", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [quota()] });
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(result.trace).toMatchObject({ selectedModel: "gemini-3.1-flash-lite", fallbackUsed: true, fallbackReason: "quota", taskType: "FALLBACK" });
  });

  it("capacity / 503 high demand: retries the same model once with backoff, then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [highDemand()] });
    const result = await routePlatoCompletion(request, { config: config({ retryBaseDelayMs: 500 }), invoke, sleep, random: () => 0.5 });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview"]);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(result.trace).toMatchObject({ selectedModel: "gemini-3-flash-preview", fallbackUsed: false });
  });

  it("capacity / 503 that persists: one same-model retry, then the next model", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [highDemand(), highDemand()] });
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(result.trace).toMatchObject({ selectedModel: "gemini-3.1-flash-lite", fallbackReason: "capacity" });
  });

  it("'high demand' text on a 500 is classified as capacity", () => {
    expect(classifyTransportError(err(500, "model is experiencing high demand"), "p", "m").errorClass).toBe("capacity");
    expect(classifyTransportError(err(502, "bad gateway"), "p", "m").errorClass).toBe("provider_5xx");
  });

  it("transient 5xx: retried on the same model, then falls back", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [err(500, "internal"), err(502, "bad gateway")] });
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(result.trace.fallbackReason).toBe("provider_5xx");
  });

  it("network failure (fetch failed) is transient", async () => {
    const network = new TypeError("fetch failed", { cause: new Error("ECONNRESET") });
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [network] });
    await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview"]);
  });

  it("timeout: aborts the hung request at the per-attempt deadline and moves to the next model", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": ["hang"] });
    const result = await routePlatoCompletion(request, { config: config({ attemptTimeoutMs: 20 }), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(result.trace).toMatchObject({ selectedModel: "gemini-3.1-flash-lite", fallbackReason: "timeout" });
    const firstSignal = invoke.mock.calls[0][0].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
  });

  it("retired model / 404: falls back to the next model", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [err(404, "no longer available to new users")] });
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(result.trace.fallbackReason).toBe("model_unavailable");
  });

  it("auth / 401-403: stops immediately (every model shares the key)", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [err(403, "PERMISSION_DENIED")] });
    const failure = await routePlatoCompletion(request, { config: config(), invoke }).catch(e => e);
    expect(calls).toEqual(["gemini-3-flash-preview"]);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure.reason).toBe("misconfigured");
  });

  it("missing gateway key is classified as auth and not retried", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [new Error("BUILT_IN_FORGE_API_KEY is not configured")] });
    const failure = await routePlatoCompletion(request, { config: config(), invoke }).catch(e => e);
    expect(calls).toHaveLength(1);
    expect(failure.reason).toBe("misconfigured");
  });

  it("bad request / 400: stops without trying another model", async () => {
    const { invoke, calls } = scripted({ "gemini-3-flash-preview": [err(400, "INVALID_ARGUMENT")] });
    const failure = await routePlatoCompletion(request, { config: config(), invoke }).catch(e => e);
    expect(calls).toHaveLength(1);
    expect(failure.attempts[0].errorClass).toBe("bad_request");
  });
});

describe("PLATO router: all-fail path and bounds", () => {
  it("every model over quota: typed PlatoUnavailableError(reason=quota), never a synthetic answer", async () => {
    const { invoke, calls } = scripted({
      "gemini-3-flash-preview": [quota()],
      "gemini-3.1-flash-lite": [quota()],
      "gemini-3.5-flash-lite": [quota()],
    });
    const failure = await routePlatoCompletion(request, { config: config(), invoke }).catch(e => e);
    expect(calls).toEqual(CHAIN);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure).toMatchObject({ reason: "quota", rateLimited: true, attemptedModels: CHAIN });
    expect(failure).not.toHaveProperty("response");
  });

  it("mixed quota and high demand ends as capacity", async () => {
    const { invoke } = scripted({
      "gemini-3-flash-preview": [quota()],
      "gemini-3.1-flash-lite": [highDemand(), highDemand()],
      "gemini-3.5-flash-lite": [quota()],
    });
    const failure = await routePlatoCompletion(request, { config: config({ maxAttempts: 8 }), invoke }).catch(e => e);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure.reason).toBe("capacity");
  });

  it("every attempt times out: reason=timeout", async () => {
    const { invoke } = scripted({ "gemini-3-flash-preview": ["hang"], "gemini-3.1-flash-lite": ["hang"], "gemini-3.5-flash-lite": ["hang"] });
    const failure = await routePlatoCompletion(request, { config: config({ attemptTimeoutMs: 10 }), invoke }).catch(e => e);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure.reason).toBe("timeout");
    expect(failure.attempts).toHaveLength(3);
  });

  it("never exceeds the attempt cap", async () => {
    const { invoke, calls } = scripted({
      "gemini-3-flash-preview": [highDemand(), highDemand()],
      "gemini-3.1-flash-lite": [highDemand(), highDemand()],
      "gemini-3.5-flash-lite": [highDemand(), highDemand()],
    });
    const failure = await routePlatoCompletion(request, { config: config({ maxAttempts: 4 }), invoke }).catch(e => e);
    expect(calls).toHaveLength(4);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
  });

  it("stops at the total deadline even when models remain", async () => {
    let clock = 0;
    const now = () => clock;
    const invoke = vi.fn(async () => {
      clock += 60;
      throw quota();
    });
    const failure = await routePlatoCompletion(request, { config: config({ totalDeadlineMs: 100 }), invoke, now }).catch(e => e);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
  });
});

describe("PLATO router: telemetry", () => {
  it("logs provider, model, attempt and fallback reason with no prompt, question, answer or key", async () => {
    const info = vi.spyOn(log, "info").mockImplementation(() => {});
    const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
    const { invoke } = scripted({
      "gemini-3-flash-preview": [err(429, 'RESOURCE_EXHAUSTED key=AIzaSyA1234567890abcdefghijklmnopq Bearer sk-abcdefghijklmnopqrstu')],
    });
    await routePlatoCompletion(request, { config: config(), invoke });

    expect(warn).toHaveBeenCalledWith("[PLATO] model call", expect.objectContaining({
      provider: "openai-compatible",
      model: "gemini-3-flash-preview",
      attempt: 1,
      success: false,
      errorClass: "quota",
      httpStatus: 429,
      fallbackReason: null,
    }));
    expect(info).toHaveBeenCalledWith("[PLATO] model call", expect.objectContaining({
      provider: "openai-compatible",
      model: "gemini-3.1-flash-lite",
      attempt: 2,
      success: true,
      fallbackUsed: true,
      fallbackReason: "quota",
    }));
    const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain(USER_QUESTION);
    expect(logged).not.toContain("123-45-6789");
    expect(logged).not.toContain("context");
    expect(logged).not.toContain("AIzaSyA1234567890");
    expect(logged).not.toContain("sk-abcdefghijklmnop");
    expect(logged).not.toContain("{\\\"reply\\\"");
  });

  it("redacts key-like strings from upstream detail", () => {
    expect(redactProviderMessage("x?key=AIzaSyA1234567890abcdefghijklmnopq&y Bearer abc.def")).not.toMatch(/AIza|abc\.def/);
  });
});

describe("PLATO router: a 200 without a usable answer is a failure", () => {
  const answerless = (choices: InvokeResult["choices"]): InvokeResult => ({ id: "x", created: 1, model: "m", choices });
  function sequence(responses: InvokeResult[]) {
    const calls: string[] = [];
    const invoke = vi.fn(async (params: InvokeParams) => {
      calls.push(params.model ?? "");
      return responses.shift() ?? ok(params.model ?? "");
    });
    return { invoke, calls };
  }

  it.each([
    ["no choices", answerless([])],
    ["empty content", answerless([{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "stop" }])],
    ["null content", answerless([{ index: 0, message: { role: "assistant", content: null as unknown as string }, finish_reason: "stop" }])],
    ["content_filter block", answerless([{ index: 0, message: { role: "assistant", content: "partial" }, finish_reason: "content_filter" }])],
  ])("%s → empty_response, next model", async (_label, bad) => {
    const { invoke, calls } = sequence([bad]);
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(result.trace).toMatchObject({ fallbackUsed: true, fallbackReason: "empty_response" });
  });

  it("truncated (finish_reason=length) → malformed_response, next model", async () => {
    const { invoke, calls } = sequence([answerless([{ index: 0, message: { role: "assistant", content: "{\"reply\":\"Cred" }, finish_reason: "length" }])]);
    const result = await routePlatoCompletion(request, { config: config(), invoke });
    expect(calls).toHaveLength(2);
    expect(result.trace.fallbackReason).toBe("malformed_response");
  });

  it("non-JSON content when JSON was requested → malformed_response", async () => {
    const { invoke } = sequence([answerless([{ index: 0, message: { role: "assistant", content: "plain prose" }, finish_reason: "stop" }])]);
    const result = await routePlatoCompletion(
      { ...request, response_format: { type: "json_object" } },
      { config: config(), invoke },
    );
    expect(result.trace.fallbackReason).toBe("malformed_response");
  });

  it("caller validator can reject a 200 (e.g. JSON without a reply)", async () => {
    const { invoke, calls } = sequence([ok("gemini-3-flash-preview", "{}")]);
    const result = await routePlatoCompletion(request, {
      config: config(),
      invoke,
      validateResponse: response => (String(response.choices[0].message.content).includes("reply") ? null : "empty_response"),
    });
    expect(calls).toHaveLength(2);
    expect(result.trace.fallbackReason).toBe("empty_response");
  });

  it("every model answerless → typed PlatoUnavailableError, never a response", async () => {
    const empty = () => answerless([]);
    const { invoke } = sequence([empty(), empty(), empty()]);
    const failure = await routePlatoCompletion(request, { config: config(), invoke }).catch(e => e);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(failure.reason).toBe("provider_error");
    expect(failure.attempts.map((attempt: { errorClass: string }) => attempt.errorClass)).toEqual(["empty_response", "empty_response", "empty_response"]);
  });
});

describe("PLATO router: shared per-question budget", () => {
  it("two router calls with one budget make at most maxAttempts provider calls", async () => {
    const budget = createPlatoBudget(config({ maxAttempts: 4 }));
    const { invoke, calls } = scripted({
      "gemini-3-flash-preview": [quota(), highDemand(), highDemand(), "ok"],
      "gemini-3.1-flash-lite": ["ok", highDemand()],
    });
    await routePlatoCompletion(request, { config: config(), invoke, budget }); // 2 calls
    const failure = await routePlatoCompletion(request, { config: config(), invoke, budget }).catch(e => e); // 2 more, then cap
    expect(calls).toHaveLength(4);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(platoBudgetExhausted(budget)).toBe(true);
  });

  it("an exhausted budget makes no provider call", async () => {
    const budget = createPlatoBudget(config({ maxAttempts: 1 }));
    budget.attemptsUsed = 1;
    const { invoke } = scripted({});
    const failure = await routePlatoCompletion(request, { config: config(), invoke, budget }).catch(e => e);
    expect(invoke).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
  });

  it("the shared deadline carries across router calls", async () => {
    let clock = 0;
    const now = () => clock;
    const budget = createPlatoBudget(config({ totalDeadlineMs: 100 }), now);
    clock = 150;
    const { invoke } = scripted({});
    const failure = await routePlatoCompletion(request, { config: config(), invoke, budget, now }).catch(e => e);
    expect(invoke).not.toHaveBeenCalled();
    expect(failure.reason).toBe("timeout");
  });
});
