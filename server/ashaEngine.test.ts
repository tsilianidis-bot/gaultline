import { beforeEach, describe, expect, it, vi } from "vitest";
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

const modelTrace = { selectedModel: "gpt-5", attemptedModels: ["gpt-5"], resolutionSource: "live-catalog", resolvedAt: "2026-08-22T12:00:00.000Z" } as const;
const provenance = { contextVersion: "1.0", marketStateVersion: "1.0", generatedAt: "2026-08-22T12:00:00.000Z", sourceUpdatedAt: "2026-08-22T12:00:00.000Z", freshness: "live", cacheStatus: "fresh-cache", sourceHealth: [], warnings: [] } as any;
const gatewayContext = {
  version: "1.0", destination: "now", page: { page: "/app/now" },
  marketState: {
    sourceUpdatedAt: "2026-08-22T12:00:00.000Z", sourceHealth: [], now: { pressureScore: 61, regime: "Late Cycle" },
    history: { observationCount: 0 }, outlook: { probabilities: { bull: 25, bear: 35, confidence: 72 } }, why: { evidenceFamilies: [] },
  },
} as any;

function llmResult(content: string): InvokeResult {
  return { id: "asha-test", created: 1, model: "gpt-5", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] } as InvokeResult;
}

describe("ASHA Phase 4 canonical evidence integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayMocks.createContext.mockResolvedValue(gatewayContext);
    gatewayMocks.buildContextBlock.mockReturnValue("\nLEGACY-CONTEXT-UNUSED-FOR-PRIMARY-CLAIMS");
    gatewayMocks.getProvenance.mockReturnValue(provenance);
  });

  it("uses a Phase 4 evidence-bound prompt and returns response transaction provenance", async () => {
    gatewayMocks.invokeGateway.mockResolvedValue({ response: llmResult(JSON.stringify({ reply: "The supplied evidence is limited." })), trace: modelTrace });
    const response = await askAsha({ userMessage: "What is happening?", history: [], pageContext: { page: "/app/now" } });
    expect(gatewayMocks.invokeGateway).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({ role: "system", content: expect.stringContaining("PHASE 4 INTERPRETATION CONTRACT") })]),
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
    expect(response.integrity.transaction.contractVersion).toBe("phase4-interpretation-integrity-v1");
    expect(response.provenance).toBe(provenance);
    expect(response.modelTrace).toBe(modelTrace);
  });

  it("withholds unsupported numeric probability, timing, and invalidation fields instead of projecting legacy defaults", async () => {
    gatewayMocks.invokeGateway.mockResolvedValue({
      response: llmResult(JSON.stringify({ reply: "The evidence is incomplete.", bullProbability: 75, bearProbability: 25, expectedTimeframe: "4 weeks", invalidationConditions: ["Break 90"] })),
      trace: modelTrace,
    });
    const response = await askAsha({ userMessage: "What happens next?", history: [], pageContext: { page: "/app/now" } });
    expect(response.bullProbability).toBeUndefined();
    expect(response.bearProbability).toBeUndefined();
    expect(response.expectedTimeframe).toBe("Not established");
    expect(response.invalidationConditions).toEqual(["No governed invalidation condition is currently defined."]);
  });

  it("preserves bounded conversation ordering without turning history into current market evidence", async () => {
    gatewayMocks.invokeGateway.mockResolvedValue({ response: llmResult(JSON.stringify({ reply: "Current evidence is limited." })), trace: modelTrace });
    await askAsha({
      userMessage: "What changed?",
      history: [{ role: "user", content: "Yesterday?" }, { role: "assistant", content: "Prior answer." }],
      pageContext: { page: "/app/why" },
    });
    expect(gatewayMocks.invokeGateway).toHaveBeenCalledWith(expect.objectContaining({ messages: [
      expect.objectContaining({ role: "system" }), { role: "user", content: "Yesterday?" }, { role: "assistant", content: "Prior answer." }, { role: "user", content: "What changed?" },
    ] }));
  });

  it("routes daily greeting through the shared Phase 4 evidence transaction and fails safely when no canonical state is available", async () => {
    gatewayMocks.invokeGateway.mockResolvedValue({ response: llmResult("   "), trace: modelTrace });
    const greeting = await generateAshaDailyGreeting({ engineContext: { pressureScore: 61, regime: "Late Cycle", regimeConfidence: 0.72, narrative: "Credit is tightening.", trend: "Deteriorating", keyDrivers: ["Credit"] } });
    expect(gatewayMocks.createContext).toHaveBeenCalledWith(expect.objectContaining({ page: "daily-greeting" }));
    expect(greeting).toBe("Canonical state unavailable. Insufficient evidence for a current market greeting.");
  });
});
