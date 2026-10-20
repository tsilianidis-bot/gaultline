import { describe, expect, it } from "vitest";
import { ENV } from "../_core/env";
import { checkoutReceiptForCaller, isOwnerOrAdmin, toPublicAuthUser } from "./access";

const owner = "owner-open-id";
const userA = { id: 11, role: "user", openId: "user-a", email: "a@example.com", adminNotes: "note-a", stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_a" };
const userB = { id: 22, role: "user", openId: "user-b", email: "b@example.com", adminNotes: "note-b", stripeCustomerId: "cus_b", stripeSubscriptionId: "sub_b" };
const admin = { id: 1, role: "admin", openId: "admin-open", email: "admin@example.com", adminNotes: "staff", stripeCustomerId: "cus_admin", stripeSubscriptionId: null };
const ownerUser = { id: 2, role: "user", openId: owner, email: "owner@example.com", adminNotes: "owner note", stripeCustomerId: "cus_owner", stripeSubscriptionId: "sub_owner" };

describe("owner and admin principals", () => {
  it("admits an admin and the owner, and refuses members, cron, and anonymous", () => {
    expect(isOwnerOrAdmin(admin, owner)).toBe(true);
    expect(isOwnerOrAdmin(ownerUser, owner)).toBe(true);
    expect(isOwnerOrAdmin(userA, owner)).toBe(false);
    expect(isOwnerOrAdmin(userB, owner)).toBe(false);
    expect(isOwnerOrAdmin({ role: "admin", openId: "cron", isCron: true }, owner)).toBe(false);
    expect(isOwnerOrAdmin(null, owner)).toBe(false);
    expect(isOwnerOrAdmin(userA, "")).toBe(false);
  });
});

describe("auth.me public user", () => {
  it("returns null for an anonymous caller and strips internal fields for each signed-in principal", () => {
    expect(toPublicAuthUser(null)).toBeNull();
    for (const principal of [userA, userB, admin, ownerUser]) {
      const published = toPublicAuthUser(principal);
      expect(published).toMatchObject({
        id: principal.id,
        email: principal.email,
        role: principal.role,
        isOwnerOrAdmin: principal.role === "admin",
      });
      expect(published).not.toHaveProperty("adminNotes");
      expect(published).not.toHaveProperty("stripeCustomerId");
      expect(published).not.toHaveProperty("stripeSubscriptionId");
      expect(JSON.stringify(published)).not.toContain(principal.adminNotes);
    }
    expect(toPublicAuthUser(userA)).not.toMatchObject({ email: userB.email });
    ENV.ownerOpenId = owner;
    expect(toPublicAuthUser(ownerUser).isOwnerOrAdmin).toBe(true);
    expect(toPublicAuthUser(userA).isOwnerOrAdmin).toBe(false);
    expect(toPublicAuthUser({ ...admin, isCron: true }).isOwnerOrAdmin).toBe(false);
    ENV.ownerOpenId = "";
  });
});

describe("checkout receipt ownership", () => {
  const session = {
    clientReferenceId: "11",
    metadataUserId: "11",
    status: "complete",
    paymentStatus: "paid",
    amountTotal: 9900,
    currency: "usd",
    planId: "premium",
    customerEmail: "a@example.com",
  };

  it("shows the receipt only to the session owner", () => {
    expect(checkoutReceiptForCaller(null, session)).toBeNull();
    expect(checkoutReceiptForCaller(userB, session)).toBeNull();
    expect(checkoutReceiptForCaller(admin, session)).toBeNull();
    expect(checkoutReceiptForCaller(ownerUser, session)).toBeNull();
    expect(checkoutReceiptForCaller(userA, session)).toMatchObject({
      paymentStatus: "paid",
      amountTotal: 9900,
      customerEmail: "a@example.com",
      planId: "premium",
    });
  });

  it("does not copy a Stripe email that is not the caller's email", () => {
    const receipt = checkoutReceiptForCaller(userA, { ...session, customerEmail: "other@example.com" });
    expect(receipt?.customerEmail).toBeNull();
    expect(receipt?.amountTotal).toBe(9900);
  });
});
