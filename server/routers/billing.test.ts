import { describe, expect, it } from "vitest";
import { PRICING_PLANS } from "../../shared/tiers";
import { PLANS } from "../stripe/products";
import { billingRouter, isPlanAvailableForPurchase } from "./billing";
import type { TrpcContext } from "../_core/context";

function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function authCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      email: "test@faultline.app",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00Z"),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("billing plan availability lock", () => {
  it("opens only Standard and Lifetime, and only when a Stripe price ID is configured", () => {
    expect(PRICING_PLANS.lifetime.available).toBe(true);
    expect(isPlanAvailableForPurchase("lifetime", "price_test_lifetime_1500")).toBe(true);
    expect(isPlanAvailableForPurchase("lifetime", null)).toBe(false);
    expect(isPlanAvailableForPurchase("premium", "price_test_99")).toBe(true);
    expect(isPlanAvailableForPurchase("premium", null)).toBe(false);
    expect(isPlanAvailableForPurchase("core_annual", "price_test_annual")).toBe(false);
    expect(isPlanAvailableForPurchase("premium_annual", "price_test_annual")).toBe(false);
    expect(isPlanAvailableForPurchase("core", "price_test_core")).toBe(false);
    expect(isPlanAvailableForPurchase("core", null)).toBe(false);
    expect(isPlanAvailableForPurchase("founding", "price_test_founding")).toBe(false);
  });

  it("getPlans publishes available only when the product lock and price ID both allow it", async () => {
    const plans = await billingRouter.createCaller(publicCtx()).getPlans();
    for (const plan of plans) {
      expect(plan.available).toBe(isPlanAvailableForPurchase(plan.id, PLANS[plan.id].priceId));
    }
    expect(plans.map(plan => plan.id)).toEqual(["premium", "lifetime"]);
    expect(plans.map(plan => plan.amount)).toEqual([9900, 150000]);
  });

  it("rejects checkout when the plan's Stripe price is not configured or verified", async () => {
    await expect(billingRouter.createCaller(authCtx()).createCheckout({ planId: "premium", origin: "https://faultline.app" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(billingRouter.createCaller(authCtx()).createCheckout({ planId: "lifetime", origin: "https://faultline.app" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects createCheckout for plans with available:false", async () => {
    const caller = billingRouter.createCaller(authCtx());
    await expect(caller.createCheckout({ planId: "founding", origin: "https://faultline.app" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This plan is not yet available for purchase. Please contact us.",
    });
    await expect(caller.createCheckout({ planId: "core_annual", origin: "https://faultline.app" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.createCheckout({ planId: "premium_annual", origin: "https://faultline.app" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
