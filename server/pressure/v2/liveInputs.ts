// Live input assembly for the v2 shadow (pure apart from the injected fetcher).
// Combines the frozen reference (≤ cutoff) with FRED observations after the cutoff.
import type { DatedSeries, V2Data } from "./engine";
import type { V2Reference } from "./reference";
import { referenceMacroWeekly } from "./reference";

type Obs = { date: string; value: string };
const num = (v: string) => { if (v === "." || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

function ascValid(obs: Obs[]): { dates: string[]; values: number[] } {
  const rows = obs.map(o => ({ d: o.date, v: num(o.value) })).filter((r): r is { d: string; v: number } => r.v !== null)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { dates: rows.map(r => r.d), values: rows.map(r => r.v) };
}

function appendAfter(base: DatedSeries, extra: { dates: string[]; values: number[] }, cutoff: string): DatedSeries {
  const dates = [...base.dates], values = [...base.values];
  extra.dates.forEach((d, i) => { if (d > cutoff) { dates.push(d); values.push(extra.values[i]); } });
  return { dates, values };
}

/** Drawdown (%) from trailing 252-session closing high, for each session after `cutoff` (needs ≥252 prior closes). */
export function drawdownAfter(sp: { dates: string[]; values: number[] }, cutoff: string): { dates: string[]; values: number[] } {
  const dates: string[] = [], values: number[] = [];
  for (let i = 0; i < sp.dates.length; i++) {
    if (sp.dates[i] <= cutoff || i < 251) continue;
    let hi = -Infinity; for (let k = i - 251; k <= i; k++) hi = Math.max(hi, sp.values[k]);
    dates.push(sp.dates[i]); values.push(100 * (1 - sp.values[i] / hi));
  }
  return { dates, values };
}

/** Real-time Sahm-type gap from the current UNRATE vintage: 3-mo avg minus min of 3-mo avgs over prior 12 months. */
export function sahmGap(unrateAsc: number[]): number | null {
  if (unrateAsc.length < 15) return null;
  const ma: number[] = [];
  for (let i = 2; i < unrateAsc.length; i++) ma.push((unrateAsc[i] + unrateAsc[i - 1] + unrateAsc[i - 2]) / 3);
  return ma[ma.length - 1] - Math.min(...ma.slice(-13, -1));
}

export interface LiveInputProvenance { pillar: string; source: string; lastObservationDate: string | null; rowsAfterCutoff: number; note?: string }

export function assembleLiveV2Data(ref: V2Reference, fred: Record<string, Obs[] | undefined>, asOfDate: string):
  { data: V2Data; provenance: LiveInputProvenance[] } {
  const cutoff = ref.cutoff;
  const baa = ascValid(fred.BAA10Y ?? []);
  const vix = ascValid(fred.VIXCLS ?? []);
  const sp = ascValid(fred.SP500 ?? []);
  const ur = ascValid(fred.UNRATE ?? []);
  const dd = drawdownAfter(sp, cutoff);
  const credit = appendAfter(ref.daily.credit, baa, cutoff);
  const vol = appendAfter(ref.daily.vol, vix, cutoff);
  const mkt = appendAfter(ref.daily.mkt, dd, cutoff);
  const macroWeekly = referenceMacroWeekly(ref);
  const s = sahmGap(ur.values);
  if (s !== null && asOfDate > cutoff) { macroWeekly.dates.push(asOfDate); macroWeekly.values.push(s); }
  const last = (x: { dates: string[] }) => x.dates.length ? x.dates[x.dates.length - 1] : null;
  return {
    data: { daily: { credit, funding: ref.daily.funding, vol, mkt }, macroWeekly, weekly: ref.weekly },
    provenance: [
      { pillar: "credit", source: "FRED BAA10Y", lastObservationDate: last(credit), rowsAfterCutoff: baa.dates.filter(d => d > cutoff).length },
      { pillar: "funding", source: "FRED TEDRATE", lastObservationDate: last(ref.daily.funding), rowsAfterCutoff: 0, note: "Discontinued 2022-01-21; no free LIBOR-OIS/FRA-OIS substitute (spec): pillar UNAVAILABLE" },
      { pillar: "vol", source: "FRED VIXCLS", lastObservationDate: last(vol), rowsAfterCutoff: vix.dates.filter(d => d > cutoff).length },
      { pillar: "mkt", source: "FRED SP500 closes (reference: Yahoo ^GSPC) → 252-session drawdown", lastObservationDate: last(mkt), rowsAfterCutoff: dd.dates.length },
      { pillar: "macro", source: "FRED UNRATE current vintage (real-time as of recording)", lastObservationDate: last(ur), rowsAfterCutoff: s === null ? 0 : 1, ...(s === null ? { note: "fewer than 15 UNRATE rows" } : {}) },
    ],
  };
}
