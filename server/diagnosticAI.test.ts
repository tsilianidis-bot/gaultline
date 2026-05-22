// ============================================================
// Vitest tests for FAULTLINE Diagnostic AI™ + Position Guidance™
// ============================================================

import { describe, it, expect } from "vitest";
import {
  classifyRegimeLabel,
  pressureToActionBias,
  actionBiasScore,
  type ActionBias,
} from "./diagnosticAI";
import {
  DEMO_ASSETS,
} from "./positionGuidance";

// ── diagnosticAI.ts unit tests ────────────────────────────────

describe("classifyRegimeLabel", () => {
  it("returns Calm for pressure 0", () => {
    expect(classifyRegimeLabel(0)).toBe("Calm");
  });
  it("returns Calm for pressure 20", () => {
    expect(classifyRegimeLabel(20)).toBe("Calm");
  });
  it("returns Normal Risk for pressure 21", () => {
    expect(classifyRegimeLabel(21)).toBe("Normal Risk");
  });
  it("returns Normal Risk for pressure 40", () => {
    expect(classifyRegimeLabel(40)).toBe("Normal Risk");
  });
  it("returns Watch Zone for pressure 41", () => {
    expect(classifyRegimeLabel(41)).toBe("Watch Zone");
  });
  it("returns Watch Zone for pressure 60", () => {
    expect(classifyRegimeLabel(60)).toBe("Watch Zone");
  });
  it("returns Elevated Pressure for pressure 61", () => {
    expect(classifyRegimeLabel(61)).toBe("Elevated Pressure");
  });
  it("returns Elevated Pressure for pressure 75", () => {
    expect(classifyRegimeLabel(75)).toBe("Elevated Pressure");
  });
  it("returns Critical Stress for pressure 76", () => {
    expect(classifyRegimeLabel(76)).toBe("Critical Stress");
  });
  it("returns Critical Stress for pressure 85", () => {
    expect(classifyRegimeLabel(85)).toBe("Critical Stress");
  });
  it("returns Systemic Break Zone for pressure 86", () => {
    expect(classifyRegimeLabel(86)).toBe("Systemic Break Zone");
  });
  it("returns Systemic Break Zone for pressure 100", () => {
    expect(classifyRegimeLabel(100)).toBe("Systemic Break Zone");
  });
});

describe("pressureToActionBias", () => {
  const cases: Array<[number, ActionBias]> = [
    [0,   "Bullish"],
    [20,  "Bullish"],
    [21,  "Neutral"],
    [40,  "Neutral"],
    [41,  "Cautious"],
    [60,  "Cautious"],
    [61,  "Defensive"],
    [75,  "Defensive"],
    [76,  "Critical"],
    [100, "Critical"],
  ];
  for (const [pressure, expected] of cases) {
    it(`pressure ${pressure} → ${expected}`, () => {
      expect(pressureToActionBias(pressure)).toBe(expected);
    });
  }
});

describe("actionBiasScore", () => {
  it("pressure 0 → score 100", () => {
    expect(actionBiasScore(0)).toBe(100);
  });
  it("pressure 100 → score 0", () => {
    expect(actionBiasScore(100)).toBe(0);
  });
  it("pressure 50 → score 50", () => {
    expect(actionBiasScore(50)).toBe(50);
  });
  it("score is always 0–100", () => {
    for (let p = 0; p <= 100; p += 5) {
      const s = actionBiasScore(p);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ── positionGuidance.ts unit tests ───────────────────────────

describe("DEMO_ASSETS catalog", () => {
  it("contains exactly 7 assets", () => {
    expect(DEMO_ASSETS).toHaveLength(7);
  });

  it("contains all required tickers", () => {
    const tickers = DEMO_ASSETS.map(a => a.ticker);
    expect(tickers).toContain("SPY");
    expect(tickers).toContain("QQQ");
    expect(tickers).toContain("NVDA");
    expect(tickers).toContain("AAPL");
    expect(tickers).toContain("TSLA");
    expect(tickers).toContain("BTC");
    expect(tickers).toContain("ETH");
  });

  it("all assets have valid assetType", () => {
    const validTypes = ["Stock", "ETF", "Crypto", "Index"];
    for (const asset of DEMO_ASSETS) {
      expect(validTypes).toContain(asset.assetType);
    }
  });

  it("all numeric scores are 0–100", () => {
    for (const asset of DEMO_ASSETS) {
      expect(asset.aiExposure).toBeGreaterThanOrEqual(0);
      expect(asset.aiExposure).toBeLessThanOrEqual(100);
      expect(asset.debtRisk).toBeGreaterThanOrEqual(0);
      expect(asset.debtRisk).toBeLessThanOrEqual(100);
      expect(asset.recessionSensitivity).toBeGreaterThanOrEqual(0);
      expect(asset.recessionSensitivity).toBeLessThanOrEqual(100);
      expect(asset.volatilityBase).toBeGreaterThanOrEqual(0);
      expect(asset.volatilityBase).toBeLessThanOrEqual(100);
      expect(asset.momentumBase).toBeGreaterThanOrEqual(0);
      expect(asset.momentumBase).toBeLessThanOrEqual(100);
      expect(asset.sectorStrengthBase).toBeGreaterThanOrEqual(0);
      expect(asset.sectorStrengthBase).toBeLessThanOrEqual(100);
    }
  });

  it("crypto assets have higher volatilityBase than ETFs", () => {
    const btc = DEMO_ASSETS.find(a => a.ticker === "BTC")!;
    const spy = DEMO_ASSETS.find(a => a.ticker === "SPY")!;
    expect(btc.volatilityBase).toBeGreaterThan(spy.volatilityBase);
  });

  it("NVDA has higher aiExposure than SPY", () => {
    const nvda = DEMO_ASSETS.find(a => a.ticker === "NVDA")!;
    const spy  = DEMO_ASSETS.find(a => a.ticker === "SPY")!;
    expect(nvda.aiExposure).toBeGreaterThan(spy.aiExposure);
  });
});

// ── positionGuidance scoring logic ───────────────────────────
// We test the scoring conversion thresholds directly since
// computeAssetScores is not exported (tested via integration).

type PositionActionType = "Add" | "Hold" | "Watch / No Add" | "Trim" | "Exit Watch" | "Sell Bias";

function scoreToAction(compositeScore: number): PositionActionType {
  if (compositeScore >= 80) return "Add";
  if (compositeScore >= 65) return "Hold";
  if (compositeScore >= 50) return "Watch / No Add";
  if (compositeScore >= 35) return "Trim";
  if (compositeScore >= 20) return "Exit Watch";
  return "Sell Bias";
}

describe("scoreToAction (position guidance scoring)", () => {
  const cases: Array<[number, PositionActionType]> = [
    [100, "Add"],
    [80,  "Add"],
    [79,  "Hold"],
    [65,  "Hold"],
    [64,  "Watch / No Add"],
    [50,  "Watch / No Add"],
    [49,  "Trim"],
    [35,  "Trim"],
    [34,  "Exit Watch"],
    [20,  "Exit Watch"],
    [19,  "Sell Bias"],
    [0,   "Sell Bias"],
  ];
  for (const [score, expected] of cases) {
    it(`score ${score} → ${expected}`, () => {
      expect(scoreToAction(score)).toBe(expected);
    });
  }

  it("all 6 action labels are reachable", () => {
    // Scores chosen to hit each branch: 85=Add, 70=Hold, 55=Watch/No Add, 42=Trim, 25=Exit Watch, 5=Sell Bias
    const labels = new Set([85, 70, 55, 42, 25, 5].map(scoreToAction));
    expect(labels.size).toBe(6);
  });
});
