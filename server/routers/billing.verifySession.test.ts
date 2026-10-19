import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

let retrieveImpl: (...a: unknown[]) => Promise<unknown> = async () => null;
let called = 0;
vi.mock("../stripe/client", () => ({
  stripe: { checkout: { sessions: { retrieve: (...a: unknown[]) => { called++; return retrieveImpl(...a); } } } },
  stripeRuntimeMode: "test",
  requireStripe: () => ({}),
}));

import { billingRouter } from "./billing";

function ctx(user: { id: number } | null): TrpcContext {
  return {
    user: user ? ({ id: user.id, email: "u@example.com", name: "U", role: "user" } as any) : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

const paidSession = {
  status: "complete",
  payment_status: "paid",
  amount_total: 9900,
  currency: "usd",
  client_reference_id: "1",
  customer_email: "secret@example.com",
  metadata: { plan_id: "premium", user_id: "1", customer_email: "secret@example.com" },
};

describe("billing.verifyCheckoutSession (D4)", () => {
  beforeEach(() => { retrieveImpl = async () => null; called = 0; });

  it("rejects unauthenticated callers without touching Stripe", async () => {
    await expect(billingRouter.createCaller(ctx(null)).verifyCheckoutSession({ sessionId: "cs_1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(called).toBe(0);
  });

  it("returns the owner's session without any customer email", async () => {
    retrieveImpl = async () => paidSession;
    const out = await billingRouter.createCaller(ctx({ id: 1 })).verifyCheckoutSession({ sessionId: "cs_1" });
    expect(out).toEqual({ status: "complete", paymentStatus: "paid", amountTotal: 9900, currency: "usd", planId: "premium" });
    expect(JSON.stringify(out)).not.toContain("secret@example.com");
    expect(out).not.toHaveProperty("customerEmail");
  });

  it("returns null for a session that belongs to another user", async () => {
    retrieveImpl = async () => paidSession;
    expect(await billingRouter.createCaller(ctx({ id: 2 })).verifyCheckoutSession({ sessionId: "cs_1" })).toBeNull();
  });

  it("returns null when the session has no owner reference", async () => {
    retrieveImpl = async () => ({ ...paidSession, client_reference_id: null, metadata: { plan_id: "premium" } });
    expect(await billingRouter.createCaller(ctx({ id: 1 })).verifyCheckoutSession({ sessionId: "cs_1" })).toBeNull();
  });

  it("returns null when Stripe lookup fails", async () => {
    retrieveImpl = async () => { throw new Error("No such session"); };
    expect(await billingRouter.createCaller(ctx({ id: 1 })).verifyCheckoutSession({ sessionId: "cs_x" })).toBeNull();
  });
});
