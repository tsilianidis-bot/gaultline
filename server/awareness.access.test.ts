/**
 * awareness.access.test.ts
 *
 * Verifies that the Market Preflight / Complete Market Awareness™ procedures
 * enforce the correct access control after the coreProcedure → protectedProcedure fix.
 *
 * User states tested:
 *   1. Anonymous visitor (user = null)            → UNAUTHORIZED
 *   2. Free-tier logged-in user (accessTier=free) → allowed (was FORBIDDEN before fix)
 *   3. Core-tier logged-in user                   → allowed
 *   4. Founding-tier logged-in user (owner)       → allowed
 *
 * Procedures tested:
 *   - awareness.getScore
 *   - awareness.getHistory
 *   - awareness.logAction
 *   - awareness.getPreflightMode  (was already protectedProcedure — regression check)
 *   - awareness.setPreflightMode  (was already protectedProcedure — regression check)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
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
    ...overrides,
  };
}

function makeCtx(user: User | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Mock the DB helpers so tests don't need a real database ──────────────────

vi.mock("./marketAwareness", () => ({
  ACTION_KEYS: ["viewed_dashboard", "viewed_scores", "viewed_signals"] as const,
  logMarketAwarenessAction: vi.fn().mockResolvedValue(undefined),
  computeAwarenessScore: vi.fn().mockResolvedValue({
    score: 42,
    label: "Partial Awareness",
    color: "#F59E0B",
    completedKeys: ["viewed_dashboard"],
    missingKeys: ["viewed_scores", "viewed_signals"],
    totalPossible: 10,
    completedCount: 1,
  }),
  getRecentActions: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, actionKey: "viewed_dashboard", sourcePage: "dashboard", metadata: null, createdAt: new Date() },
  ]),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserTier: vi.fn().mockResolvedValue("free"),
    getDb: vi.fn().mockResolvedValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ preflightPromptMode: "full_guidance" }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("awareness.getScore", () => {
  it("throws UNAUTHORIZED for anonymous visitor (user = null)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.awareness.getScore()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("allows free-tier logged-in user (was FORBIDDEN before fix)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    const result = await caller.awareness.getScore();
    expect(result).toMatchObject({ score: expect.any(Number) });
  });

  it("allows core-tier logged-in user", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "core" })));
    const result = await caller.awareness.getScore();
    expect(result).toMatchObject({ score: expect.any(Number) });
  });

  it("allows founding-tier logged-in user (owner)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "founding", role: "admin" })));
    const result = await caller.awareness.getScore();
    expect(result).toMatchObject({ score: expect.any(Number) });
  });
});

describe("awareness.getHistory", () => {
  it("throws UNAUTHORIZED for anonymous visitor (user = null)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.awareness.getHistory()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("allows free-tier logged-in user (was FORBIDDEN before fix)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    const result = await caller.awareness.getHistory();
    expect(Array.isArray(result)).toBe(true);
  });

  it("allows founding-tier logged-in user", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "founding" })));
    const result = await caller.awareness.getHistory();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("awareness.logAction", () => {
  it("throws UNAUTHORIZED for anonymous visitor (user = null)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.awareness.logAction({ actionKey: "viewed_dashboard", sourcePage: "dashboard" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows free-tier logged-in user to log an action (was FORBIDDEN before fix)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    const result = await caller.awareness.logAction({
      actionKey: "viewed_dashboard",
      sourcePage: "dashboard",
    });
    expect(result).toEqual({ success: true });
  });

  it("allows founding-tier logged-in user to log an action", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "founding" })));
    const result = await caller.awareness.logAction({
      actionKey: "viewed_dashboard",
      sourcePage: "dashboard",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects invalid actionKey", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    await expect(
      caller.awareness.logAction({ actionKey: "invalid_key_xyz" as any })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("awareness.getPreflightMode (regression — was already protectedProcedure)", () => {
  it("throws UNAUTHORIZED for anonymous visitor", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.awareness.getPreflightMode()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("allows free-tier logged-in user", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    const result = await caller.awareness.getPreflightMode();
    expect(result).toMatchObject({ mode: expect.stringMatching(/^(full_guidance|minimal_reminders|off)$/) });
  });
});

describe("awareness.setPreflightMode (regression — was already protectedProcedure)", () => {
  it("throws UNAUTHORIZED for anonymous visitor", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.awareness.setPreflightMode({ mode: "minimal_reminders" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows free-tier logged-in user to change preference", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    const result = await caller.awareness.setPreflightMode({ mode: "minimal_reminders" });
    expect(result).toMatchObject({ success: true, mode: "minimal_reminders" });
  });
});

describe("no permission regressions — coreProcedure procedures still require core+ tier", () => {
  it("portfolio.getPositions still throws FORBIDDEN for free-tier user", async () => {
    // getUserTier mock returns 'free' — coreProcedure should still block this
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "free" })));
    await expect(caller.portfolio.getPositions()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("portfolio.getPositions allows founding-tier user", async () => {
    const { getUserTier } = await import("./db");
    vi.mocked(getUserTier).mockResolvedValueOnce("founding");
    const caller = appRouter.createCaller(makeCtx(makeUser({ accessTier: "founding" })));
    // This calls the DB for positions — mock returns empty array via getPositionsByUser
    // We just verify no FORBIDDEN is thrown
    await expect(caller.portfolio.getPositions()).resolves.toBeDefined();
  });
});
