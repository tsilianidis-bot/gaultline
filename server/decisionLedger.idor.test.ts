/**
 * updateOutcome must change only the caller's decision_ledger row.
 * An id-only WHERE lets a second principal overwrite the owner's outcome.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";

type LedgerRow = {
  id: number;
  userId: number;
  outcome: string;
  notes: string | null;
};

const state = vi.hoisted(() => ({
  rows: [] as LedgerRow[],
}));

const dialect = new MySqlDialect();

function whereOwnsRow(row: LedgerRow, condition: unknown): boolean {
  const compiled = dialect.sqlToQuery(condition as SQL);
  const sqlText = compiled.sql;
  if (!/`id`/.test(sqlText) || !/`userId`/.test(sqlText)) return false;
  return compiled.params.includes(row.id) && compiled.params.includes(row.userId);
}

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    update: () => ({
      set: (data: { outcome?: string; notes?: string | null }) => ({
        where: async (condition: unknown) => {
          for (const row of state.rows) {
            if (!whereOwnsRow(row, condition)) continue;
            if (typeof data.outcome === "string") row.outcome = data.outcome;
            if ("notes" in data) row.notes = data.notes ?? null;
          }
        },
      }),
    }),
  })),
}));

vi.mock("./yahooProxy", () => ({
  getQuote: vi.fn(async () => ({ price: 100 })),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `principal-${userId}`,
    email: `principal-${userId}@example.com`,
    name: `Principal ${userId}`,
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

describe("smartDiscovery.updateOutcome owner scope", () => {
  beforeEach(() => {
    state.rows.splice(0, state.rows.length,
      { id: 10, userId: 1, outcome: "pending", notes: null },
      { id: 11, userId: 2, outcome: "pending", notes: null },
    );
  });

  it("lets the owner update their row and leaves the other principal's row unchanged", async () => {
    const { smartDiscoveryRouter } = await import("./routers/smartDiscovery");
    const owner = smartDiscoveryRouter.createCaller(createAuthContext(1));
    const other = smartDiscoveryRouter.createCaller(createAuthContext(2));

    await expect(owner.updateOutcome({ id: 10, outcome: "correct", notes: "owner resolution" })).resolves.toEqual({ success: true });
    await expect(other.updateOutcome({ id: 10, outcome: "incorrect", notes: "cross-account write" })).resolves.toEqual({ success: true });
    await expect(other.updateOutcome({ id: 11, outcome: "incorrect", notes: "own resolution" })).resolves.toEqual({ success: true });
    await expect(owner.updateOutcome({ id: 11, outcome: "correct", notes: "cross-account write" })).resolves.toEqual({ success: true });

    expect(state.rows.find(row => row.id === 10)).toMatchObject({
      userId: 1,
      outcome: "correct",
      notes: "owner resolution",
    });
    expect(state.rows.find(row => row.id === 11)).toMatchObject({
      userId: 2,
      outcome: "incorrect",
      notes: "own resolution",
    });
  });
});
