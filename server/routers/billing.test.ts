import { describe, expect, it } from "vitest";
import { PRICING_PLANS, CHECKOUT_ENABLED, LIFETIME_TERMS, LIFETIME_FINAL_SALE_NOTICE } from "../../shared/tiers";
import { readFileSync } from "node:fs";
import { PLANS } from "../stripe/products";
import { billingReturnOrigin, billingRouter, buildCheckoutSessionParams, isPlanAvailableForPurchase } from "./billing";
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

describe("billing return origin", () => {
  const nonProduction = { NODE_ENV: "test" } as const;

  it("allows exact HTTPS production apex/www entries and the explicit local nonproduction entry", () => {
    expect(billingReturnOrigin("https://getfaultline.live", "https://getfaultline.live", { NODE_ENV: "production" })).toBe("https://getfaultline.live");
    expect(billingReturnOrigin("https://www.getfaultline.live", "https://www.getfaultline.live", { NODE_ENV: "production" })).toBe("https://getfaultline.live");
    expect(billingReturnOrigin("http://localhost:5173", "http://localhost:5173", nonProduction)).toBe("http://localhost:5173");
    expect(billingReturnOrigin("http://localhost:5173", "http://localhost:5173", { NODE_ENV: "production" })).toBeNull();
  });

  it("rejects matching hostile values, mismatches, lookalikes, HTTP production, and production ports", () => {
    expect(billingReturnOrigin("https://attacker.invalid", "https://attacker.invalid", nonProduction)).toBeNull();
    expect(billingReturnOrigin("https://attacker.invalid", "https://getfaultline.live")).toBeNull();
    expect(billingReturnOrigin("https://www.getfaultline.live", "https://getfaultline.live", nonProduction)).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live.attacker.invalid", "https://getfaultline.live.attacker.invalid", nonProduction)).toBeNull();
    expect(billingReturnOrigin("http://getfaultline.live", "http://getfaultline.live", nonProduction)).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live:8443", "https://getfaultline.live:8443", nonProduction)).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live:443", "https://getfaultline.live:443", nonProduction)).toBeNull();
  });

  it("rejects malformed, credentialed, path-bearing, query/hash, or missing request origins", () => {
    expect(billingReturnOrigin("https://getfaultline.live/checkout", "https://getfaultline.live")).toBeNull();
    expect(billingReturnOrigin("https://user:pass@getfaultline.live", "https://getfaultline.live")).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live?next=attacker", "https://getfaultline.live")).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live#attacker", "https://getfaultline.live")).toBeNull();
    expect(billingReturnOrigin("ftp://getfaultline.live", "ftp://getfaultline.live")).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live", undefined)).toBeNull();
    expect(billingReturnOrigin("https://getfaultline.live", ["https://getfaultline.live"])).toBeNull();
  });

  it("permits staging only when explicitly server-configured outside production", () => {
    const staging = "https://staging.faultline.example";
    const localProxy = "http://127.0.0.1:4173";
    expect(billingReturnOrigin(staging, staging, nonProduction)).toBeNull();
    expect(billingReturnOrigin(localProxy, localProxy, nonProduction)).toBeNull();
    expect(billingReturnOrigin(staging, staging, {
      NODE_ENV: "test",
      BILLING_RETURN_ORIGIN_ALLOWLIST: `${staging}, ${localProxy}`,
    })).toBe(staging);
    expect(billingReturnOrigin(localProxy, localProxy, {
      NODE_ENV: "test",
      BILLING_RETURN_ORIGIN_ALLOWLIST: `${staging}, ${localProxy}`,
    })).toBe(localProxy);
    expect(billingReturnOrigin(staging, staging, {
      NODE_ENV: "production",
      BILLING_RETURN_ORIGIN_ALLOWLIST: staging,
    })).toBeNull();
  });

  it("defensively refuses attacker origins passed directly to checkout-param construction", () => {
    expect(() => buildCheckoutSessionParams({
      userId: 1,
      planId: "premium",
      priceId: "price_test_premium",
      interval: "month",
      origin: "https://attacker.invalid",
    })).toThrow("approved billing return origin");
    const params = buildCheckoutSessionParams({
      userId: 1,
      planId: "premium",
      priceId: "price_test_premium",
      interval: "month",
      origin: "https://www.getfaultline.live",
    });
    expect(params.success_url).toMatch(/^https:\/\/getfaultline\.live\//);
    expect(params.cancel_url).toMatch(/^https:\/\/getfaultline\.live\//);
  });
});

describe("billing plan availability lock", () => {
  it("keeps checkout OFF (CHECKOUT_ENABLED=false) even with a Stripe price ID configured", () => {
    expect(CHECKOUT_ENABLED).toBe(false);
    expect(PRICING_PLANS.lifetime.available).toBe(true);
    expect(isPlanAvailableForPurchase("lifetime", "price_test_lifetime_1500")).toBe(false);
    expect(isPlanAvailableForPurchase("lifetime", null)).toBe(false);
    expect(isPlanAvailableForPurchase("premium", "price_test_99")).toBe(false);
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

  it("Lifetime terms: final sale, no refund window, shown on /pricing card and Terms", () => {
    expect(LIFETIME_FINAL_SALE_NOTICE).toBe("All Lifetime purchases are final and non-refundable.");
    expect(LIFETIME_TERMS).toContain(LIFETIME_FINAL_SALE_NOTICE);
    expect(LIFETIME_TERMS.join(" ")).not.toMatch(/14-day|refund window|full refund/i);
    const offer = readFileSync("client/src/components/MembershipOffer.tsx", "utf8");
    expect(offer).toContain("data-lifetime-final-sale");
    expect(offer).toContain("data-lifetime-terms");
    expect(offer).toContain("data-checkout-coming-soon");
    expect(readFileSync("client/src/pages/Legal.tsx", "utf8")).toContain("LIFETIME_TERMS");
  });
});
