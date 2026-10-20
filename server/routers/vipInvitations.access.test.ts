import { describe, expect, it } from "vitest";
import { vipInvitationRouter } from "./vipInvitations";

const nonOwner: any = {
  id: 19,
  openId: "member-19",
  name: "Member",
  email: "member@example.test",
  loginMethod: "test",
  role: "user",
  accessTier: "free",
  dashboardMode: "pulse",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("VIP invitation owner boundary", () => {
  it("denies invitation creation before any database or token operation for a non-admin", async () => {
    const caller = vipInvitationRouter.createCaller({
      user: nonOwner,
      req: {
        protocol: "https",
        headers: { host: "faultline.test" },
        get: () => "faultline.test",
      },
      res: {},
    } as any);
    await expect(
      caller.adminCreate({ label: "must not create" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
