import { civilClock, officialFridaysThrough } from "./calendar";
import { FIRST_OFFICIAL_FRIDAY, loadLockedSpec } from "./spec";
import { SPEC_ID } from "./lock";
import { daysBetween } from "./dates";
import type { MonitorKind } from "./types";

export type MonitorDraft = {
  kind: MonitorKind;
  severity: "info" | "alert";
  specId: typeof SPEC_ID;
  specSha256: string | null;
  asOfDate: string | null;
  detail: Record<string, unknown>;
};

const LIVE_SERIES = [
  { seriesId: "BAA10Y", staleDays: 10 },
  { seriesId: "VIXCLS", staleDays: 10 },
  { seriesId: "SP500", staleDays: 10 },
  { seriesId: "UNRATE", staleDays: 70 },
] as const;

export function checkSpecHashDrift(actual: string, locked: string): MonitorDraft | null {
  if (actual === locked) return null;
  return {
    kind: "SPEC_HASH_DRIFT",
    severity: "alert",
    specId: SPEC_ID,
    specSha256: actual,
    asOfDate: null,
    detail: { actual, locked },
  };
}

export function evaluateResearchMonitors(args: {
  now: Date;
  snapshotDates: readonly string[];
  raw: readonly { seriesId: string; observationDate: string }[];
  actualSpecHash: string;
  lockedSpecHash: string;
  calculationError?: string | null;
  watchFrom?: string;
}): MonitorDraft[] {
  const spec = loadLockedSpec().spec;
  const findings: MonitorDraft[] = [];
  const drift = checkSpecHashDrift(args.actualSpecHash, args.lockedSpecHash);
  if (drift) findings.push(drift);
  if (args.calculationError) {
    findings.push({
      kind: "CALCULATION_FAILURE",
      severity: "alert",
      specId: SPEC_ID,
      specSha256: args.actualSpecHash,
      asOfDate: civilClock(args.now).date,
      detail: { message: args.calculationError },
    });
  }
  const clock = civilClock(args.now);
  const dueMinutes = 14 * 60;
  const afterClock = clock.hour * 60 + clock.minute >= dueMinutes;
  if (afterClock && clock.date >= (args.watchFrom ?? FIRST_OFFICIAL_FRIDAY)) {
    const due = officialFridaysThrough(clock.date, args.watchFrom ?? spec.firstOfficialFriday);
    const have = new Set(args.snapshotDates);
    for (const date of due) {
      if (!have.has(date)) {
        findings.push({
          kind: "MISSING_FRIDAY_SNAPSHOT",
          severity: "alert",
          specId: SPEC_ID,
          specSha256: args.lockedSpecHash,
          asOfDate: date,
          detail: { date },
        });
      }
    }
  }
  for (const series of LIVE_SERIES) {
    const dates = args.raw.filter(row => row.seriesId === series.seriesId).map(row => row.observationDate).sort();
    const latest = dates[dates.length - 1];
    if (!latest || daysBetween(latest, clock.date) > series.staleDays) {
      findings.push({
        kind: "STALE_DATA",
        severity: "alert",
        specId: SPEC_ID,
        specSha256: args.lockedSpecHash,
        asOfDate: clock.date,
        detail: { seriesId: series.seriesId, latest: latest ?? null, staleDays: series.staleDays },
      });
    }
  }
  const tedDates = args.raw.filter(row => row.seriesId === "TEDRATE").map(row => row.observationDate).sort();
  const tedLatest = tedDates[tedDates.length - 1] ?? null;
  if (clock.date > "2022-01-31") {
    findings.push({
      kind: "EXPECTED_UNAVAILABLE",
      severity: "info",
      specId: SPEC_ID,
      specSha256: args.lockedSpecHash,
      asOfDate: clock.date,
      detail: {
        seriesId: "TEDRATE",
        latest: tedLatest,
        reason: "FUNDING_SUCCESSOR_NOT_APPROVED",
      },
    });
  }
  return findings;
}
