/**
 * Completed-bar rule for technical indicators.
 *
 * Equities: a daily bar is complete when `now` is at or after that session's
 * NYSE close (16:00 America/New_York, 13:00 on an early-close session). The
 * close comes from `nyseSeismographRunWindow`, so holidays and early closes
 * stay on the shared calendar. The same day's bar counts after the close and
 * is excluded before it. Weekend and holiday dates have no session.
 *
 * Crypto: completion is the candle's own period versus `now`. CoinGecko OHLC
 * is 30 minutes for 1–2 days, 4 hours for 3–30 days, and one UTC day after
 * that. A candle is complete only when `timestamp + period <= now`. The open
 * candle is excluded. A UTC-day bar is complete at the next UTC midnight.
 *
 * This module does not invent bars, timestamps, or indicator values.
 */
import { nyseSeismographRunWindow } from "./nyseSession";

const ET = "America/New_York";
const ET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: ET,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function etParts(ms: number): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  if (!Number.isFinite(ms)) return null;
  const parts = Object.fromEntries(ET_FORMAT.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
  return { year, month, day, hour, minute, second };
}

/** America/New_York calendar date of an instant, `YYYY-MM-DD`. */
export function etSessionDate(ms: number): string | null {
  const parts = etParts(ms);
  if (!parts) return null;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** UTC milliseconds of a wall-clock time in America/New_York. */
export function etWallToUtc(date: string, hour: number, minute: number): number {
  const [year, month, day] = date.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour + 5, minute);
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = etParts(utc);
    if (!parts) break;
    const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, 0);
    if (got === want) break;
    utc += want - got;
  }
  return utc;
}

function previousDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 1));
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
}

/** Session close in UTC ms, or null when that Eastern date has no NYSE session. */
export function equitySessionCloseMs(etDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etDate)) return null;
  const noon = etWallToUtc(etDate, 12, 0);
  const window = nyseSeismographRunWindow(new Date(noon));
  if (window.session === "CLOSED" || window.etDate !== etDate || !window.marketCloseAtEt) return null;
  const [hour, minute] = window.marketCloseAtEt.split(" ")[0].split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return etWallToUtc(etDate, hour, minute);
}

/** True when the equity daily bar's NYSE session has closed at `nowMs`. */
export function isEquityDailyBarComplete(barTimestampMs: number, nowMs: number): boolean {
  const session = etSessionDate(barTimestampMs);
  if (!session) return false;
  const close = equitySessionCloseMs(session);
  if (close == null) return false;
  return nowMs >= close;
}

/**
 * Most recent NYSE session whose close is at or before `nowMs`.
 * After the close, that is today's session. Before the close, it is the
 * previous completed session.
 */
export function lastCompletedEquitySessionDate(nowMs: number): string | null {
  const today = etSessionDate(nowMs);
  if (!today) return null;
  let cursor = today;
  for (let step = 0; step < 14; step++) {
    const close = equitySessionCloseMs(cursor);
    if (close != null && nowMs >= close) return cursor;
    cursor = previousDate(cursor);
  }
  return null;
}

/**
 * CoinGecko `/coins/{id}/ohlc` candle length for the requested day count.
 * 1–2 days: 30 minutes. 3–30 days: 4 hours. Longer: one UTC day.
 */
export function coinGeckoOhlcPeriodMs(days: number): number {
  if (days <= 2) return 30 * 60 * 1000;
  if (days <= 30) return 4 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

/** A crypto candle is complete only after its own period has ended. */
export function isCryptoCandleComplete(timestampMs: number, periodMs: number, nowMs: number): boolean {
  if (![timestampMs, periodMs, nowMs].every(Number.isFinite) || periodMs <= 0) return false;
  return timestampMs + periodMs <= nowMs;
}
