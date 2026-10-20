/**
 * A thrown day-trade symbol setup must not invent a price or confidence of 0.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const setup = vi.hoisted(() => vi.fn());

vi.mock("./dayTradeEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dayTradeEngine")>();
  return { ...actual, dayTradeSymbolSetup: setup };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getUserTier: vi.fn(async () => "core" as const) };
});

import { appRouter } from "./routers";

function caller() {
  const user = {
    id: 1,
    openId: "core-user",
    email: "core@example.com",
    name: "Core User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as NonNullable<TrpcContext["user"]>;
  return appRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

describe("dayTrade.symbolSetup provider failure", () => {
  beforeEach(() => {
    setup.mockReset();
    setup.mockRejectedValue(new Error("all providers failed"));
  });

  it("returns null price and confidence instead of fabricated zeros", async () => {
    const report = await caller().dayTrade.symbolSetup({
      symbol: "nvda",
      assetType: "stock",
      direction: "both",
    });

    expect(report.currentPrice).toBeNull();
    expect(report.confidence).toBeNull();
    expect(report.setupType).toBe("NO_TRADE");
    expect(report.symbol).toBe("NVDA");
  });
});
