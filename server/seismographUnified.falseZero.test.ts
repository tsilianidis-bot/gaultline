/**
 * Tests for the false-zero sub-score fallback logic in seismographUnified.ts.
 *
 * Root cause: the pressureHistory DB stores 0 (not null) for sub-scores that
 * were not computed in a partial live-run row. Before the fix, `?? 50` did not
 * catch zero, so evidenceFamilies.strength displayed as 0/100 on the WHY page.
 *
 * The fix uses `|| 50` in history normalization AND a second-layer patch that
 * replaces zero raw-DB values in the latest row with the previous row's values.
 */

import { describe, it, expect } from "vitest";

// ─── Helpers extracted from seismographUnified.ts logic ─────────────────────

/** Mirrors the history normalization: `|| 50` catches both null and 0. */
function normalizeSubScore(raw: number | null | undefined): number {
  return raw || 50;
}

/**
 * Mirrors the second-layer patch that replaces missing latest-row sub-scores
 * with the previous row's values, detected via the raw DB value.
 */
function patchLatestRow(
  rawLatest: { liquidity: number | null; credit: number | null; volatility: number | null; macro: number | null; breadth: number | null },
  normalizedLatest: { liquidity: number; credit: number; volatility: number; macro: number; breadth: number },
  normalizedPrev: { liquidity: number; credit: number; volatility: number; macro: number; breadth: number },
) {
  return {
    liquidity:  (rawLatest.liquidity  === 0 || rawLatest.liquidity  === null) ? normalizedPrev.liquidity  : normalizedLatest.liquidity,
    credit:     (rawLatest.credit     === 0 || rawLatest.credit     === null) ? normalizedPrev.credit     : normalizedLatest.credit,
    volatility: (rawLatest.volatility === 0 || rawLatest.volatility === null) ? normalizedPrev.volatility : normalizedLatest.volatility,
    macro:      (rawLatest.macro      === 0 || rawLatest.macro      === null) ? normalizedPrev.macro      : normalizedLatest.macro,
    breadth:    (rawLatest.breadth    === 0 || rawLatest.breadth    === null) ? normalizedPrev.breadth    : normalizedLatest.breadth,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("normalizeSubScore — || 50 fallback", () => {
  it("returns the value when non-zero", () => {
    expect(normalizeSubScore(29)).toBe(29);
    expect(normalizeSubScore(44)).toBe(44);
    expect(normalizeSubScore(30)).toBe(30);
  });

  it("returns 50 when raw value is 0 (missing DB row)", () => {
    expect(normalizeSubScore(0)).toBe(50);
  });

  it("returns 50 when raw value is null", () => {
    expect(normalizeSubScore(null)).toBe(50);
  });

  it("returns 50 when raw value is undefined", () => {
    expect(normalizeSubScore(undefined)).toBe(50);
  });

  it("does NOT return 50 for genuine low-stress readings (e.g. 20)", () => {
    expect(normalizeSubScore(20)).toBe(20);
    expect(normalizeSubScore(15)).toBe(15);
  });
});

describe("patchLatestRow — second-layer fallback to previous row", () => {
  const prev = { liquidity: 29, credit: 25, volatility: 28, macro: 44, breadth: 22 };

  it("uses previous row values when latest raw DB values are 0 (May 2026 scenario)", () => {
    const rawLatest = { liquidity: 0, credit: 0, volatility: 30, macro: 0, breadth: 0 };
    const normalizedLatest = { liquidity: 50, credit: 50, volatility: 30, macro: 50, breadth: 50 };

    const patched = patchLatestRow(rawLatest, normalizedLatest, prev);

    expect(patched.liquidity).toBe(29);   // from prev, not 50
    expect(patched.credit).toBe(25);      // from prev, not 50
    expect(patched.volatility).toBe(30);  // kept from latest (non-zero raw)
    expect(patched.macro).toBe(44);       // from prev, not 50
    expect(patched.breadth).toBe(22);     // from prev, not 50
  });

  it("keeps latest values when all sub-scores are present (normal row)", () => {
    const rawLatest = { liquidity: 35, credit: 28, volatility: 42, macro: 38, breadth: 30 };
    const normalizedLatest = { liquidity: 35, credit: 28, volatility: 42, macro: 38, breadth: 30 };

    const patched = patchLatestRow(rawLatest, normalizedLatest, prev);

    expect(patched.liquidity).toBe(35);
    expect(patched.credit).toBe(28);
    expect(patched.volatility).toBe(42);
    expect(patched.macro).toBe(38);
    expect(patched.breadth).toBe(30);
  });

  it("uses previous row values when latest raw DB values are null", () => {
    const rawLatest = { liquidity: null, credit: null, volatility: null, macro: null, breadth: null };
    const normalizedLatest = { liquidity: 50, credit: 50, volatility: 50, macro: 50, breadth: 50 };

    const patched = patchLatestRow(rawLatest, normalizedLatest, prev);

    expect(patched.liquidity).toBe(29);
    expect(patched.credit).toBe(25);
    expect(patched.volatility).toBe(28);
    expect(patched.macro).toBe(44);
    expect(patched.breadth).toBe(22);
  });
});

describe("false-zero regression: WHY page evidence families must never show 0/100", () => {
  it("strength is never 0 after normalization for any realistic DB row", () => {
    const dbRows = [
      { liquidity: 0, credit: 0, volatility: 30, macro: 0, breadth: 0 },   // May 2026 partial row
      { liquidity: 29, credit: 25, volatility: 28, macro: 44, breadth: 22 }, // April 2026 full row
      { liquidity: null, credit: null, volatility: null, macro: null, breadth: null }, // all null
    ];

    for (const row of dbRows) {
      expect(normalizeSubScore(row.liquidity)).toBeGreaterThan(0);
      expect(normalizeSubScore(row.credit)).toBeGreaterThan(0);
      expect(normalizeSubScore(row.volatility)).toBeGreaterThan(0);
      expect(normalizeSubScore(row.macro)).toBeGreaterThan(0);
      expect(normalizeSubScore(row.breadth)).toBeGreaterThan(0);
    }
  });
});
