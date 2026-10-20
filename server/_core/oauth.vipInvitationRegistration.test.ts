import { describe, expect, it } from "vitest";
import { canRegisterWithVipInvitation } from "./oauth";

describe("VIP invitation registration exception", () => {
  const claim = { invitationId: 41 };

  it("does not reopen registration without a current server-validated invitation claim", () => {
    expect(canRegisterWithVipInvitation(null, "recipient@example.test")).toBe(
      false
    );
  });

  it("does not create an account without an email supplied by the identity provider", () => {
    expect(canRegisterWithVipInvitation(claim, null)).toBe(false);
    expect(canRegisterWithVipInvitation(claim, "")).toBe(false);
    expect(canRegisterWithVipInvitation(claim, "not-an-email")).toBe(false);
  });

  it("permits only a pending claim plus provider email through the existing OAuth callback", () => {
    expect(canRegisterWithVipInvitation(claim, "recipient@example.test")).toBe(
      true
    );
  });
});
