// FL-PI-v2-research-0 shadow engine — pure functions, no I/O.
// Implements docs/pressure/v2/PRESPEC_V2.md exactly; reproduces the Oct 12 2026
// research build (pi-reconstruction scripts/build_v2.py). NOT PUBLIC. NOT v1.
import { pressureRegimeLabel } from "../../../shared/pressureBands";
import {
  V2_MAX_STALENESS_DAYS, V2_MIN_HISTORY_DAYS, V2_MIN_MACRO_POOL, V2_MIN_PILLARS,
  V2_PILLARS, V2_SPEC_ID, V2_SPEC_SHA256, V2_IMPLEMENTATION_VERSION, type V2Pillar,
} from "./spec";

export interface DatedSeries { dates: string[]; values: number[] }
export interface WeeklyPanel {
  date: string[];
  credit_raw: (number | null)[];
  funding_raw: (number | null)[];
  vol_raw: (number | null)[];
  mkt_raw: (number | null)[];
  macro_raw: (number | null)[];
}
export interface V2Data {
  daily: Record<"credit" | "funding" | "vol" | "mkt", DatedSeries>;
  /** Point-in-time weekly Sahm-type gap values (date ascending). */
  macroWeekly: DatedSeries;
  /** Weekly raw pillar values (for the EW-z benchmark). */
  weekly: WeeklyPanel;
}

export interface V2PillarResult {
  pillar: V2Pillar;
  raw: number | null;
  observationDate: string | null;
  percentile: number | null;
  score: number | null;
  status: "available" | "unavailable";
  reason?: string;
}

export interface V2Observation {
  specId: typeof V2_SPEC_ID;
  specSha256: typeof V2_SPEC_SHA256;
  implementationVersion: typeof V2_IMPLEMENTATION_VERSION;
  asOfDate: string;
  status: "computed" | "unavailable";
  v2: number | null;
  band: string | null;
  nPillars: number;
  pillars: V2PillarResult[];
  benchmarks: { vix: number | null; spDrawdownPct: number | null; ewz: number | null; ewzPillars: number };
  unavailableReason?: string;
}

const DAY = 86400000;
const days = (a: string, b: string) => (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

/** Index of last element ≤ key in an ascending string array (−1 if none). */
export function bisectRight(arr: string[], key: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= key) lo = m + 1; else hi = m; }
  return lo - 1;
}

/** Mid-rank empirical percentile of v within `pool` (0–100), as in the research build. */
export function midrankPercentile(pool: number[], v: number): number | null {
  if (pool.length < 1) return null;
  let below = 0, equal = 0;
  for (const x of pool) { if (x < v) below++; else if (x === v) equal++; }
  return (100 * (below + equal / 2)) / pool.length;
}

/** s = 100 × clip((p − 50)/50, 0, 1). */
export function pillarScore(p: number | null): number | null {
  return p === null ? null : 100 * Math.min(1, Math.max(0, (p - 50) / 50));
}

export function v2Band(score: number | null): string | null {
  return score === null ? null : pressureRegimeLabel(score);
}

function dailyPillar(pillar: "credit" | "funding" | "vol" | "mkt", s: DatedSeries, D: string): V2PillarResult {
  const i = bisectRight(s.dates, D);
  if (i < 0) return { pillar, raw: null, observationDate: null, percentile: null, score: null, status: "unavailable", reason: "no observation on or before date" };
  const od = s.dates[i], v = s.values[i];
  let stale = days(D, od) > V2_MAX_STALENESS_DAYS;
  if (pillar === "funding" && od < "2022-01-14") stale = false; // research-build rule, reproduced verbatim
  if (stale) return { pillar, raw: null, observationDate: od, percentile: null, score: null, status: "unavailable", reason: `stale: last observation ${od}` };
  if (days(D, s.dates[0]) < V2_MIN_HISTORY_DAYS) return { pillar, raw: null, observationDate: od, percentile: null, score: null, status: "unavailable", reason: "less than 5 years of history" };
  const pool = s.values.slice(0, i + 1);
  const p = midrankPercentile(pool, v);
  return { pillar, raw: v, observationDate: od, percentile: p, score: pillarScore(p), status: "available" };
}

function macroPillar(s: DatedSeries, D: string): V2PillarResult {
  const i = bisectRight(s.dates, D);
  if (i < 0 || s.dates[i] !== D && days(D, s.dates[i]) > 7) {
    return { pillar: "macro", raw: null, observationDate: i >= 0 ? s.dates[i] : null, percentile: null, score: null, status: "unavailable", reason: "no point-in-time Sahm value for date" };
  }
  const v = s.values[i];
  const pool = s.values.slice(0, i + 1);
  if (pool.length < V2_MIN_MACRO_POOL) return { pillar: "macro", raw: v, observationDate: s.dates[i], percentile: null, score: null, status: "unavailable", reason: `pool < ${V2_MIN_MACRO_POOL}` };
  const p = midrankPercentile(pool, v);
  return { pillar: "macro", raw: v, observationDate: s.dates[i], percentile: p, score: pillarScore(p), status: "available" };
}

/** EW-z benchmark: mean expanding z of available weekly raw pillars (≥3, each with ≥260 history). */
export function ewzAt(weekly: WeeklyPanel, D: string, current?: Partial<Record<V2Pillar, number | null>>): { ewz: number | null; n: number } {
  const i = bisectRight(weekly.date, D);
  const zs: number[] = [];
  for (const k of V2_PILLARS) {
    const col = weekly[`${k}_raw` as keyof WeeklyPanel] as (number | null)[];
    const hist = col.slice(0, i + 1).filter((x): x is number => x !== null);
    const onGrid = i >= 0 && weekly.date[i] === D;
    let v: number | null = onGrid ? col[i] : null;
    if (!onGrid && current && current[k] != null) { v = current[k]!; hist.push(v); }
    if (v === null || hist.length < 260) continue;
    const m = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - m) ** 2, 0) / hist.length);
    if (sd > 0) zs.push((v - m) / sd);
  }
  return { ewz: zs.length >= 3 ? Math.round((zs.reduce((a, b) => a + b, 0) / zs.length) * 1000) / 1000 : null, n: zs.length };
}

/** Compute the v2 observation as of date D (YYYY-MM-DD) using only data dated ≤ D. */
export function computeV2At(data: V2Data, D: string): V2Observation {
  const pillars: V2PillarResult[] = [
    dailyPillar("credit", data.daily.credit, D),
    dailyPillar("funding", data.daily.funding, D),
    dailyPillar("vol", data.daily.vol, D),
    dailyPillar("mkt", data.daily.mkt, D),
    macroPillar(data.macroWeekly, D),
  ];
  const avail = pillars.filter(p => p.score !== null);
  const v2 = avail.length >= V2_MIN_PILLARS ? Math.round((avail.reduce((a, p) => a + (p.score as number), 0) / avail.length) * 100) / 100 : null;
  const cur = Object.fromEntries(pillars.map(p => [p.pillar, p.raw])) as Record<V2Pillar, number | null>;
  const { ewz, n } = ewzAt(data.weekly, D, cur);
  const vol = pillars.find(p => p.pillar === "vol")!;
  const mkt = pillars.find(p => p.pillar === "mkt")!;
  return {
    specId: V2_SPEC_ID, specSha256: V2_SPEC_SHA256, implementationVersion: V2_IMPLEMENTATION_VERSION,
    asOfDate: D,
    status: v2 === null ? "unavailable" : "computed",
    v2, band: v2Band(v2), nPillars: avail.length, pillars,
    benchmarks: { vix: vol.raw, spDrawdownPct: mkt.raw, ewz, ewzPillars: n },
    ...(v2 === null ? { unavailableReason: `only ${avail.length} pillars available (need ${V2_MIN_PILLARS})` } : {}),
  };
}
