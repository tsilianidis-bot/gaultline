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

const vector = (id: string, score: number, trend = "stable") => ({ id, label: id, score, driver: `${id} driver`, trend });
const pressure = (vectors: unknown[], overrides: Record<string, unknown> = {}) => ({
  overallPressure: 33, regime: "Moderate Risk", level: "MODERATE", vectors, alerts: [],
  topAnalog: { label: "2019", description: "Mid-cycle", similarity: 40 }, analogs: [],
  timestamp: "2026-10-02T12:00:00.000Z", dataSource: "live", lastUpdated: "2026-10-02T12:00:00.000Z", priorPressure: null,
  ...overrides,
});
const ALL = ["ai-bubble", "volatility-regime", "macro-sensitivity", "liquidity-stress", "credit-contagion"];
const VECTOR_METRICS = ["ai-bubble-exposure", "rate-sensitivity", "liquidity-risk", "recession-exposure"];

async function metrics(vectors: unknown[], overrides: Record<string, unknown> = {}) {
  mocks.pressure.mockResolvedValue(pressure(vectors, overrides));
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
    // A missing vector has no trend (no icon), never a "stable" default.
    for (const id of VECTOR_METRICS) expect(byId[id].trend).toBeNull();
    // Metrics not built from vectors are unchanged.
    expect(byId["portfolio-pressure"].score).toBe(33);
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

  it("a vector's own trend still passes through when it is present", async () => {
    const byId = await metrics(ALL.map(id => vector(id, 60, "rising")));
    expect(VECTOR_METRICS.map(id => byId[id].trend)).toEqual(["rising", "rising", "rising", "rising"]);
  });
});

const positions = (n: number) => Array.from({ length: n }, (_, k) => ({ id: k, ticker: `T${k}`, assetType: "Stock" }));

describe("portfolio.getIntelligence: concentration with no positions (r10)", () => {
  it("0 positions gives null / No positions / neutral colour, never 50 Elevated", async () => {
    const c = (await metrics(ALL.map(id => vector(id, 60))))["concentration-risk"];
    expect(c.score).toBeNull();
    expect(c.level).toBe("No positions");
    expect(c.color).toBe("#64748B");
    expect(c.driver).toBe("No positions tracked");
  });

  it("the position-count heuristic is unchanged for 1 or more positions", async () => {
    const expected: Array<[number, number, string]> = [[1, 90, "Critical"], [3, 75, "Critical"], [6, 55, "Elevated"], [10, 35, "Moderate"], [11, 20, "Moderate"]];
    for (const [n, score, level] of expected) {
      mocks.positions.mockResolvedValue(positions(n));
      const c = (await metrics(ALL.map(id => vector(id, 60))))["concentration-risk"];
      expect([c.score, c.level]).toEqual([score, level]);
    }
  });
});

describe("portfolio.getIntelligence: crash vulnerability and regime alignment fail closed (r10)", () => {
  const BAD = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, "40"];

  it("a missing or non-finite analog similarity makes crash vulnerability null / Unavailable", async () => {
    for (const similarity of BAD) {
      const byId = await metrics(ALL.map(id => vector(id, 60)), { topAnalog: { label: "2019", description: "Mid-cycle", similarity } });
      const crash = byId["crash-vulnerability"];
      expect([crash.score, crash.level, crash.color, crash.trend, crash.driver]).toEqual([null, "Unavailable", "#64748B", null, ""]);
      expect(crash.description).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(byId["regime-alignment"].score).toBe(67); // pressure 33 is present
    }
    const noAnalog = await metrics(ALL.map(id => vector(id, 60)), { topAnalog: undefined });
    expect(noAnalog["crash-vulnerability"].score).toBeNull();
  });

  it("a missing or non-finite overall pressure makes crash vulnerability and regime alignment null / Unavailable", async () => {
    for (const overallPressure of BAD) {
      const byId = await metrics(ALL.map(id => vector(id, 60)), { overallPressure });
      for (const id of ["crash-vulnerability", "regime-alignment"]) {
        const m = byId[id];
        expect([m.score, m.level, m.color, m.trend, m.driver]).toEqual([null, "Unavailable", "#64748B", null, ""]);
      }
    }
  });

  it("with full inputs both still score as before", async () => {
    const byId = await metrics(ALL.map(id => vector(id, 60)));
    // round(40 * 0.85 + 33 * 0.15) = 39; max(0, 100 - 33) = 67
    expect([byId["crash-vulnerability"].score, byId["crash-vulnerability"].level, byId["crash-vulnerability"].trend]).toEqual([39, "Moderate", "stable"]);
    expect(byId["crash-vulnerability"].description).toBe("Current conditions match 2019 (40% similarity)");
    expect([byId["regime-alignment"].score, byId["regime-alignment"].level, byId["regime-alignment"].trend]).toEqual([67, "High", "rising"]);
  });
});
