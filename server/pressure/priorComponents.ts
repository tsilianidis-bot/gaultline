// Prior-period v1 component values for DIRECTION only (Phase 2 #6, QA r3).
// Recomputes the SAME frozen v1 engine from FRED observations dated exactly one
// month before each current input's observation date (date-matched). Read-only:
// FRED GETs only, no DB access. If any prior input cannot be verified the
// result is null and callers must report "Insufficient evidence".
// Does not modify v1 scoring: it calls resolveVerifiedInputs +
// computePressureFromVerifiedInputs unchanged.
import { fetchFredBulk } from "../fredClient";
import { computePressureFromVerifiedInputs, resolveVerifiedInputs, type FredResultsLike, type PressureInputId } from "./engine";

export const PRIOR_FRED_SERIES = [
  { id: "BAMLH0A0HYM2", limit: 60 }, { id: "DGS10", limit: 60 }, { id: "DGS2", limit: 60 }, { id: "SOFR", limit: 60 },
  { id: "CPIAUCSL", limit: 27 }, { id: "PPIACO", limit: 27 }, { id: "FEDFUNDS", limit: 6 }, { id: "UNRATE", limit: 6 },
];

const SERIES_OF: Record<PressureInputId, string> = {
  hySpread: "BAMLH0A0HYM2", tsy10y: "DGS10", tsy2y: "DGS2", sofr: "SOFR",
  cpi: "CPIAUCSL", ppi: "PPIACO", fedFunds: "FEDFUNDS", unemployment: "UNRATE",
};

/** Same calendar day one month earlier (clamped to month end). */
export function minusOneMonth(iso: string): string {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export interface PriorComponents {
  asOf: string;           // prior daily anchor date
  currentAsOf: string;    // current daily anchor date
  components: Record<string, number>; // v1 vector id → score
  inputDates: Record<string, string | null>;
}

/** Pure: given FRED results (deep enough), compute v1 components one month before the current observation dates. */
export function computePriorComponents(results: FredResultsLike, now: Date): PriorComponents | null {
  const current = resolveVerifiedInputs(results, now);
  if (!current.ok) return null;
  const cutoffs: Record<string, string> = {};
  for (const p of current.provenance) {
    if (!p.observationDate) return null;
    cutoffs[SERIES_OF[p.inputId]] = minusOneMonth(p.observationDate);
  }
  const truncated: FredResultsLike = {};
  for (const [sid, cut] of Object.entries(cutoffs)) {
    const s = results[sid];
    truncated[sid] = { observations: (s?.observations ?? []).filter(o => o.date <= cut) };
  }
  const anchor = cutoffs["BAMLH0A0HYM2"];
  const prior = resolveVerifiedInputs(truncated, new Date(`${anchor}T16:00:00Z`));
  if (!prior.ok) return null;
  const out = computePressureFromVerifiedInputs(prior.inputs, prior.provenance, new Date(`${anchor}T16:00:00Z`));
  return {
    asOf: anchor,
    currentAsOf: current.provenance.find(p => p.inputId === "hySpread")!.observationDate!,
    components: Object.fromEntries(out.vectors.map(v => [v.id, v.score])),
    inputDates: Object.fromEntries(prior.provenance.map(p => [p.inputId, p.observationDate])),
  };
}

/** Read-only fetch + compute. Never throws; null = prior not established. */
export async function getPriorV1Components(now: Date = new Date()): Promise<PriorComponents | null> {
  try {
    const bulk = await fetchFredBulk(PRIOR_FRED_SERIES);
    return computePriorComponents(bulk.results, now);
  } catch {
    return null;
  }
}
