const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function assertIsoDate(iso: string): void {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Expected YYYY-MM-DD, received ${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date ${iso}`);
  }
}

export function parseIsoDateUtc(iso: string): number {
  assertIsoDate(iso);
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

export function formatIsoDateUtc(utcMs: number): string {
  const date = new Date(utcMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(iso: string, days: number): string {
  return formatIsoDateUtc(parseIsoDateUtc(iso) + days * 86_400_000);
}

/** later - earlier, in calendar days. */
export function daysBetween(earlier: string, later: string): number {
  return Math.round((parseIsoDateUtc(later) - parseIsoDateUtc(earlier)) / 86_400_000);
}

export function weekdayIndexUtc(iso: string): number {
  return new Date(parseIsoDateUtc(iso) + 12 * 3_600_000).getUTCDay();
}

export function isFridayDate(iso: string): boolean {
  return weekdayIndexUtc(iso) === 5;
}

export function addMonths(isoMonthStart: string, months: number): string {
  assertIsoDate(isoMonthStart);
  const [year, month, day] = isoMonthStart.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1 + months, day!));
  return formatIsoDateUtc(utc.getTime());
}
