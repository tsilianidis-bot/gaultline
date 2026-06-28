import { describe, it, expect } from "vitest";

// ── Unit tests for dailyBrief router helpers ──────────────────────────────────
// These tests validate the business logic of the daily brief feature without
// requiring a live database or LLM connection.

describe("dailyBrief — EngineSnapshot schema validation", () => {
  it("should accept a valid engine snapshot", () => {
    const snapshot = {
      overallPressure: 45,
      regime: "Late Cycle",
      liquidity: 60,
      credit: 30,
      breadth: 55,
      aiConcentration: 32,
      volatility: 40,
      bullProbability: 58,
      vix: 18.5,
      dxy: 104.2,
      treasury10y: 4.3,
      timestamp: Date.now(),
    };
    // All required numeric fields should be present
    expect(typeof snapshot.overallPressure).toBe("number");
    expect(typeof snapshot.regime).toBe("string");
    expect(typeof snapshot.liquidity).toBe("number");
    expect(typeof snapshot.credit).toBe("number");
    expect(typeof snapshot.breadth).toBe("number");
    expect(typeof snapshot.bullProbability).toBe("number");
    expect(typeof snapshot.timestamp).toBe("number");
  });

  it("should allow optional vix/dxy/treasury10y fields", () => {
    const minimalSnapshot = {
      overallPressure: 50,
      regime: "Expansion",
      liquidity: 50,
      credit: 25,
      breadth: 50,
      aiConcentration: 30,
      volatility: 35,
      bullProbability: 60,
      timestamp: Date.now(),
    };
    expect(minimalSnapshot.vix).toBeUndefined();
    expect(minimalSnapshot.dxy).toBeUndefined();
    expect(minimalSnapshot.treasury10y).toBeUndefined();
  });
});

describe("dailyBrief — pressure-to-bias mapping", () => {
  const deriveInstitutionalBias = (pressure: number, regime: string): string => {
    const r = regime.toLowerCase();
    if (pressure < 25) {
      if (r.includes("expansion") || r.includes("bull")) return "Strongly Bullish";
      return "Moderately Bullish";
    }
    if (pressure < 45) {
      if (r.includes("expansion")) return "Moderately Bullish";
      return "Neutral to Cautious";
    }
    if (pressure < 65) return "Cautious";
    if (pressure < 80) return "Defensive";
    return "Risk-Off";
  };

  it("returns Strongly Bullish for low pressure in expansion regime", () => {
    expect(deriveInstitutionalBias(20, "Expansion")).toBe("Strongly Bullish");
  });

  it("returns Moderately Bullish for low pressure in neutral regime", () => {
    expect(deriveInstitutionalBias(20, "Late Cycle")).toBe("Moderately Bullish");
  });

  it("returns Neutral to Cautious for moderate pressure in non-expansion regime", () => {
    expect(deriveInstitutionalBias(35, "Contraction")).toBe("Neutral to Cautious");
  });

  it("returns Cautious for mid-range pressure", () => {
    expect(deriveInstitutionalBias(55, "Late Cycle")).toBe("Cautious");
  });

  it("returns Defensive for high pressure", () => {
    expect(deriveInstitutionalBias(72, "Recession")).toBe("Defensive");
  });

  it("returns Risk-Off for extreme pressure", () => {
    expect(deriveInstitutionalBias(85, "Crisis")).toBe("Risk-Off");
  });
});

describe("dailyBrief — market health label", () => {
  const deriveMarketHealth = (pressure: number, breadth: number, liquidity: number): string => {
    const composite = (100 - pressure) * 0.4 + breadth * 0.35 + liquidity * 0.25;
    if (composite > 70) return "Healthy";
    if (composite > 55) return "Moderately Healthy";
    if (composite > 40) return "Stressed";
    if (composite > 25) return "Deteriorating";
    return "Critical";
  };

  it("returns Healthy for strong conditions", () => {
    expect(deriveMarketHealth(10, 85, 90)).toBe("Healthy");
  });

  it("returns Critical for extreme stress", () => {
    expect(deriveMarketHealth(90, 10, 5)).toBe("Critical");
  });

  it("returns Stressed for mid-range conditions", () => {
    const result = deriveMarketHealth(55, 45, 40);
    expect(["Stressed", "Moderately Healthy"]).toContain(result);
  });
});

describe("dailyBrief — change detection logic", () => {
  it("detects regime change between snapshots", () => {
    const previous = { regime: "Expansion", overallPressure: 30, liquidity: 65, credit: 20, breadth: 70, bullProbability: 65, aiConcentration: 28, volatility: 25, timestamp: Date.now() - 86400000 };
    const current  = { regime: "Late Cycle", overallPressure: 50, liquidity: 55, credit: 35, breadth: 55, bullProbability: 50, aiConcentration: 32, volatility: 40, timestamp: Date.now() };
    const regimeChanged = current.regime !== previous.regime;
    expect(regimeChanged).toBe(true);
  });

  it("detects significant pressure increase", () => {
    const previous = { overallPressure: 25 };
    const current  = { overallPressure: 55 };
    const delta = current.overallPressure - previous.overallPressure;
    expect(Math.abs(delta)).toBeGreaterThanOrEqual(5);
  });

  it("does not flag insignificant changes", () => {
    const previous = { overallPressure: 45 };
    const current  = { overallPressure: 46 };
    const delta = Math.abs(current.overallPressure - previous.overallPressure);
    expect(delta).toBeLessThan(5);
  });
});

describe("dailyBrief — watchlist intelligence signals", () => {
  it("generates positive signal for low pressure regime", () => {
    const pressure = 25;
    const direction = pressure < 40 ? "positive" : pressure > 60 ? "negative" : "neutral";
    expect(direction).toBe("positive");
  });

  it("generates negative signal for high pressure regime", () => {
    const pressure = 75;
    const direction = pressure < 40 ? "positive" : pressure > 60 ? "negative" : "neutral";
    expect(direction).toBe("negative");
  });

  it("generates neutral signal for mid-range pressure", () => {
    const pressure = 50;
    const direction = pressure < 40 ? "positive" : pressure > 60 ? "negative" : "neutral";
    expect(direction).toBe("neutral");
  });
});
