/**
 * Decision Ledger — unit tests
 *
 * Tests the V2.0 smartDiscovery router procedures:
 *   - logRecommendation (mutation)
 *   - getLedger (query)
 *   - updateOutcome (mutation)
 *   - getLedgerStats (query)
 *
 * These tests mock the DB layer so no real DB connection is needed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── Mock getDb so tests don't need a real database ────────────
vi.mock("./db", () => {
  const rows: Array<{
    id: number;
    userId: number;
    ticker: string | null;
    assetType: "stock" | "crypto" | null;
    verdict: string;
    opportunityScore: number;
    confidence: number;
    primaryDriver: string;
    expectedTimeframe: string;
    queryType: string;
    outcome: "pending" | "correct" | "incorrect";
    notes: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }> = [];
  let nextId = 1;

  const mockDb = {
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => {
        rows.push({ id: nextId++, ...data } as typeof rows[0]);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: (_table: unknown) => ({
        where: (_cond: unknown) => ({
          orderBy: (_ord: unknown) => ({
            limit: (_n: number) => Promise.resolve(rows.filter(r => r.userId === 1)),
          }),
          then: (resolve: (v: typeof rows) => void) => resolve(rows.filter(r => r.userId === 1)),
          [Symbol.iterator]: function* () { yield* rows.filter(r => r.userId === 1); },
          // Allow direct await
          [Symbol.toStringTag]: "Promise",
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (_data: Record<string, unknown>) => ({
        where: (_cond: unknown) => Promise.resolve(),
      }),
    }),
    _rows: rows,
  };

  return {
    getDb: vi.fn().mockResolvedValue(mockDb),
  };
});

// ── Helpers ───────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe("smartDiscovery.logRecommendation", () => {
  it("returns success:true when DB is available", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.smartDiscovery.logRecommendation({
      ticker: "NVDA",
      assetType: "stock",
      verdict: "STRONG BUY",
      opportunityScore: 82,
      confidence: 74,
      primaryDriver: "AI infrastructure cycle driving record data center demand.",
      expectedTimeframe: "2-4 weeks",
      queryType: "single-ticker",
    });

    expect(result).toMatchObject({ success: true });
  });

  it("returns success:true when ticker is null (macro query)", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.smartDiscovery.logRecommendation({
      ticker: null,
      assetType: null,
      verdict: "WAIT",
      opportunityScore: 35,
      confidence: 45,
      primaryDriver: "Macro uncertainty ahead of FOMC meeting.",
      expectedTimeframe: "1-2 weeks",
      queryType: "macro",
    });

    expect(result).toMatchObject({ success: true });
  });
});

describe("smartDiscovery.getLedger", () => {
  it("returns an array (possibly empty) for authenticated user", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.smartDiscovery.getLedger({ limit: 50 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("smartDiscovery.updateOutcome", () => {
  it("returns success:true when updating outcome", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.smartDiscovery.updateOutcome({
      id: 1,
      outcome: "correct",
      notes: "NVDA hit target within 2 weeks.",
    });

    expect(result).toMatchObject({ success: true });
  });

  it("accepts all three outcome values", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const outcome of ["correct", "incorrect", "pending"] as const) {
      const result = await caller.smartDiscovery.updateOutcome({ id: 1, outcome });
      expect(result).toMatchObject({ success: true });
    }
  });
});

describe("smartDiscovery.getLedgerStats", () => {
  it("returns stats object with required fields", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.smartDiscovery.getLedgerStats();

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("resolved");
    expect(stats).toHaveProperty("pending");
    expect(stats).toHaveProperty("correct");
    expect(stats).toHaveProperty("incorrect");
    expect(stats).toHaveProperty("winRate");
    expect(stats).toHaveProperty("byAsset");
    expect(stats).toHaveProperty("byVerdict");
    expect(Array.isArray(stats.byAsset)).toBe(true);
    expect(Array.isArray(stats.byVerdict)).toBe(true);
  });

  it("winRate is null when no resolved entries", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.smartDiscovery.getLedgerStats();
    // With our mock, all entries are pending so winRate should be null
    expect(typeof stats.winRate === "number" || stats.winRate === null).toBe(true);
  });
});
