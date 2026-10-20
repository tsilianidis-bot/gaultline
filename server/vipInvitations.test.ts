import { afterEach, describe, expect, it, vi } from "vitest";

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "issue-111-test-secret";

const service = await import("./vipInvitations");

afterEach(() => {
  vi.useRealTimers();
  process.env.JWT_SECRET = "issue-111-test-secret";
});

describe("VIP invitation security primitives", () => {
  it("creates 256-bit URL-safe tokens and persists only a non-reversible hash", () => {
    const token = service.createVipInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(service.hashVipInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hashVipInvitationToken(token)).not.toContain(token);
  });

  it("signs a token-free claim cookie and rejects tampering", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const cookie = service.createVipInviteClaimCookie({
      invitationId: 44,
      expiresAt,
    });
    expect(cookie).not.toContain("raw-invitation-token");
    expect(service.parseVipInviteClaimCookie(cookie)).toMatchObject({
      invitationId: 44,
    });
    expect(
      service.parseVipInviteClaimCookie(cookie.replace(".44.", ".45."))
    ).toBeNull();
  });

  it("fails closed when the signed claim expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T10:00:00.000Z"));
    const cookie = service.createVipInviteClaimCookie({
      invitationId: 9,
      expiresAt: new Date("2026-10-20T10:00:10.000Z"),
    });
    vi.setSystemTime(new Date("2026-10-20T10:00:10.001Z"));
    expect(service.parseVipInviteClaimCookie(cookie)).toBeNull();
  });

  it("uses exact seven-day link expiry and thirty-day access expiry", () => {
    const starts = new Date("2026-10-20T00:00:00.000Z");
    expect(
      service.addUtcDays(starts, service.VIP_INVITATION_DAYS).toISOString()
    ).toBe("2026-10-27T00:00:00.000Z");
    expect(
      service.addUtcDays(starts, service.VIP_GUEST_ACCESS_DAYS).toISOString()
    ).toBe("2026-11-19T00:00:00.000Z");
  });

  it("elevates only free/core users while preserving paid and founding tiers", () => {
    expect(service.resolveVipEffectiveTier("free", false)).toBe("free");
    expect(service.resolveVipEffectiveTier("free", true)).toBe("premium");
    expect(service.resolveVipEffectiveTier("core", true)).toBe("premium");
    expect(service.resolveVipEffectiveTier("premium", true)).toBe("premium");
    expect(service.resolveVipEffectiveTier("founding", true)).toBe("founding");
  });
});

if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
else process.env.JWT_SECRET = originalJwtSecret;
