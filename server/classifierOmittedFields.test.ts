import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeLlmClassification } from "./signalsClassifier";

const supplied = {
  signals: ["Neutral / Watch" as const],
  primarySignal: "Neutral / Watch" as const,
  bullishFactors: ["a"],
  bearishFactors: ["b"],
  whyThisSignal: "because",
  aiExposure: "High" as const,
  debtRisk: "Low" as const,
  recessionSensitivity: "Low" as const,
  liquidityRisk: "Low" as const,
  momentumScore: 40,
  macroSensitivity: "macro",
};

describe("an omitted classifier field is not filled with a moderate default", () => {
  it("keeps a supplied regime fit, label, and volatility, including the clamp", () => {
    const result = sanitizeLlmClassification({
      ...supplied,
      regimeFit: 12,
      regimeFitLabel: "Strong Fit",
      volatilityLabel: "High",
    }, "AAPL");
    expect(result.regimeFit).toBe(10);
    expect(result.regimeFitLabel).toBe("Strong Fit");
    expect(result.volatilityLabel).toBe("High");
    const emptyLabel = sanitizeLlmClassification({
      ...supplied,
      regimeFit: 5,
      regimeFitLabel: "",
      volatilityLabel: "Moderate",
    }, "AAPL");
    expect(emptyLabel.regimeFit).toBe(5);
    expect(emptyLabel.regimeFitLabel).toBe("");
    expect(emptyLabel.volatilityLabel).toBe("Moderate");
  });

  it("withholds regime fit, its label, and volatility when the model omits them", () => {
    const result = sanitizeLlmClassification(supplied, "AAPL");
    expect(result.regimeFit).toBeNull();
    expect(result.regimeFitLabel).toBeNull();
    expect(result.volatilityLabel).toBeNull();
    const source = readFileSync("server/signalsClassifier.ts", "utf8");
    expect(source).not.toContain("parsed.regimeFit ?? 5");
    expect(source).not.toContain('parsed.regimeFitLabel ?? "Moderate Fit"');
    expect(source).not.toContain('parsed.volatilityLabel ?? "Moderate"');
    const search = readFileSync("client/src/components/TickerSearch.tsx", "utf8");
    expect(search).toContain("not supplied");
  });
});
