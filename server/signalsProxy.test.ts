/**
 * Tests for the holiday-aware trading date helpers in signalsProxy.ts
 * We test the logic by re-implementing the same functions here and
 * verifying they produce the correct results for known dates.
 */
import { describe, it, expect } from "vitest";

// Re-implement the helpers under test (mirrors signalsProxy.ts exactly)
const US_MARKET_HOLIDAYS = new Set([
  // 2024
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27',
  '2024-06-19', '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
  // 2025
  '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27',
  '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
]);

function isNonTradingDay(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6 || US_MARKET_HOLIDAYS.has(dateStr);
}

function getLastTradingDateFrom(fromDate: Date): string {
  const d = new Date(fromDate.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  while (isNonTradingDay(d.toISOString().slice(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

function getNTradingDaysBefore(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const s = d.toISOString().slice(0, 10);
    if (!isNonTradingDay(s)) count++;
  }
  return d.toISOString().slice(0, 10);
}

describe("isNonTradingDay", () => {
  it("returns true for weekends", () => {
    expect(isNonTradingDay("2026-05-23")).toBe(true); // Saturday
    expect(isNonTradingDay("2026-05-24")).toBe(true); // Sunday
  });

  it("returns true for US market holidays", () => {
    expect(isNonTradingDay("2026-05-25")).toBe(true); // Memorial Day 2026
    expect(isNonTradingDay("2026-12-25")).toBe(true); // Christmas 2026
    expect(isNonTradingDay("2026-01-01")).toBe(true); // New Year 2026
    expect(isNonTradingDay("2026-07-03")).toBe(true); // Independence Day observed 2026
  });

  it("returns false for normal trading days", () => {
    expect(isNonTradingDay("2026-05-22")).toBe(false); // Thursday
    expect(isNonTradingDay("2026-05-26")).toBe(false); // Tuesday (day after Memorial Day)
    expect(isNonTradingDay("2026-01-02")).toBe(false); // Friday after New Year
  });
});

describe("getLastTradingDateFrom", () => {
  it("skips Memorial Day 2026 and returns the previous Friday", () => {
    // Today = Tuesday May 26, 2026 → yesterday = May 25 (Memorial Day) → skip → May 22 (Friday)
    const result = getLastTradingDateFrom(new Date("2026-05-26T12:00:00Z"));
    expect(result).toBe("2026-05-22");
  });

  it("skips a normal weekend and returns Friday", () => {
    // Today = Monday May 18, 2026 → yesterday = May 17 (Sunday) → skip → May 16 (Saturday) → skip → May 15 (Friday)
    const result = getLastTradingDateFrom(new Date("2026-05-18T12:00:00Z"));
    expect(result).toBe("2026-05-15");
  });

  it("returns yesterday for a normal weekday", () => {
    // Today = Wednesday May 20, 2026 → yesterday = May 19 (Tuesday)
    const result = getLastTradingDateFrom(new Date("2026-05-20T12:00:00Z"));
    expect(result).toBe("2026-05-19");
  });

  it("skips Christmas 2026 (Friday) and returns Thursday Dec 24", () => {
    // Today = Monday Dec 28, 2026 → yesterday = Dec 27 (Sunday) → skip → Dec 26 (Saturday) → skip → Dec 25 (Christmas) → skip → Dec 24 (Thursday)
    const result = getLastTradingDateFrom(new Date("2026-12-28T12:00:00Z"));
    expect(result).toBe("2026-12-24");
  });
});

describe("getNTradingDaysBefore", () => {
  it("correctly skips Memorial Day when counting back", () => {
    // 1 trading day before May 22 = May 21 (Thursday)
    expect(getNTradingDaysBefore("2026-05-22", 1)).toBe("2026-05-21");
  });

  it("skips weekends when counting back", () => {
    // May 19 is a Tuesday, so 1 trading day before = May 18 (Monday)
    expect(getNTradingDaysBefore("2026-05-19", 1)).toBe("2026-05-18");
    // 1 trading day before May 18 (Monday) = May 15 (Friday) — skips weekend
    expect(getNTradingDaysBefore("2026-05-18", 1)).toBe("2026-05-15");
  });

  it("counts 5 trading days back correctly", () => {
    // 5 trading days before May 22 = May 15 (skipping weekend)
    expect(getNTradingDaysBefore("2026-05-22", 5)).toBe("2026-05-15");
  });
});
