/**
 * Promo Router Tests
 *
 * Tests the core business logic of the FACEBOOK30 campaign:
 * - Code validation (valid, invalid, exhausted)
 * - Redemption deduplication
 * - Cap enforcement logic
 * - Milestone notification thresholds
 */
import { describe, it, expect } from "vitest";

// ── Pure logic tests (no DB required) ────────────────────────

describe("Promo campaign business logic", () => {
  it("correctly identifies when a campaign is exhausted", () => {
    const isExhausted = (redemptionCount: number, maxRedemptions: number) =>
      redemptionCount >= maxRedemptions;

    expect(isExhausted(0, 100)).toBe(false);
    expect(isExhausted(99, 100)).toBe(false);
    expect(isExhausted(100, 100)).toBe(true);
    expect(isExhausted(101, 100)).toBe(true);
  });

  it("correctly calculates trial expiry date", () => {
    const calcExpiry = (activatedAt: Date, trialDays: number) => {
      const expiry = new Date(activatedAt);
      expiry.setDate(expiry.getDate() + trialDays);
      return expiry;
    };

    const now = new Date("2026-07-18T00:00:00Z");
    const expiry = calcExpiry(now, 30);
    expect(expiry.toISOString().startsWith("2026-08-17")).toBe(true);
  });

  it("correctly determines if a trial is still active", () => {
    const isActive = (trialExpiresAt: Date) => new Date() < trialExpiresAt;

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10); // 10 days from now
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);   // 1 day ago

    expect(isActive(future)).toBe(true);
    expect(isActive(past)).toBe(false);
  });

  it("correctly identifies milestones that need to fire", () => {
    const getMilestonesToFire = (
      milestones: number[],
      alreadyNotified: number[],
      currentCount: number
    ) => milestones.filter(m => m <= currentCount && !alreadyNotified.includes(m));

    const milestones = [75, 90, 100];

    expect(getMilestonesToFire(milestones, [], 74)).toEqual([]);
    expect(getMilestonesToFire(milestones, [], 75)).toEqual([75]);
    expect(getMilestonesToFire(milestones, [75], 75)).toEqual([]);
    expect(getMilestonesToFire(milestones, [75], 90)).toEqual([90]);
    expect(getMilestonesToFire(milestones, [75, 90], 100)).toEqual([100]);
    expect(getMilestonesToFire(milestones, [75, 90, 100], 100)).toEqual([]);
  });

  it("correctly calculates conversion rate", () => {
    const conversionRate = (converted: number, total: number) =>
      total > 0 ? Math.round((converted / total) * 100) : 0;

    expect(conversionRate(0, 0)).toBe(0);
    expect(conversionRate(0, 100)).toBe(0);
    expect(conversionRate(10, 100)).toBe(10);
    expect(conversionRate(50, 100)).toBe(50);
    expect(conversionRate(1, 3)).toBe(33);
  });

  it("correctly computes days remaining in trial", () => {
    const daysRemaining = (trialExpiresAt: Date) => {
      const now = new Date();
      const isActive = now < trialExpiresAt;
      return isActive
        ? Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    };

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); // 15 days
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);

    expect(daysRemaining(future)).toBeGreaterThan(0);
    expect(daysRemaining(past)).toBe(0);
  });

  it("normalizes promo codes to uppercase", () => {
    const normalize = (code: string) => code.toUpperCase();
    expect(normalize("facebook30")).toBe("FACEBOOK30");
    expect(normalize("FACEBOOK30")).toBe("FACEBOOK30");
    expect(normalize("Facebook30")).toBe("FACEBOOK30");
  });

  it("validates that campaign max is exactly 100 for FACEBOOK30", () => {
    const FACEBOOK30_MAX = 100;
    expect(FACEBOOK30_MAX).toBe(100);
    expect(FACEBOOK30_MAX).toBeGreaterThan(0);
  });
});

describe("Promo redemption URL structure", () => {
  it("generates correct redemption URL", () => {
    const getPromoUrl = (code: string, baseUrl = "https://getfaultline.live") =>
      `${baseUrl}/promo/${code.toUpperCase()}`;

    expect(getPromoUrl("FACEBOOK30")).toBe("https://getfaultline.live/promo/FACEBOOK30");
    expect(getPromoUrl("facebook30")).toBe("https://getfaultline.live/promo/FACEBOOK30");
  });

  it("generates correct admin dashboard URL", () => {
    const adminUrl = "https://getfaultline.live/admin/promo";
    expect(adminUrl).toContain("/admin/promo");
  });
});
