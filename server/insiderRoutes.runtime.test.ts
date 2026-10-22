import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const INSIDER_UNAVAILABLE = "Insider Intelligence unavailable: source verification required.";

function makeUser(): User {
  return {
    id: 1,
    openId: "insider-contained-test",
    name: "Contained Insider Test",
    email: "contained-insider@example.com",
    loginMethod: "manus",
    role: "user",
    accessTier: "free",
    dashboardMode: "pulse",
    preflightPromptMode: "full_guidance",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00Z"),
  };
}

function makeCaller() {
  const ctx: TrpcContext = {
    user: makeUser(),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("contained insider procedure callers", () => {
  it("radar returns SERVICE_UNAVAILABLE for an authenticated caller", async () => {
    await expect(makeCaller().insider.radar()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: INSIDER_UNAVAILABLE,
    });
  });

  it("company returns SERVICE_UNAVAILABLE for an authenticated caller", async () => {
    await expect(makeCaller().insider.company({ ticker: "NVDA" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: INSIDER_UNAVAILABLE,
    });
  });

  it("tickerAlert returns SERVICE_UNAVAILABLE for an authenticated caller", async () => {
    await expect(makeCaller().insider.tickerAlert({ ticker: "NVDA" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: INSIDER_UNAVAILABLE,
    });
  });
});
