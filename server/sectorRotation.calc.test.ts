/**
 * Sector Rotation calculations. All market series below are SYNTHETIC TEST
 * FIXTURES generated in this file — they exist only for tests and are never
 * shipped or used as a fallback.
 */
import { describe, expect, it } from "vitest";
import {
  alignToBenchmark, buildSectorRotationReading, classifyAction, classifyCatalyst, classifyQuadrant, completedReturn, computeRrg,
  dailyChange, earlyIndicator, etWallToUtc, explains, findDiscontinuity, findUntraceableNumbers, isSessionComplete, latestRrg,
  momentumArrow, rankBy, sectorBreadth, sessionCompletedAt, splitBars, thesisAlignment, volumeRatio,
  APPROVED_NEWS_PUBLISHERS, EXPLICIT_COMPANY_ALIASES, buildAliasIndex, isApprovedPublisher, normalizeCompanyName, normalizePublisher, qualifyNewsItem,
  type ChartInput, type InputBar, type NewsItemInput, type SectorRotationInputs, type UniverseMember,
} from "./sectorRotation/calc";
import { CATALYST_UNCLEAR_TEXT, SECTOR_ETFS, type SectorEtfTicker } from "../shared/sectorRotation";

// ── Synthetic fixture helpers (test-only) ────────────────────────────────────
function weekdaysEndingOn(last: string, count: number): string[] {
  const out: string[] = [];
  let t = Date.parse(`${last}T12:00:00Z`);
  while (out.length < count) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.unshift(d.toISOString().slice(0, 10));
    t -= 86_400_000;
  }
  return out;
}
const SESSIONS = weekdaysEndingOn("2026-10-02", 130);
const AFTER_CLOSE = etWallToUtc("2026-10-02", 18, 0);
const toBars = (closes: number[], vols?: number[], sessions = SESSIONS): InputBar[] =>
  closes.map((close, i) => ({ timestamp: etWallToUtc(sessions[sessions.length - closes.length + i], 9, 30), close, volume: vols?.[i] ?? 1_000_000 }));
const chart = (ticker: string, closes: number[], vols?: number[], extra: Partial<ChartInput> = {}): ChartInput => ({ ticker, bars: toBars(closes, vols), regularMarketTime: null, ...extra });
const spyCloses = SESSIONS.map((_, i) => 400 * Math.pow(1.0004, i));
const n = SESSIONS.length;
/** RS paths that put a sector in a known quadrant. */
const RS_PATH: Record<string, (i: number) => number> = {
  LEADING: i => Math.exp(0.00002 * i * i),
  LAGGING: i => Math.exp(-0.00002 * i * i),
  IMPROVING: i => (i < n - 12 ? Math.exp(-0.002 * i) : Math.exp(-0.002 * (n - 12)) * Math.exp(0.0015 * (i - (n - 12)))),
  LOSING_MOMENTUM: i => (i < n - 12 ? Math.exp(0.002 * i) : Math.exp(0.002 * (n - 12)) * Math.exp(-0.003 * (i - (n - 12)))),
};
const sectorCloses = (path: (i: number) => number) => spyCloses.map((s, i) => (s * path(i)) / 10);
const DESIGN: Record<SectorEtfTicker, keyof typeof RS_PATH> = { XLK: "LEADING", XLC: "LEADING", XLF: "IMPROVING", XLI: "IMPROVING", XLE: "LOSING_MOMENTUM", XLY: "LOSING_MOMENTUM", XLU: "LAGGING", XLP: "LAGGING", XLV: "LAGGING", XLB: "LAGGING", XLRE: "LAGGING" };

function stockCloses(seed: number, lastMovePct: number): number[] {
  const closes = SESSIONS.map((_, i) => 50 + seed + 0.05 * i * ((seed % 3) - 1));
  closes[n - 1] = closes[n - 2] * (1 + lastMovePct / 100);
  return closes;
}
function universe(count: number): UniverseMember[] {
  return Array.from({ length: count }, (_, i) => ({ ticker: `S${String(i).padStart(2, "0")}`, name: `Stock ${i}`, sectorEtf: SECTOR_ETFS[i % 11].ticker }));
}
function baseInputs(overrides: Partial<SectorRotationInputs> = {}): SectorRotationInputs {
  const members = universe(44);
  const charts: SectorRotationInputs["charts"] = { SPY: chart("SPY", spyCloses) };
  for (const etf of SECTOR_ETFS) charts[etf.ticker] = chart(etf.ticker, sectorCloses(RS_PATH[DESIGN[etf.ticker]]));
  const stockCharts: SectorRotationInputs["stockCharts"] = {};
  members.forEach((m, i) => { stockCharts[m.ticker] = chart(m.ticker, stockCloses(i, (i % 2 ? -1 : 1) * (i + 1) * 0.25), undefined, { companyName: `Company ${i}` }); });
  return {
    now: AFTER_CLOSE,
    canonical: { stateId: "state:test", stateHash: "h", stateGeneratedAt: "2026-10-02T18:00:00.000Z", runId: null, regime: "MODERATE RISK", pressureIndex: 33 },
    charts, fred: {},
    universe: { status: "OK", name: "test universe", source: "synthetic", asOf: "2026-10-01", members, reason: null },
    stockCharts, news: { status: "UNAVAILABLE", reason: "test: no news", items: [] },
    ...overrides,
  };
}

// Independent reference (hard-coded 50 / 10, not imported) to catch parameter drift.
function referenceRrg(asset: number[], bench: number[]) {
  const rs = asset.map((a, i) => a / bench[i]);
  const ratio = (t: number) => { let s = 0; for (let k = t - 49; k <= t; k++) s += rs[k]; return (100 * rs[t]) / (s / 50); };
  const t = rs.length - 1;
  return { rsRatio: ratio(t), rsMomentum: (100 * ratio(t)) / ratio(t - 10) };
}

// ── Completed-bar rule ───────────────────────────────────────────────────────
describe("completed-bar rule (4 PM ET + 60 min)", () => {
  it("completes at 17:00 ET, DST-aware", () => {
    expect(new Date(sessionCompletedAt("2026-10-02")).toISOString()).toBe("2026-10-02T21:00:00.000Z"); // EDT
    expect(new Date(sessionCompletedAt("2026-12-01")).toISOString()).toBe("2026-12-01T22:00:00.000Z"); // EST
    expect(isSessionComplete("2026-10-02", Date.parse("2026-10-02T20:59:59Z"))).toBe(false);
    expect(isSessionComplete("2026-10-02", Date.parse("2026-10-02T21:00:00Z"))).toBe(true);
  });
  it("treats the latest bar as in-progress before completion and labels today % intraday with its as-of", () => {
    const intradayNow = etWallToUtc("2026-10-02", 11, 0);
    const split = splitBars(toBars([100, 101, 102]), intradayNow);
    expect(split.inProgress?.session).toBe("2026-10-02");
    expect(split.completed.map(b => b.session).at(-1)).toBe("2026-10-01");
    const asOf = etWallToUtc("2026-10-02", 10, 59);
    expect(dailyChange(split, asOf)).toEqual({ pct: 0.99, basis: { kind: "INTRADAY", asOf: new Date(asOf).toISOString(), sessionDate: "2026-10-02" } });
    // Between 4:00 and 5:00 PM ET the session is still not completed.
    expect(splitBars(toBars([100, 101, 102]), etWallToUtc("2026-10-02", 16, 30)).inProgress?.session).toBe("2026-10-02");
  });
  it("uses session close vs prior session once completed", () => {
    expect(dailyChange(splitBars(toBars([100, 101, 102]), AFTER_CLOSE), null)).toEqual({ pct: 0.99, basis: { kind: "SESSION_CLOSE", sessionDate: "2026-10-02" } });
  });
});

describe("returns", () => {
  it("computes n-session completed returns and withholds short history", () => {
    const split = splitBars(toBars([100, 110, 121, 133.1, 146.41, 161.051]), AFTER_CLOSE);
    expect(completedReturn(split.completed, 5)).toBe(61.05);
    expect(completedReturn(split.completed, 1)).toBe(10);
    expect(completedReturn(split.completed, 6)).toBeNull();
  });
  it("excludes the in-progress bar from multi-day returns", () => {
    const split = splitBars(toBars([100, 100, 100, 100, 100, 100, 150]), etWallToUtc("2026-10-02", 12, 0));
    expect(completedReturn(split.completed, 5)).toBe(0);
  });
});

describe("volume vs normal", () => {
  const vols = Array.from({ length: 21 }, (_, i) => (i === 20 ? 2_000_000 : 1_000_000));
  it("ratio = latest completed volume / mean of prior 20", () => {
    expect(volumeRatio(splitBars(toBars(Array(21).fill(10), vols), AFTER_CLOSE))).toEqual({ ratio: 2, reason: null });
  });
  it("uses exactly the 20 completed sessions before the latest (window edges)", () => {
    // 23 bars: two outside the window (huge), the first in-window bar 3M, 19 × 1M, latest 2M → 2 / 1.1 = 1.8×.
    const v = [99_000_000, 99_000_000, 3_000_000, ...Array(19).fill(1_000_000), 2_000_000];
    expect(volumeRatio(splitBars(toBars(Array(23).fill(10), v), AFTER_CLOSE))).toEqual({ ratio: 1.8, reason: null });
  });
  it("is unavailable (never 0 or 1×) with missing volume, short history or an in-progress session", () => {
    const missing = [...vols]; missing[5] = Number.NaN;
    expect(volumeRatio(splitBars(toBars(Array(21).fill(10), missing), AFTER_CLOSE)).ratio).toBeNull();
    expect(volumeRatio(splitBars(toBars(Array(20).fill(10), vols.slice(1)), AFTER_CLOSE)).ratio).toBeNull();
    const zero = [...vols]; zero[20] = 0;
    expect(volumeRatio(splitBars(toBars(Array(21).fill(10), zero), AFTER_CLOSE)).ratio).toBeNull();
    const r = volumeRatio(splitBars(toBars(Array(22).fill(10)), etWallToUtc("2026-10-02", 12, 0)));
    expect(r.ratio).toBeNull();
    expect(r.reason).toMatch(/in progress/);
  });
});

describe("RRG relative strength and quadrant", () => {
  it("classifies the four quadrants with 100 on the ≥ side", () => {
    expect(classifyQuadrant(100, 100)).toBe("LEADING");
    expect(classifyQuadrant(99.99, 100)).toBe("IMPROVING");
    expect(classifyQuadrant(100, 99.99)).toBe("LOSING_MOMENTUM");
    expect(classifyQuadrant(99.99, 99.99)).toBe("LAGGING");
  });
  it("arrow uses a ±0.5 dead-band on RS-Momentum", () => {
    expect(momentumArrow(100.5)).toBe("UP");
    expect(momentumArrow(100.49)).toBe("FLAT");
    expect(momentumArrow(99.51)).toBe("FLAT");
    expect(momentumArrow(99.5)).toBe("DOWN");
  });
  it("constant relative strength sits exactly at the centre", () => {
    const bench = spyCloses.slice(-70); const asset = bench.map(b => b * 0.25);
    const r = latestRrg(computeRrg(SESSIONS.slice(-70), asset, bench))!;
    expect(r.rsRatio).toBe(100); expect(r.rsMomentum).toBe(100); expect(r.quadrant).toBe("LEADING");
  });
  it("matches an independent RS-Ratio(50) / RS-Momentum(10) reference for every designed path", () => {
    for (const [name, path] of Object.entries(RS_PATH)) {
      const asset = sectorCloses(path);
      const r = latestRrg(computeRrg(SESSIONS, asset, spyCloses))!;
      const ref = referenceRrg(asset, spyCloses);
      expect(r.rsRatio).toBeCloseTo(ref.rsRatio, 2);
      expect(r.rsMomentum).toBeCloseTo(ref.rsMomentum, 2);
      expect(r.quadrant, name).toBe(name);
    }
  });
  it("aligns to SPY sessions and fails closed on a missing or misaligned bar", () => {
    const spy = splitBars(toBars(spyCloses), AFTER_CLOSE).completed;
    const full = splitBars(toBars(sectorCloses(RS_PATH.LEADING)), AFTER_CLOSE).completed;
    expect(alignToBenchmark(full, spy, 61).ok).toBe(true);
    const gap = full.filter((_, i) => i !== full.length - 30);
    const g = alignToBenchmark(gap, spy, 61);
    expect(g.ok).toBe(false);
    const late = full.slice(0, -1);
    const l = alignToBenchmark(late, spy, 61);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.reason).toMatch(/2026-10-02/);
  });
});

describe("rank and rank change", () => {
  it("ranks by value descending with ticker tie-break", () => {
    const r = rankBy([{ ticker: "XLB", value: 101 }, { ticker: "XLA", value: 101 }, { ticker: "XLC", value: 103 }, { ticker: "XLD", value: 95 }]);
    expect([...r.entries()]).toEqual([["XLC", 1], ["XLA", 2], ["XLB", 3], ["XLD", 4]]);
  });
  it("rankChange = priorRank − rank on the built reading", () => {
    const reading = buildSectorRotationReading(baseInputs());
    const ranked = reading.sectors.filter(s => s.status === "RANKED");
    expect(ranked.map(s => s.rank)).toEqual(ranked.map((_, i) => i + 1));
    for (const s of ranked) expect(s.rankChange).toBe(s.priorRank! - s.rank!);
    const sortedByRatio = [...ranked].sort((a, b) => b.rsRatio! - a.rsRatio!);
    expect(sortedByRatio.map(s => s.ticker)).toEqual(ranked.map(s => s.ticker));
  });
});

describe("builder: missing / stale handling and no fabrication", () => {
  it("a sector with missing bars is UNAVAILABLE, unranked, and carries no numbers", () => {
    const inputs = baseInputs();
    inputs.charts.XLE = { ...inputs.charts.XLE!, bars: inputs.charts.XLE!.bars.filter((_, i) => i !== 100) };
    inputs.charts.XLRE = { ticker: "XLRE", bars: [], regularMarketTime: null, error: "Yahoo daily chart HTTP 404" };
    const r = buildSectorRotationReading(inputs);
    for (const t of ["XLE", "XLRE"]) {
      const s = r.sectors.find(x => x.ticker === t)!;
      expect(s.status).toBe("UNAVAILABLE");
      expect([s.rank, s.rsRatio, s.rsMomentum, s.quadrant, s.dailyChangePct, s.return5dPct, s.return20dPct, s.action]).toEqual([null, null, null, null, null, null, null, null]);
      expect(r.missingData.some(m => m.id === t)).toBe(true);
    }
    expect(r.sectors.filter(s => s.status === "RANKED").map(s => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.sectors.find(s => s.ticker === "XLRE")!.unavailableReason).toMatch(/404/);
  });
  it("is UNAVAILABLE end-to-end when SPY is missing: no rankings, no narrative, no movers", () => {
    const inputs = baseInputs(); delete inputs.charts.SPY;
    const r = buildSectorRotationReading(inputs);
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.sectors.every(s => s.status === "UNAVAILABLE" && s.rank === null)).toBe(true);
    expect(Object.values(r.narrative).every(v => v === null)).toBe(true);
    expect(r.movers.winners).toEqual([]); expect(r.movers.losers).toEqual([]);
  });
  it("labels a stale benchmark STALE with its as-of session", () => {
    const r = buildSectorRotationReading({ ...baseInputs(), now: etWallToUtc("2026-10-12", 12, 0) });
    expect(r.status).toBe("STALE");
    expect(r.benchmark.status).toBe("STALE");
    expect(r.missingData.find(m => m.id === "SPY")?.asOf).toBe("2026-10-02");
  });
  it("drivers without data are UNAVAILABLE with a reason; growth expectations are never substituted", () => {
    const inputs = baseInputs({ fred: { DGS10: { id: "DGS10", observations: [], error: "HTTP 400" } } });
    const r = buildSectorRotationReading(inputs);
    const d10 = r.drivers.find(d => d.id === "UST10Y")!;
    expect(d10).toMatchObject({ status: "UNAVAILABLE", latest: null, change: null, direction: null });
    expect(d10.reason).toMatch(/HTTP 400/);
    expect(r.drivers.find(d => d.id === "GROWTH_EXPECTATIONS")!.status).toBe("UNAVAILABLE");
    expect(r.drivers.find(d => d.id === "OIL_WTI")!.status).toBe("UNAVAILABLE");
    expect(r.watch.find(w => w.id === "UST10Y")!.state).toBe("UNAVAILABLE");
  });
  it("computes a FRED driver change in bp and flags stale FRED observations", () => {
    const obs = Array.from({ length: 25 }, (_, i) => ({ date: SESSIONS[n - 25 + i], value: (4 + i * 0.01).toFixed(2) }));
    const r = buildSectorRotationReading(baseInputs({ fred: { DGS10: { id: "DGS10", observations: [...obs, { date: "2026-10-03", value: "." }] } } }));
    expect(r.drivers.find(d => d.id === "UST10Y")).toMatchObject({ status: "OK", latest: 4.24, change: 20, changeUnit: "bp", direction: "RISING", asOf: "2026-10-02" });
    const stale = buildSectorRotationReading({ ...baseInputs({ fred: { DGS10: { id: "DGS10", observations: obs } } }), now: etWallToUtc("2026-10-20", 18, 0) });
    expect(stale.drivers.find(d => d.id === "UST10Y")!.status).toBe("STALE");
  });
  it("is deterministic", () => {
    expect(buildSectorRotationReading(baseInputs())).toEqual(buildSectorRotationReading(baseInputs()));
  });
  it("every narrative number is traceable to the computed object", () => {
    const r = buildSectorRotationReading(baseInputs());
    const source = { ...r, narrative: undefined };
    for (const [k, v] of Object.entries(r.narrative)) {
      expect(v, k).not.toBeNull();
      expect(findUntraceableNumbers(v!, source), k).toEqual([]);
    }
    expect(r.narrative.whyItMatters).toMatch(/MODERATE RISK/);
    expect(r.narrative.whyItMatters).toMatch(/Pressure Index 33/);
  });
  it("the validator flags an invented number", () => {
    const r = buildSectorRotationReading(baseInputs());
    expect(findUntraceableNumbers("XLK leads with a 73.4% chance of continuing.", { ...r, narrative: undefined })).toContain("73.4");
    expect(findUntraceableNumbers("Leading: XLK.", {})).toEqual([]);
  });
  it("withholds (null) any narrative field that would carry a number absent from the object", () => {
    const r = buildSectorRotationReading(baseInputs({ canonical: { stateId: null, stateHash: null, stateGeneratedAt: null, runId: null, regime: "REGIME 77", pressureIndex: null } }));
    expect(r.narrative.whyItMatters).toBeNull();
    expect(r.narrative.happening).not.toBeNull();
  });
  it("pressureBand labels the WHY IT MATTERS regime from the displayed score (33 → MODERATE RISK)", () => {
    const r = buildSectorRotationReading(baseInputs({ canonical: { stateId: "state:test", stateHash: "h", stateGeneratedAt: "2026-10-02T18:00:00.000Z", runId: null, regime: "ELEVATED RISK", pressureIndex: 33 } }));
    // Score wins over a mismatched stored regime string — single source is pressureBand().
    expect(r.narrative.whyItMatters).toMatch(/Under FAULTLINE's MODERATE RISK regime \(Pressure Index 33\)/);
    expect(r.narrative.whyItMatters).not.toMatch(/ELEVATED RISK/);
  });

  it("states the regime as unavailable rather than inventing one", () => {
    const r = buildSectorRotationReading(baseInputs({ canonical: { stateId: null, stateHash: null, stateGeneratedAt: null, runId: null, regime: null, pressureIndex: null } }));
    expect(r.narrative.whyItMatters).toMatch(/^With the FAULTLINE regime unavailable/);
    expect(r.narrative.whyItMatters).not.toMatch(/Pressure Index/);
  });
  it("contains no probability language or LLM text", () => {
    const r = buildSectorRotationReading(baseInputs());
    expect(JSON.stringify(r.narrative)).not.toMatch(/probab|likelihood|odds|chance/i);
  });
});

describe("breadth", () => {
  it("withholds breadth below 90% constituent coverage", () => {
    const members: UniverseMember[] = Array.from({ length: 10 }, (_, i) => ({ ticker: `B${i}`, name: "", sectorEtf: "XLK" }));
    const splits = new Map(members.map((m, i) => [m.ticker, splitBars(toBars(i < 8 ? stockCloses(i, 1) : []), AFTER_CLOSE)]));
    const b = sectorBreadth(members, splits, "2026-10-02", true);
    expect(b).toMatchObject({ status: "UNAVAILABLE", pctAboveSma: null, counted: 8, total: 10 });
    expect(sectorBreadth(members, splits, "2026-10-02", false).status).toBe("UNAVAILABLE");
  });
  it("counts constituents above their 50-session average", () => {
    const members: UniverseMember[] = Array.from({ length: 4 }, (_, i) => ({ ticker: `B${i}`, name: "", sectorEtf: "XLK" }));
    const up = SESSIONS.map((_, i) => 10 + i * 0.1), down = SESSIONS.map((_, i) => 30 - i * 0.1);
    const splits = new Map(members.map((m, i) => [m.ticker, splitBars(toBars(i < 3 ? up : down), AFTER_CLOSE)]));
    expect(sectorBreadth(members, splits, "2026-10-02", true)).toMatchObject({ status: "OK", pctAboveSma: 75, counted: 4 });
  });
  it("skips a constituent with a possible unadjusted corporate action", () => {
    const c = SESSIONS.map((_, i) => (i < n - 3 ? 80 : 12));
    const split = splitBars(toBars(c), AFTER_CLOSE);
    expect(findDiscontinuity(split.completed, 49)).toEqual({ session: SESSIONS[n - 3], pct: -85 });
  });
});

describe("action classes (mechanical: quadrant + evidence)", () => {
  it.each([
    [{ quadrant: "LEADING", relReturn20dPct: 2, breadthPct: 60, arrow: "UP" }, "OVERWEIGHT"],
    [{ quadrant: "LEADING", relReturn20dPct: 2, breadthPct: null, arrow: "UP" }, "WATCH_FOR_CONFIRMATION"],
    [{ quadrant: "LEADING", relReturn20dPct: -1, breadthPct: 60, arrow: "UP" }, "WATCH_FOR_CONFIRMATION"],
    [{ quadrant: "LEADING", relReturn20dPct: 2, breadthPct: 49.9, arrow: "UP" }, "WATCH_FOR_CONFIRMATION"],
    [{ quadrant: "IMPROVING", relReturn20dPct: 5, breadthPct: 90, arrow: "UP" }, "WATCH_FOR_CONFIRMATION"],
    [{ quadrant: "LOSING_MOMENTUM", relReturn20dPct: 1, breadthPct: 40, arrow: "DOWN" }, "NEUTRAL"],
    [{ quadrant: "LOSING_MOMENTUM", relReturn20dPct: 0, breadthPct: 40, arrow: "DOWN" }, "UNDERWEIGHT"],
    [{ quadrant: "LAGGING", relReturn20dPct: -3, breadthPct: 20, arrow: "DOWN" }, "AVOID"],
    [{ quadrant: "LAGGING", relReturn20dPct: -3, breadthPct: 20, arrow: "FLAT" }, "UNDERWEIGHT"],
    [{ quadrant: "LAGGING", relReturn20dPct: -3, breadthPct: null, arrow: "DOWN" }, "UNDERWEIGHT"],
  ] as const)("%o → %s", (input, expected) => {
    const r = classifyAction(input as never);
    expect(r.class).toBe(expected);
    expect(r.evidence.map(e => e.id)).toEqual(["quadrant", "rel20", "breadth", "momentum"]);
  });
});

// ── Movers ───────────────────────────────────────────────────────────────────
describe("top 5 winners / losers", () => {
  it("ranks by today % (ties by ticker), positives as winners and negatives as losers", () => {
    const r = buildSectorRotationReading(baseInputs());
    const all = Object.entries(baseInputs().stockCharts).map(([t, c]) => {
      const s = splitBars(c!.bars, AFTER_CLOSE); return { t, pct: dailyChange(s, null)!.pct };
    });
    const expectedWinners = all.filter(x => x.pct > 0).sort((a, b) => b.pct - a.pct || a.t.localeCompare(b.t)).slice(0, 5).map(x => x.t);
    const expectedLosers = all.filter(x => x.pct < 0).sort((a, b) => a.pct - b.pct || a.t.localeCompare(b.t)).slice(0, 5).map(x => x.t);
    expect(r.movers.status).toBe("OK");
    expect(r.movers.winners.map(m => m.ticker)).toEqual(expectedWinners);
    expect(r.movers.losers.map(m => m.ticker)).toEqual(expectedLosers);
    expect(r.movers.universe).toMatchObject({ total: 44, ranked: 44 });
    expect(r.movers.winners[0].company).toBe("Company 42");
  });
  it("breaks ties by ticker", () => {
    const inputs = baseInputs();
    const members = inputs.universe.members.slice(0, 22);
    const stockCharts: SectorRotationInputs["stockCharts"] = {};
    members.forEach((m, i) => { stockCharts[m.ticker] = chart(m.ticker, stockCloses(0, i < 6 ? 3 : -0.5)); });
    // Members supplied in reverse order so input order cannot stand in for the ticker tie-break.
    const r = buildSectorRotationReading({ ...inputs, universe: { ...inputs.universe, members: [...members].reverse() }, stockCharts });
    expect(r.movers.winners.map(m => m.ticker)).toEqual(["S00", "S01", "S02", "S03", "S04"]);
    expect(r.movers.losers.map(m => m.ticker)).toEqual(["S06", "S07", "S08", "S09", "S10"]);
  });
  it("never lists a rising stock as a loser (or a falling one as a winner)", () => {
    const inputs = baseInputs();
    const members = inputs.universe.members.slice(0, 22);
    const stockCharts: SectorRotationInputs["stockCharts"] = {};
    members.forEach((m, i) => { stockCharts[m.ticker] = chart(m.ticker, stockCloses(i, 0.5 + i * 0.1)); });
    const r = buildSectorRotationReading({ ...inputs, universe: { ...inputs.universe, members }, stockCharts });
    expect(r.movers.status).toBe("OK");
    expect(r.movers.winners).toHaveLength(5);
    expect(r.movers.losers).toEqual([]);
  });
  it("does not rank a ≥ 50% one-session move (possible unadjusted corporate action); lists it as unavailable", () => {
    const inputs = baseInputs();
    inputs.stockCharts.S43 = chart("S43", stockCloses(43, -84));
    const r = buildSectorRotationReading(inputs);
    expect(r.movers.losers.map(m => m.ticker)).not.toContain("S43");
    expect(r.movers.universe.unavailable).toEqual(["S43"]);
    expect(r.movers.status).toBe("OK");
  });
  it("is UNAVAILABLE (no partial ranking) below 95% coverage or without a universe", () => {
    const inputs = baseInputs();
    for (const t of ["S00", "S01", "S02"]) inputs.stockCharts[t] = { ticker: t, bars: [], regularMarketTime: null, error: "HTTP 429" };
    const r = buildSectorRotationReading(inputs);
    expect(r.movers.status).toBe("UNAVAILABLE");
    expect(r.movers.winners).toEqual([]); expect(r.movers.losers).toEqual([]);
    expect(r.movers.reason).toMatch(/41 of 44/);
    expect(r.narrative.whyItMatters).toMatch(/Top stock movers are unavailable/);
    const noUni = buildSectorRotationReading(baseInputs({ universe: { status: "UNAVAILABLE", name: "x", source: "x", asOf: null, members: [], reason: "Constituent list unavailable: XLK holdings HTTP 503" } }));
    expect(noUni.movers.status).toBe("UNAVAILABLE");
    expect(noUni.movers.reason).toMatch(/503/);
    expect(noUni.sectors.every(s => s.breadth.status === "UNAVAILABLE")).toBe(true);
  });
  it("a stock on a different session basis is not ranked and is listed as unavailable", () => {
    const inputs = baseInputs();
    inputs.stockCharts.S43 = { ...inputs.stockCharts.S43!, bars: inputs.stockCharts.S43!.bars.slice(0, -1) };
    const r = buildSectorRotationReading(inputs);
    expect(r.movers.universe.unavailable).toEqual(["S43"]);
    expect(r.movers.winners.map(m => m.ticker)).not.toContain("S43");
    expect(r.movers.reason).toMatch(/1 of 44 constituents unavailable/);
  });
  it("withholds a 5D return that spans a possible unadjusted corporate action", () => {
    const inputs = baseInputs();
    const c = stockCloses(43, 20); c[n - 3] = c[n - 4] * 0.15; c[n - 2] = c[n - 3]; c[n - 1] = c[n - 2] * 1.2;
    inputs.stockCharts.S43 = chart("S43", c);
    const m = buildSectorRotationReading(inputs).movers.winners.find(x => x.ticker === "S43")!;
    expect(m.return5dPct).toBeNull();
    expect(m.return5dReason).toMatch(/corporate action/);
  });
  it("volume ratio is null with a reason when volume is missing", () => {
    const inputs = baseInputs();
    const vols = SESSIONS.map(() => 1_000_000); vols[n - 4] = Number.NaN;
    inputs.stockCharts.S43 = chart("S43", stockCloses(43, 20), vols);
    const m = buildSectorRotationReading(inputs).movers.winners.find(x => x.ticker === "S43")!;
    expect(m.volumeRatio).toBeNull();
    expect(m.volumeRatioReason).toMatch(/missing/);
  });
});

describe("catalyst classification", () => {
  // Test-only universe (real S&P 500 names as SSGA lists them, plus labelled synthetic entries).
  const M = (ticker: string, name: string, sectorEtf: SectorEtfTicker = "XLK"): UniverseMember => ({ ticker, name, sectorEtf });
  const MEMBERS: UniverseMember[] = [
    M("ACME", "ACME WIDGETS CORP"), M("MU", "MICRON TECHNOLOGY INC"), M("WDC", "WESTERN DIGITAL CORP"), M("STX", "SEAGATE TECHNOLOGY HOLDINGS"),
    M("TER", "TERADYNE INC"), M("HPE", "HEWLETT PACKARD ENTERPRISE"), M("NKE", "NIKE INC  CL B", "XLY"), M("TSLA", "TESLA INC", "XLY"),
    M("ON", "ON SEMICONDUCTOR"), M("GOOGL", "ALPHABET INC CL A", "XLC"), M("GOOG", "ALPHABET INC CL C", "XLC"), M("LOW", "LOWE S COS INC", "XLY"),
    M("ALL", "ALLSTATE CORP", "XLF"), M("KEY", "KEYCORP", "XLF"), M("TGT", "TARGET CORP", "XLP"), M("JPM", "JPMORGAN CHASE + CO", "XLF"),
    M("GE", "GENERAL ELECTRIC", "XLI"), M("GEV", "GE VERNOVA INC", "XLI"), M("T", "AT+T INC", "XLC"), M("NDAQ", "NASDAQ INC", "XLF"),
  ];
  const aliases = buildAliasIndex(MEMBERS);
  const news = (over: Partial<NewsItemInput> = {}): NewsItemInput => ({ id: "n1", title: "Acme Widgets beats third-quarter earnings estimates", publisher: "Benzinga", url: "https://example.test/a", publishedAt: "2026-10-02T12:00:00Z", tickers: ["ACME"], ...over });
  const base = { ticker: "ACME", stockPct: 8, sectorEtf: "XLK" as const, sectorPct: 1, spyPct: 0.5, news: [] as NewsItemInput[], newsAvailable: true, aliases };
  const cls = (ticker: string, items: NewsItemInput[], over: Partial<typeof base> = {}) => classifyCatalyst({ ...base, ticker, news: items, ...over });

  it("EVENT_DRIVEN only from a qualifying item; why restates the fetched title verbatim with source", () => {
    const c = classifyCatalyst({ ...base, news: [news()] });
    expect(c).toMatchObject({ class: "EVENT_DRIVEN", eventFamily: "EARNINGS", why: "Acme Widgets beats third-quarter earnings estimates" });
    expect(c.news).toMatchObject({ id: "n1", publisher: "Benzinga", publishedAt: "2026-10-02T12:00:00Z", source: "polygon-news" });
    expect(classifyCatalyst({ ...base, news: [news({ title: "Broker upgrades Acme Widgets to buy" })] }).eventFamily).toBe("ANALYST_ACTION");
    expect(classifyCatalyst({ ...base, news: [news({ title: "Acme Widgets agrees to acquire Widget Co" })] }).eventFamily).toBe("M_AND_A");
    expect(cls("MU", [news({ title: "Micron earnings beat as memory prices climb", tickers: ["MU"] })])).toMatchObject({ class: "EVENT_DRIVEN", eventFamily: "EARNINGS" });
  });

  it("a Micron earnings headline is never another semiconductor's catalyst", () => {
    const peerTagged = news({ id: "mu1", title: "Micron earnings beat as memory prices climb", tickers: ["MU", "WDC", "STX"] });
    for (const t of ["WDC", "STX"]) {
      expect(qualifyNewsItem(peerTagged, t, aliases)).toBe("NOT_NAMED");
      expect(cls(t, [peerTagged], { stockPct: -10 })).toMatchObject({ class: "CATALYST_UNCLEAR", news: null, why: "CATALYST UNCLEAR" });
    }
    const namesPeers = news({ id: "mu2", title: "Micron results lift Western Digital and Seagate", tickers: ["MU", "WDC", "STX"] });
    expect(qualifyNewsItem(namesPeers, "WDC", aliases)).toBe("NAMES_OTHER_ISSUER");
    expect(qualifyNewsItem(namesPeers, "STX", aliases)).toBe("NAMES_OTHER_ISSUER");
    expect(cls("WDC", [namesPeers], { stockPct: -10 }).class).toBe("CATALYST_UNCLEAR");
  });

  it("a movers roundup never explains a stock, named or not", () => {
    const roundup = news({ id: "r1", title: "Stocks making the biggest moves midday: Nike, Tesla, Teradyne and more", tickers: ["NKE", "TSLA", "TER", "HPE"] });
    expect(qualifyNewsItem(roundup, "HPE", aliases)).toBe("TOO_MANY_TAGS");
    expect(cls("HPE", [roundup]).class).toBe("CATALYST_UNCLEAR");
    expect(cls("TER", [roundup]).class).toBe("CATALYST_UNCLEAR");
    // Even tagged only with the stock, a roundup is rejected.
    for (const title of ["Stocks making the biggest moves midday: Teradyne", "Teradyne among top midday movers", "Biggest movers: Teradyne, HPE", "5 stocks to watch: Teradyne"]) {
      expect(qualifyNewsItem(news({ title, tickers: ["TER"] }), "TER", aliases), title).toBe("ROUNDUP");
    }
    // A roundup that does not name the stock cannot explain it.
    expect(qualifyNewsItem(news({ title: "Here are today's biggest movers", tickers: ["HPE"] }), "HPE", aliases)).toBe("ROUNDUP");
  });

  it("sector / market stories that do not name the company are rejected", () => {
    for (const title of ["Chip stocks rally on AI demand", "Semiconductor sector jumps as yields fall", "Stock market today: Dow, S&P 500 rise", "Memory makers gain after industry data"]) {
      expect(cls("WDC", [news({ title, tickers: ["WDC"] })], { stockPct: 5 }).class, title).toBe("CATALYST_UNCLEAR");
    }
  });

  it("only approved publishers count; missing publisher fails closed", () => {
    for (const publisher of ["", "   ", "The Motley Fool", "Zacks Investment Research", "Seeking Alpha", "Some Blog"]) {
      const c = classifyCatalyst({ ...base, news: [news({ publisher })] });
      expect(c.class, publisher).toBe("CATALYST_UNCLEAR");
      expect(c.news).toBeNull();
    }
    expect(qualifyNewsItem(news({ publisher: "" }), "ACME", aliases)).toBe("PUBLISHER_MISSING");
    expect(qualifyNewsItem(news({ publisher: "The Motley Fool" }), "ACME", aliases)).toBe("PUBLISHER_NOT_APPROVED");
    expect(qualifyNewsItem(news({ publishedAt: "not a date" }), "ACME", aliases)).toBe("BAD_TIMESTAMP");
  });

  it("exchange-qualified press-release notation is not a mention of the exchange operator", () => {
    expect(qualifyNewsItem(news({ title: "Teradyne (NASDAQ: TER) raises full-year outlook", publisher: "GlobeNewswire Inc.", tickers: ["TER"] }), "TER", aliases)).toBeNull();
    expect(qualifyNewsItem(news({ title: "Nasdaq, Inc. reports third-quarter results", tickers: ["NDAQ"] }), "NDAQ", aliases)).toBeNull();
    expect(qualifyNewsItem(news({ title: "Nasdaq rises as Teradyne jumps", tickers: ["TER"] }), "TER", aliases)).toBe("NAMES_OTHER_ISSUER"); // fail closed
    for (const publisher of ["Benzinga", "GlobeNewswire Inc.", "PR Newswire", "Business Wire", "Reuters", "MarketWatch"]) expect(isApprovedPublisher(publisher), publisher).toBe(true);
    expect(APPROVED_NEWS_PUBLISHERS.every(p => p === normalizePublisher(p))).toBe(true);
  });

  it("aliases are controlled and deterministic", () => {
    const shuffled = buildAliasIndex([...MEMBERS].reverse());
    expect(Array.from(shuffled.issuerAliases.entries()).sort()).toEqual(Array.from(aliases.issuerAliases.entries()).sort());
    const of = (t: string) => aliases.issuerAliases.get(aliases.issuerOf.get(t)!)?.slice().sort();
    expect(of("TER")).toEqual(["teradyne"]);
    expect(of("WDC")).toEqual(["western digital"]); // "western" alone is not distinctive
    expect(of("STX")).toEqual(["seagate", "seagate technology"]);
    expect(of("MU")).toEqual(["micron", "micron technology"]);
    expect(of("JPM")).toEqual(["jpmorgan", "jpmorgan chase"]);
    expect(of("TGT")).toBeUndefined(); // "target" is an ordinary word: ticker forms only
    expect(aliases.issuerOf.get("GOOGL")).toBe(aliases.issuerOf.get("GOOG")); // share classes = one issuer
    // Ordinary-word first names are not aliases: such issuers are named by full name or ticker only.
    const words = buildAliasIndex([M("STT", "STATE STREET CORP", "XLF"), M("WFC", "WELLS FARGO + CO", "XLF"), M("AMD", "ADVANCED MICRO DEVICES", "XLK")]);
    expect(Array.from(words.aliasIssuers.keys()).sort()).toEqual(["advanced micro devices", "state street", "wells fargo"]);
    expect(qualifyNewsItem(news({ title: "Teradyne surges on advanced packaging demand", tickers: ["TER"] }), "TER", buildAliasIndex([...MEMBERS, M("AMD", "ADVANCED MICRO DEVICES")]))).toBeNull();
    // A first word shared by two issuers is never an alias of either (test-only synthetic names).
    const shared = buildAliasIndex([M("ZYPX", "ZYLOX PETROLEUM CORP", "XLE"), M("ZYOX", "ZYLOX OIL CORP", "XLE")]);
    expect(shared.issuerAliases.get("zylox petroleum")).toEqual(["zylox petroleum"]);
    expect(qualifyNewsItem(news({ title: "Zylox raises full-year outlook", tickers: ["ZYPX"] }), "ZYPX", shared)).toBe("NOT_NAMED");
    expect(of("GOOGL")).toEqual(["alphabet", "google"]);
    expect(of("LOW")).toEqual(["lowe"]);
    expect(normalizeCompanyName("AT+T INC")).toBe("at&t");
    expect(Object.keys(EXPLICIT_COMPANY_ALIASES).sort()).toEqual(["AAPL", "AMZN", "BRK-B", "FOX", "FOXA", "GOOG", "GOOGL", "LOW", "META", "NWS", "NWSA", "T"]);
  });

  it("ambiguous ticker / name collisions never attribute", () => {
    // Ordinary-word tickers only count when exchange-qualified, $-prefixed or parenthesised.
    expect(qualifyNewsItem(news({ title: "Stocks rally on Fed relief", tickers: ["ON"] }), "ON", aliases)).toBe("NOT_NAMED");
    expect(qualifyNewsItem(news({ title: "All eyes on bank earnings", tickers: ["ALL"] }), "ALL", aliases)).toBe("NOT_NAMED");
    expect(qualifyNewsItem(news({ title: "Key takeaways from earnings season", tickers: ["KEY"] }), "KEY", aliases)).toBe("NOT_NAMED");
    expect(qualifyNewsItem(news({ title: "Analysts lift price target on retailers", tickers: ["TGT"] }), "TGT", aliases)).toBe("NOT_NAMED");
    expect(qualifyNewsItem(news({ title: "GE shares climb", tickers: ["GE"] }), "GE", aliases)).toBe("NOT_NAMED");
    expect(qualifyNewsItem(news({ title: "ON Semiconductor (NASDAQ: ON) raises guidance", tickers: ["ON"] }), "ON", aliases)).toBeNull();
    expect(qualifyNewsItem(news({ title: "Shares of $ON jump after guidance raise", tickers: ["ON"] }), "ON", aliases)).toBeNull();
    expect(qualifyNewsItem(news({ title: "Target Corp (NYSE:TGT) cuts full-year outlook", tickers: ["TGT"] }), "TGT", aliases)).toBeNull();
    // Shared alias across two issuers → ambiguous (synthetic second issuer, test-only).
    const amb = buildAliasIndex([...MEMBERS, M("GOOGX", "GOOGLE ANALYTICS HOLDINGS")]);
    expect(qualifyNewsItem(news({ title: "Google unveils new chip", tickers: ["GOOGL"] }), "GOOGL", amb)).toBe("AMBIGUOUS_NAME");
    // All-caps headlines do not count bare tickers.
    expect(qualifyNewsItem(news({ title: "TERADYNE TER SHARES SURGE", tickers: ["TER"] }), "TER", aliases)).toBeNull(); // alias "teradyne" still names it
    expect(qualifyNewsItem(news({ title: "HPE SHARES SURGE", tickers: ["HPE"] }), "HPE", aliases)).toBe("NOT_NAMED");
  });

  it("keyword families use specific phrases only", () => {
    const fam = (title: string) => classifyCatalyst({ ...base, ticker: "TER", news: [news({ title, tickers: ["TER"] })] }).eventFamily;
    expect(fam("Teradyne slips on profit-taking")).toBeNull();
    expect(fam("Teradyne revenue mix shifts")).toBeNull();
    expect(fam("Teradyne files SEC form 8-K")).toBeNull();
    expect(fam("Teradyne shares extend rally; analysts see results")).toBeNull();
    expect(fam("Teradyne outlook for robotics unit")).toBeNull();
    expect(fam("Teradyne Q3 earnings top estimates")).toBe("EARNINGS");
    expect(fam("Teradyne raises full-year guidance")).toBe("GUIDANCE");
    expect(fam("Teradyne faces SEC probe")).toBe("REGULATORY");
    expect(fam("Teradyne downgraded to neutral at broker")).toBe("ANALYST_ACTION");
  });

  it("ignores items not tagged with the mover or tagging more than 3 tickers", () => {
    expect(classifyCatalyst({ ...base, news: [news({ tickers: ["OTHER"] })] }).class).toBe("CATALYST_UNCLEAR");
    expect(classifyCatalyst({ ...base, news: [news({ tickers: ["ACME", "A1", "A2", "A3"] })] }).class).toBe("CATALYST_UNCLEAR");
    expect(classifyCatalyst({ ...base, news: [news({ tickers: ["ACME", "A1", "A2"] })] }).class).toBe("EVENT_DRIVEN");
  });

  it("COMPANY_SPECIFIC needs a qualifying item and a move the sector does not explain; co-moves never carry a headline", () => {
    expect(classifyCatalyst({ ...base, news: [news({ title: "Acme Widgets names new CEO" })] }).class).toBe("COMPANY_SPECIFIC");
    const sec = classifyCatalyst({ ...base, sectorPct: 5, spyPct: 0.5, news: [news({ title: "Acme Widgets names new CEO" })] });
    expect(sec).toMatchObject({ class: "SECTOR_DRIVEN", news: null });
    expect(sec.why).not.toContain("CEO");
    const mac = classifyCatalyst({ ...base, stockPct: -3, sectorPct: -2, spyPct: -1.8, news: [news({ id: "x", title: "Chip stocks slide", tickers: ["ACME"] })] });
    expect(mac).toMatchObject({ class: "MACRO_DRIVEN", news: null });
    expect(mac.why).not.toContain("Chip");
  });

  it("SECTOR / MACRO co-moves and exactly 'CATALYST UNCLEAR' otherwise", () => {
    expect(classifyCatalyst({ ...base, sectorPct: 4.5, spyPct: 0.5 })).toMatchObject({ class: "SECTOR_DRIVEN", coMove: { benchmark: "XLK", benchmarkPct: 4.5, stockPct: 8 }, news: null });
    expect(classifyCatalyst({ ...base, stockPct: -3, sectorPct: -2, spyPct: -1.8 })).toMatchObject({ class: "MACRO_DRIVEN", coMove: { benchmark: "SPY" } });
    const unclear = classifyCatalyst(base);
    expect(unclear).toEqual({ class: "CATALYST_UNCLEAR", eventFamily: null, why: CATALYST_UNCLEAR_TEXT, news: null, coMove: null });
    expect(CATALYST_UNCLEAR_TEXT).toBe("CATALYST UNCLEAR");
    expect(explains(4, 8)).toBe(true); expect(explains(3.99, 8)).toBe(false); expect(explains(-4, 8)).toBe(false); expect(explains(null, 8)).toBe(false);
  });

  it("missing valid news fails closed to CATALYST UNCLEAR", () => {
    expect(classifyCatalyst({ ...base, news: [news()], newsAvailable: false })).toMatchObject({ class: "CATALYST_UNCLEAR", news: null });
    const rejected = [news({ publisher: "" }), news({ id: "2", tickers: ["ZZZ"] }), news({ id: "3", title: "Tech stocks climb" }), news({ id: "4", publisher: "Seeking Alpha" })];
    expect(classifyCatalyst({ ...base, news: rejected })).toMatchObject({ class: "CATALYST_UNCLEAR", news: null, why: "CATALYST UNCLEAR" });
  });

  it("no catalyst without a qualifying source item (randomised invariant)", () => {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const titles = ["Acme Widgets quarterly results beat estimates", "Acme Widgets opens office", "Biggest movers: Acme Widgets", "Chip stocks rally", "Micron earnings beat", "Acme Widgets and Micron sign deal"];
    const pubs = ["Benzinga", "", "The Motley Fool", "Reuters"];
    for (let i = 0; i < 800; i++) {
      const items = rnd() < 0.6 ? [news({ id: `r${i}`, title: titles[Math.floor(rnd() * titles.length)], publisher: pubs[Math.floor(rnd() * pubs.length)], tickers: rnd() < 0.7 ? ["ACME"] : rnd() < 0.5 ? ["ZZZ"] : ["ACME", "MU", "WDC", "STX"] })] : [];
      const newsAvailable = rnd() < 0.8;
      const c = classifyCatalyst({ ...base, stockPct: (rnd() - 0.5) * 20 || 1, sectorPct: rnd() < 0.1 ? null : (rnd() - 0.5) * 10, spyPct: (rnd() - 0.5) * 6, news: items, newsAvailable });
      if (c.class === "EVENT_DRIVEN" || c.class === "COMPANY_SPECIFIC") {
        expect(newsAvailable).toBe(true);
        const src = items.find(n => n.id === c.news!.id)!;
        expect(qualifyNewsItem(src, "ACME", aliases)).toBeNull();
        expect(c.why).toBe(src.title);
      } else expect(c.news).toBeNull();
      if (c.class === "SECTOR_DRIVEN" || c.class === "MACRO_DRIVEN") expect(c.coMove).not.toBeNull();
      if (c.class === "CATALYST_UNCLEAR") expect(c.why).toBe("CATALYST UNCLEAR");
    }
  });

  it("only news inside the move's window is used by the builder", () => {
    const inputs = baseInputs();
    const winner = buildSectorRotationReading(inputs).movers.winners[0].ticker;
    const inWindow = news({ id: "in", tickers: [winner], title: `${winner} quarterly results beat estimates`, publishedAt: "2026-10-02T13:00:00Z" });
    const tooEarly = news({ id: "early", tickers: [winner], title: `${winner} earnings preview`, publishedAt: "2026-10-01T19:00:00Z" }); // before 4 PM ET Oct 1 close
    const r1 = buildSectorRotationReading({ ...inputs, news: { status: "OK", reason: null, items: [tooEarly] } });
    expect(r1.movers.winners[0].catalyst.class).not.toBe("EVENT_DRIVEN");
    const r2 = buildSectorRotationReading({ ...inputs, news: { status: "OK", reason: null, items: [tooEarly, inWindow] } });
    expect(r2.movers.winners[0].catalyst).toMatchObject({ class: "EVENT_DRIVEN", news: { id: "in" } });
  });
});

describe("thesis alignment and early indicators", () => {
  it("winner in Leading/Improving reinforces; loser there contradicts", () => {
    expect(thesisAlignment("winner", "LEADING")).toBe("REINFORCES");
    expect(thesisAlignment("winner", "LAGGING")).toBe("CONTRADICTS");
    expect(thesisAlignment("loser", "LOSING_MOMENTUM")).toBe("REINFORCES");
    expect(thesisAlignment("loser", "IMPROVING")).toBe("CONTRADICTS");
    expect(thesisAlignment("winner", null)).toBe("UNDETERMINED");
  });
  it("flags only contradicting, non-company, high-volume moves", () => {
    const base = { ticker: "X", sectorEtf: "XLU" as const, todayPct: 6, volumeRatio: 1.5, thesisAlignment: "CONTRADICTS" as const, catalystClass: "CATALYST_UNCLEAR" as const, quadrant: "LAGGING" as const };
    expect(earlyIndicator(base).flagged).toBe(true);
    expect(earlyIndicator({ ...base, volumeRatio: 1.4 }).flagged).toBe(false);
    expect(earlyIndicator({ ...base, volumeRatio: null }).flagged).toBe(false);
    expect(earlyIndicator({ ...base, catalystClass: "EVENT_DRIVEN" }).flagged).toBe(false);
    expect(earlyIndicator({ ...base, catalystClass: "MACRO_DRIVEN" }).flagged).toBe(false);
    expect(earlyIndicator({ ...base, thesisAlignment: "REINFORCES" }).flagged).toBe(false);
  });
});
