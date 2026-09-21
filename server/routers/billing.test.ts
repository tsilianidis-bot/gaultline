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
  it("keeps Lifetime unavailable even when a Stripe price ID is present", () => {
    expect(PRICING_PLANS.lifetime.available).toBe(false);
    expect(isPlanAvailableForPurchase("lifetime", "price_test_lifetime_299")).toBe(false);
    expect(isPlanAvailableForPurchase("lifetime", PLANS.lifetime.priceId)).toBe(false);
    expect(isPlanAvailableForPurchase("core_annual", "price_test_annual")).toBe(false);
    expect(isPlanAvailableForPurchase("premium_annual", "price_test_annual")).toBe(false);
    expect(isPlanAvailableForPurchase("core", "price_test_core")).toBe(true);
    expect(isPlanAvailableForPurchase("core", null)).toBe(false);
    expect(isPlanAvailableForPurchase("founding", "price_test_founding")).toBe(true);
  });

  it("getPlans publishes available only when the product lock and price ID both allow it", async () => {
    const plans = await billingRouter.createCaller(publicCtx()).getPlans();
    for (const plan of plans) {
      expect(plan.available).toBe(isPlanAvailableForPurchase(plan.id, PLANS[plan.id].priceId));
    }
    expect(plans.find((plan) => plan.id === "lifetime")?.available).toBe(false);
  });

  it("rejects createCheckout for plans with available:false", async () => {
    const caller = billingRouter.createCaller(authCtx());
    await expect(caller.createCheckout({ planId: "lifetime", origin: "https://faultline.app" })).rejects.toMatchObject({
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
