import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Deterministic explanation." } }],
  }),
}));

vi.mock("./ownerSimulation", () => ({
  scanOpportunities: vi.fn().mockResolvedValue([]),
}));

import { runTradePreflightSimulation } from "./tradePreflight";
import { DECISION_LIGHT_REQUIRED_FIELDS } from "../shared/decisionLight";

const LIVE_LOW = {
  overallPressure: 22,
  dataSource: "live" as const,
  vectors: [
    { id: "liquidity-stress", score: 18, label: "Liquidity", riskLevel: "low" },
    { id: "credit-contagion", score: 20, label: "Credit", riskLevel: "low" },
    { id: "volatility-regime", score: 15, label: "Volatility", riskLevel: "low" },
    { id: "macro-sensitivity", score: 22, label: "Macro", riskLevel: "low" },
    { id: "market-breadth", score: 19, label: "Breadth", riskLevel: "low" },
    { id: "ai-bubble", score: 25, label: "AI", riskLevel: "low" },
  ],
  regime: "Expansion",
  level: "Low",
};

const LIVE_HIGH = {
  ...LIVE_LOW,
  overallPressure: 75,
  dataSource: "live" as const,
  vectors: LIVE_LOW.vectors.map(vector => ({ ...vector, score: 70, riskLevel: "critical" })),
  regime: "Late-Cycle Stress",
  level: "High",
};

const FALLBACK = {
  ...LIVE_LOW,
  dataSource: "fallback" as const,
};

describe("runTradePreflightSimulation Decision-Light", () => {
  it("attaches the full action-specific contract on a live risk-on move", async () => {
    const result = await runTradePreflightSimulation(
      { moveType: "add_risk", timeframe: "today" },
      LIVE_LOW,
      { stateId: "state:preflight-live", qualityStatus: "HEALTHY", coherenceStatus: "COHERENT" },
    );
    for (const field of DECISION_LIGHT_REQUIRED_FIELDS) {
      expect(result.decisionLight[field], field).toBeDefined();
    }
    expect(result.decisionLight.decisionLight).toBe("GREEN");
    expect(result.decisionLight.decisionLabel).toBe("PROCEED");
    expect(result.decisionLight.canonicalStateId).toBe("state:preflight-live");
    expect(result.decisionLight.bullContinuationProbability).not.toBeNull();
    expect(result.decisionLight.crashDrawdownProbability).not.toBeNull();
    expect(result.decisionLight.bullContinuationProbability).not.toBe(result.decisionLight.crashDrawdownProbability);
  });

  it("marks add_risk RED under live high pressure and reduce_risk GREEN", async () => {
    const addRisk = await runTradePreflightSimulation(
      { moveType: "add_risk", timeframe: "today" },
      LIVE_HIGH,
      { stateId: "state:preflight-high", qualityStatus: "HEALTHY", coherenceStatus: "COHERENT" },
    );
    const reduceRisk = await runTradePreflightSimulation(
      { moveType: "reduce_risk", timeframe: "today" },
      LIVE_HIGH,
      { stateId: "state:preflight-high", qualityStatus: "HEALTHY", coherenceStatus: "COHERENT" },
    );
    expect(addRisk.decisionLight.decisionLight).toBe("RED");
    expect(reduceRisk.decisionLight.decisionLight).toBe("GREEN");
  });

  it("returns GRAY/UNAVAILABLE for fallback pressure without a canonical binding", async () => {
    const result = await runTradePreflightSimulation(
      { moveType: "sell_specific_asset", timeframe: "this_week", ticker: "NVDA" },
      FALLBACK,
      null,
    );
    expect(result.decisionLight.decisionLight).toBe("GRAY");
    expect(result.decisionLight.decisionLabel).toBe("UNAVAILABLE");
    expect(result.decisionLight.canonicalStateId).toBeNull();
    expect(result.decisionLight.supportingEvidence).toEqual([]);
  });

  it("reaches deploy_cash and hold instead of falling through to the default score", async () => {
    const deploy = await runTradePreflightSimulation(
      { moveType: "deploy_cash", timeframe: "this_week" },
      LIVE_LOW,
      { stateId: "state:preflight-live", qualityStatus: "HEALTHY", coherenceStatus: "COHERENT" },
    );
    const hold = await runTradePreflightSimulation(
      { moveType: "hold", timeframe: "this_week" },
      LIVE_LOW,
      { stateId: "state:preflight-live", qualityStatus: "HEALTHY", coherenceStatus: "COHERENT" },
    );
    expect(deploy.moveFavorabilityScore).not.toBe(50);
    expect(hold.moveType).toBe("hold");
    expect(hold.decisionLight.proposedAction).toBe("Hold");
    expect(deploy.decisionLight.moveFamily).toBe("risk_on");
    expect(hold.decisionLight.moveFamily).toBe("neutral");
  });
});
