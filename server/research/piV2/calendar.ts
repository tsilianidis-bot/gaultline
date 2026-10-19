import { daysBetween, isFridayDate } from "./dates";
import { FIRST_OFFICIAL_FRIDAY, loadLockedSpec } from "./spec";

export const DECISION_TIME_ZONE = "America/New_York";
export const DECISION_LOCAL_TIME = "14:00";

export type CivilClock = {
  date: string;
  hour: number;
  minute: number;
  weekday: string;
};

export function civilClock(instant: Date, timeZone = DECISION_TIME_ZONE): CivilClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

/**
 * Convert a civil date and HH:MM in a zone to a UTC instant.
 * Two passes correct the offset when the first guess lands across a DST boundary.
 */
export function zonedCivilToUtc(date: string, time: string, timeZone = DECISION_TIME_ZONE): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const offsetMs = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return asUtc - instant;
  };
  const wall = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0);
  const first = wall - offsetMs(wall);
  return new Date(wall - offsetMs(first));
}

export function decisionInstantUtc(asOfDate: string): Date {
  return zonedCivilToUtc(asOfDate, DECISION_LOCAL_TIME, DECISION_TIME_ZONE);
}

export function isOfficialSnapshotDate(asOfDate: string): boolean {
  const spec = loadLockedSpec().spec;
  return asOfDate >= spec.firstOfficialFriday && isFridayDate(asOfDate);
}

export function isSnapshotDue(instant: Date): { due: boolean; asOfDate: string; reason: string } {
  const clock = civilClock(instant);
  if (clock.date < FIRST_OFFICIAL_FRIDAY) return { due: false, asOfDate: clock.date, reason: "before_first_official_friday" };
  if (!isFridayDate(clock.date)) return { due: false, asOfDate: clock.date, reason: "not_friday" };
  const dueMinutes = 14 * 60;
  const nowMinutes = clock.hour * 60 + clock.minute;
  if (nowMinutes < dueMinutes) return { due: false, asOfDate: clock.date, reason: "before_decision_clock" };
  return { due: true, asOfDate: clock.date, reason: "official_friday" };
}

export function officialFridaysThrough(asOfDate: string, watchFrom = FIRST_OFFICIAL_FRIDAY): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${watchFrom}T12:00:00.000Z`);
  const end = new Date(`${asOfDate}T12:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isOfficialSnapshotDate(iso)) dates.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function daysSince(earlier: string, later: string): number {
  return daysBetween(earlier, later);
}
