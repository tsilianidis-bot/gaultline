import { addCalendarDays } from "../dates";
import { loadLockedSpec } from "../spec";

export const NBER_PEAK_LIST_ID = "NBER_US_PEAKS_THROUGH_2020_02";

/**
 * Public NBER business-cycle peaks (recession starts) through February 2020.
 * A later NBER peak requires a new list id. Absence from this list is not a claim
 * that no later recession was declared.
 */
export const NBER_PEAKS_THROUGH_2020_02 = [
  "1948-11-01",
  "1953-07-01",
  "1957-08-01",
  "1960-04-01",
  "1969-12-01",
  "1973-11-01",
  "1980-01-01",
  "1981-07-01",
  "1990-07-01",
  "2001-03-01",
  "2007-12-01",
  "2020-02-01",
] as const;

export type ClosePoint = { date: string; value: number };

export function forwardCloseToCloseReturnPct(closes: readonly ClosePoint[], asOfDate: string, horizon: { calendarDays?: number; sessions?: number }): number | null {
  const sorted = [...closes].sort((left, right) => left.date.localeCompare(right.date));
  const base = [...sorted].reverse().find(point => point.date <= asOfDate);
  if (!base || !(base.value > 0)) return null;
  let future = sorted.filter(point => point.date > asOfDate);
  if (horizon.sessions != null) future = future.slice(0, horizon.sessions);
  if (horizon.calendarDays != null) {
    const end = addCalendarDays(asOfDate, horizon.calendarDays);
    future = future.filter(point => point.date <= end);
  }
  if (future.length === 0) return null;
  const trough = Math.min(...future.map(point => point.value));
  return ((trough / base.value) - 1) * 100;
}

export function equityDrawdownEvent(closes: readonly ClosePoint[], asOfDate: string, thresholdPct: number, horizon: { calendarDays?: number; sessions?: number }): boolean | null {
  const move = forwardCloseToCloseReturnPct(closes, asOfDate, horizon);
  if (move == null) return null;
  return move <= thresholdPct;
}

export function recessionStartWithin(asOfDate: string, horizonDays: number, peaks: readonly string[]): boolean {
  const end = addCalendarDays(asOfDate, horizonDays);
  return peaks.some(peak => peak > asOfDate && peak <= end);
}

export function preregisteredEventsWithin(args: {
  asOfDate: string;
  horizonDays: number;
  events: readonly { date: string }[];
  preregistered: boolean;
  listId: string;
}): boolean {
  if (!args.preregistered || args.listId.trim() === "") {
    throw new Error("T-BANK requires a preregistered event list id");
  }
  const end = addCalendarDays(args.asOfDate, args.horizonDays);
  return args.events.some(event => event.date > args.asOfDate && event.date <= end);
}

export function evaluateFundingTarget(): { status: "NOT_EVALUABLE"; reason: string } {
  const spec = loadLockedSpec().spec;
  return {
    status: spec.evaluation.tliqUnderThisSpec,
    reason: "FL-PI-v2-research-0 has no approved funding successor and no preregistered T-LIQ threshold.",
  };
}

export type RegimeLabel = "pre-GFC" | "GFC" | "2010-2019" | "2020-2021" | "2022-2026" | "pre-2013" | "post-2013";

export function regimeLabels(date: string): RegimeLabel[] {
  const labels: RegimeLabel[] = [];
  if (date < "2007-12-01") labels.push("pre-GFC");
  if (date >= "2007-12-01" && date <= "2009-06-30") labels.push("GFC");
  if (date >= "2010-01-01" && date <= "2019-12-31") labels.push("2010-2019");
  if (date >= "2020-01-01" && date <= "2021-12-31") labels.push("2020-2021");
  if (date >= "2022-01-01" && date <= "2026-12-31") labels.push("2022-2026");
  labels.push(date < "2013-01-01" ? "pre-2013" : "post-2013");
  return labels;
}
