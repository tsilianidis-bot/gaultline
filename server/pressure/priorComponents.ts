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

// ── Cache (QA B-3) ──────────────────────────────────────────────
// Priors are computed ONLY by the scheduled/admin Seismograph pipeline after a
// verified run, then kept in process memory and in the existing Market Memory
// key-value store (same store as "seismograph:latest_output"; no migration).
// The request path reads the cache only and never fetches upstream.
export const PRIOR_COMPONENTS_MEMORY_KEY = "pressure:v1_prior_components";
/** A cached prior is usable only if its current anchor is this recent vs the canonical state. */
export const PRIOR_MAX_ANCHOR_LAG_DAYS = 10;

export interface CachedPriorComponents extends PriorComponents { computedAt: string; runTrigger: string }
let _cached: CachedPriorComponents | null = null;

/** Scheduled/admin pipeline only. FRED read + memory write; never called from a request. */
export async function refreshPriorComponentsAfterVerifiedRun(runTrigger: string, now: Date = new Date()): Promise<CachedPriorComponents | null> {
  let prior: PriorComponents | null = null;
  try {
    const bulk = await fetchFredBulk(PRIOR_FRED_SERIES);
    prior = computePriorComponents(bulk.results, now);
  } catch { prior = null; }
  if (!prior) return null; // keep the previous cache rather than overwrite with nothing
  const entry: CachedPriorComponents = { ...prior, computedAt: now.toISOString(), runTrigger };
  _cached = entry;
  try {
    const { memorySetJson } = await import("../seismographEngine");
    await memorySetJson(PRIOR_COMPONENTS_MEMORY_KEY, entry, "v1 components recomputed from FRED obs one month earlier (direction only)");
  } catch { /* in-memory copy still serves this process */ }
  return entry;
}

/**
 * Request path: cache only (process memory, then Market Memory). Never fetches FRED.
 * Returns null (→ "Insufficient evidence") when absent or not aligned with `canonicalGeneratedAt`.
 */
export async function readCachedPriorComponents(canonicalGeneratedAt?: string | null): Promise<CachedPriorComponents | null> {
  let entry = _cached;
  if (!entry) {
    try {
      const { memoryGetJson } = await import("../seismographEngine");
      entry = await memoryGetJson<CachedPriorComponents | null>(PRIOR_COMPONENTS_MEMORY_KEY, null);
      if (entry) _cached = entry;
    } catch { entry = null; }
  }
  if (!entry || !entry.components || !entry.currentAsOf) return null;
  if (canonicalGeneratedAt) {
    const lagDays = (Date.parse(canonicalGeneratedAt) - Date.parse(`${entry.currentAsOf}T00:00:00Z`)) / 86400000;
    if (!Number.isFinite(lagDays) || lagDays < -1 || lagDays > PRIOR_MAX_ANCHOR_LAG_DAYS) return null;
  }
  return entry;
}

export function __resetPriorCacheForTests(): void { _cached = null; }
