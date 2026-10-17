/**
 * NYSE session-calendar policy used only to decide when a scheduled Seismograph
 * run may be classified as the daily post-close run. It never changes market
 * inputs, scoring, or Pressure Index methodology.
 *
 * Every valid session is eligible at 4:15 PM America/New_York. Early-close
 * sessions still identify their actual 1:00 PM close, but retain the approved
 * 4:15 PM post-close run. The external scheduler must invoke this route in
 * that window; calls outside it are intentionally skipped.
 */
export type NyseSessionKind = "CLOSED" | "REGULAR" | "EARLY_CLOSE";

export interface NyseSeismographRunWindow {
  etDate: string | null;
  session: NyseSessionKind;
  marketCloseAtEt: string | null;
  scheduledRunAtEt: string | null;
  scheduledWindowEndEt: string | null;
  isScheduledWindow: boolean;
  reason: string;
}

const ET_TIME_ZONE = "America/New_York";
const POST_CLOSE_DELAY_MINUTES = 15;
const SCHEDULED_WINDOW_MINUTES = 30;
const ET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type CalendarDate = { year: number; month: number; day: number };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: CalendarDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function fromUtcMillis(timestamp: number): CalendarDate {
  const date = new Date(timestamp);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMillis(Date.UTC(date.year, date.month - 1, date.day + days));
}

function weekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function nthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, ordinal: number): CalendarDate {
  const first = { year, month, day: 1 };
  const offset = (dayOfWeek - weekday(first) + 7) % 7;
  return { year, month, day: 1 + offset + (ordinal - 1) * 7 };
}

function lastWeekdayOfMonth(year: number, month: number, dayOfWeek: number): CalendarDate {
  const last = fromUtcMillis(Date.UTC(year, month, 0));
  return addDays(last, -((weekday(last) - dayOfWeek + 7) % 7));
}

/** Gregorian computus. NYSE is closed on Good Friday. */
function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

function observedFixedHoliday(year: number, month: number, day: number): CalendarDate {
  const actual = { year, month, day };
  const dayOfWeek = weekday(actual);
  if (dayOfWeek === 6) return addDays(actual, -1);
  if (dayOfWeek === 0) return addDays(actual, 1);
  return actual;
}

function sameDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Standard NYSE full-day closures. Extraordinary exchange closures remain explicit operations events. */
function holidayName(date: CalendarDate): string | null {
  for (const year of [date.year - 1, date.year, date.year + 1]) {
    const holidays: Array<{ name: string; date: CalendarDate }> = [
      { name: "New Year's Day", date: observedFixedHoliday(year, 1, 1) },
      { name: "Martin Luther King Jr. Day", date: nthWeekdayOfMonth(year, 1, 1, 3) },
      { name: "Washington's Birthday", date: nthWeekdayOfMonth(year, 2, 1, 3) },
      { name: "Good Friday", date: addDays(easterSunday(year), -2) },
      { name: "Memorial Day", date: lastWeekdayOfMonth(year, 5, 1) },
      { name: "Juneteenth", date: observedFixedHoliday(year, 6, 19) },
      { name: "Independence Day", date: observedFixedHoliday(year, 7, 4) },
      { name: "Labor Day", date: nthWeekdayOfMonth(year, 9, 1, 1) },
      { name: "Thanksgiving Day", date: nthWeekdayOfMonth(year, 11, 4, 4) },
      { name: "Christmas Day", date: observedFixedHoliday(year, 12, 25) },
    ];
    const match = holidays.find(holiday => sameDate(holiday.date, date));
    if (match) return match.name;
  }
  return null;
}

function earlyCloseName(date: CalendarDate): string | null {
  // Never override a full-day closure (for example, July 3 observed as the July 4 holiday).
  if (holidayName(date)) return null;
  const thanksgiving = nthWeekdayOfMonth(date.year, 11, 4, 4);
  if (sameDate(date, addDays(thanksgiving, 1))) return "Day after Thanksgiving";
  if (date.month === 12 && date.day === 24) return "Christmas Eve";
  if (date.month === 7 && date.day === 3) return "Day before Independence Day";
  return null;
}

function easternFields(at: Date): { date: CalendarDate; minuteOfDay: number } | null {
  if (!Number.isFinite(at.getTime())) return null;
  const parts = Object.fromEntries(ET_FORMATTER.formatToParts(at).map(part => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return { date: { year, month, day }, minuteOfDay: hour * 60 + minute };
}

function timeLabel(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)} ET`;
}

/**
 * Returns the only valid scheduled-run interval for this Eastern calendar date.
 * DST is handled by Intl when mapping the supplied instant to America/New_York.
 */
export function nyseSeismographRunWindow(at: Date | string = new Date()): NyseSeismographRunWindow {
  const instant = typeof at === "string" ? new Date(at) : at;
  const fields = easternFields(instant);
  if (!fields) {
    return {
      etDate: null,
      session: "CLOSED",
      marketCloseAtEt: null,
      scheduledRunAtEt: null,
      scheduledWindowEndEt: null,
      isScheduledWindow: false,
      reason: "The supplied schedule time is invalid.",
    };
  }
  const key = dateKey(fields.date);
  const dayOfWeek = weekday(fields.date);
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      etDate: key,
      session: "CLOSED",
      marketCloseAtEt: null,
      scheduledRunAtEt: null,
      scheduledWindowEndEt: null,
      isScheduledWindow: false,
      reason: "NYSE is closed on weekends.",
    };
  }
  const holiday = holidayName(fields.date);
  if (holiday) {
    return {
      etDate: key,
      session: "CLOSED",
      marketCloseAtEt: null,
      scheduledRunAtEt: null,
      scheduledWindowEndEt: null,
      isScheduledWindow: false,
      reason: `NYSE is closed for ${holiday}.`,
    };
  }
  const earlyClose = earlyCloseName(fields.date);
  const marketCloseMinute = earlyClose ? 13 * 60 : 16 * 60;
  // The approved daily cadence is 4:15 PM ET for both ordinary and early-close
  // sessions. Keep the actual close time as provenance rather than moving the
  // daily run to 1:15 PM on early-close dates.
  const scheduledMinute = 16 * 60 + POST_CLOSE_DELAY_MINUTES;
  const windowEndMinute = scheduledMinute + SCHEDULED_WINDOW_MINUTES;
  const inWindow = fields.minuteOfDay >= scheduledMinute && fields.minuteOfDay < windowEndMinute;
  return {
    etDate: key,
    session: earlyClose ? "EARLY_CLOSE" : "REGULAR",
    marketCloseAtEt: timeLabel(marketCloseMinute),
    scheduledRunAtEt: timeLabel(scheduledMinute),
    scheduledWindowEndEt: timeLabel(windowEndMinute),
    isScheduledWindow: inWindow,
    reason: inWindow
      ? `Within the ${earlyClose ? "early-close" : "regular"} NYSE post-close Seismograph window.`
      : `Scheduled Seismograph runs only from ${timeLabel(scheduledMinute)} through ${timeLabel(windowEndMinute)} on this ${earlyClose ? "early-close" : "regular"} session.`,
  };
}
