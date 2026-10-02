/**
 * PR #58 r9: portfolio.getIntelligence (/app/portfolio) never defaults a missing vector score to 50.
 * A missing or non-finite vector gives a null score, level "Unavailable" and a neutral colour, and
 * nothing is derived from it. Mocked pressure engine and DB only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ pressure: vi.fn(), positions: vi.fn() }));
vi.mock("./pressure/engine", async importOriginal => ({
  ...(await importOriginal<typeof import("./pressure/engine")>()),
  calculateFaultlinePressure: mocks.pressure,
}));
vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getUserTier: async () => "core",
  getPositionsByUser: mocks.positions,
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
const ctx = (): TrpcContext => ({
  user: { id: 7, openId: "user-7", email: "u7@example.com", name: "Test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as AuthenticatedUser,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
});

const vector = (id: string, score: number) => ({ id, label: id, score, driver: `${id} driver`, trend: "stable" });
const pressure = (vectors: unknown[]) => ({
  overallPressure: 33, regime: "Moderate Risk", level: "MODERATE", vectors, alerts: [],
  topAnalog: { label: "2019", description: "Mid-cycle", similarity: 40 }, analogs: [],
  timestamp: "2026-10-02T12:00:00.000Z", dataSource: "live", lastUpdated: "2026-10-02T12:00:00.000Z", priorPressure: null,
});
const ALL = ["ai-bubble", "volatility-regime", "macro-sensitivity", "liquidity-stress", "credit-contagion"];
const VECTOR_METRICS = ["ai-bubble-exposure", "rate-sensitivity", "liquidity-risk", "recession-exposure"];

async function metrics(vectors: unknown[]) {
  mocks.pressure.mockResolvedValue(pressure(vectors));
  const result = await appRouter.createCaller(ctx()).portfolio.getIntelligence();
  return Object.fromEntries(result.metrics.map(m => [m.id, m]));
}

beforeEach(() => {
  mocks.pressure.mockReset();
  mocks.positions.mockReset().mockResolvedValue([]);
});

describe("portfolio.getIntelligence fails closed on missing vector scores", () => {
  it("with no vectors, every vector-derived metric is null / Unavailable, never 50", async () => {
    const byId = await metrics([]);
    for (const id of VECTOR_METRICS) {
      expect(byId[id].score).toBeNull();
      expect(byId[id].level).toBe("Unavailable");
      expect(byId[id].color).toBe("#64748B");
    }
    // Metrics not built from vectors are unchanged.
    expect(byId["portfolio-pressure"].score).toBe(33);
    expect(byId["concentration-risk"].score).toBe(50); // 0 positions: the position-count heuristic, not a vector default
  });

  it("a non-finite vector score is treated as missing", async () => {
    const byId = await metrics(ALL.map(id => vector(id, id === "ai-bubble" ? Number.NaN : 40)));
    expect(byId["ai-bubble-exposure"].score).toBeNull();
    expect(byId["liquidity-risk"].score).toBe(40);
  });

  it("a composite with one missing input is null, not half a default", async () => {
    const byId = await metrics(ALL.filter(id => id !== "macro-sensitivity").map(id => vector(id, 80)));
    expect(byId["rate-sensitivity"].score).toBeNull();
    expect(byId["recession-exposure"].score).toBeNull();
    expect(byId["ai-bubble-exposure"].score).toBe(80);
    expect(byId["liquidity-risk"].score).toBe(80);

    const noVol = await metrics(ALL.filter(id => id !== "volatility-regime").map(id => vector(id, 80)));
    expect(noVol["rate-sensitivity"].score).toBeNull();
    expect(noVol["recession-exposure"].score).toBe(80);

    const noCredit = await metrics(ALL.filter(id => id !== "credit-contagion").map(id => vector(id, 80)));
    expect(noCredit["recession-exposure"].score).toBeNull();
    expect(noCredit["rate-sensitivity"].score).toBe(80);
  });

  it("present vectors still score as before", async () => {
    const byId = await metrics(ALL.map(id => vector(id, 60)));
    expect(VECTOR_METRICS.map(id => byId[id].score)).toEqual([60, 60, 60, 60]);
    expect(VECTOR_METRICS.map(id => byId[id].level)).toEqual(["High", "High", "High", "High"]);
  });
});
