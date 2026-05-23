import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock DB helpers ───────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserTier: vi.fn().mockResolvedValue("free"),
    setUserTier: vi.fn().mockResolvedValue(undefined),
    createFoundingRequest: vi.fn().mockResolvedValue(42),
    getFoundingRequests: vi.fn().mockResolvedValue([]),
    updateFoundingRequestStatus: vi.fn().mockResolvedValue(undefined),
    getAllUsersWithTier: vi.fn().mockResolvedValue([]),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  return makeCtx({ role: "admin", id: 99 });
}

// ── user.getAccessTier ────────────────────────────────────────
describe("user.getAccessTier", () => {
  it("returns tier for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.user.getAccessTier();
    expect(result).toEqual({ tier: "free" });
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.user.getAccessTier()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ── user.getProfile ───────────────────────────────────────────
describe("user.getProfile", () => {
  it("returns user profile with tier", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.user.getProfile();
    expect(result).toMatchObject({
      id: 1,
      email: "test@example.com",
      accessTier: "free",
    });
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.user.getProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ── user.requestFoundingAccess ────────────────────────────────
describe("user.requestFoundingAccess", () => {
  it("allows public user to submit a founding access request", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.user.requestFoundingAccess({
      email: "investor@fund.com",
      name: "Jane Investor",
      message: "I manage a macro fund.",
    });
    expect(result).toEqual({ success: true, id: 42 });
  });

  it("allows authenticated user to submit a founding access request", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.user.requestFoundingAccess({
      email: "test@example.com",
    });
    expect(result).toEqual({ success: true, id: 42 });
  });

  it("rejects invalid email", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.user.requestFoundingAccess({ email: "not-an-email" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ── admin.setUserTier ─────────────────────────────────────────
describe("admin.setUserTier", () => {
  it("admin can set a user's tier", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.setUserTier({ userId: 1, tier: "premium" });
    expect(result).toEqual({ success: true });
  });

  it("non-admin cannot set a user's tier", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.admin.setUserTier({ userId: 1, tier: "premium" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("unauthenticated user cannot set a user's tier", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.admin.setUserTier({ userId: 1, tier: "premium" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ── admin.getFoundingRequests ─────────────────────────────────
describe("admin.getFoundingRequests", () => {
  it("admin can list founding requests", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getFoundingRequests();
    expect(Array.isArray(result)).toBe(true);
  });

  it("non-admin cannot list founding requests", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.admin.getFoundingRequests()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ── admin.updateFoundingRequestStatus ────────────────────────
describe("admin.updateFoundingRequestStatus", () => {
  it("admin can approve a founding request", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.updateFoundingRequestStatus({
      id: 1,
      status: "approved",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects invalid status values", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(
      caller.admin.updateFoundingRequestStatus({
        id: 1,
        status: "invalid" as "approved",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
