/**
 * Checkout guards against a mocked Stripe client.
 * These tests do not call Stripe. A mocked sessions.create is not end-to-end verification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../stripe/client", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: "https://checkout.stripe.test/cs_test_mock_only" })),
      },
    },
  },
  stripeRuntimeMode: "test",
}));

vi.mock("../stripe/products", () => ({
  PLANS: {
    core: { id: "core", name: "FAULTLINE Trader", description: "", priceId: "price_mock_core", amount: 5900, interval: "month", tier: "core" },
    core_annual: { id: "core_annual", name: "FAULTLINE Trader (Annual)", description: "", priceId: "price_mock_core_annual", amount: 0, interval: "year", tier: "core" },
    premium: { id: "premium", name: "FAULTLINE Intelligence", description: "", priceId: "price_mock_99", amount: 9900, interval: "month", tier: "premium" },
    premium_annual: { id: "premium_annual", name: "FAULTLINE Power (Annual)", description: "", priceId: "price_mock_annual", amount: 0, interval: "year", tier: "premium" },
    founding: { id: "founding", name: "FAULTLINE Founding Member", description: "", priceId: "price_mock_founding", amount: 4900, interval: "month", tier: "founding" },
    lifetime: { id: "lifetime", name: "FAULTLINE Lifetime", description: "", priceId: "price_mock_1500", amount: 150000, interval: "one_time", tier: "founding" },
  },
  verifyStripePlanConfiguration: vi.fn(async () => ({ verified: true as const })),
}));

import { stripe } from "../stripe/client";
import { billingRouter } from "./billing";
import { CHECKOUT_ALLOWLIST_COPY, CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY } from "../../shared/checkoutAccess";

const createSession = stripe!.checkout.sessions.create as unknown as ReturnType<typeof vi.fn>;

function authCtx(overrides: { id?: number; email?: string } = {}): TrpcContext {
  return {
    user: {
      id: overrides.id ?? 42,
      openId: "test-open-id",
      email: overrides.email ?? "member@faultline.app",
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

function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  createSession.mockClear();
  process.env.CHECKOUT_RUNTIME_ENABLED = "true";
  delete process.env.CHECKOUT_ALLOWLIST_ONLY;
  delete process.env.CHECKOUT_ALLOWLIST_USER_IDS;
  delete process.env.CHECKOUT_ALLOWLIST_EMAILS;
});

afterEach(() => {
  delete process.env.CHECKOUT_RUNTIME_ENABLED;
  delete process.env.CHECKOUT_ALLOWLIST_ONLY;
  delete process.env.CHECKOUT_ALLOWLIST_USER_IDS;
  delete process.env.CHECKOUT_ALLOWLIST_EMAILS;
});

describe("createCheckout guards (mocked Stripe client, not a Stripe API call)", () => {
  it("does not open a session for the Trader plan id", async () => {
    await expect(billingRouter.createCaller(authCtx()).createCheckout({
      planId: "core",
      origin: "https://faultline.app",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This plan is not yet available for purchase. Please contact us.",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects Intelligence when the runtime kill switch is off and does not call Stripe", async () => {
    delete process.env.CHECKOUT_RUNTIME_ENABLED;
    await expect(billingRouter.createCaller(authCtx()).createCheckout({
      planId: "premium",
      origin: "https://faultline.app",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY,
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("denies everyone when allowlist mode is on and the lists are empty", async () => {
    process.env.CHECKOUT_ALLOWLIST_ONLY = "true";
    await expect(billingRouter.createCaller(authCtx()).createCheckout({
      planId: "lifetime",
      origin: "https://faultline.app",
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: CHECKOUT_ALLOWLIST_COPY });
    const plans = await billingRouter.createCaller(publicCtx()).getPlans();
    expect(plans.every(plan => plan.available === false && plan.blockedReason === "allowlist")).toBe(true);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("opens a mocked session only for an allowlisted account and only for the two public plans", async () => {
    process.env.CHECKOUT_ALLOWLIST_ONLY = "true";
    process.env.CHECKOUT_ALLOWLIST_EMAILS = "member@faultline.app";
    const allowed = billingRouter.createCaller(authCtx());
    const premium = await allowed.createCheckout({ planId: "premium", origin: "https://getfaultline.live" });
    const lifetime = await allowed.createCheckout({ planId: "lifetime", origin: "https://getfaultline.live" });
    expect(premium.url).toContain("checkout.stripe.test");
    expect(lifetime.url).toContain("checkout.stripe.test");
    expect(createSession).toHaveBeenCalledTimes(2);
    const modes = createSession.mock.calls.map(call => (call[0] as { mode: string }).mode);
    expect(modes).toEqual(["subscription", "payment"]);
    const priceIds = createSession.mock.calls.map(call => (call[0] as { line_items: { price: string }[] }).line_items[0].price);
    expect(priceIds).toEqual(["price_mock_99", "price_mock_1500"]);

    await expect(billingRouter.createCaller(authCtx({ id: 99, email: "other@faultline.app" })).createCheckout({
      planId: "premium",
      origin: "https://getfaultline.live",
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: CHECKOUT_ALLOWLIST_COPY });
    expect(createSession).toHaveBeenCalledTimes(2);
  });
});
