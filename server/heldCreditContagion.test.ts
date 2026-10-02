/* HELD methodology change (probability/held-methodology-2026-10-02): preFlight,
   simPortfolioEngine and ownerSimulation read the real "credit-contagion"
   vector instead of the nonexistent "credit-stress" id (which always fell back
   to 50). Fails if the id fix is reverted. Not in PR #60; see HELD_CHANGES.md. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const vec = (id: string, score: number, trend = "Stable") => ({ id, name: id, label: id, driver: "", score, trend, weight: 1, level: "Moderate", drivers: [], description: "" });

// The 2026-10-01 18:00 UTC production vectors (QA gate-pr60 item10 fixture).
vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: async () => ({
    overallPressure: 33, regime: "MODERATE RISK", level: "Moderate", dataSource: "fixture", alerts: [], timestamp: 1790877634009,
    vectors: [vec("liquidity-stress", 22), vec("credit-contagion", 22), vec("volatility-regime", 40), vec("macro-sensitivity", 43), vec("market-breadth", 28), vec("ai-bubble", 44, "Unknown")],
  }),
}));
let prompt = "";
vi.mock("./_core/llm", () => ({ invokeLLM: async (a: { messages: unknown }) => { prompt = JSON.stringify(a.messages); throw new Error("stub: no LLM"); } }));

describe("preFlight reads the credit-contagion vector (held)", () => {
  it("credit condition, recession condition, key risks and prompt use credit-contagion = 22, not the default 50", async () => {
    const { getPreFlightData } = await import("./preFlight");
    const out = await getPreFlightData();
    expect(out.creditCondition.score).toBe(22);
    expect(out.creditCondition.level).toBe("Stable");
    // round(22·0.35 + 28·0.35 + 33·0.30) = 27 (with the default 50 it was 37).
    expect(out.recessionRisk.score).toBe(27);
    expect(out.keyRisks.map(risk => risk.id)).not.toContain("credit-stress");
    expect(out.awarenessChecks.find(check => check.id === "credit-check")?.status).toBe("pass");
    expect(prompt).toContain("22/100");
    expect(prompt).not.toMatch(/Credit[^"]{0,20}50\/100/);
  });

  it("simPortfolioEngine and ownerSimulation read credit-contagion", () => {
    for (const file of ["simPortfolioEngine.ts", "ownerSimulation.ts"]) {
      const src = readFileSync(join(__dirname, file), "utf8");
      expect(src).toMatch(/find\("credit-contagion"\)/);
      expect(src).not.toMatch(/find\("credit-stress"\)/);
    }
  });
});
