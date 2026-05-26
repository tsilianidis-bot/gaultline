import { describe, it, expect } from "vitest";
import { getPressureHistory, getPressureHistoryStats } from "./db";

describe("Track Record DB helpers", () => {
  it("getPressureHistory returns an array", async () => {
    const records = await getPressureHistory({ limit: 10 });
    expect(Array.isArray(records)).toBe(true);
  });

  it("getPressureHistory respects limit", async () => {
    const records = await getPressureHistory({ limit: 5 });
    expect(records.length).toBeLessThanOrEqual(5);
  });

  it("getPressureHistory records have required fields", async () => {
    const records = await getPressureHistory({ limit: 3 });
    for (const r of records) {
      expect(r).toHaveProperty("month");
      expect(r).toHaveProperty("overallPressure");
      expect(r).toHaveProperty("regime");
      expect(typeof r.month).toBe("string");
      expect(typeof r.overallPressure).toBe("number");
      expect(typeof r.regime).toBe("string");
    }
  });

  it("getPressureHistory startMonth filter works", async () => {
    const records = await getPressureHistory({ startMonth: "2008-01", endMonth: "2008-12" });
    for (const r of records) {
      expect(r.month >= "2008-01").toBe(true);
      expect(r.month <= "2008-12").toBe(true);
    }
  });

  it("getPressureHistoryStats returns aggregate stats", async () => {
    const stats = await getPressureHistoryStats();
    if (stats === null) {
      // DB not available in test env — skip
      return;
    }
    expect(stats).toHaveProperty("totalMonths");
    expect(stats).toHaveProperty("avgPressure");
    expect(stats).toHaveProperty("maxPressure");
    expect(stats).toHaveProperty("criticalMonths");
    expect(stats).toHaveProperty("highRiskMonths");
    expect(typeof stats.totalMonths).toBe("number");
    expect(typeof stats.avgPressure).toBe("number");
  });

  it("getPressureHistoryStats totalMonths >= 300 if DB available", async () => {
    const stats = await getPressureHistoryStats();
    if (stats === null) return; // DB not available
    expect(stats.totalMonths).toBeGreaterThanOrEqual(300);
  });

  it("getPressureHistoryStats maxPressure is between 70 and 100", async () => {
    const stats = await getPressureHistoryStats();
    if (stats === null) return;
    expect(stats.maxPressure).toBeGreaterThanOrEqual(70);
    expect(stats.maxPressure).toBeLessThanOrEqual(100);
  });
});
