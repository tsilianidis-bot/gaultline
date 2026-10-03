/**
 * Launch fix-up 5: the Trade Preflight explanation prompt carries no verdict confidence figure
 * (a clamped formula, not calibrated); the engine's verdict.confidence value is unchanged.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const llm = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (req: any) => {
    llm.calls.push(req);
    return { choices: [{ message: { content: "Deterministic explanation of the simulated move." } }] };
  }),
}));
vi.mock("./ownerSimulation", () => ({ scanOpportunities: vi.fn().mockResolvedValue([]) }));
vi.mock("./db", () => {
  const chain: any = new Proxy(() => chain, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve([]) : chain),
    apply: () => chain,
  });
  return { getDb: vi.fn(async () => ({ select: () => chain, update: () => chain, insert: () => ({ values: () => Promise.resolve() }) })) };
});

import { runTradePreflightSimulation } from "./tradePreflight";

const vectors = (score: number) => ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"]
  .map(id => ({ id, score, label: id, riskLevel: score >= 60 ? "critical" : "low" }));
const PRESSURES = [
  { overallPressure: 12, dataSource: "live", vectors: vectors(10), regime: "Expansion", level: "Low" },
  { overallPressure: 75, dataSource: "live", vectors: vectors(70), regime: "Late-Cycle Stress", level: "High" },
];

describe("trade.simulate explanation prompt", () => {
  beforeEach(() => { llm.calls.length = 0; });
  it("states no verdict confidence figure; the engine value stays", async () => {
    for (const p of PRESSURES) for (const moveType of ["add_risk", "raise_cash", "hold"]) {
      llm.calls.length = 0;
      const r: any = await runTradePreflightSimulation({ moveType, timeframe: "this_week", ticker: "NVDA" } as any, p as any, null);
      expect(typeof r.verdict.confidence).toBe("number");
      const user = llm.calls.flatMap(c => c.messages).filter((m: any) => m.role === "user").map((m: any) => String(m.content)).join("\n");
      const verdictLine = user.split("\n").find(l => l.startsWith("- VERDICT: "));
      expect(verdictLine).toMatch(/^- VERDICT: .+ \(confidence not established\)$/);
      expect(user).not.toContain(`${r.verdict.confidence}%`);
      expect(user).not.toMatch(/Confidence: \d/);
    }
  });
});
