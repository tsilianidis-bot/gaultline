import { describe, expect, it, vi } from "vitest";

const canonical = vi.hoisted(() => ({ getAuthoritativeCanonicalIntelligenceState: vi.fn() }));
const fmos = vi.hoisted(() => ({ runFMOSPipelineFast: vi.fn() }));
const opportunities = vi.hoisted(() => ({ getTopOpportunities: vi.fn() }));
const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./canonicalIntelligenceState", () => ({ ...canonical, toClientCanonicalIntelligenceState: vi.fn(value => value) }));
vi.mock("./fmos/pipeline", () => fmos);
vi.mock("./signalOutlook", () => ({
  getFullOutlook: vi.fn(), getQuickOutlook: vi.fn(), getTopOpportunities: opportunities.getTopOpportunities,
  getOpportunityDiscovery: vi.fn(), clearOutlookCaches: vi.fn(),
}));
vi.mock("./_core/llm", () => llm);

import { outlookRouter } from "./routers/outlook";
const caller = () => outlookRouter.createCaller({ req: {} as never, res: {} as never, user: null } as never);

describe("Today’s Story canonical admission", () => {
  it("rejects before any LLM call when the authoritative canonical state is unavailable", async () => {
    canonical.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue(null);
    await expect(caller().getTodaysStory()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("rejects degraded canonical evidence before any LLM call", async () => {
    canonical.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue({
      pressureIndex: 42, regime: "MODERATE RISK", confidenceOrEvidenceQuality: "DEGRADED", provenance: { coherenceStatus: "COHERENT" },
    });
    await expect(caller().getTodaysStory()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });
  it("rejects mismatched derived pressure before any LLM call", async () => {
    canonical.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue({
      pressureIndex: 42, regime: "MODERATE RISK", confidenceOrEvidenceQuality: "HEALTHY", provenance: { coherenceStatus: "COHERENT" },
    });
    fmos.runFMOSPipelineFast.mockResolvedValue({ pressure: { overallPressure: 43 }, regime: { currentRegime: "MODERATE RISK" } });
    opportunities.getTopOpportunities.mockResolvedValue({ stocks: [{ symbol: "AAPL", name: "Apple", outlookScore: 60, direction: "BUY" }], crypto: [] });
    await expect(caller().getTodaysStory()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

});
