// Benchmark & evaluation harness for FL-PI-v2-research-0 (pure; no I/O).
// Implements the locked event/warning/false-alarm/AUC definitions of PRESPEC_V2.md.
// Every result must carry its recordClass: HISTORICAL_BACKTEST (in-sample,
// hindsight-informed design) is never mixed with FORWARD_LIVE observations.
import { bisectRight } from "./engine";

export type RecordClass = "HISTORICAL_BACKTEST" | "FORWARD_LIVE";
export interface WeeklySignalRow { date: string; signals: Record<string, number | null> }
export interface DrawdownEvent { start: string; trough: string; ddPct: number }

const DAY = 86400000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** ≥10% close-to-close peak→trough within 60 sessions; earliest start; advance past trough. */
export function detectDrawdownEvents(dates: string[], closes: number[], from: string, to: string): DrawdownEvent[] {
  const ev: DrawdownEvent[] = [];
  let i = bisectRight(dates, addDays(from, -1)) + 1;
  const end = bisectRight(dates, to) + 1;
  while (i < end) {
    const hi = Math.min(i + 61, end);
    let j = 0; for (let k = 1; k < hi - i; k++) if (closes[i + k] < closes[i + j]) j = k;
    if (j > 0 && closes[i + j] <= closes[i] * 0.9) {
      let pk = i; for (let k = i; k <= i + j; k++) if (closes[k] > closes[pk]) pk = k;
      if (pk === i) {
        ev.push({ start: dates[i], trough: dates[i + j], ddPct: Math.round(10000 * (closes[i + j] / closes[i] - 1)) / 100 });
        i = i + j + 1; continue;
      }
    }
    i++;
  }
  return ev;
}

export interface SignalEvaluation {
  signal: string; threshold: number; warned: number; missed: number; unavailable: number;
  warnedEvents: string[]; missedEvents: string[];
  missedDetectedDuringDecline: number; medianDetectionLagSessionsForMissed: number | null;
  firstCrossings: number; falseAlarms: number;
}

/** Warning = signal ≥ threshold on any weekly date in the 8 weeks ending on/before event start. */
export function evaluateSignal(rows: WeeklySignalRow[], events: DrawdownEvent[], signal: string, threshold: number,
  sessionDates: string[]): SignalEvaluation {
  const on = (r: WeeklySignalRow) => { const v = r.signals[signal]; return v === null || v === undefined ? null : v >= threshold; };
  const warned: string[] = [], missed: string[] = [], unavail: string[] = []; const lags: (number | null)[] = [];
  for (const e of events) {
    const win = rows.filter(r => r.date >= addDays(e.start, -56) && r.date <= e.start);
    const vals = win.map(on);
    if (vals.every(v => v === null)) { unavail.push(e.start); continue; }
    if (vals.some(v => v === true)) { warned.push(e.start); lags.push(0); continue; }
    missed.push(e.start);
    const hit = rows.find(r => r.date > e.start && r.date <= e.trough && on(r) === true);
    const lb = (d: string) => { const k = bisectRight(sessionDates, addDays(d, -1)) + 1; return k; };
    lags.push(hit ? lb(hit.date) - lb(e.start) : null);
  }
  const starts = events.map(e => bisectRight(sessionDates, addDays(e.start, -1)) + 1);
  let prev = false, cross = 0, fa = 0;
  for (const r of rows) {
    const o = on(r);
    if (o && !prev) {
      cross++;
      const ii = bisectRight(sessionDates, addDays(r.date, -1)) + 1;
      const inside = events.some(e => e.start <= r.date && r.date <= e.trough);
      const next = starts.some(s => ii <= s && s <= ii + 60);
      if (!inside && !next) fa++;
    }
    prev = Boolean(o);
  }
  const lagged = lags.filter((x): x is number => x !== null && x !== 0).sort((a, b) => a - b);
  return {
    signal, threshold, warned: warned.length, missed: missed.length, unavailable: unavail.length,
    warnedEvents: warned, missedEvents: missed,
    missedDetectedDuringDecline: lagged.length,
    medianDetectionLagSessionsForMissed: lagged.length ? lagged[Math.floor(lagged.length / 2)] : null,
    firstCrossings: cross, falseAlarms: fa,
  };
}

/** Rank AUC (ties mid-ranked). */
export function rankAuc(pairs: Array<[number, 0 | 1]>): number | null {
  const pos = pairs.filter(p => p[1] === 1).length, neg = pairs.length - pos;
  if (!pos || !neg) return null;
  const sorted = pairs.map(p => p[0]).sort((a, b) => a - b);
  const rank = new Map<number, number>();
  for (let i = 0; i < sorted.length;) { let j = i; while (j < sorted.length && sorted[j] === sorted[i]) j++; rank.set(sorted[i], (i + j + 1) / 2); i = j; }
  const rp = pairs.filter(p => p[1] === 1).reduce((a, p) => a + rank.get(p[0])!, 0);
  return (rp - pos * (pos + 1) / 2) / (pos * neg);
}

/** Forward 63-session max drawdown / return from the close at D (null if window incomplete or beyond `lastDate`). */
export function forwardOutcome(sessionDates: string[], closes: number[], D: string, lastDate: string) {
  const i = bisectRight(sessionDates, D);
  if (i < 0 || i + 63 >= sessionDates.length || sessionDates[i + 63] > lastDate) return null;
  const f = closes.slice(i + 1, i + 64);
  const mdd = 100 * (1 - Math.min(...f) / closes[i]);
  return { fwdMaxDdPct: mdd, fwdRetPct: 100 * (closes[i + 63] / closes[i] - 1), y: mdd >= 10 ? 1 as const : 0 as const };
}

/** Calibration-style table: outcomes by v2 band (descriptive; NOT a probability calibration). */
export function outcomesByBand(rows: Array<{ v2: number | null; fwd: ReturnType<typeof forwardOutcome> }>) {
  const bands: Array<[string, number, number]> = [["0-24", 0, 25], ["25-44", 25, 45], ["45-64", 45, 65], ["65-79", 65, 80], ["80-100", 80, 101]];
  return bands.map(([label, lo, hi]) => {
    const xs = rows.filter(r => r.v2 !== null && r.fwd && r.v2 >= lo && r.v2 < hi);
    const n = xs.length;
    const mean = (f: (r: typeof xs[number]) => number) => n ? Math.round(100 * xs.reduce((a, r) => a + f(r), 0) / n) / 100 : null;
    return { band: label, weeks: n, meanFwd63Ret: mean(r => r.fwd!.fwdRetPct), meanFwd63MaxDd: mean(r => r.fwd!.fwdMaxDdPct), shareY: n ? Math.round(1000 * xs.filter(r => r.fwd!.y === 1).length / n) / 1000 : null };
  });
}
