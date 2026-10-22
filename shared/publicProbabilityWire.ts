// Public API boundary for withheld (uncalibrated) probabilities — Phase 2 #4 (2026-10-13).
// Internally a withheld probability is NaN. superjson renders NaN on the wire as
// the string "NaN", which looks like a defective number to any API reader. At the
// public boundary every non-finite probability becomes null; the client restores
// NaN (the in-app "withheld" sentinel) so existing rendering is unchanged.
import type { CanonicalMarketState } from "./marketState";

type Nullable<T> = { [K in keyof T]: T[K] extends number ? number | null : T[K] };
export type PublicCanonicalMarketState = Omit<CanonicalMarketState, "outlook"> & {
  outlook: Omit<CanonicalMarketState["outlook"], "probabilities" | "regimeProbabilities" | "transitionProbabilities"> & {
    probabilities: Nullable<CanonicalMarketState["outlook"]["probabilities"]>;
    regimeProbabilities: Nullable<CanonicalMarketState["outlook"]["regimeProbabilities"]>;
    transitionProbabilities: Nullable<CanonicalMarketState["outlook"]["transitionProbabilities"]>;
  };
};

const GROUPS = ["probabilities", "regimeProbabilities", "transitionProbabilities"] as const;
const NUMERIC_KEYS: Record<(typeof GROUPS)[number], string[]> = {
  probabilities: ["bull", "neutral", "bear", "confidence"],
  regimeProbabilities: ["bull", "softLanding", "stagflation", "recession", "crash"],
  transitionProbabilities: ["remainInRegime", "transitionToElevated", "transitionToLow", "transitionToCrisis", "confidence"],
};

export function toPublicMarketStateWire(state: CanonicalMarketState): PublicCanonicalMarketState;
export function toPublicMarketStateWire(state: CanonicalMarketState | null): PublicCanonicalMarketState | null;
export function toPublicMarketStateWire(state: CanonicalMarketState | null): PublicCanonicalMarketState | null {
  if (!state || !state.outlook) return state as any;
  const outlook: any = { ...state.outlook };
  for (const g of GROUPS) {
    const src = (state.outlook as any)[g];
    if (!src) continue;
    const out: any = { ...src };
    for (const k of NUMERIC_KEYS[g]) {
      if (k in out && (typeof out[k] !== "number" || !Number.isFinite(out[k]))) out[k] = null;
    }
    outlook[g] = out;
  }
  return { ...state, outlook } as PublicCanonicalMarketState;
}

export function fromPublicMarketStateWire(state: PublicCanonicalMarketState): CanonicalMarketState;
export function fromPublicMarketStateWire(state: PublicCanonicalMarketState | null | undefined): CanonicalMarketState | null;
export function fromPublicMarketStateWire(state: PublicCanonicalMarketState | null | undefined): CanonicalMarketState | null {
  if (!state) return null;
  if (!state.outlook) return state as any;
  const outlook: any = { ...state.outlook };
  for (const g of GROUPS) {
    const src = (state.outlook as any)[g];
    if (!src) continue;
    const out: any = { ...src };
    for (const k of NUMERIC_KEYS[g]) if (k in out && out[k] === null) out[k] = Number.NaN;
    outlook[g] = out;
  }
  return { ...state, outlook } as CanonicalMarketState;
}
