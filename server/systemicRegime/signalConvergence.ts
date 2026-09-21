/**
 * Signal Convergence — N of M independent votes.
 *
 * This is NOT a mechanical average of unrelated scores. Each engine casts one
 * boolean vote: deteriorating or not, using that engine's own persisted output.
 * Missing engines are excluded from N and M (they are not treated as "fine").
 *
 * Votes (M ≤ 5):
 * 1. Champion Pressure Index (persisted canonical pressure/regime/direction)
 * 2. Seismograph evidence consensus (bearish/stressed majority or divergent)
 * 3. Cross-engine synthesis (aligned deteriorating, or conflicted/divergent)
 * 4. Governed Early Warning (a material warning presentation is current)
 * 5. Systemic Regime HMM (STRESS BUILDING or CRISIS) — this new engine
 *
 * Level:
 *   HIGH   if N ≥ 3 available deteriorating votes
 *   MEDIUM if N === 2
 *   LOW    if N ≤ 1 and at least 3 engines available
 *   UNAVAILABLE if fewer than 3 engines have persisted output
 *
 * Pressure Index weights are not changed. Convergence is an independent overlay.
 */

import {
  SIGNAL_CONVERGENCE_METHODOLOGY,
  type ConvergenceLevel,
  type ConvergenceVote,
  type SignalConvergenceSnapshot,
  type SystemicRegimeReading,
} from "../../shared/systemicRegime";
import type { CanonicalIntelligenceState } from "../../shared/canonicalIntelligenceState";
import type { CrossEngineSynthesis } from "../../shared/crossEngineSynthesis";
import type { GovernedEarlyWarningPresentation } from "../../shared/earlyWarningPresentation";
import type { SeismographOutput } from "../seismographCore";

const THRESHOLD_MEDIUM = 2;
const THRESHOLD_HIGH = 3;
const MIN_AVAILABLE = 3;
const DETERIORATING_PRESSURE_REGIMES = /HIGH STRESS|SYSTEMIC CRISIS|ELEVATED RISK|CRISIS/i;
const DETERIORATING_HMM = new Set(["STRESS BUILDING", "CRISIS", "STRESS", "TRANSITION"]);

export interface ConvergenceInputs {
  canonical: CanonicalIntelligenceState | null;
  seismograph: SeismographOutput | null;
  synthesis: CrossEngineSynthesis | null;
  earlyWarning: GovernedEarlyWarningPresentation | null;
  systemicRegime: SystemicRegimeReading | null;
}

function pressureVote(canonical: CanonicalIntelligenceState | null): ConvergenceVote {
  if (!canonical || canonical.pressureIndex == null) {
    return { engineId: "champion-pressure", engineName: "Champion Pressure Index", available: false, deteriorating: null, reason: "Canonical Pressure reading unavailable.", independent: true };
  }
  const elevated = canonical.pressureIndex >= 45 || DETERIORATING_PRESSURE_REGIMES.test(canonical.regime ?? "");
  const directionDown = canonical.pressureDirection === "Deteriorating";
  const deteriorating = elevated || directionDown;
  return {
    engineId: "champion-pressure",
    engineName: "Champion Pressure Index",
    available: true,
    deteriorating,
    reason: deteriorating
      ? `Pressure ${canonical.pressureIndex} / regime ${canonical.regime ?? "unknown"} / direction ${canonical.pressureDirection}.`
      : `Pressure ${canonical.pressureIndex} is not in an elevated or deteriorating state.`,
    independent: true,
  };
}

function seismographVote(seismograph: SeismographOutput | null): ConvergenceVote {
  if (!seismograph) {
    return { engineId: "seismograph-consensus", engineName: "Seismograph evidence consensus", available: false, deteriorating: null, reason: "Seismograph output unavailable.", independent: true };
  }
  const consensus = seismograph.evidenceConsensus;
  const directed = seismograph.direction === "Deteriorating" || (seismograph.probabilities?.bear ?? 0) > (seismograph.probabilities?.bull ?? 0) + 10;
  const deteriorating = consensus === "divergent" || directed;
  return {
    engineId: "seismograph-consensus",
    engineName: "Seismograph evidence consensus",
    available: true,
    deteriorating,
    reason: `Consensus ${consensus}; direction ${seismograph.direction}; bear ${seismograph.probabilities?.bear ?? "n/a"}.`,
    independent: true,
  };
}

function synthesisVote(synthesis: CrossEngineSynthesis | null): ConvergenceVote {
  if (!synthesis) {
    return { engineId: "cross-engine-synthesis", engineName: "Cross-engine synthesis", available: false, deteriorating: null, reason: "Cross-engine synthesis unavailable.", independent: true };
  }
  const deterioratingCount = synthesis.engineObservations?.filter(item => item.direction === "DETERIORATING").length
    ?? synthesis.deterioratingDomains?.length
    ?? 0;
  const alignedDown = synthesis.summary?.overallSynthesis === "ALIGNED" && deterioratingCount >= 2;
  const conflicted = synthesis.summary?.overallSynthesis === "CONFLICTED";
  const divergences = (synthesis.divergences?.length ?? 0) > 0;
  const deteriorating = alignedDown || conflicted || (divergences && deterioratingCount >= 2) || deterioratingCount >= 3;
  return {
    engineId: "cross-engine-synthesis",
    engineName: "Cross-engine synthesis",
    available: true,
    deteriorating,
    reason: `Overall ${synthesis.summary?.overallSynthesis}; ${deterioratingCount} deteriorating engines; ${synthesis.divergences?.length ?? 0} divergences.`,
    independent: true,
  };
}

function earlyWarningVote(earlyWarning: GovernedEarlyWarningPresentation | null): ConvergenceVote {
  if (!earlyWarning) {
    return { engineId: "early-warning", engineName: "Governed Early Warning", available: false, deteriorating: null, reason: "Early Warning presentation unavailable.", independent: true };
  }
  if (earlyWarning.kind === "GOVERNED_EVALUATION_UNAVAILABLE") {
    return { engineId: "early-warning", engineName: "Governed Early Warning", available: false, deteriorating: null, reason: "Governed Early Warning evaluation unavailable.", independent: true };
  }
  const deteriorating = earlyWarning.kind === "ACTIVE_GOVERNED_WARNING";
  return {
    engineId: "early-warning",
    engineName: "Governed Early Warning",
    available: true,
    deteriorating,
    reason: deteriorating
      ? `Material governed warning is current (${earlyWarning.kind}).`
      : "No material early warning currently meets governed qualification.",
    independent: true,
  };
}

function hmmVote(reading: SystemicRegimeReading | null): ConvergenceVote {
  if (!reading || reading.freshnessStatus === "UNAVAILABLE" || !reading.currentRegime) {
    return { engineId: "systemic-regime-hmm", engineName: "Systemic Regime HMM", available: false, deteriorating: null, reason: "No persisted Systemic Regime inference.", independent: true };
  }
  const deteriorating = DETERIORATING_HMM.has(reading.currentRegime);
  return {
    engineId: "systemic-regime-hmm",
    engineName: "Systemic Regime HMM",
    available: true,
    deteriorating,
    reason: `Regime ${reading.currentRegime}; crisis p=${reading.crisisProbability ?? "n/a"}; data through ${reading.dataAsOf}.`,
    independent: true,
  };
}

export function computeSignalConvergence(inputs: ConvergenceInputs, computedAt = new Date().toISOString()): SignalConvergenceSnapshot {
  const votes: ConvergenceVote[] = [
    pressureVote(inputs.canonical),
    seismographVote(inputs.seismograph),
    synthesisVote(inputs.synthesis),
    earlyWarningVote(inputs.earlyWarning),
    hmmVote(inputs.systemicRegime),
  ];
  const available = votes.filter(vote => vote.available);
  const deterioratingCount = available.filter(vote => vote.deteriorating === true).length;
  let level: ConvergenceLevel = "UNAVAILABLE";
  if (available.length >= MIN_AVAILABLE) {
    if (deterioratingCount >= THRESHOLD_HIGH) level = "HIGH";
    else if (deterioratingCount >= THRESHOLD_MEDIUM) level = "MEDIUM";
    else level = "LOW";
  }
  const summary = available.length < MIN_AVAILABLE
    ? `Signal Convergence unavailable: ${available.length} of ${votes.length} independent engines have persisted output (need ${MIN_AVAILABLE}).`
    : `${deterioratingCount} of ${available.length} independent engines are deteriorating → ${level}. Not a score average; Systemic Regime HMM is one vote.`;
  return {
    methodology: SIGNAL_CONVERGENCE_METHODOLOGY,
    level,
    deterioratingCount,
    availableCount: available.length,
    voteCount: votes.length,
    thresholdMedium: THRESHOLD_MEDIUM,
    thresholdHigh: THRESHOLD_HIGH,
    votes,
    summary,
    computedAt,
    contributesToPressureIndex: false,
  };
}
