import { beforeEach, describe, expect, it, vi } from "vitest";

const getUsersPendingDripStep = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const dispatchEmailWithClaim = vi.hoisted(() => vi.fn());
const claimDelivery = vi.hoisted(() => vi.fn());
const markDeliverySkipped = vi.hoisted(() => vi.fn());
const publishingClaimStore = vi.hoisted(() => ({ claimDelivery, markDeliverySkipped }));

vi.mock("./db", () => ({ getUsersPendingDripStep }));
vi.mock("./email", () => ({
  sendEmail,
  buildDay1PressureEmail: ({ email }: { email: string }) => ({ to: email, subject: "day-1", html: "" }),
  buildDay2UpgradeEmail: ({ email }: { email: string }) => ({ to: email, subject: "day-2", html: "" }),
  buildDay3FoundingEmail: ({ email }: { email: string }) => ({ to: email, subject: "day-3", html: "" }),
}));
vi.mock("./publishingDeliveryClaims", () => ({
  dispatchEmailWithClaim,
  onboardingDeliveryKey: (step: number, userId: number) => `onboarding:${step}:user:${userId}`,
  publishingClaimStore,
}));

import { handleDripEmail } from "./scheduledDripEmail";

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { json, status } };
}

describe("scheduled drip durable delivery claims", () => {
  beforeEach(() => {
    getUsersPendingDripStep.mockReset();
    sendEmail.mockReset();
    dispatchEmailWithClaim.mockReset();
    claimDelivery.mockReset();
    markDeliverySkipped.mockReset();
  });

  it("does not count a step when the claim-gated provider boundary explicitly rejects it", async () => {
    getUsersPendingDripStep.mockImplementation(async (step: number) => step === 1
      ? [{ id: 7, name: "Recipient", email: "recipient@example.test", accessTier: "free" }]
      : []);
    dispatchEmailWithClaim.mockImplementation(async (_store: unknown, input: { send: () => Promise<{ success: boolean }> }) => {
      await input.send();
      return { status: "rejected" };
    });
    sendEmail.mockResolvedValue({ success: false, error: "provider unavailable" });
    const { json, res } = response();
    await handleDripEmail({ url: "/api/scheduled/drip-email" } as never, res as never);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, sent1: 0, sent2: 0, sent3: 0 }));
  });

  it("counts only provider acceptance and persists a paid Day 3 policy skip without invoking transport", async () => {
    getUsersPendingDripStep.mockImplementation(async (step: number) => {
      if (step === 1) return [{ id: 1, name: "One", email: "one@example.test", accessTier: "free" }];
      if (step === 2) return [{ id: 2, name: "Two", email: "two@example.test", accessTier: "free" }];
      return [{ id: 3, name: "Three", email: "three@example.test", accessTier: "premium" }];
    });
    dispatchEmailWithClaim.mockImplementation(async (_store: unknown, input: { send: () => Promise<{ success: boolean }> }) => {
      await input.send();
      return { status: "accepted" };
    });
    sendEmail.mockResolvedValue({ success: true });
    claimDelivery.mockResolvedValue({
      status: "claimed",
      claim: { key: "onboarding:3:user:3", deliveryType: "onboarding_day_3", userId: 3, attemptId: "a", attempt: 1 },
    });
    markDeliverySkipped.mockResolvedValue(true);
    const { json, res } = response();
    await handleDripEmail({ url: "/api/scheduled/drip-email" } as never, res as never);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(markDeliverySkipped).toHaveBeenCalledWith(expect.objectContaining({ userId: 3 }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, sent1: 1, sent2: 1, sent3: 0 }));
  });
});
