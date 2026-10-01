import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalMarketState } from "../shared/marketState";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

const llm = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  listLLMModels: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: async () => null };
});

const marketState = {
  version: "1.0",
  generatedAt: "2026-07-23T13:00:00.000Z",
  sourceUpdatedAt: "2026-07-23T12:59:00.000Z",
  freshness: "live",
  cache: { status: "fresh", ageMs: 1_000, staleReason: null },
  sourceHealth: [],
  warnings: [],
  now: { pressureScore: 62, regime: "Late Cycle", stressLevel: "Elevated", direction: "Deteriorating", historicalPercentile: 78, headline: "Pressure is elevated.", topDrivers: ["Credit"] },
  why: {
    story: "Credit is tightening.",
    whyThisScore: "Credit and liquidity.",
    whyThisRegime: "Growth is slowing.",
    keyDevelopments: ["Spreads widened"],
    narrative: { whatIsHappening: "Pressure is rising.", whyIsItHappening: "Liquidity is tighter.", whatHasChanged: "Credit weakened.", whatIsBuildingBeneathSurface: "Funding stress." },
    evidenceFamilies: [],
    evidenceConsensus: "moderate",
  },
  outlook: { probabilities: { bull: 25, neutral: 40, bear: 35, confidence: 68, primaryDriver: "Credit", evidenceBasis: "Spreads", historicalBasis: "Late-cycle analogs" }, regimeProbabilities: { bull: 15, softLanding: 35, stagflation: 20, recession: 25, crash: 5 }, transitionProbabilities: { remainInRegime: 55, transitionToElevated: 25, transitionToLow: 15, transitionToCrisis: 5, confidence: 68, historicalBasis: "Analogs", currentEvidence: ["Credit"] }, highestProbabilityPath: "A slower expansion.", invalidationConditions: ["Credit improves"], topAnalog: null },
  watch: { developingConditions: [], activePatterns: [], whatChanged: ["Credit weakened"], whatToWatch: ["Funding markets"], accelerating: false, buildingPressure: true },
  act: { marketPosture: "balanced", decisionSummary: "Maintain balance.", whatWouldInvalidate: "Credit recovery.", riskControls: ["Size risk conservatively"] },
  history: { observationCount: 100, datasetSpan: "2020-2026", currentStreakDescription: "Three weeks elevated", lastMajorShift: null, analogSummary: "Late-cycle periods" },
} as CanonicalMarketState;

vi.mock("./marketStateService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./marketStateService")>();
  return { ...actual, getCanonicalMarketState: async () => marketState };
});

vi.mock("./_core/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return { ...actual, invokeLLM: llm.invokeLLM, listLLMModels: llm.listLLMModels };
});

import { appRouter } from "./routers";
import { resetAshaModelResolutionCache } from "./ashaModelPolicy";

function caller() {
  const ctx: TrpcContext = {
    user: {
      id: 1,
      openId: "test-open-id",
      email: "test@faultline.app",
      name: "Test User",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      lastSignedIn: new Date("2026-05-23T00:00:00Z"),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function history(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `turn-${index}`,
  }));
}

const askInput = {
  userMessage: "What is happening?",
  history: history(32),
  pageContext: { page: "/app/now" },
};

function providerReply(content: string) {
  return {
    id: "plato-test",
    created: 1,
    model: "gemini-3-flash-preview",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  };
}

beforeEach(() => {
  resetAshaModelResolutionCache();
  llm.invokeLLM.mockReset();
  llm.listLLMModels.mockReset();
  llm.listLLMModels.mockResolvedValue({
    data: [
      { id: "models/gemini-embedding-001" },
      { id: "models/imagen-3.0-generate-002" },
      { id: "models/text-embedding-004" },
      { id: "models/gemini-3-flash-preview" },
    ],
  });
});

describe("PLATO ask round-trip", () => {
  it("answers a 32-message thread through the mocked provider using a bare chat model", async () => {
    llm.invokeLLM.mockResolvedValue(providerReply(JSON.stringify({
      reply: "Credit pressure is elevated and still building.",
    })));

    const response = await caller().asha.ask(askInput);

    expect(typeof response.reply).toBe("string");
    expect(response.reply.length).toBeGreaterThan(20);
    expect(llm.invokeLLM).toHaveBeenCalled();
    const payload = llm.invokeLLM.mock.calls[0][0];
    expect(payload.model).toBe("gemini-3-flash-preview");
    const contents = payload.messages.map((message: { content: string }) => message.content);
    expect(contents).toContain("turn-0");
    expect(contents).toContain("turn-31");
    expect(contents).toContain("What is happening?");
    expect(payload.messages.filter((message: { role: string }) => message.role !== "system")).toHaveLength(33);
  });

  it("returns TOO_MANY_REQUESTS when the provider answers 429", async () => {
    llm.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 429 Too Many Requests – RESOURCE_EXHAUSTED"));

    await expect(caller().asha.ask(askInput)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringMatching(/PLATO is temporarily unavailable/),
    });
  });

  it("returns a clear internal error when the provider answers 5xx", async () => {
    llm.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 500 Internal Server Error – upstream"));

    const error = await caller().asha.ask(askInput).then(
      () => { throw new Error("expected the ask to fail"); },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "PLATO is temporarily unavailable. Please try again.",
    });
    expect((error as TRPCError).message).not.toContain("upstream");
  });

  it("does not call the provider when the caller is signed out", async () => {
    const anonymous = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as TrpcContext["res"],
    });

    await expect(anonymous.asha.ask(askInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });
});
