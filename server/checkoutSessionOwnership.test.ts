import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const retrieve = vi.hoisted(() => vi.fn());
vi.mock("./stripe/client", () => ({
  stripe: { checkout: { sessions: { retrieve } } },
}));

import { billingRouter } from "./routers/billing";

function ctx(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function principal(id: number, email: string, role: "user" | "admin" = "user", openId = `open-${id}`) {
  return {
    id,
    openId,
    email,
    name: email,
    loginMethod: "manus",
    role,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00Z"),
  } as NonNullable<TrpcContext["user"]>;
}

describe("verifyCheckoutSession ownership", () => {
  beforeEach(() => {
    retrieve.mockReset();
  });

  it("does not read Stripe for an anonymous caller", async () => {
    const result = await billingRouter.createCaller(ctx(null)).verifyCheckoutSession({ sessionId: "cs_user_a" });
    expect(result).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns user A's receipt to user A and nothing to user B, an admin, or the owner", async () => {
    retrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      amount_total: 9900,
      currency: "usd",
      customer_email: "a@example.com",
      client_reference_id: "11",
      metadata: { user_id: "11", plan_id: "premium", customer_email: "a@example.com" },
    });
    const userA = principal(11, "a@example.com");
    const userB = principal(22, "b@example.com");
    const admin = principal(1, "admin@example.com", "admin");
    const owner = principal(2, "owner@example.com", "user", "owner-open-id");

    const owned = await billingRouter.createCaller(ctx(userA)).verifyCheckoutSession({ sessionId: "cs_user_a" });
    expect(owned).toMatchObject({ paymentStatus: "paid", amountTotal: 9900, customerEmail: "a@example.com" });

    for (const caller of [userB, admin, owner]) {
      const hidden = await billingRouter.createCaller(ctx(caller)).verifyCheckoutSession({ sessionId: "cs_user_a" });
      expect(hidden).toBeNull();
      expect(JSON.stringify(hidden)).not.toContain("a@example.com");
    }
  });
});
