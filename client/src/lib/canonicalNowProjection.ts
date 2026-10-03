/* ============================================================
   Canonical "now" projection (presentation only).

   The compatibility market-state projection (marketState.current) carries
   seismograph labels for stress level, direction, headline and story. Every
   app surface must instead show the band, direction and evidence of the ONE
   canonical snapshot (marketState.canonicalCurrent):
     - band / level  → engine thresholds (CHAMPION_REGIME_THRESHOLDS)
     - direction     → canonical composite pressureDirection; Unknown is shown
                       as "Unavailable", never guessed from another engine.
   Nothing here calculates a score.
   ============================================================ */
import type { CanonicalMarketState } from "@shared/marketState";
import type { PublicCanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import { directionDisplay, type DirectionDisplay } from "@shared/snapshotEvidence";
import { isValidPressureScore, pressureBandFor, type PressureBand } from "./pressureSnapshot";
import { classifyEvidenceFamilies } from "@shared/canonicalReadout";
import { probabilityPercent, type CanonicalProbabilityContract } from "@shared/probabilityContract";

/** Contract percent for a scenario/transition claim id, or NaN when withheld. */
export function contractScenarioPercent(
  contract: CanonicalProbabilityContract | null | undefined,
  scenarioId: string,
): number {
  const claim = contract?.scenarioSet.scenarios.find(c => c.scenario.scenarioId === scenarioId)
    ?? contract?.transitions.find(c => c.scenario.scenarioId === scenarioId)
    ?? null;
  const percent = probabilityPercent(claim);
  return percent === null ? Number.NaN : percent;
}

type NowFields = CanonicalMarketState["now"];

export interface CanonicalNowProjection {
  band: PressureBand | null;
  stressLevel: NowFields["stressLevel"];
  direction: DirectionDisplay;
  headline: string;
}

function directionClause(direction: DirectionDisplay): string {
  if (direction === "Unavailable") return "direction is unavailable (no prior comparable reading)";
  if (direction === "Stable") return "composite pressure is stable versus the prior reading";
  return `composite pressure is ${direction.toLowerCase()} versus the prior reading`;
}

export function projectCanonicalNow(
  canonical: Pick<PublicCanonicalIntelligenceState, "pressureIndex" | "regime" | "pressureDirection">,
  legacy: Pick<NowFields, "stressLevel" | "headline" | "regime">,
): CanonicalNowProjection {
  const direction = directionDisplay(canonical.pressureDirection);
  const score = canonical.pressureIndex;
  if (!isValidPressureScore(score)) {
    return { band: null, stressLevel: legacy.stressLevel, direction, headline: legacy.headline };
  }
  const band = pressureBandFor(score);
  const regime = canonical.regime?.trim() ? canonical.regime : band.regime;
  return {
    band,
    stressLevel: band.level,
    direction,
    headline: `${band.level} pressure in a ${regime} regime; ${directionClause(direction)}.`,
  };
}

const SEISMOGRAPH_LEAD = /^FAULTLINE's Seismograph is reading [^.]*\.\s*/;

/**
 * Replace the seismograph template's lead sentence (score, stress description,
 * direction) with one built from the canonical snapshot, so the story cannot
 * contradict the band or direction shown beside it. Other story text is kept.
 */
export function canonicalStoryLead(
  story: string,
  canonical: Pick<PublicCanonicalIntelligenceState, "pressureIndex" | "pressureDirection">,
): string {
  const score = canonical.pressureIndex;
  if (!isValidPressureScore(score)) return story;
  const band = pressureBandFor(score);
  const direction = directionDisplay(canonical.pressureDirection);
  const lead = `FAULTLINE's Pressure Index is reading ${Math.round(score)}/100 — ${band.level.toLowerCase()} band (${band.range}) — ${directionClause(direction)}.`;
  if (SEISMOGRAPH_LEAD.test(story)) return `${lead} ${story.replace(SEISMOGRAPH_LEAD, "")}`.trim();
  return story;
}

/**
 * Merge the governed canonical snapshot over the compatibility projection.
 * This is the single market-state object every app page reads (NOW, Brief,
 * ACT, Watch, the context strip): band/direction/headline, the scenario
 * probability set and the threat/support classification all come from here.
 */
export function mergeCanonicalMarketState(
  canonicalState: PublicCanonicalIntelligenceState | null,
  legacy: CanonicalMarketState | null,
): CanonicalMarketState | null {
  if (!canonicalState || !legacy) return null;
  const pressureScore = canonicalState.pressureIndex ?? legacy.now.pressureScore;
  const regime = canonicalState.regime ?? legacy.now.regime;
  // Band, direction and headline come from the canonical snapshot and the engine
  // thresholds; the seismograph's own direction/stress labels are not used here.
  const now = projectCanonicalNow(canonicalState, legacy.now);
  // One canonical scenario set for every page, through the probability
  // contract: a number survives only when its claim is AVAILABLE (calibrated,
  // complete, fresh). Withheld → NaN, and surfaces render the claim's text
  // ("Uncalibrated", "Insufficient data", …). Raw scenarioOutputs and the
  // seismograph's 3-way / 5-way distributions are never displayed.
  const contract = canonicalState.probabilityContract ?? legacy.outlook.probabilityContract ?? null;
  // Threat/support classification: one classifier over the same evidence families.
  const classified = classifyEvidenceFamilies(legacy.why.evidenceFamilies);
  return {
    ...legacy,
    generatedAt: canonicalState.generatedAt,
    sourceUpdatedAt: canonicalState.effectiveAt,
    now: {
      ...legacy.now,
      pressureScore,
      regime,
      stressLevel: now.stressLevel,
      direction: now.direction,
      headline: now.headline,
      threats: classified.threats,
      supports: classified.supports,
    },
    outlook: {
      ...legacy.outlook,
      probabilities: {
        ...legacy.outlook.probabilities,
        bull: contractScenarioPercent(contract, "bull"),
        neutral: contractScenarioPercent(contract, "neutral"),
        bear: contractScenarioPercent(contract, "bear"),
        confidence: Number.NaN,
      },
      regimeProbabilities: {
        bull: Number.NaN,
        softLanding: Number.NaN,
        stagflation: Number.NaN,
        recession: Number.NaN,
        crash: Number.NaN,
      },
      transitionProbabilities: {
        ...legacy.outlook.transitionProbabilities,
        remainInRegime: contractScenarioPercent(contract, "remainInRegime"),
        transitionToElevated: contractScenarioPercent(contract, "transitionToElevated"),
        transitionToLow: contractScenarioPercent(contract, "transitionToLow"),
        transitionToCrisis: contractScenarioPercent(contract, "transitionToCrisis"),
        confidence: Number.NaN,
      },
      probabilityContract: contract,
    },
    why: { ...legacy.why, story: canonicalStoryLead(legacy.why.story, canonicalState) },
    warnings: Array.from(new Set([...legacy.warnings, ...canonicalState.warnings])),
  };
}
