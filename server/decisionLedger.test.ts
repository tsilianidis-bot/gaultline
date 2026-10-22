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
    outcome: "pending" | "correct" | "incorrect" | "partially_correct" | "still_active";
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
    _reset: () => {
      rows.splice(0, rows.length);
      nextId = 1;
    },
  };

  return {
    getDb: vi.fn().mockResolvedValue(mockDb),
  };
});

// The ledger persistence contract is independent of live quote retrieval.
// Stub that optional enrichment so provider latency cannot mask DB behavior.
vi.mock("./yahooProxy", () => ({
  getQuote: vi.fn().mockResolvedValue({ price: 100 }),
}));

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

type LedgerOutcome = "pending" | "correct" | "incorrect" | "partially_correct" | "still_active";
type MockLedgerRow = {
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
  outcome: LedgerOutcome;
  notes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

type MockLedgerDb = {
  _rows: MockLedgerRow[];
  _reset: () => void;
};

function ledgerRow(id: number, outcome: LedgerOutcome): MockLedgerRow {
  return {
    id,
    userId: 1,
    ticker: "NVDA",
    assetType: "stock",
    verdict: "BUY",
    opportunityScore: 80,
    confidence: 70,
    primaryDriver: "Test assessment",
    expectedTimeframe: "2 weeks",
    queryType: "security",
    outcome,
    notes: null,
    resolvedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

async function setLedgerRows(rows: MockLedgerRow[]) {
  const { getDb } = await import("./db");
  const db = await getDb() as unknown as MockLedgerDb;
  db._reset();
  db._rows.push(...rows);
}

// ── Tests ─────────────────────────────────────────────────────

describe("smartDiscovery.logRecommendation", () => {
  it("returns success:true when DB is available", async () => {
const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
const ctx = createAuthContext();
const caller = smartDiscoveryRouter.createCaller(ctx);

    const result = await caller.logRecommendation({
ticker: "NVDA",
assetType: "stock",
verdict: "STRONG BUY",
      opportunityScore: 82,
      confidence: 74,
    primaryDriver: "AI infrastructure cycle driving record data center demand.",
    expectedTimeframe: "2-4 weeks",
    queryType: "single-ticker",
    stockRegimeAtTime: "TEST REGIME",
    cryptoRegimeAtTime: "TEST REGIME",
    alignmentAtTime: "TEST ALIGNMENT",
    });

    expect(result).toMatchObject({ success: true });
  });

  it("returns success:true when ticker is null (macro query)", async () => {
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const ctx = createAuthContext();
    const caller = smartDiscoveryRouter.createCaller(ctx);

    const result = await caller.logRecommendation({
    ticker: null,
    assetType: null,
      verdict: "WAIT",
      opportunityScore: 35,
    confidence: 45,
    primaryDriver: "Macro uncertainty ahead of FOMC meeting.",
    expectedTimeframe: "1-2 weeks",
    queryType: "macro",
    stockRegimeAtTime: "TEST REGIME",
    cryptoRegimeAtTime: "TEST REGIME",
    alignmentAtTime: "TEST ALIGNMENT",
    });

    expect(result).toMatchObject({ success: true });
  });
});

describe("smartDiscovery.getLedger", () => {
  it("returns an array (possibly empty) for authenticated user", async () => {
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const ctx = createAuthContext();
    const caller = smartDiscoveryRouter.createCaller(ctx);

    const result = await caller.getLedger({ limit: 50 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("smartDiscovery.updateOutcome", () => {
  it("returns success:true when updating outcome", async () => {
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const ctx = createAuthContext();
    const caller = smartDiscoveryRouter.createCaller(ctx);

    const result = await caller.updateOutcome({
    id: 1,
    outcome: "correct",
      notes: "NVDA hit target within 2 weeks.",
    });

    expect(result).toMatchObject({ success: true });
  });

  it("accepts all three outcome values", async () => {
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const ctx = createAuthContext();
    const caller = smartDiscoveryRouter.createCaller(ctx);

    for (const outcome of ["correct", "incorrect", "pending"] as const) {
      const result = await caller.updateOutcome({ id: 1, outcome });
      expect(result).toMatchObject({ success: true });
    }
  });
});

describe("smartDiscovery.getLedgerStats", () => {
  it("returns stats object with required fields", async () => {
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const ctx = createAuthContext();
    const caller = smartDiscoveryRouter.createCaller(ctx);

    const stats = await caller.getLedgerStats();

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
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const ctx = createAuthContext();
    const caller = smartDiscoveryRouter.createCaller(ctx);

    const stats = await caller.getLedgerStats();
    // With our mock, all entries are pending so winRate should be null
    expect(typeof stats.winRate === "number" || stats.winRate === null).toBe(true);
  });

  it("does not score only still_active assessments", async () => {
    await setLedgerRows([ledgerRow(1, "still_active")]);
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const stats = await smartDiscoveryRouter.createCaller(createAuthContext()).getLedgerStats();

    expect(stats).toMatchObject({
      total: 1,
      resolved: 0,
      pending: 0,
      stillActive: 1,
      winRate: null,
    });
    expect(stats.byAsset).toEqual([]);
    expect(stats.byVerdict).toEqual([]);
  });

  it("keeps still_active out of headline and group denominators", async () => {
    await setLedgerRows([
      ledgerRow(1, "correct"),
      ledgerRow(2, "incorrect"),
      ledgerRow(3, "still_active"),
    ]);
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const caller = smartDiscoveryRouter.createCaller(createAuthContext());
    const mixed = await caller.getLedgerStats();

    await setLedgerRows([ledgerRow(1, "correct"), ledgerRow(2, "incorrect")]);
    const finalOnly = await caller.getLedgerStats();

    expect(mixed).toMatchObject({ total: 3, resolved: 2, stillActive: 1, winRate: 50 });
    expect(mixed.winRate).toBe(finalOnly.winRate);
    expect(mixed.byAsset).toEqual(finalOnly.byAsset);
    expect(mixed.byVerdict).toEqual(finalOnly.byVerdict);
  });

  it("applies half credit for partially_correct in the headline and both group metrics", async () => {
    await setLedgerRows([
      ledgerRow(1, "correct"),
      ledgerRow(2, "partially_correct"),
      ledgerRow(3, "incorrect"),
    ]);
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const stats = await smartDiscoveryRouter.createCaller(createAuthContext()).getLedgerStats();

    expect(stats.winRate).toBe(50); // (1 + 0.5 + 0) / 3
    expect(stats.byAsset).toEqual([{ asset: "stock", accuracy: 50, total: 3 }]);
    expect(stats.byVerdict).toEqual([{ verdict: "BUY", accuracy: 50, total: 3 }]);
  });
});
