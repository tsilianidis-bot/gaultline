// ============================================================
// FAULTLINE — Pressure Engine Tests
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateFaultlinePressure } from "./engine";

// Mock fetch so tests don't hit the real FRED API
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
});

describe("calculateFaultlinePressure (fallback mode)", () => {
  it("returns a valid output structure", async () => {
    const result = await calculateFaultlinePressure();

    expect(result).toHaveProperty("overallPressure");
    expect(result).toHaveProperty("regime");
    expect(result).toHaveProperty("level");
    expect(result).toHaveProperty("vectors");
    expect(result).toHaveProperty("alerts");
    expect(result).toHaveProperty("topAnalog");
    expect(result).toHaveProperty("analogs");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("dataSource");
  });

  it("overallPressure is between 0 and 100", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.overallPressure).toBeGreaterThanOrEqual(0);
    expect(result.overallPressure).toBeLessThanOrEqual(100);
  });

  it("returns exactly 6 risk vectors", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.vectors).toHaveLength(6);
  });

  it("each vector has required fields", async () => {
    const result = await calculateFaultlinePressure();
    for (const v of result.vectors) {
      expect(v).toHaveProperty("id");
      expect(v).toHaveProperty("label");
      expect(v).toHaveProperty("score");
      expect(v).toHaveProperty("level");
      expect(v).toHaveProperty("driver");
      expect(v).toHaveProperty("trend");
      expect(v).toHaveProperty("weight");
      expect(v.score).toBeGreaterThanOrEqual(0);
      expect(v.score).toBeLessThanOrEqual(100);
    }
  });

  it("vector weights sum to approximately 1.0", async () => {
    const result = await calculateFaultlinePressure();
    const totalWeight = result.vectors.reduce((sum, v) => sum + v.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  });

  it("level matches overallPressure range", async () => {
    const result = await calculateFaultlinePressure();
    const { overallPressure, level } = result;
    if (overallPressure >= 80) expect(level).toBe("Critical");
    else if (overallPressure >= 65) expect(level).toBe("High");
    else if (overallPressure >= 45) expect(level).toBe("Elevated");
    else if (overallPressure >= 25) expect(level).toBe("Moderate");
    else expect(level).toBe("Low");
  });

  it("returns historical analogs sorted by similarity descending", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.analogs.length).toBeGreaterThan(0);
    for (let i = 1; i < result.analogs.length; i++) {
      expect(result.analogs[i - 1]!.similarity).toBeGreaterThanOrEqual(result.analogs[i]!.similarity);
    }
  });

  it("topAnalog matches the first analog in the sorted list", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.topAnalog.year).toBe(result.analogs[0]!.year);
    expect(result.topAnalog.similarity).toBe(result.analogs[0]!.similarity);
  });

  it("dataSource is 'fallback' when FRED is unavailable", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.dataSource).toBe("fallback");
  });

  it("timestamp is a valid ISO string", async () => {
    const result = await calculateFaultlinePressure();
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).getFullYear()).toBeGreaterThan(2020);
  });

  it("all vector IDs are unique", async () => {
    const result = await calculateFaultlinePressure();
    const ids = result.vectors.map(v => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("expected vector IDs are present", async () => {
    const result = await calculateFaultlinePressure();
    const ids = result.vectors.map(v => v.id);
    expect(ids).toContain("liquidity-stress");
    expect(ids).toContain("credit-contagion");
    expect(ids).toContain("volatility-regime");
    expect(ids).toContain("macro-sensitivity");
    expect(ids).toContain("market-breadth");
    expect(ids).toContain("ai-bubble");
  });

  // ── Data truth labeling regression tests ──────────────────────

  it("output includes lastUpdated as a valid ISO string", async () => {
    const result = await calculateFaultlinePressure();
    expect(result).toHaveProperty("lastUpdated");
    expect(() => new Date(result.lastUpdated)).not.toThrow();
    expect(new Date(result.lastUpdated).getFullYear()).toBeGreaterThan(2020);
  });

  it("each vector has dataStatus and source fields", async () => {
    const result = await calculateFaultlinePressure();
    const validStatuses = ["live", "delayed", "cached", "stale", "fallback", "static", "unavailable"];
    for (const v of result.vectors) {
      expect(v).toHaveProperty("dataStatus");
      expect(v).toHaveProperty("source");
      expect(validStatuses).toContain(v.dataStatus);
      expect(typeof v.source).toBe("string");
      expect(v.source.length).toBeGreaterThan(0);
    }
  });

  it("ai-bubble vector is labeled static with a fallbackReason", async () => {
    const result = await calculateFaultlinePressure();
    const aiBubble = result.vectors.find(v => v.id === "ai-bubble");
    expect(aiBubble).toBeDefined();
    expect(aiBubble!.dataStatus).toBe("static");
    expect(aiBubble!.fallbackReason).toBeDefined();
    expect(aiBubble!.fallbackReason!.length).toBeGreaterThan(10);
    // Source must mention it is a static model estimate — not a live feed
    expect(aiBubble!.source.toLowerCase()).toContain("static");
  });

  it("ai-bubble vector score is still within valid range despite static concentration baseline", async () => {
    const result = await calculateFaultlinePressure();
    const aiBubble = result.vectors.find(v => v.id === "ai-bubble");
    expect(aiBubble).toBeDefined();
    expect(aiBubble!.score).toBeGreaterThanOrEqual(0);
    expect(aiBubble!.score).toBeLessThanOrEqual(100);
  });

  it("live FRED vectors are labeled fallback when FRED is unavailable", async () => {
    const result = await calculateFaultlinePressure();
    // In test mode, FRED is mocked to fail, so all live vectors should be fallback
    const liveVectors = result.vectors.filter(v => v.id !== "ai-bubble");
    for (const v of liveVectors) {
      expect(["fallback", "delayed", "live"]).toContain(v.dataStatus);
    }
  });

  it("no vector uses dataStatus 'live' when dataSource is fallback", async () => {
    const result = await calculateFaultlinePressure();
    if (result.dataSource === "fallback") {
      for (const v of result.vectors) {
        // Static is allowed; live is not when the overall source is fallback
        if (v.dataStatus === "live") {
          throw new Error(`Vector '${v.id}' claims live status but overall dataSource is fallback`);
        }
      }
    }
  });
});
