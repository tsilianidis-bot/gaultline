// v2 shadow: reproducibility of the locked research build + harness + recorder isolation.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { computeV2At, midrankPercentile, pillarScore } from "./engine";
import { loadV2Reference, referenceV2Data } from "./reference";
import { detectDrawdownEvents, evaluateSignal, forwardOutcome, outcomesByBand, rankAuc } from "./benchmarkHarness";
import { assembleLiveV2Data, sahmGap } from "./liveInputs";
import { V2_SPEC_SHA256 } from "./spec";

describe("locked spec integrity", () => {
  it("docs/pressure/v2/PRESPEC_V2.md matches the locked sha256", () => {
    const raw = readFileSync("docs/pressure/v2/PRESPEC_V2.md");
    expect(createHash("sha256").update(raw).digest("hex")).toBe(V2_SPEC_SHA256);
  });
});

describe("primitives", () => {
  it("mid-rank percentile and clipped pillar score", () => {
    expect(midrankPercentile([1, 2, 3, 4], 3)).toBe(62.5);
    expect(pillarScore(50)).toBe(0);
    expect(pillarScore(75)).toBe(50);
    expect(pillarScore(100)).toBe(100);
    expect(pillarScore(null)).toBeNull();
  });
});

describe("reproduces the Oct 12 research build (weekly_panel.csv)", async () => {
  const { ref } = await loadV2Reference();
  const data = referenceV2Data(ref);
  const expected = (d: string) => ref.weekly.v2[ref.weekly.date.indexOf(d)];
  for (const d of ["2001-09-21", "2008-10-10", "2008-11-21", "2011-08-12", "2018-12-21", "2020-03-20", "2022-10-14", "2026-09-11"]) {
    it(`v2 on ${d}`, () => {
      const o = computeV2At(data, d);
      expect(o.v2).toBe(expected(d));
    });
  }
  it("2008-11-21 peak 98.85 with all 5 pillars; 2026-09-11 = 0 with funding unavailable", () => {
    expect(computeV2At(data, "2008-11-21")).toMatchObject({ v2: 98.85, nPillars: 5, band: "SYSTEMIC CRISIS" });
    const latest = computeV2At(data, "2026-09-11");
    expect(latest.nPillars).toBe(4);
    expect(latest.pillars.find(p => p.pillar === "funding")!.status).toBe("unavailable");
  });
  it("full weekly series 2000–2026-09-11 matches the research panel exactly", () => {
    let mism = 0, n = 0;
    ref.weekly.date.forEach((d, i) => {
      if (d < "2000-01-01") return;
      n++;
      if (computeV2At(data, d).v2 !== ref.weekly.v2[i]) mism++;
    });
    expect(n).toBeGreaterThan(1380);
    expect(mism).toBe(0);
  }, 120_000);

  it("harness reproduces 26 events and v2 14 warned / 12 missed (HISTORICAL_BACKTEST, in-sample)", () => {
    const sp = ref.spxClose;
    const events = detectDrawdownEvents(sp.dates, sp.values, "2000-01-01", "2026-09-14");
    expect(events.length).toBe(26);
    const rows = ref.weekly.date.map((d, i) => ({ date: d, signals: { v2: ref.weekly.v2[i], vix: ref.weekly.vol_raw[i], drawdown: ref.weekly.mkt_raw[i] } }))
      .filter(r => r.date >= "2000-01-01" && r.date <= "2026-09-14");
    const ev = evaluateSignal(rows, events, "v2", 45, sp.dates);
    expect([ev.warned, ev.missed]).toEqual([14, 12]);
    const vix = evaluateSignal(rows, events, "vix", 25, sp.dates);
    expect(vix.warned + vix.missed + vix.unavailable).toBe(26);
    const labelled = rows.map(r => ({ v2: r.signals.v2, fwd: forwardOutcome(sp.dates, sp.values, r.date, "2026-09-14") }));
    const bands = outcomesByBand(labelled);
    expect(bands.find(b => b.band === "80-100")!.weeks).toBe(40);
    const auc = rankAuc(labelled.filter(r => r.v2 !== null && r.fwd).map(r => [r.v2 as number, r.fwd!.y]));
    expect(auc).not.toBeNull();
  });
});

describe("live assembly", () => {
  it("sahmGap needs ≥15 months and computes 3-mo avg minus prior-12 min", () => {
    expect(sahmGap([4, 4, 4])).toBeNull();
    const xs = Array(14).fill(4.0).concat([4.6]);
    expect(sahmGap(xs)).toBeCloseTo((4 + 4 + 4.6) / 3 - 4, 9);
  });
  it("funding is UNAVAILABLE live (TEDRATE discontinued) and nothing is fabricated", async () => {
    const { ref } = await loadV2Reference();
    const { data, provenance } = assembleLiveV2Data(ref, {}, "2026-10-13");
    const o = computeV2At(data, "2026-10-13");
    expect(o.pillars.find(p => p.pillar === "funding")!.status).toBe("unavailable");
    // No live rows supplied → daily pillars are stale → composite unavailable (fail closed).
    expect(o.status).toBe("unavailable");
    expect(o.v2).toBeNull();
    expect(provenance.find(p => p.pillar === "funding")!.note).toMatch(/Discontinued/);
  });
});

describe("isolation", () => {
  it("no public router imports the v2 shadow", () => {
    const files = ["server/routers.ts", "server/routers/marketState.ts", "server/routers/seismograph.ts", "server/routers/systemicRegime.ts"];
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/pressure\/v2|pressureV2Shadow/);
  });
});
