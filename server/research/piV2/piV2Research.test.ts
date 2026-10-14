import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSnapshotDue, decisionInstantUtc } from "./calendar";
import { runCapture } from "./capture";
import { bandForScore, computeV2At, midrankPercentile, sahmGap, stressScoreFromPercentile } from "./compute";
import { addCalendarDays, weekdayIndexUtc } from "./dates";
import { assertCandidateStaysOutsideFrozenSpec, evaluateCpTbillCandidate } from "./eval/cpTbillCandidate";
import { auroc, blockBootstrapAuroc, falseAlarmRate } from "./eval/metrics";
import { assertRetrospectiveArtifact, buildHistoricalArtifact, main as historicalMain } from "./eval/runHistoricalEval";
import { equityDrawdownEvent, evaluateFundingTarget, preregisteredEventsWithin, recessionStartWithin } from "./eval/targets";
import { assertOutOfSample, expandingYearFolds, rowsInTestWindow } from "./eval/walkForward";
import { mapFredObservations } from "./fredAdapter";
import { EXPECTED_SPEC_SHA256, SPEC_ID } from "./lock";
import { checkSpecHashDrift, evaluateResearchMonitors } from "./monitor";
import { createMemoryRepository } from "./repository";
import { researchScheduleGate, runResearchTick, INTENDED_ROUTE } from "./schedule";
import { hashSpecBytes, loadLockedSpec } from "./spec";
import type { Observation, RawDraft } from "./types";
import { calculateFaultlinePressure } from "../../pressure/engine";

const LOCKED_HASH = "5da5fbd53dccf86718a7933c61b581e4d813d336234b2eebe637512f0ddf9fcb";
const AS_OF = "2026-10-16";
const DECISION = "2026-10-16T18:00:00.000Z";

function refStress(percentile: number): number {
  const scaled = Math.min(1, Math.max(0, (percentile - 50) / 50));
  return Math.round((100 * scaled + Number.EPSILON) * 10000) / 10000;
}

function refPercentile(raw: number, history: number[]): number {
  let less = 0;
  let equal = 0;
  for (const value of history) {
    if (value < raw) less += 1;
    else if (value === raw) equal += 1;
  }
  return (100 * (less + 0.5 * equal)) / history.length;
}

function weekdays(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    const day = weekdayIndexUtc(cursor);
    if (day !== 0 && day !== 6) dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

function market(seriesId: string, date: string, value: number): Observation {
  return {
    seriesId,
    observationDate: date,
    value,
    releaseTime: `${date}T21:00:00.000Z`,
    realtimeStart: date,
    vintageId: "UNREVISED",
    provider: "FRED",
    ingestionTime: "2026-10-16T18:05:00.000Z",
  };
}

function unemploymentHistory(valueFor: (observationDate: string) => number = () => 4): Observation[] {
  const rows: Observation[] = [];
  for (let year = 2010; year <= 2026; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (year === 2026 && month > 9) break;
      const observationDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const releaseYear = month === 12 ? year + 1 : year;
      const releaseMonth = month === 12 ? 1 : month + 1;
      const realtimeStart = `${releaseYear}-${String(releaseMonth).padStart(2, "0")}-10`;
      rows.push({
        seriesId: "UNRATE",
        observationDate,
        value: valueFor(observationDate),
        releaseTime: null,
        realtimeStart,
        vintageId: `ALFRED_${realtimeStart}_${observationDate}`,
        provider: "ALFRED",
        ingestionTime: "2026-10-16T18:05:00.000Z",
      });
    }
  }
  return rows;
}

function draft(seriesId: string, date: string, value: string): RawDraft {
  return {
    seriesId,
    observationDate: date,
    valueText: value,
    releaseTime: `${date}T21:00:00.000Z`,
    realtimeStart: date,
    vintageId: "UNREVISED",
    provider: "FRED",
    coverageLabel: seriesId === "TEDRATE" ? "TED_ENDED_2022_01_21" : "FULL_PUBLIC",
    inComposite: true,
  };
}

describe("FL-PI-v2-research-0 spec lock", () => {
  it("hashes the frozen spec file to the preregistered digest", () => {
    expect(hashSpecBytes()).toBe(LOCKED_HASH);
    expect(EXPECTED_SPEC_SHA256).toBe(LOCKED_HASH);
    const loaded = loadLockedSpec();
    expect(loaded.sha256).toBe(LOCKED_HASH);
    expect(loaded.spec.specId).toBe(SPEC_ID);
    expect(loaded.spec.weightOptimization).toBe("forbidden");
    expect(loaded.spec.probabilitiesEmitted).toBe(false);
    expect(loaded.spec.platoReceivesV2).toBe(false);
    expect(loaded.spec.pillars).toHaveLength(5);
    expect(loaded.spec.nominalWeightEach).toBe(0.2);
  });

  it("keeps band edges and the median clip", () => {
    expect(bandForScore(0)).toBe("LOW");
    expect(bandForScore(24.9999)).toBe("LOW");
    expect(bandForScore(25)).toBe("MODERATE");
    expect(bandForScore(44.9999)).toBe("MODERATE");
    expect(bandForScore(45)).toBe("ELEVATED");
    expect(bandForScore(64.9999)).toBe("ELEVATED");
    expect(bandForScore(65)).toBe("HIGH");
    expect(bandForScore(79.9999)).toBe("HIGH");
    expect(bandForScore(80)).toBe("SYSTEMIC_CRISIS");
    expect(bandForScore(100)).toBe("SYSTEMIC_CRISIS");
    expect(stressScoreFromPercentile(50)).toBe(0);
    expect(stressScoreFromPercentile(100)).toBe(100);
    expect(stressScoreFromPercentile(25)).toBe(0);
    expect(midrankPercentile(2, [1, 2])).toBe(75);
    expect(refStress(refPercentile(2, [1, 2]))).toBe(50);
  });
});

describe("private v2 calculator", () => {
  const dates = weekdays("2014-01-02", "2026-10-15");

  function flatPanel(extra: Observation[] = []): Observation[] {
    return [
      ...dates.map(date => market("BAA10Y", date, 1.5)),
      ...dates.map(date => market("VIXCLS", date, 16)),
      ...dates.map(date => market("SP500", date, 4000)),
      ...weekdays("2010-01-04", "2022-01-21").map(date => market("TEDRATE", date, 0.3)),
      ...unemploymentHistory(),
      ...extra,
    ];
  }

  it("scores a flat history at zero and leaves ended TED unavailable", () => {
    const result = computeV2At({ asOfDate: AS_OF, decisionTimeUtc: DECISION, observations: flatPanel() });
    expect(result.probabilitiesEmitted).toBe(false);
    expect(result).not.toHaveProperty("crisisProbability");
    expect(JSON.stringify(result)).not.toMatch(/crisisProbability|predictedProbability/);
    expect(result.status).toBe("ok");
    expect(result.v2Score).toBe(0);
    expect(result.band).toBe("LOW");
    expect(result.nPillars).toBe(4);
    expect(result.missingDataStatus).toBe("partial");
    const funding = result.pillars.find(pillar => pillar.id === "funding_stress");
    expect(funding?.status).toBe("unavailable");
    expect(funding?.reason).toBe("FUNDING_SUCCESSOR_NOT_APPROVED");
    expect(result.pillars.find(pillar => pillar.id === "credit_stress")?.proxyLabel).toBe("IG_SPREAD_PROXY");
    expect(result.benchmarks.vixLevel).toBe(16);
    expect(result.benchmarks.vixAtLeast25).toBe(false);
    expect(result.benchmarks.spxDrawdownPct).toBe(0);
  });

  it("matches an independent percentile for a record credit print and ignores the future", () => {
    const creditValues = dates.map((_, index) => index + 1);
    const observations = [
      ...dates.map((date, index) => market("BAA10Y", date, creditValues[index]!)),
      ...dates.map((date, index) => market("VIXCLS", date, index + 1)),
      ...dates.map((date, index) => market("SP500", date, 5000 - index)),
      ...weekdays("2010-01-04", "2022-01-21").map(date => market("TEDRATE", date, 0.2)),
    ];
    const result = computeV2At({ asOfDate: AS_OF, decisionTimeUtc: DECISION, observations });
    expect(result.nPillars).toBe(3);
    expect(result.status).toBe("ok");
    const expectedPillars = ["BAA10Y", "VIXCLS"].map(seriesId => {
      const history = observations.filter(row => row.seriesId === seriesId).map(row => row.value);
      return refStress(refPercentile(history[history.length - 1]!, history));
    });
    const equity = result.pillars.find(pillar => pillar.id === "equity_drawdown");
    expect(equity?.status).toBe("ok");
    expect(equity?.score).toBeGreaterThan(90);
    const credit = result.pillars.find(pillar => pillar.id === "credit_stress");
    const vol = result.pillars.find(pillar => pillar.id === "market_volatility");
    expect(credit?.score).toBe(expectedPillars[0]);
    expect(vol?.score).toBe(expectedPillars[1]);
    const composite = Math.round(((credit!.score! + vol!.score! + equity!.score!) / 3 + Number.EPSILON) * 10000) / 10000;
    expect(result.v2Score).toBe(composite);
    expect(result.band).toBe("SYSTEMIC_CRISIS");

    const leaked = computeV2At({
      asOfDate: AS_OF,
      decisionTimeUtc: DECISION,
      observations: [...observations, market("BAA10Y", "2026-10-17", 1_000_000)],
    });
    expect(leaked.v2Score).toBe(result.v2Score);
    expect(leaked.referenceSha256).toBe(result.referenceSha256);
  });

  it("does not impute missing pillars and still returns an unavailable total below three pillars", () => {
    const observations = [
      ...dates.map(date => market("BAA10Y", date, 2)),
      ...dates.map(date => market("VIXCLS", date, 18)),
    ];
    const result = computeV2At({ asOfDate: AS_OF, decisionTimeUtc: DECISION, observations });
    expect(result.status).toBe("unavailable");
    expect(result.v2Score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.nPillars).toBe(2);
    expect(result.missingDataStatus).toBe("unavailable");
    for (const pillar of result.pillars.filter(item => item.status === "unavailable")) {
      expect(pillar.score).toBeNull();
      expect(pillar.score).not.toBe(50);
    }
  });

  it("marks daily inputs older than 10 days stale and rejects funding substitutes", () => {
    const staleDates = weekdays("2014-01-02", "2026-09-01");
    const result = computeV2At({
      asOfDate: AS_OF,
      decisionTimeUtc: DECISION,
      observations: [
        ...dates.map(date => market("BAA10Y", date, 2)),
        ...staleDates.map(date => market("VIXCLS", date, 18)),
        ...dates.map(date => market("SP500", date, 4000)),
        ...unemploymentHistory(),
      ],
    });
    expect(result.pillars.find(pillar => pillar.id === "market_volatility")?.reason).toBe("STALE");
    expect(result.benchmarks.vixLevel).toBeNull();
    expect(() => computeV2At({
      asOfDate: AS_OF,
      decisionTimeUtc: DECISION,
      observations: [...dates.map(date => market("BAA10Y", date, 2)), market("DCPF3M", "2026-10-15", 5)],
    })).toThrow(/FL-PI-v2-research-0/);
    expect(() => computeV2At({
      asOfDate: AS_OF,
      decisionTimeUtc: DECISION,
      observations: [market("BAMLH0A0HYM2", "2026-10-15", 8)],
    })).toThrow(/not a pillar series/);
  });

  it("keeps a single current unemployment vintage from counting as real-time history", () => {
    const dumped = unemploymentHistory().map(row => ({ ...row, realtimeStart: AS_OF, vintageId: `FRED_CURRENT_${AS_OF}` }));
    const result = computeV2At({
      asOfDate: AS_OF,
      decisionTimeUtc: DECISION,
      observations: [
        ...dates.map(date => market("BAA10Y", date, 2)),
        ...dates.map(date => market("VIXCLS", date, 16)),
        ...dates.map(date => market("SP500", date, 4000)),
        ...dumped,
      ],
    });
    expect(result.pillars.find(pillar => pillar.id === "unemployment_deterioration")?.reason).toBe("INSUFFICIENT_HISTORY");
  });

  it("ignores an unemployment vintage that was not released yet", () => {
    const base = [
      ...dates.map(date => market("BAA10Y", date, 2)),
      ...dates.map(date => market("VIXCLS", date, 16)),
      ...dates.map(date => market("SP500", date, 4000)),
      ...unemploymentHistory(),
    ];
    const before = computeV2At({ asOfDate: AS_OF, decisionTimeUtc: DECISION, observations: base });
    const after = computeV2At({
      asOfDate: AS_OF,
      decisionTimeUtc: DECISION,
      observations: [...base, {
        seriesId: "UNRATE",
        observationDate: "2026-10-01",
        value: 20,
        releaseTime: null,
        realtimeStart: "2026-10-20",
        vintageId: "ALFRED_FUTURE",
        provider: "ALFRED",
        ingestionTime: "2026-10-16T18:05:00.000Z",
      }],
    });
    expect(after.pillars.find(pillar => pillar.id === "unemployment_deterioration")).toEqual(
      before.pillars.find(pillar => pillar.id === "unemployment_deterioration"),
    );
  });

  it("computes the Sahm gap from the published three-month and twelve-month windows", () => {
    const rates = [...Array(14).fill(4), 5, 6, 7];
    expect(sahmGap(rates.slice(0, 14))).toBe(0);
    expect(sahmGap(rates.slice(0, 15))).toBeCloseTo((4 + 4 + 5) / 3 - 4, 10);
    expect(sahmGap(rates.slice(0, 16))).toBeCloseTo((4 + 5 + 6) / 3 - 4, 10);
    expect(sahmGap(rates.slice(0, 17))).toBeCloseTo((5 + 6 + 7) / 3 - 4, 10);
  });
});

describe("append-only Friday store and ledger separation", () => {
  const dates = weekdays("2014-01-02", "2026-10-15");

  function draftsFor(creditValue: (index: number) => string): RawDraft[] {
    return [
      ...dates.map((date, index) => draft("BAA10Y", date, creditValue(index))),
      ...dates.map(date => draft("VIXCLS", date, "16")),
      ...dates.map(date => draft("SP500", date, "4000")),
      ...unemploymentHistory().map(row => ({
        seriesId: row.seriesId,
        observationDate: row.observationDate,
        valueText: String(row.value),
        releaseTime: null,
        realtimeStart: row.realtimeStart,
        vintageId: row.vintageId,
        provider: row.provider,
        coverageLabel: "ALFRED",
        inComposite: true,
      })),
    ];
  }

  it("appends one immutable forward snapshot and rejects a second write", () => {
    const repo = createMemoryRepository();
    const first = runCapture({
      repo,
      drafts: draftsFor(() => "1.5"),
      asOfDate: AS_OF,
      nowIso: "2026-10-16T18:05:00.000Z",
      runTrigger: "SCHEDULED_CRON",
      writeSnapshot: true,
    });
    expect(first.snapshot).toBe("appended");
    expect(first.computation?.v2Score).toBe(0);
    const stored = repo.listSnapshots()[0]!;
    expect(stored.recordClass).toBe("FORWARD_LIVE");
    expect(Object.isFrozen(stored)).toBe(true);
    expect(() => { (stored as { v2Score: number | null }).v2Score = 99; }).toThrow();
    expect(repo.listSnapshots()[0]!.v2Score).toBe(0);
    expect(repo.listLedger()).toEqual([expect.objectContaining({ recordClass: "FORWARD_LIVE", origin: "OBSERVED_AT_DECISION", rowKind: "SCORE" })]);

    const second = runCapture({
      repo,
      drafts: [{ ...draft("BAA10Y", "2026-10-16", "80"), releaseTime: "2026-10-16T17:00:00.000Z" }],
      asOfDate: AS_OF,
      nowIso: "2026-10-16T18:06:00.000Z",
      runTrigger: "SCHEDULED_CRON",
      writeSnapshot: true,
    });
    expect(second.snapshot).toBe("already_exists");
    expect(second.conflict).toBe(true);
    expect(repo.listSnapshots()).toHaveLength(1);
    expect(repo.listSnapshots()[0]!.v2Score).toBe(0);
    expect(repo.listMonitor().some(row => row.kind === "CALCULATION_FAILURE")).toBe(true);
  });

  it("stores an unavailable Friday when fewer than three pillars exist", () => {
    const repo = createMemoryRepository();
    const result = runCapture({
      repo,
      drafts: dates.map(date => draft("BAA10Y", date, "1.5")),
      asOfDate: AS_OF,
      nowIso: "2026-10-16T18:05:00.000Z",
      runTrigger: "ADMIN_SEED",
      writeSnapshot: true,
    });
    expect(result.snapshot).toBe("appended");
    expect(repo.listSnapshots()[0]).toEqual(expect.objectContaining({ status: "unavailable", v2Score: null, band: null }));
  });

  it("rejects retrospective rows in the forward table and backfill labeled forward", () => {
    const repo = createMemoryRepository();
    expect(() => repo.appendSnapshot({
      asOfDate: "2026-10-15",
      onSpecGrid: true,
      recordClass: "FORWARD_LIVE",
      specId: SPEC_ID,
      specSha256: LOCKED_HASH,
      implementationVersion: "pi-v2-research-impl-0.1.0",
      referenceSha256: "abc",
      runTrigger: "ADMIN_SEED",
      status: "unavailable",
      v2Score: null,
      band: null,
      nPillars: 0,
      missingDataStatus: "unavailable",
      pillarsJson: "[]",
      benchmarksJson: "{}",
      inputsProvenanceJson: "[]",
      inputSnapshotHash: "abc",
      decisionTimeUtc: DECISION,
      v1Reading: null,
      v1MethodologyVersion: null,
    }, "2026-10-15T18:00:00.000Z")).toThrow(/not an official Friday/);

    expect(() => repo.appendLedger({
      recordClass: "FORWARD_LIVE",
      origin: "BACKFILL",
      rowKind: "SCORE",
      asOfDate: AS_OF,
      specId: SPEC_ID,
      specSha256: LOCKED_HASH,
      implementationVersion: "pi-v2-research-impl-0.1.0",
      targetId: "PI_V2_SCORE",
      horizon: "spot",
      snapshotId: 1,
      parentLedgerId: null,
      score: 10,
      outcome: null,
      artifactKind: "FORWARD_SCORE",
      notes: null,
    }, "2026-10-16T18:05:00.000Z")).toThrow(/backfilled row cannot be labeled FORWARD_LIVE/);

    const retrospective = repo.appendLedger({
      recordClass: "RETROSPECTIVE",
      origin: "BACKFILL",
      rowKind: "SCORE",
      asOfDate: "2020-03-13",
      specId: SPEC_ID,
      specSha256: LOCKED_HASH,
      implementationVersion: "pi-v2-research-impl-0.1.0",
      targetId: "T-EQ10",
      horizon: "63s",
      snapshotId: null,
      parentLedgerId: null,
      score: 12,
      outcome: null,
      artifactKind: "HISTORICAL_BACKTEST",
      notes: null,
    }, "2026-10-14T00:00:00.000Z");
    expect(retrospective.recordClass).toBe("RETROSPECTIVE");
    expect(() => repo.appendRaw({
      seriesId: "DCPF3M",
      observationDate: "2020-01-02",
      valueText: "2",
      releaseTime: "2020-01-02T21:00:00.000Z",
      realtimeStart: "2020-01-02",
      vintageId: "UNREVISED",
      provider: "FRED",
      coverageLabel: "FULL_PUBLIC",
      inComposite: true,
    }, "2026-10-16T18:05:00.000Z")).toThrow(/cannot be stored/);
  });

  it("keeps the FRED high-yield window out of the score and labels it", () => {
    const base = draftsFor(() => "1.5");
    const left = createMemoryRepository();
    const right = createMemoryRepository();
    runCapture({ repo: left, drafts: base, asOfDate: AS_OF, nowIso: "2026-10-16T18:05:00.000Z", runTrigger: "SCHEDULED_CRON", writeSnapshot: true });
    runCapture({
      repo: right,
      drafts: [...base, {
        seriesId: "BAMLH0A0HYM2",
        observationDate: "2024-06-03",
        valueText: "12.5",
        releaseTime: "2024-06-03T21:00:00.000Z",
        realtimeStart: "2024-06-03",
        vintageId: "UNREVISED",
        provider: "FRED",
        coverageLabel: "FRED_WINDOW_FROM_2023_10_16",
        inComposite: false,
      }],
      asOfDate: AS_OF,
      nowIso: "2026-10-16T18:05:00.000Z",
      runTrigger: "SCHEDULED_CRON",
      writeSnapshot: true,
    });
    expect(right.listSnapshots()[0]!.v2Score).toBe(left.listSnapshots()[0]!.v2Score);
    expect(right.listSnapshots()[0]!.inputsProvenanceJson).toContain("NOT_IN_SPEC_FRED_WINDOW_ONLY");
    expect(right.listSnapshots()[0]!.inputsProvenanceJson).toContain("FRED_WINDOW_FROM_2023_10_16");
  });
});

describe("schedule gate, monitors, and evaluation scripts", () => {
  it("stays disabled by default and in production", async () => {
    const loader = vi.fn();
    const closed = await runResearchTick({
      now: new Date("2026-10-16T18:05:00.000Z"),
      env: {},
      repo: createMemoryRepository(),
      loadObservations: loader,
    });
    expect(closed.ran).toBe(false);
    expect(closed.reason).toBe("flag_off");
    expect(loader).not.toHaveBeenCalled();
    expect(researchScheduleGate({
      NODE_ENV: "production",
      PI_V2_RESEARCH_SCHEDULE_ENABLED: "true",
      PI_V2_RESEARCH_ISOLATED_ACK: "research-only-not-production",
    }).enabled).toBe(false);
    expect(researchScheduleGate({
      RAILWAY_ENVIRONMENT: "production",
      PI_V2_RESEARCH_SCHEDULE_ENABLED: "true",
      PI_V2_RESEARCH_ISOLATED_ACK: "research-only-not-production",
    }).enabled).toBe(false);
  });

  it("uses the New York Friday clock, including winter time", () => {
    expect(decisionInstantUtc("2026-10-16").toISOString()).toBe("2026-10-16T18:00:00.000Z");
    expect(decisionInstantUtc("2026-11-06").toISOString()).toBe("2026-11-06T19:00:00.000Z");
    expect(isSnapshotDue(new Date("2026-10-16T17:30:00.000Z")).due).toBe(false);
    expect(isSnapshotDue(new Date("2026-10-16T18:00:00.000Z"))).toEqual({ due: true, asOfDate: AS_OF, reason: "official_friday" });
    expect(isSnapshotDue(new Date("2026-11-06T18:30:00.000Z")).due).toBe(false);
    expect(isSnapshotDue(new Date("2026-11-06T19:00:00.000Z")).due).toBe(true);
    expect(isSnapshotDue(new Date("2026-10-09T18:00:00.000Z")).reason).toBe("before_first_official_friday");
  });

  it("alerts on a missing Friday, staleness, and spec-hash drift", () => {
    const now = new Date("2026-10-16T18:05:00.000Z");
    const missing = evaluateResearchMonitors({
      now,
      snapshotDates: [],
      raw: [],
      actualSpecHash: LOCKED_HASH,
      lockedSpecHash: LOCKED_HASH,
    });
    expect(missing.some(item => item.kind === "MISSING_FRIDAY_SNAPSHOT" && item.asOfDate === AS_OF)).toBe(true);
    expect(missing.some(item => item.kind === "STALE_DATA")).toBe(true);
    expect(missing.some(item => item.kind === "EXPECTED_UNAVAILABLE")).toBe(true);
    const present = evaluateResearchMonitors({
      now,
      snapshotDates: [AS_OF],
      raw: [
        { seriesId: "BAA10Y", observationDate: "2026-10-15" },
        { seriesId: "VIXCLS", observationDate: "2026-10-15" },
        { seriesId: "SP500", observationDate: "2026-10-15" },
        { seriesId: "UNRATE", observationDate: "2026-09-01" },
      ],
      actualSpecHash: LOCKED_HASH,
      lockedSpecHash: LOCKED_HASH,
    });
    expect(present.some(item => item.kind === "MISSING_FRIDAY_SNAPSHOT")).toBe(false);
    expect(present.some(item => item.kind === "STALE_DATA")).toBe(false);
    expect(checkSpecHashDrift("deadbeef", LOCKED_HASH)?.kind).toBe("SPEC_HASH_DRIFT");
    expect(checkSpecHashDrift(LOCKED_HASH, LOCKED_HASH)).toBeNull();
  });

  it("maps a FRED high-yield print onto the window label and leaves it out of the composite", () => {
    const drafts = mapFredObservations({
      seriesId: "BAMLH0A0HYM2",
      observations: [{ date: "2023-10-16", value: "4.2" }, { date: "2026-10-17", value: "9" }],
      ingestionTime: "2026-10-16T18:05:00.000Z",
      ingestionDate: AS_OF,
      coverageLabel: "FRED_WINDOW_FROM_2023_10_16",
      inComposite: false,
      vintageId: "UNREVISED",
      realtimeStart: null,
      provider: "FRED",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.coverageLabel).toBe("FRED_WINDOW_FROM_2023_10_16");
    expect(drafts[0]!.inComposite).toBe(false);
    expect(drafts[0]!.releaseTime).toBe("2023-10-16T21:00:00.000Z");
  });

  it("evaluates targets without look-ahead and refuses manufactured forward rows", () => {
    const closes = [
      { date: "2026-01-02", value: 100 },
      { date: "2026-01-05", value: 80 },
    ];
    expect(equityDrawdownEvent(closes, "2026-01-02", -10, { sessions: 21 })).toBe(true);
    expect(equityDrawdownEvent([{ date: "2026-01-02", value: 80 }, { date: "2026-01-05", value: 100 }], "2026-01-02", -10, { sessions: 21 })).toBe(false);
    expect(recessionStartWithin("2007-11-01", 180, ["2007-12-01"])).toBe(true);
    expect(recessionStartWithin("2007-12-01", 180, ["2007-12-01"])).toBe(false);
    expect(() => preregisteredEventsWithin({ asOfDate: "2020-01-01", horizonDays: 30, events: [], preregistered: false, listId: "" })).toThrow(/preregistered/);
    expect(evaluateFundingTarget().status).toBe("NOT_EVALUABLE");

    const scores = [0, 0, 1, 1];
    const labels = [false, false, true, true];
    expect(auroc(scores, labels)).toBe(1);
    expect(falseAlarmRate({ scores: [10, 70, 70], events: [false, false, false], threshold: 65, horizonSteps: 2 }).rate).toBe(1);
    const separableScores = Array.from({ length: 80 }, (_, index) => index);
    const separableLabels = separableScores.map(score => score >= 40);
    const boot = blockBootstrapAuroc({ scores: separableScores, labels: separableLabels, draws: 30, blockLength: 10, seed: 20261014 });
    expect(boot.auc).toBe(1);
    expect(boot.status).toBe("ok");

    const folds = expandingYearFolds(["2010-06-01", "2016-06-01", "2017-06-01"], 5);
    expect(folds[0]!.testStart).toBe("2016-01-01");
    const testRows = rowsInTestWindow([{ asOfDate: "2016-06-01" }, { asOfDate: "2010-06-01" }], folds[0]!);
    expect(testRows.map(row => row.asOfDate)).toEqual(["2016-06-01"]);
    expect(() => assertOutOfSample([{ asOfDate: "2010-06-01" }], folds[0]!)).toThrow(/training window/);

    const artifact = buildHistoricalArtifact({
      panels: [{ asOfDate: "2020-03-13", decisionTimeUtc: "2020-03-13T18:00:00.000Z", observations: [] }],
    });
    assertRetrospectiveArtifact(artifact);
    expect(artifact.eligibleForForwardLedger).toBe(false);
    expect(artifact.scores[0]!.origin).toBe("BACKFILL");
    expect(artifact.evaluations["T-EQ10"]!.status).toBe("NOT_COMPUTED");
    expect(historicalMain([])).toBe(2);
  });

  it("keeps CP minus T-bill outside the frozen spec", () => {
    expect(() => assertCandidateStaysOutsideFrozenSpec(SPEC_ID)).toThrow(/cannot be inserted/);
    const result = evaluateCpTbillCandidate({
      cp: [
        { date: "2024-01-02", value: 5.3 },
        { date: "2024-01-03", value: 5.3 },
        { date: "2024-01-04", value: 5.3 },
        { date: "2024-01-05", value: 5.3 },
        { date: "2024-01-08", value: 5.3 },
      ],
      tbill: [
        { date: "2024-01-02", value: 5 },
        { date: "2024-01-03", value: 5 },
        { date: "2024-01-04", value: 5 },
        { date: "2024-01-05", value: 5 },
        { date: "2024-01-08", value: 5 },
      ],
      threshold: 0.2,
    });
    expect(result.frozenSpecAccepts).toBe(false);
    expect(result.evaluable).toBe(false);
    expect(result.claim).toBe("NONE");
    expect(result.pass).toBeNull();
    expect(result.descriptiveStreakCount).toBe(1);
    expect(result.spreads[0]!.spread).toBeCloseTo(0.3);
    const unset = evaluateCpTbillCandidate({ cp: [], tbill: [], threshold: null });
    expect(unset.descriptiveStreakCount).toBeNull();
    expect(unset.evaluable).toBe(false);
  });
});

describe("production boundary", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
  });

  it("leaves the v1 pressure engine on its six-vector fallback output", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.vectors.map(vector => vector.id)).toEqual([
      "liquidity-stress",
      "credit-contagion",
      "volatility-regime",
      "macro-sensitivity",
      "market-breadth",
      "ai-bubble",
    ]);
    expect(result.vectors.map(vector => vector.weight)).toEqual([0.2, 0.2, 0.15, 0.2, 0.1, 0.15]);
    expect(result.dataSource).toBe("fallback");
    expect(result).not.toHaveProperty("v2Score");
    expect(result).not.toHaveProperty("specSha256");
  });

  it("is not imported by public routes, PLATO, or the v1 engine", () => {
    const root = process.cwd();
    const denied = [
      "server/_core/index.ts",
      "server/pressure/engine.ts",
      "server/pressure/shadowEngine.ts",
      "server/ashaEngine.ts",
      "server/evidencePacket.ts",
      "server/scheduledSeismograph.ts",
    ];
    for (const relative of denied) {
      const source = readFileSync(join(root, relative), "utf8");
      expect(source).not.toContain("research/piV2");
      expect(source).not.toContain(INTENDED_ROUTE);
      expect(source).not.toContain("FL-PI-v2-research-0");
    }
    const files = walk(join(root, "client"));
    for (const file of files) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      expect(readFileSync(file, "utf8")).not.toContain("research/piV2");
    }
    const migration = readFileSync(join(root, "drizzle/0072_pi_v2_research_private.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE `piV2ResearchSnapshots`");
    expect(migration).toContain("BEFORE UPDATE");
    expect(migration).toContain("BEFORE DELETE");
    expect(migration).toContain("FORWARD_LIVE");
    expect(migration).toContain("RETROSPECTIVE");
    expect(migration).not.toContain("shadowModelReadings");
    expect(migration).not.toContain("DROP TABLE");
    const schema = readFileSync(join(root, "drizzle/schema.ts"), "utf8");
    expect(schema).toContain("piV2ResearchSnapshots");
    const journal = readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8");
    expect(journal).toContain("0072_pi_v2_research_private");
    const engine = readFileSync(join(root, "server/pressure/engine.ts"), "utf8");
    expect(engine).toContain("runV3HShadow");
    expect(engine).toContain("weight: 0.20");
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}
