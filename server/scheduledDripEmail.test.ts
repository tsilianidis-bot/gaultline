import { beforeEach, describe, expect, it, vi } from "vitest";

const getUsersPendingDripStep = vi.hoisted(() => vi.fn());
const recordOnboardingEmailSent = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({
  getUsersPendingDripStep,
  recordOnboardingEmailSent,
}));
vi.mock("./email", () => ({
  sendEmail,
  buildDay1PressureEmail: ({ email }: { email: string }) => ({ to: email, subject: "day-1", html: "" }),
  buildDay2UpgradeEmail: ({ email }: { email: string }) => ({ to: email, subject: "day-2", html: "" }),
  buildDay3FoundingEmail: ({ email }: { email: string }) => ({ to: email, subject: "day-3", html: "" }),
}));

import { handleDripEmail } from "./scheduledDripEmail";

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { json, status } };
}

describe("scheduled drip email delivery receipts", () => {
  beforeEach(() => {
    getUsersPendingDripStep.mockReset();
    recordOnboardingEmailSent.mockReset();
    sendEmail.mockReset();
  });

  it("keeps a step pending when the email provider returns success:false", async () => {
    getUsersPendingDripStep.mockImplementation(async (step: number) => step === 1
      ? [{ id: 7, name: "Recipient", email: "recipient@example.test", accessTier: "free" }]
      : []);
    sendEmail.mockResolvedValue({ success: false, error: "provider unavailable" });
    const { json, res } = response();

    await handleDripEmail({ url: "/api/scheduled/drip-email" } as never, res as never);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(recordOnboardingEmailSent).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, sent1: 0, sent2: 0, sent3: 0 }));
  });

  it("records only accepted deliveries and marks a paid user through the non-email Day 3 step", async () => {
    getUsersPendingDripStep.mockImplementation(async (step: number) => {
      if (step === 1) return [{ id: 1, name: "One", email: "one@example.test", accessTier: "free" }];
      if (step === 2) return [{ id: 2, name: "Two", email: "two@example.test", accessTier: "free" }];
      return [{ id: 3, name: "Three", email: "three@example.test", accessTier: "premium" }];
    });
    sendEmail.mockResolvedValue({ success: true });
    recordOnboardingEmailSent.mockResolvedValue(undefined);
    const { json, res } = response();

    await handleDripEmail({ url: "/api/scheduled/drip-email" } as never, res as never);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(recordOnboardingEmailSent).toHaveBeenNthCalledWith(1, 1, 1);
    expect(recordOnboardingEmailSent).toHaveBeenNthCalledWith(2, 2, 2);
    expect(recordOnboardingEmailSent).toHaveBeenNthCalledWith(3, 3, 3);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, sent1: 1, sent2: 1, sent3: 0 }));
  });
});
