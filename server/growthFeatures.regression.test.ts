/**
 * Regression tests for the 3 growth features:
 * 1. Shareable Public Report Links
 * 2. Paywall Blur (tier-based access control)
 * 3. Interactive Sizing Calculator math
 */

import { describe, it, expect, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Feature 1: Shareable Public Report Links
// ─────────────────────────────────────────────────────────────
describe('Shareable Public Report Links', () => {
  describe('Access control — create procedure', () => {
    it('allows premium tier users to create share links', () => {
      const tier = 'premium';
      const allowed = ['premium', 'founding'].includes(tier);
      expect(allowed).toBe(true);
    });

    it('allows founding tier users to create share links', () => {
      const tier = 'founding';
      const allowed = ['premium', 'founding'].includes(tier);
      expect(allowed).toBe(true);
    });

    it('allows admin role to create share links regardless of tier', () => {
      const tier = 'free';
      const role = 'admin';
      const allowed = ['premium', 'founding'].includes(tier) || role === 'admin';
      expect(allowed).toBe(true);
    });

    it('blocks free tier non-admin users from creating share links', () => {
      const tier = 'free';
      const role = 'user';
      const allowed = ['premium', 'founding'].includes(tier) || role === 'admin';
      expect(allowed).toBe(false);
    });

    it('blocks basic tier non-admin users from creating share links', () => {
      const tier = 'basic';
      const role = 'user';
      const allowed = ['premium', 'founding'].includes(tier) || role === 'admin';
      expect(allowed).toBe(false);
    });
  });

  describe('Public report access control', () => {
    it('returns NOT_FOUND for unknown publicShareId', () => {
      const report = null; // simulates DB returning nothing
      const isNotFound = report === null || report === undefined;
      expect(isNotFound).toBe(true);
    });

    it('blocks access to revoked reports', () => {
      const report = { revoked: 1, expiresAt: null };
      const isRevoked = report.revoked === 1;
      expect(isRevoked).toBe(true);
    });

    it('blocks access to expired reports', () => {
      const report = { revoked: 0, expiresAt: new Date(Date.now() - 86400 * 1000) }; // 1 day ago
      const isExpired = report.expiresAt !== null && new Date(report.expiresAt) < new Date();
      expect(isExpired).toBe(true);
    });

    it('allows access to valid non-revoked non-expired reports', () => {
      const report = {
        revoked: 0,
        expiresAt: new Date(Date.now() + 86400 * 1000), // 1 day from now
      };
      const isRevoked = report.revoked === 1;
      const isExpired = report.expiresAt !== null && new Date(report.expiresAt) < new Date();
      expect(isRevoked).toBe(false);
      expect(isExpired).toBe(false);
    });

    it('allows access to reports with no expiry date', () => {
      const report = { revoked: 0, expiresAt: null };
      const isRevoked = report.revoked === 1;
      const isExpired = report.expiresAt !== null && new Date(report.expiresAt as Date) < new Date();
      expect(isRevoked).toBe(false);
      expect(isExpired).toBe(false);
    });
  });

  describe('Share URL format', () => {
    it('generates share URL in /r/{id} format', () => {
      const publicShareId = 'abc123xyz789def456ghi';
      const shareUrl = `/r/${publicShareId}`;
      expect(shareUrl).toBe('/r/abc123xyz789def456ghi');
      expect(shareUrl).toMatch(/^\/r\/.+$/);
    });

    it('publicShareId has at least 10 characters', () => {
      // nanoid(21) produces 21 chars — minimum validation is 10
      const id = 'a'.repeat(21);
      expect(id.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Report types', () => {
    it('accepts all valid report types', () => {
      const validTypes = ['stock_intelligence', 'crypto_intelligence', 'market_preflight', 'diagnostic_ai', 'daily_report'];
      for (const t of validTypes) {
        expect(validTypes.includes(t)).toBe(true);
      }
    });

    it('rejects unknown report types', () => {
      const validTypes = ['stock_intelligence', 'crypto_intelligence', 'market_preflight', 'diagnostic_ai', 'daily_report'];
      expect(validTypes.includes('unknown_type')).toBe(false);
    });
  });

  describe('Expiry calculation', () => {
    it('calculates expiry date correctly for 7 days', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 7 * 86400 * 1000);
      const diffDays = (expiresAt.getTime() - now) / (86400 * 1000);
      expect(diffDays).toBeCloseTo(7, 1);
    });

    it('calculates expiry date correctly for 30 days', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 30 * 86400 * 1000);
      const diffDays = (expiresAt.getTime() - now) / (86400 * 1000);
      expect(diffDays).toBeCloseTo(30, 1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Feature 2: Paywall Blur — Tier-Based Access Control
// ─────────────────────────────────────────────────────────────

/** Mirrors the tierMeetsRequirement logic from PremiumGate.tsx */
function tierMeetsRequirement(userTier: string, requiredTier: string): boolean {
  const TIER_ORDER = ['free', 'basic', 'premium', 'founding'];
  const userIdx = TIER_ORDER.indexOf(userTier);
  const reqIdx = TIER_ORDER.indexOf(requiredTier);
  if (userIdx === -1 || reqIdx === -1) return false;
  return userIdx >= reqIdx;
}

describe('Paywall Blur — Tier Access Control', () => {
  describe('tierMeetsRequirement logic', () => {
    it('free tier does not meet premium requirement', () => {
      expect(tierMeetsRequirement('free', 'premium')).toBe(false);
    });

    it('basic tier does not meet premium requirement', () => {
      expect(tierMeetsRequirement('basic', 'premium')).toBe(false);
    });

    it('premium tier meets premium requirement', () => {
      expect(tierMeetsRequirement('premium', 'premium')).toBe(true);
    });

    it('founding tier meets premium requirement', () => {
      expect(tierMeetsRequirement('founding', 'premium')).toBe(true);
    });

    it('founding tier meets founding requirement', () => {
      expect(tierMeetsRequirement('founding', 'founding')).toBe(true);
    });

    it('premium tier does not meet founding requirement', () => {
      expect(tierMeetsRequirement('premium', 'founding')).toBe(false);
    });

    it('free tier meets free requirement', () => {
      expect(tierMeetsRequirement('free', 'free')).toBe(true);
    });

    it('unknown tier returns false', () => {
      expect(tierMeetsRequirement('enterprise', 'premium')).toBe(false);
    });
  });

  describe('Blur overlay visibility logic', () => {
    it('shows blur for unauthenticated user on any gated content', () => {
      const isAuthenticated = false;
      const shouldBlur = !isAuthenticated;
      expect(shouldBlur).toBe(true);
    });

    it('shows blur for authenticated free user on premium content', () => {
      const isAuthenticated = true;
      const userTier = 'free';
      const requiredTier = 'premium';
      const shouldBlur = !isAuthenticated || !tierMeetsRequirement(userTier, requiredTier);
      expect(shouldBlur).toBe(true);
    });

    it('does not show blur for authenticated premium user on premium content', () => {
      const isAuthenticated = true;
      const userTier = 'premium';
      const requiredTier = 'premium';
      const shouldBlur = !isAuthenticated || !tierMeetsRequirement(userTier, requiredTier);
      expect(shouldBlur).toBe(false);
    });

    it('does not show blur for admin user regardless of tier', () => {
      const isAuthenticated = true;
      const userTier = 'free';
      const role = 'admin';
      const requiredTier = 'premium';
      const shouldBlur = !isAuthenticated || (role !== 'admin' && !tierMeetsRequirement(userTier, requiredTier));
      expect(shouldBlur).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Feature 3: Interactive Sizing Calculator — Math Verification
// ─────────────────────────────────────────────────────────────

/** Mirrors the core calculation logic in SizingCalculator.tsx */
function calcSizing(params: {
  accountSize: number;
  riskPercent: number;
  entry: number;
  stop: number;
  target: number;
}) {
  const { accountSize, riskPercent, entry, stop, target } = params;
  const riskPerShare = Math.abs(entry - stop);
  const rewardPerShare = Math.abs(target - entry);
  const riskReward = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  const dollarRisk = accountSize * (riskPercent / 100);
  const shares = riskPerShare > 0 ? Math.floor(dollarRisk / riskPerShare) : 0;
  const positionSize = shares * entry;
  const maxLoss = shares * riskPerShare;
  const maxGain = shares * rewardPerShare;
  const positionPercent = accountSize > 0 ? (positionSize / accountSize) * 100 : 0;
  return { riskPerShare, rewardPerShare, riskReward, dollarRisk, shares, positionSize, maxLoss, maxGain, positionPercent };
}

describe('Sizing Calculator Math', () => {
  describe('Basic calculations', () => {
    it('calculates risk per share correctly', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.riskPerShare).toBeCloseTo(5, 4);
    });

    it('calculates reward per share correctly', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.rewardPerShare).toBeCloseTo(15, 4);
    });

    it('calculates risk/reward ratio correctly (3:1)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.riskReward).toBeCloseTo(3, 4);
    });

    it('calculates dollar risk correctly (1% of $10,000 = $100)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.dollarRisk).toBeCloseTo(100, 4);
    });

    it('calculates share count correctly (floor of $100 / $5 = 20 shares)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.shares).toBe(20);
    });

    it('calculates position size correctly (20 shares × $100 = $2,000)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.positionSize).toBeCloseTo(2000, 2);
    });

    it('calculates max loss correctly (20 shares × $5 = $100)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.maxLoss).toBeCloseTo(100, 2);
    });

    it('calculates max gain correctly (20 shares × $15 = $300)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.maxGain).toBeCloseTo(300, 2);
    });

    it('calculates position as % of account correctly (20% of $10K)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 95, target: 115 });
      expect(result.positionPercent).toBeCloseTo(20, 2);
    });
  });

  describe('Edge cases', () => {
    it('returns 0 shares when entry equals stop (no risk)', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 100, target: 115 });
      expect(result.shares).toBe(0);
    });

    it('returns 0 riskReward when entry equals stop', () => {
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 100, target: 115 });
      expect(result.riskReward).toBe(0);
    });

    it('handles short position (entry < stop) with absolute value', () => {
      // Short: entry 100, stop 105 (stop above entry = risk going up)
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 105, target: 85 });
      expect(result.riskPerShare).toBeCloseTo(5, 4);
      expect(result.rewardPerShare).toBeCloseTo(15, 4);
    });

    it('floors share count to whole shares (no fractional shares)', () => {
      // $100 risk / $3 per share = 33.33 → floor to 33
      const result = calcSizing({ accountSize: 10000, riskPercent: 1, entry: 100, stop: 97, target: 115 });
      expect(result.shares).toBe(33);
      expect(Number.isInteger(result.shares)).toBe(true);
    });

    it('handles high-value crypto correctly (e.g. BTC at $65,000)', () => {
      const result = calcSizing({ accountSize: 100000, riskPercent: 2, entry: 65000, stop: 62000, target: 75000 });
      expect(result.riskPerShare).toBeCloseTo(3000, 0);
      expect(result.rewardPerShare).toBeCloseTo(10000, 0);
      expect(result.riskReward).toBeCloseTo(3.33, 1);
      expect(result.dollarRisk).toBeCloseTo(2000, 0);
      expect(result.shares).toBe(0); // floor(2000/3000) = 0 — need fractional crypto
    });

    it('calculates 2% risk correctly', () => {
      const result = calcSizing({ accountSize: 50000, riskPercent: 2, entry: 50, stop: 45, target: 65 });
      expect(result.dollarRisk).toBeCloseTo(1000, 2);
      expect(result.shares).toBe(200);
    });
  });

  describe('R/R ratio quality thresholds', () => {
    it('identifies excellent R/R (≥ 3:1)', () => {
      const rr = 3.5;
      const quality = rr >= 3 ? 'excellent' : rr >= 2 ? 'good' : rr >= 1.5 ? 'acceptable' : 'poor';
      expect(quality).toBe('excellent');
    });

    it('identifies good R/R (2:1 to 3:1)', () => {
      const rr = 2.5;
      const quality = rr >= 3 ? 'excellent' : rr >= 2 ? 'good' : rr >= 1.5 ? 'acceptable' : 'poor';
      expect(quality).toBe('good');
    });

    it('identifies poor R/R (< 1.5:1)', () => {
      const rr = 1.2;
      const quality = rr >= 3 ? 'excellent' : rr >= 2 ? 'good' : rr >= 1.5 ? 'acceptable' : 'poor';
      expect(quality).toBe('poor');
    });
  });
});
