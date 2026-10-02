import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InvokeResult } from "../_core/llm";
import { createManusGatewayAdapter } from "./adapters/openaiCompatible";
import { createManusV2Adapter, MANUS_API_BASE } from "./adapters/manusV2";
import { routePlatoCompletion } from "./router";
import { log } from "../logger";

const envKeys = [
  "PLATO_FAST_PROVIDER",
  "PLATO_REASONING_PROVIDER",
  "PLATO_FALLBACK_PROVIDER",
  "PLATO_FAST_MODEL",
  "PLATO_REASONING_MODEL",
  "PLATO_FALLBACK_MODEL",
  "FAULTLINE_PLATO_MODEL",
  "MANUS_API_KEY",
  "MANUS_OAUTH_TOKEN",
  "PLATO_MANUS_AGENT_PROFILE",
  "PLATO_MANUS_POLL_DEADLINE_MS",
  "PLATO_FAST_TIMEOUT_MS",
  "PLATO_MANUS_GATEWAY_ENABLED",
  "PLATO_MANUS_GATEWAY_BASE_URL",
  "PLATO_MANUS_GATEWAY_API_KEY",
  "PLATO_MANUS_GATEWAY_MODEL",
  "BUILT_IN_FORGE_API_URL",
];

function reply(content: string, model = "gemini-3-flash-preview"): InvokeResult {
  return {
    id: "plato-test",
    created: 1,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  };
}

function jsonResult(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? "Too Many Requests" : "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
});

describe("PLATO AI router", () => {
  it("answers FAST chat on the default bare model", async () => {
    const invoke = vi.fn().mockResolvedValue(reply("Credit pressure is elevated."));
    const messages = [
      ...Array.from({ length: 32 }, (_, index) => ({
        role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `turn-${index}`,
      })),
      { role: "user" as const, content: "What is happening?" },
    ];

    const result = await routePlatoCompletion({ messages }, { invoke });

    expect(result.response.choices[0]?.message.content).toBe("Credit pressure is elevated.");
    expect(result.trace).toMatchObject({
      selectedModel: "gemini-3-flash-preview",
      provider: "openai-compatible",
      taskType: "FAST",
      fallbackUsed: false,
      resolutionSource: "router-default",
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    const payload = invoke.mock.calls[0][0];
    expect(payload.model).toBe("gemini-3-flash-preview");
    expect(payload.messages).toHaveLength(33);
    expect(payload.messages.map((message: { content: string }) => message.content)).toEqual(
      expect.arrayContaining(["turn-0", "turn-31", "What is happening?"]),
    );
    expect(result.telemetry).toMatchObject({
      success: true,
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
      errorClass: null,
    });
  });

  it("strips a models/ prefix only when the configured base URL is Gemini", async () => {
    const invoke = vi.fn().mockResolvedValue(reply("ok"));
    process.env.PLATO_FAST_MODEL = "models/gemini-3-flash-preview";
    process.env.BUILT_IN_FORGE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

    await routePlatoCompletion(
      { messages: [{ role: "user", content: "Explain the pressure index." }] },
      { invoke },
    );
    expect(invoke.mock.calls[0][0].model).toBe("gemini-3-flash-preview");

    process.env.BUILT_IN_FORGE_API_URL = "https://example.test/v1";
    process.env.PLATO_FAST_MODEL = "models/claude-sonnet-4-6";
    await routePlatoCompletion(
      { messages: [{ role: "user", content: "Explain the pressure index." }] },
      { invoke },
    );
    expect(invoke.mock.calls[1][0].model).toBe("models/claude-sonnet-4-6");
  });

  it("falls back after a 429, a 5xx response, or a timeout, and does not repeat the same model", async () => {
    process.env.PLATO_FALLBACK_MODEL = "gemini-2.5-flash";
    const invoke = vi.fn()
      .mockRejectedValueOnce(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(reply("fallback after 429", "gemini-2.5-flash"));

    const limited = await routePlatoCompletion(
      { messages: [{ role: "user", content: "Summarize the tape." }] },
      { invoke },
    );
    expect(limited.trace.fallbackUsed).toBe(true);
    expect(limited.trace.selectedModel).toBe("gemini-2.5-flash");
    expect(limited.trace.attemptedModels).toEqual(["gemini-3-flash-preview", "gemini-2.5-flash"]);

    invoke.mockReset();
    invoke
      .mockRejectedValueOnce(new Error("LLM invoke failed: 500 Internal Server Error – upstream"))
      .mockResolvedValueOnce(reply("fallback after 500", "gemini-2.5-flash"));
    const failed = await routePlatoCompletion(
      { messages: [{ role: "user", content: "Summarize the tape." }] },
      { invoke },
    );
    expect(failed.trace.fallbackUsed).toBe(true);
    expect(failed.response.choices[0]?.message.content).toBe("fallback after 500");

    invoke.mockReset();
    invoke
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce(reply("fallback after timeout", "gemini-2.5-flash"));
    const timedOut = await routePlatoCompletion(
      { messages: [{ role: "user", content: "Summarize the tape." }], timeoutMs: 20 },
      { invoke },
    );
    expect(timedOut.trace.fallbackUsed).toBe(true);
    expect(timedOut.response.choices[0]?.message.content).toBe("fallback after timeout");

    delete process.env.PLATO_FALLBACK_MODEL;
    invoke.mockReset();
    invoke.mockRejectedValue(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"));
    await expect(routePlatoCompletion(
      { messages: [{ role: "user", content: "Summarize the tape." }] },
      { invoke },
    )).rejects.toMatchObject({ rateLimited: true, httpStatus: 429 });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("keeps FAST traffic off Manus even when that provider is configured for FAST", async () => {
    const fetchImpl = vi.fn();
    const invoke = vi.fn().mockResolvedValue(reply("still the direct provider"));
    process.env.PLATO_FAST_PROVIDER = "manus-v2";
    process.env.MANUS_API_KEY = "test-manus-key";

    const result = await routePlatoCompletion(
      { messages: [{ role: "user", content: "What changed today?" }] },
      { invoke, fetchImpl },
    );

    expect(result.trace.provider).toBe("openai-compatible");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("Manus API v2 adapter", () => {
  it("creates, polls, and reads a deep-reasoning task, including a 429 retry and credit usage", async () => {
    const info = vi.spyOn(log, "info").mockImplementation(() => undefined);
    let clock = 1_000;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResult({ ok: false, error: { code: "rate_limited", message: "Rate limit exceeded" } }, 429))
      .mockResolvedValueOnce(jsonResult({ ok: true, task_id: "task_123", task_url: "https://manus.im/app/task_123" }))
      .mockResolvedValueOnce(jsonResult({
        ok: true,
        task: { id: "task_123", status: "running", has_running_background_jobs: false },
      }))
      .mockResolvedValueOnce(jsonResult({
        ok: true,
        task: { id: "task_123", status: "stopped", has_running_background_jobs: false, credit_usage: 4 },
      }))
      .mockResolvedValueOnce(jsonResult({
        ok: true,
        messages: [{ type: "assistant_message", assistant_message: { content: "Scenario: credit stress persists." } }],
      }));
    process.env.PLATO_REASONING_PROVIDER = "manus-v2";
    process.env.MANUS_API_KEY = "test-manus-key";
    process.env.PLATO_MANUS_AGENT_PROFILE = "lite";

    const result = await routePlatoCompletion(
      {
        taskType: "DEEP_REASONING",
        messages: [{ role: "user", content: "Compare two regimes." }],
      },
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        now: () => clock,
        sleep: async ms => { clock += ms; },
        random: () => 0,
      },
    );

    expect(result.response.choices[0]?.message.content).toBe("Scenario: credit stress persists.");
    expect(result.trace).toMatchObject({ provider: "manus-v2", taskType: "DEEP_REASONING", selectedModel: "lite" });
    expect(result.telemetry).toMatchObject({ manusTaskId: "task_123", manusStatus: "stopped", creditUsage: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const createCall = fetchImpl.mock.calls[1];
    expect(createCall[0]).toBe(`${MANUS_API_BASE}/v2/task.create`);
    expect(createCall[1].headers["x-manus-api-key"]).toBe("test-manus-key");
    expect(createCall[1].headers.authorization).toBeUndefined();
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain("test-manus-key");
    expect(logged).toContain("task_123");
    info.mockRestore();
  });

  it("stops at the documented task.create limit without another provider call", async () => {
    let clock = 5_000;
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("task.create")) {
        return jsonResult({ ok: true, task_id: "task_limit_case_0001" });
      }
      if (String(url).includes("task.detail")) {
        return jsonResult({ ok: true, task: { status: "stopped", has_running_background_jobs: false, credit_usage: 1 } });
      }
      return jsonResult({ ok: true, messages: [{ type: "assistant_message", assistant_message: { content: "done" } }] });
    });
    const adapter = createManusV2Adapter({
      auth: { apiKey: "test-manus-key", oauthToken: "" },
      agentProfile: null,
      pollDeadlineMs: 5_000,
      modelLabel: "manus-v2",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => clock,
      sleep: async ms => { clock += ms; },
      random: () => 0,
    });

    for (let call = 0; call < 10; call += 1) {
      await adapter.complete({ messages: [{ role: "user", content: `job ${call}` }] });
    }
    const callsAfterBudget = fetchImpl.mock.calls.length;
    await expect(adapter.complete({
      messages: [{ role: "user", content: "one more" }],
    })).rejects.toMatchObject({ errorClass: "rate_limited", httpStatus: 429 });
    expect(fetchImpl.mock.calls.length).toBe(callsAfterBudget);
  });

  it("rejects an oversized prompt before calling Manus", async () => {
    const fetchImpl = vi.fn();
    const adapter = createManusV2Adapter({
      auth: { apiKey: "test-manus-key", oauthToken: "" },
      agentProfile: null,
      pollDeadlineMs: 1_000,
      modelLabel: "manus-v2",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 0,
      sleep: async () => undefined,
    });

    await expect(adapter.complete({
      messages: [{ role: "user", content: "x".repeat(20_004) }],
    })).rejects.toMatchObject({ errorClass: "invalid_argument", httpStatus: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("prefers an OAuth bearer token over an API key", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResult({ ok: true, task_id: "task_oauth" }))
      .mockResolvedValueOnce(jsonResult({ ok: true, task: { status: "stopped", has_running_background_jobs: false } }))
      .mockResolvedValueOnce(jsonResult({ ok: true, messages: [{ type: "assistant_message", assistant_message: { content: "ok" } }] }));
    const adapter = createManusV2Adapter({
      auth: { apiKey: "test-manus-key", oauthToken: "oauth-token" },
      agentProfile: "standard",
      pollDeadlineMs: 1_000,
      modelLabel: "standard",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 10,
      sleep: async () => undefined,
    });

    await adapter.complete({ taskType: "DEEP_REASONING", messages: [{ role: "user", content: "Synthesize." }] });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer oauth-token");
    expect(fetchImpl.mock.calls[0][1].headers["x-manus-api-key"]).toBeUndefined();
  });
});

describe("Manus inference gateway adapter", () => {
  it("refuses to run unless the explicit flag and a base URL are both set", async () => {
    const disabled = createManusGatewayAdapter({
      enabled: false,
      baseUrl: "https://example.test",
      apiKey: "gateway-key",
      model: "gemini-3-flash-preview",
    });
    await expect(disabled.complete({
      messages: [{ role: "user", content: "hello" }],
    })).rejects.toThrow(/pending confirmation that external use is officially supported/);

    const missingUrl = createManusGatewayAdapter({
      enabled: true,
      baseUrl: "",
      apiKey: "gateway-key",
      model: "gemini-3-flash-preview",
    });
    await expect(missingUrl.complete({
      messages: [{ role: "user", content: "hello" }],
    })).rejects.toThrow(/pending confirmation/);

    const source = readFileSync(resolve(import.meta.dirname, "adapters/openaiCompatible.ts"), "utf8");
    expect(source).toContain("pending confirmation that external use is officially supported");
    expect(source).not.toContain("forge.manus");
  });
});
