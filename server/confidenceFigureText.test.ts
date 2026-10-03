import { describe, expect, it } from "vitest";
import { withholdConfidenceFigures, CONFIDENCE_NOT_ESTABLISHED } from "../client/src/lib/confidenceDisplay";

// Launch fix-up: display text withholds heuristic confidence figures embedded
// in engine / LLM text. Engines and prompts are unchanged.
describe("withholdConfidenceFigures", () => {
  it("day-trade NO_TRADE template (dayTradeEngine.ts) loses both figures", () => {
    const out = withholdConfidenceFigures("Confidence 42/100 is below the 55/100 minimum threshold for a valid intraday setup.");
    expect(out).toBe("The setup is below the minimum heuristic threshold for a valid intraday setup.");
    expect(out).not.toMatch(/\d/);
  });
  it("owner WHY NOW fallback (ownerSimulation.ts) and LLM echoes", () => {
    expect(withholdConfidenceFigures("NVDA shows BUY signal with 85/100 confidence under MODERATE regime."))
      .toBe("NVDA shows BUY signal with confidence not established under MODERATE regime.");
    expect(withholdConfidenceFigures("A 72% confidence read.")).toBe("A confidence not established read.");
    expect(withholdConfidenceFigures("Confidence: 72%. Confidence score of 64/100.")).toBe("Confidence not established. Confidence not established.");
    expect(withholdConfidenceFigures("signal confidence at 88 / 100")).toBe("signal confidence not established");
  });
  it("leaves other numbers and non-strings alone", () => {
    const t = "Pressure 34/100, RSI 61, R/R 2.1:1, +3.2% today.";
    expect(withholdConfidenceFigures(t)).toBe(t);
    expect(withholdConfidenceFigures(null)).toBeNull();
    expect(withholdConfidenceFigures(undefined)).toBeUndefined();
    expect(CONFIDENCE_NOT_ESTABLISHED).toBe("Not established");
  });
});
