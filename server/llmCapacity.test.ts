import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLM = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({
  DEFAULT_CHAT_MODEL: "gemini-3-flash-preview",
  invokeLLM,
}));

import {
  BackgroundLlmBudgetError,
  backgroundDailyBudget,
  claimOwnerSimLlmCall,
  invokeBackgroundLLM,
  ownerSimLlmMaxCalls,
  resetBackgroundLlmCapacityForTests,
  resolveBackgroundLlmModel,
} from "./llmCapacity";

const completion = {
  id: "bg-1",
  created: 1,
  model: "gemini-3-flash-preview",
  choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
};

beforeEach(() => {
  resetBackgroundLlmCapacityForTests();
  invokeLLM.mockReset();
  invokeLLM.mockResolvedValue(completion);
  delete process.env.FAULTLINE_BACKGROUND_LLM_MODEL;
  delete process.env.FAULTLINE_OWNERSIM_LLM_MAX_CALLS;
});

afterEach(() => {
  delete process.env.FAULTLINE_BACKGROUND_LLM_MODEL;
  delete process.env.FAULTLINE_OWNERSIM_LLM_MAX_CALLS;
});

describe("background LLM capacity", () => {
  it("reserves interactive capacity when background jobs share PLATO's model", async () => {
    expect(resolveBackgroundLlmModel()).toBe("gemini-3-flash-preview");
    expect(backgroundDailyBudget()).toBe(8);

    for (let call = 0; call < 8; call += 1) {
      await invokeBackgroundLLM({ messages: [{ role: "user", content: `job ${call}` }] });
    }

    await expect(invokeBackgroundLLM({
      messages: [{ role: "user", content: "one more" }],
    })).rejects.toBeInstanceOf(BackgroundLlmBudgetError);
    expect(invokeLLM).toHaveBeenCalledTimes(8);
    expect(invokeLLM.mock.calls[0][0].model).toBe("gemini-3-flash-preview");
  });

  it("uses a configured background model and its own allowance", async () => {
    process.env.FAULTLINE_BACKGROUND_LLM_MODEL = "gemini-2.5-flash";
    expect(backgroundDailyBudget()).toBe(20);

    for (let call = 0; call < 9; call += 1) {
      await invokeBackgroundLLM({ messages: [{ role: "user", content: `job ${call}` }] });
    }

    expect(invokeLLM).toHaveBeenCalledTimes(9);
    expect(invokeLLM.mock.calls[8][0].model).toBe("gemini-2.5-flash");
  });

  it("pauses later background calls after a provider 429", async () => {
    invokeLLM.mockRejectedValueOnce(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"));

    await expect(invokeBackgroundLLM({
      messages: [{ role: "user", content: "burst" }],
    })).rejects.toThrow(/429/);

    await expect(invokeBackgroundLLM({
      messages: [{ role: "user", content: "next" }],
    })).rejects.toBeInstanceOf(BackgroundLlmBudgetError);
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("caps OwnerSim LLM calls at a conservative default and honors FAULTLINE_OWNERSIM_LLM_MAX_CALLS", () => {
    expect(ownerSimLlmMaxCalls()).toBe(4);
    expect([1, 2, 3, 4].map(() => claimOwnerSimLlmCall())).toEqual([true, true, true, true]);
    expect(claimOwnerSimLlmCall()).toBe(false);

    resetBackgroundLlmCapacityForTests();
    process.env.FAULTLINE_OWNERSIM_LLM_MAX_CALLS = "0";
    expect(ownerSimLlmMaxCalls()).toBe(0);
    expect(claimOwnerSimLlmCall()).toBe(false);

    resetBackgroundLlmCapacityForTests();
    process.env.FAULTLINE_OWNERSIM_LLM_MAX_CALLS = "2";
    expect(claimOwnerSimLlmCall()).toBe(true);
    expect(claimOwnerSimLlmCall()).toBe(true);
    expect(claimOwnerSimLlmCall()).toBe(false);
  });
});
