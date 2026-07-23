import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: {
    forgeApiKey: "test-forge-key",
    forgeApiUrl: "https://forge.example",
  },
}));

import { invokeLLM, listLLMModels } from "./llm";

const successfulResponse = () =>
  new Response(
    JSON.stringify({
      id: "completion-1",
      created: 1,
      model: "gemini-3-flash-preview",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "ok" },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invokeLLM transport", () => {
  it("uses a supported Gemini 3 default without the retired thinking payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      messages: [{ role: "user", content: "Summarize the market." }],
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));

    expect(payload.model).toBe("gemini-3-flash-preview");
    expect(payload.max_tokens).toBe(32768);
    expect(payload).not.toHaveProperty("thinking");
  });

  it("honors caller-selected model and token limits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 4096,
      messages: [{ role: "user", content: "Return JSON." }],
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));

    expect(payload.model).toBe("gpt-5-mini");
    expect(payload.max_tokens).toBe(4096);
  });
});

describe("listLLMModels", () => {
  it("reads the live model catalog through the configured server-side gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      object: "list",
      data: [{ id: "claude-sonnet-4-6" }, { id: "gpt-5" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listLLMModels();

    expect(result.data.map(model => model.id)).toEqual(["claude-sonnet-4-6", "gpt-5"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://forge.example/v1/models",
      expect.objectContaining({
        headers: { authorization: "Bearer test-forge-key" },
      }),
    );
  });

  it("rejects malformed catalog responses instead of inventing model availability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ models: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));

    await expect(listLLMModels()).rejects.toThrow("invalid response");
  });
});
