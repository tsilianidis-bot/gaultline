/**
 * Worked example under the Pentagonal Thesis™: one market reading, five
 * answers. Pure mapping, no fetching.
 *
 * LIVE values come from ONE public canonical snapshot
 * (marketState.canonicalCurrent via PR #40's selector). Two public extras are
 * used only when they are provably about the same moment or clearly labelled
 * as a separate model:
 *   - analog ranking (pressure.getHistoricalContext): shown only when its
 *     canonicalStateId equals the snapshot's stateId;
 *   - systemic-regime model (systemicRegime.current): a separate model with its
 *     own data date, labelled as such, with its limits.
 *
 * Derived values are arithmetic on published values only: distance to the
 * engine's band thresholds, and value × fixed weight per vector. Nothing is
 * forecast. Vector "direction" is deliberately NOT shown: the published
 * direction field maps the engine's "rising" stress trend to "Improving".
 *
 * ILLUSTRATIVE copy never contains a number, so it cannot be mistaken for a
 * live value and cannot contradict the live one.
 */
import { formatPressureAsOf, PRESSURE_BANDS, type PressureSnapshotView } from "@/lib/pressureSnapshot";
import { snapshotEvidenceCounts } from "@shared/snapshotEvidence";
import { customerIntegrityFromCanonical, type CustomerIntegrityLabel } from "@shared/customerIntegrityLabels";
import { AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID, PRESSURE_VECTOR_DISPLAY } from "@shared/pressureVectorLabels";
import type { SystemicRegimeReading } from "@shared/systemicRegime";
import { PRESSURE_VECTOR_ORDER } from "../landingPressure";

export const ILLUSTRATIVE_LABEL = "Illustrative example — not live output";
export const LIVE_SOURCE = "marketState.canonicalCurrent";
export const MODEL_SOURCE = "systemicRegime.current";

export const ILLUSTRATIVE = {
  why: {
    title: "How the drivers would be explained",
    text: "The reading is carried mostly by the vectors at the top of the live list. Where a vector is a static reference value, or an input is stale, the explanation is weaker at that point, and the explanation says so instead of filling the gap.",
  },
  next: {
    title: "Two paths from here",
    paths: [
      {
        name: "If conditions continue",
        text: "The vectors hold roughly where they are and the reading stays inside its band. Supported by vectors that are not moving. Weakened by a sustained move in the vectors that carry the most weight.",
      },
      {
        name: "If conditions change",
        text: "A move across the nearest threshold changes the band and the regime label. In the product, OUTLOOK lists the triggers that would move the base case and the invalidations that would weaken it.",
      },
    ],
  },
  watch: {
    title: "Why these matter",
    text: "A threshold crossing changes the label, so the distance to each threshold comes first. A move that persists across several readings is a change. A move that reverses the next day is usually noise. WATCH attaches duration, threshold distance and invalidation to each signal.",
  },
  do: {
    title: "How the choice would be framed",
    text: "This example does not choose a posture. ACT does that from the full shared state after sign-in. With healthy evidence, the options are weighed on the reading itself. With stale or fallback inputs, the case for waiting for confirmation gets stronger, because the evidence is thinner. Whichever option is taken, the condition that would reverse it is written down first.",
  },
} as const;

export const MODEL_LIMITS =
  "Separate from the Pressure Index: a two-state hidden Markov model (sre-hmm2-v1.0.0) on one factor of a broader FRED panel. The first figure is the model's probability for the state it is in. The second is its chance of leaving that state at the next observation. Neither is the chance of a crash. Out of sample, days on which the model put near-certain weight on its crisis state fell inside a labelled stress window about 18% of the time.";

export type LiveStatus = "loading" | "unavailable" | "ready";

export interface ExampleContributor {
  id: string;
  label: string;
  weightPct: number;
  value: number;
  /** value × fixed weight, in index points; null when the vectors do not reconcile with the score. */
  points: number | null;
  staticBaseline: boolean;
}

export interface ThresholdStep {
  regime: string;
  threshold: number;
  distance: number;
}

export type AnalogInput =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "available"; canonicalStateId?: string | null; timestamp?: string | null; matches: Array<{ year?: string | number | null; period?: string | null; label: string; similarity: number }> };

export type RegimeInput = { status: "loading" } | { status: "unavailable" } | { status: "available"; reading: SystemicRegimeReading | null | undefined };

export interface WorkedExampleModel {
  status: LiveStatus;
  unavailableReason: string | null;
  source: { asOf: string; asOfLabel: string; stateId: string; integrity: CustomerIntegrityLabel } | null;
  happening: { score: number; band: string; bandRange: string; regime: string; regimeMatchesBand: boolean } | null;
  why: {
    contributors: ExampleContributor[];
    reconciles: boolean;
    evidenceQuality: string;
    coherence: string;
    staleInputs: number;
    delayedInputs: number;
    fallbackInputs: number;
    unavailableInputs: number;
    unresolvedConflicts: number;
  } | null;
  next: {
    analog: { status: LiveStatus; match: { label: string; period: string; similarity: number } | null; asOfLabel: string | null };
    model: {
      status: LiveStatus;
      regime: string | null;
      stateProbability: number | null;
      leaveProbability: number | null;
      dataAsOf: string | null;
      freshness: string | null;
      modelVersion: string | null;
    };
  };
  watch: { up: ThresholdStep | null; down: ThresholdStep | null; topContributors: string[] } | null;
}

const UNAVAILABLE_REASON: Record<Extract<PressureSnapshotView, { status: "unavailable" }>["reason"], string> = {
  NO_STATE: "No canonical Pressure Index reading is published right now.",
  QUERY_ERROR: "The public Pressure Index could not be reached.",
  WITHHELD: "Canonical evidence is withheld right now.",
  INVALID_SCORE: "The canonical score is missing or invalid.",
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function thresholdSteps(score: number): { up: ThresholdStep | null; down: ThresholdStep | null } {
  const index = PRESSURE_BANDS.findIndex((band) => score >= band.min && (band.maxExclusive == null || score < band.maxExclusive));
  const band = PRESSURE_BANDS[index];
  const above = PRESSURE_BANDS[index + 1];
  const below = PRESSURE_BANDS[index - 1];
  return {
    up: above ? { regime: above.regime, threshold: above.min, distance: round1(above.min - score) } : null,
    down: below && band ? { regime: below.regime, threshold: band.min, distance: round1(score - band.min) } : null,
  };
}

function modelOf(input: RegimeInput): WorkedExampleModel["next"]["model"] {
  const empty = { regime: null, stateProbability: null, leaveProbability: null, dataAsOf: null, freshness: null, modelVersion: null };
  if (input.status === "loading") return { status: "loading", ...empty };
  const reading = input.status === "available" ? input.reading : null;
  if (!reading || reading.freshnessStatus === "UNAVAILABLE" || !reading.currentRegime || !finite(reading.regimeConfidence)) {
    return { status: "unavailable", ...empty };
  }
  return {
    status: "ready",
    regime: reading.currentRegime,
    stateProbability: reading.regimeConfidence,
    leaveProbability: finite(reading.transitionProbability) ? reading.transitionProbability : null,
    dataAsOf: reading.dataAsOf ?? null,
    freshness: reading.freshnessStatus,
    modelVersion: reading.modelVersion ?? null,
  };
}

function analogOf(input: AnalogInput, stateId: string | null): WorkedExampleModel["next"]["analog"] {
  if (input.status === "loading") return { status: stateId ? "loading" : "unavailable", match: null, asOfLabel: null };
  if (input.status === "unavailable" || !stateId || input.canonicalStateId !== stateId) return { status: "unavailable", match: null, asOfLabel: null };
  const top = input.matches.find((match) => finite(match.similarity) && match.label);
  if (!top) return { status: "unavailable", match: null, asOfLabel: null };
  return {
    status: "ready",
    match: { label: top.label, period: String(top.year || top.period || ""), similarity: Math.round(top.similarity) },
    asOfLabel: formatPressureAsOf(input.timestamp ?? null),
  };
}

export function buildWorkedExample(view: PressureSnapshotView, analog: AnalogInput, regime: RegimeInput): WorkedExampleModel {
  const model = modelOf(regime);
  if (view.status !== "ready") {
    return {
      status: view.status,
      unavailableReason: view.status === "unavailable" ? UNAVAILABLE_REASON[view.reason] : null,
      source: null,
      happening: null,
      why: null,
      next: { analog: { status: view.status === "loading" ? "loading" : "unavailable", match: null, asOfLabel: null }, model },
      watch: null,
    };
  }

  const state = view.state;
  const integrity = customerIntegrityFromCanonical(state);

  const raw = PRESSURE_VECTOR_ORDER.flatMap(([id, weight]) => {
    const engine = state.engines.find((item) => item.engineId === id);
    if (!engine || !finite(engine.value) || engine.qualityStatus === "UNAVAILABLE") return [];
    const weightPct = Number.parseFloat(weight);
    return [{
      id,
      label: PRESSURE_VECTOR_DISPLAY[id].label,
      weightPct,
      value: engine.value,
      rawPoints: (engine.value * weightPct) / 100,
      staticBaseline: engine.sourceInputIds.includes(AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID),
    }];
  });
  const complete = raw.length === PRESSURE_VECTOR_ORDER.length;
  const total = raw.reduce((sum, item) => sum + item.rawPoints, 0);
  const reconciles = complete && Math.abs(total - view.score) <= 1.5;
  const contributors: ExampleContributor[] = raw
    .map(({ rawPoints, ...item }) => ({ ...item, points: reconciles ? round1(rawPoints) : null, sortKey: reconciles ? rawPoints : item.value }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey: _sortKey, ...item }) => item);

  const evidence = snapshotEvidenceCounts(state);
  const steps = thresholdSteps(view.score);

  return {
    status: "ready",
    unavailableReason: null,
    source: {
      asOf: view.provenance.asOf,
      asOfLabel: formatPressureAsOf(view.provenance.asOf) ?? "an unpublished time",
      stateId: view.provenance.stateId,
      integrity,
    },
    happening: {
      score: view.displayScore,
      band: view.band.regime,
      bandRange: view.band.range,
      regime: view.regime,
      regimeMatchesBand: view.regimeMatchesBand,
    },
    why: {
      contributors,
      reconciles,
      evidenceQuality: state.confidenceOrEvidenceQuality,
      coherence: state.provenance?.coherenceStatus ?? "UNAVAILABLE",
      staleInputs: evidence.stale,
      delayedInputs: evidence.delayed,
      fallbackInputs: evidence.fallback,
      unavailableInputs: evidence.unavailable,
      unresolvedConflicts: state.conflicts.filter((conflict) => conflict.resolutionStatus === "UNRESOLVED").length,
    },
    next: { analog: analogOf(analog, view.provenance.stateId), model },
    watch: { ...steps, topContributors: contributors.slice(0, 2).map((item) => item.label) },
  };
}
