import { describe, it, expect } from "vitest";

/**
 * Validates that all four live-mode Stripe price IDs are set in the environment.
 * These IDs were updated from test-mode to live-mode to fix the "No such price" checkout error.
 */
describe("Live Stripe Price IDs", () => {
  const EXPECTED_PLANS = [
    { env: "STRIPE_CORE_PRICE_ID",     label: "Core $9.99/mo",       expectedPrefix: "price_" },
    { env: "STRIPE_PREMIUM_PRICE_ID",  label: "Trader $59/mo",       expectedPrefix: "price_" },
    { env: "STRIPE_FOUNDING_PRICE_ID", label: "Founding $49/mo",     expectedPrefix: "price_" },
    { env: "STRIPE_LIFETIME_PRICE_ID", label: "Lifetime $299 once",  expectedPrefix: "price_" },
  ];

  for (const plan of EXPECTED_PLANS) {
    it(`${plan.label} — ${plan.env} is set and has correct prefix`, () => {
      const val = process.env[plan.env];
      expect(val, `${plan.env} must be set`).toBeTruthy();
      expect(val!.startsWith(plan.expectedPrefix), `${plan.env} must start with "price_"`).toBe(true);
      expect(val!.length, `${plan.env} must be a full price ID (>= 20 chars)`).toBeGreaterThanOrEqual(20);
    });
  }

  it("all four price IDs are distinct (no duplicates)", () => {
    const ids = [
      process.env.STRIPE_CORE_PRICE_ID,
      process.env.STRIPE_PREMIUM_PRICE_ID,
      process.env.STRIPE_FOUNDING_PRICE_ID,
      process.env.STRIPE_LIFETIME_PRICE_ID,
    ].filter(Boolean);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("live price IDs match the expected live-mode values", () => {
    expect(process.env.STRIPE_CORE_PRICE_ID).toBe("price_1TcdXSDlVkahIFK8mqjKOpfB");
    expect(process.env.STRIPE_PREMIUM_PRICE_ID).toBe("price_1TcdgGDlVkahIFK8QM0txjAB");
    expect(process.env.STRIPE_FOUNDING_PRICE_ID).toBe("price_1TcdgIDlVkahIFK8KwBlWrvW");
    expect(process.env.STRIPE_LIFETIME_PRICE_ID).toBe("price_1TcdgKDlVkahIFK855FfdepH");
  });
});
