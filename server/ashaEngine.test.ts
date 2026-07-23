import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AshaContextProvenance,
  AshaGatewayContext,
  AshaModelTrace,
} from "../shared/ashaContext";
import type { InvokeResult } from "./_core/llm";

const gatewayMocks = vi.hoisted(() => ({
  createContext: vi.fn(),
  buildContextBlock: vi.fn(),
  getProvenance: vi.fn(),
  invokeGateway: vi.fn(),
}));

vi.mock("./ashaGateway", () => ({
  createAshaGatewayContext: gatewayMocks.createContext,
  buildAshaCanonicalContextBlock: gatewayMocks.buildContextBlock,
  getAshaContextProvenance: gatewayMocks.getProvenance,
  invokeAshaGateway: gatewayMocks.invokeGateway,
}));

import { askAsha, generateAshaDailyGreeting } from "./ashaEngine";

const modelTrace: AshaModelTrace = {
  selectedModel: "gpt-5",
  attemptedModels: ["claude-sonnet-4-6", "gpt-5"],
  resolutionSource: "live-catalog",
  resolvedAt: "2026-07-23T13:00:00.000Z",
};

const provenance: AshaContextProvenance = {
  contextVersion: "1.0",
  marketStateVersion: "1.0",
  generatedAt: "2026-07-23T13:00:00.000Z",
  sourceUpdatedAt: "2026-07-23T12:59:00.000Z",
  freshness: "live",
  cacheStatus: "fresh-cache",
  sourceHealth: [],
  warnings: [],
};

const gatewayContext = {
  version: "1.0",
  destination: "now",
  page: { page: "/app/now" },
  marketState: {
    sourceUpdatedAt: "2026-07-23T12:59:00.000Z",
    sourceHealth: [
      { id: "seismograph", label: "Canonical Seismograph", status: "healthy" },
      { id: "historical-memory", label: "Historical Market Memory", status: "healthy" },
      { id: "coingecko", label: "Crypto Market Overlay", status: "unavailable" },
    ],
    now: { pressureScore: 61, regime: "Late Cycle" },
    history: { observationCount: 120 },
    outlook: { probabilities: { confidence: 72 } },
    why: {
      evidenceFamilies: [
        { name: "Credit" },
        { name: "Liquidity" },
      ],
    },
  },
} as unknown as AshaGatewayContext;

function llmResult(content: string): InvokeResult {
  return {
    id: "asha-test",
    created: 1,
    model: "gpt-5",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

describe("ASHA live gateway integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayMocks.createContext.mockResolvedValue(gatewayContext);
    gatewayMocks.buildContextBlock.mockReturnValue("\nCANONICAL-MARKETSTATE-CONTEXT");
    gatewayMocks.getProvenance.mockReturnValue(provenance);
  });

  it("answers through the canonical gateway and returns truthful source and model provenance", async () => {
    gatewayMocks.invokeGateway.mockResolvedValue({
      response: llmResult(JSON.stringify({ reply: "The evidence currently favors caution." })),
      trace: modelTrace,
    });

    const response = await askAsha({
      userMessage: "What is happening?",
      history: [],
      pageContext: { page: "/app/now" },
    });

    expect(gatewayMocks.createContext).toHaveBeenCalledWith({ page: "/app/now" });
    expect(gatewayMocks.invokeGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("CANONICAL-MARKETSTATE-CONTEXT"),
          }),
        ]),
      }),
    );
    expect(response.sources).toEqual(["Canonical Seismograph", "Historical Market Memory"]);
    expect(response.enginesConsulted).toEqual(expect.arrayContaining([
      "Canonical Seismograph",
      "Pressure Index",
      "Market Regime Engine",
      "Historical Market Memory",
      "Probability Engine",
      "Credit Evidence",
      "Liquidity Evidence",
    ]));
    expect(response.enginesConsulted).not.toContain("Crypto Market Overlay");
    expect(response.pressureIndex).toBe(61);
    expect(response.marketRegime).toBe("Late Cycle");
    expect(response.lastUpdated).toBe("2026-07-23T12:59:00.000Z");
    expect(response.provenance).toBe(provenance);
    expect(response.modelTrace).toBe(modelTrace);
  });

  it("routes the daily greeting through the same canonical context and model gateway", async () => {
    gatewayMocks.invokeGateway.mockResolvedValue({
      response: llmResult("Welcome back. Credit pressure deserves attention today."),
      trace: modelTrace,
    });

    const greeting = await generateAshaDailyGreeting({
      userName: "James",
      engineContext: {
        pressureScore: 61,
        previousPressureScore: 58,
        regime: "Late Cycle",
        regimeConfidence: 0.72,
        narrative: "Credit is tightening.",
        trend: "Deteriorating",
        keyDrivers: ["Credit"],
      },
    });

    expect(gatewayMocks.createContext).toHaveBeenCalledWith(
      expect.objectContaining({
        page: "daily-greeting",
        additionalContext: { pressureChangeSinceLastSession: 3 },
      }),
    );
    expect(gatewayMocks.invokeGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("CANONICAL-MARKETSTATE-CONTEXT"),
          }),
        ]),
      }),
    );
    expect(greeting).toContain("Welcome back");
  });
});
