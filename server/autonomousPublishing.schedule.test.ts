import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
const authenticateRequest = vi.hoisted(() => vi.fn());
const calculateFaultlinePressure = vi.hoisted(() => vi.fn());
const effectiveTier = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const dispatchEmailWithClaim = vi.hoisted(() => vi.fn());
const publishingClaimStore = vi.hoisted(() => ({}));

vi.mock("./db", () => ({
  getDb,
  effectiveTier,
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./pressure/engine", () => ({ calculateFaultlinePressure }));
vi.mock("./email", () => ({ sendEmail }));
vi.mock("./publishingDeliveryClaims", () => ({
  briefDeliveryKey: (slug: string, userId: number) => `brief:${slug}:user:${userId}`,
  dispatchEmailWithClaim,
  publishingClaimStore,
}));

import {
  getPublishingAutomationGate,
  handleDailyBrief,
  notifyUsersByTier,
} from "./autonomousPublishing";

function scheduleDb(isActive: boolean | undefined) {
  const limit = vi.fn().mockResolvedValue(isActive === undefined ? [] : [{ isActive }]);
  const from = vi.fn(() => ({ limit }));
  return { select: vi.fn(() => ({ from })) };
}

function subscriberDb() {
  const limit = vi.fn().mockResolvedValue([
    { id: 9, name: "Recipient", email: "recipient@example.test", accessTier: "premium", lifetimeAccess: false, accessExpiresAt: null },
  ]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from })) };
}

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { json, status } };
}

describe("scheduled publishing activation and delivery boundaries", () => {
  beforeEach(() => {
    getDb.mockReset();
    authenticateRequest.mockReset();
    calculateFaultlinePressure.mockReset();
    effectiveTier.mockReset();
    sendEmail.mockReset();
    dispatchEmailWithClaim.mockReset();
  });

  it("preserves the historical active default only when no schedule record exists", async () => {
    getDb.mockResolvedValue(scheduleDb(undefined));
    await expect(getPublishingAutomationGate()).resolves.toBe("active");
    getDb.mockResolvedValue(scheduleDb(false));
    await expect(getPublishingAutomationGate()).resolves.toBe("inactive");
  });

  it("fails closed when the schedule store is unavailable", async () => {
    getDb.mockResolvedValue(null);
    await expect(getPublishingAutomationGate()).resolves.toBe("unavailable");
  });

  it("does not collect engine data or acquire a run while the owner pause is active", async () => {
    getDb.mockResolvedValue(scheduleDb(false));
    authenticateRequest.mockResolvedValue({ isCron: true, role: "user" });
    const { json, res } = response();
    await handleDailyBrief({} as never, res as never);
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ ok: true, status: "skipped", reason: "publishing-inactive" });
  });

  it("does not report a subscriber email as accepted when its durable dispatch reports rejection", async () => {
    getDb.mockResolvedValue(subscriberDb());
    effectiveTier.mockReturnValue("premium");
    dispatchEmailWithClaim.mockResolvedValue({ status: "rejected" });
    await expect(notifyUsersByTier("Brief", "brief", "Daily Intelligence Brief"))
      .resolves.toEqual({ eligible: 1, emailed: 0 });
    expect(dispatchEmailWithClaim).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
