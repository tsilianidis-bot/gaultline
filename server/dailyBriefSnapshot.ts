import { randomUUID } from "node:crypto";
import type { FaultlinePressureOutput } from "./pressure/engine";
import type { SeismographOutput } from "./seismographCore";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

export const DAILY_BRIEF_PROMPT_VERSION = "daily-brief-snapshot-v1";
const DAILY_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 60 * 1000;

export type InputCadence = "real-time" | "intraday" | "end-of-day" | "daily" | "weekly" | "monthly";
export type FreshnessStatus = "fresh" | "stale" | "unavailable";

export interface BriefInputProvenance {
  key: string;
  source: string;
  category: "observed_market_data" | "faultline_output";
  value: string | number | null;
  asOf: number | null;
  lastSuccessfulUpdate: number | null;
  expectedCadence: InputCadence;
  expectedFreshnessHours: number;
  freshness: FreshnessStatus;
  note?: string;
}

export interface DailyBriefSnapshotPayload {
  briefSnapshotId: string;
  generatedAt: number;
  briefDateEt: string;
  tradingDate: string;
  canonicalSource: "seismograph" | "pressure_engine";
  /**
   * An immutable link to the exact canonical state used at publication time.
   * Legacy records and unverified source matches retain explicit unavailability;
   * they are never retroactively assigned an invented current-state identity.
   */
  canonicalOrigin: {
    status: "linked" | "unavailable";
    reason: string | null;
    originatingStateId: string | null;
    originatingEffectiveAt: string | null;
    originatingGeneratedAt: string | null;
    originatingModelVersion: string | null;
    originatingConfigurationVersion: string | null;
    originatingInputSnapshotId: string | null;
  };
  pressureIndex: number;
  regime: string;
  stressClassification: string;
  direction: string | null;
  probabilities: { bull: number; neutral: number; bear: number; confidence: number | null } | null;
  marketMemory: { streakDays: number; streakDirection: string } | null;
  evidenceConsensus: string | null;
  transition: { remainInRegime: number | null; transitionToCrisis: number | null; note: string } | null;
  historicalAnalog: { label: string; similarity: number } | null;
  sourceInputs: BriefInputProvenance[];
  observedMarketData: string[];
  proprietaryOutputs: string[];
  unavailableData: string[];
  validation: { passed: boolean; errors: string[]; warnings: string[] };
}

function etDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

function freshness(asOf: number | null, cadence: InputCadence, now: number): FreshnessStatus {
  if (!asOf) return "unavailable";
  const maxAge = cadence === "real-time" ? 30 * 60 * 1000 : cadence === "intraday" ? 8 * 60 * 60 * 1000 : cadence === "end-of-day" || cadence === "daily" ? DAILY_SNAPSHOT_MAX_AGE_MS : cadence === "weekly" ? 9 * 24 * 60 * 60 * 1000 : 45 * 24 * 60 * 60 * 1000;
  return now - asOf <= maxAge ? "fresh" : "stale";
}

/**
 * Builds one immutable, auditable source for a Daily Brief. It deliberately
 * chooses either the assembled Seismograph output or a direct engine fallback;
 * it never combines their numerical outputs in one publication.
 */
export function buildDailyBriefSnapshot({
  pressure,
  seismograph,
  canonicalState = null,
  now = Date.now(),
}: {
  pressure: FaultlinePressureOutput | null;
  seismograph: SeismographOutput | null;
  canonicalState?: PublicCanonicalIntelligenceState | null;
  now?: number;
}): DailyBriefSnapshotPayload {
  const source = seismograph ? "seismograph" : "pressure_engine";
  const sourceAsOf = seismograph?.computedAt ?? now;
  const sourceFreshness = seismograph ? freshness(seismograph.computedAt, "daily", now) : pressure ? "fresh" : "unavailable";
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!seismograph && !pressure) errors.push("critical-pressure-source-unavailable");
  if (sourceFreshness === "stale") errors.push("canonical-snapshot-unexpectedly-stale");

  const probabilities = seismograph
    ? {
        bull: seismograph.probabilities.bull,
        neutral: seismograph.probabilities.neutral,
        bear: seismograph.probabilities.bear,
        confidence: seismograph.probabilities.confidence,
      }
    : null;
  if (probabilities && Math.abs(probabilities.bull + probabilities.neutral + probabilities.bear - 100) > 1) {
    errors.push("probability-distribution-does-not-total-100");
  }

  const pressureIndex = seismograph?.pressureScore ?? pressure?.overallPressure ?? 0;
  const regime = seismograph?.regime ?? pressure?.regime ?? "Unavailable";
  const stressClassification = seismograph?.stressLevel ?? pressure?.level ?? "Unavailable";
  const canonicalOrigin = canonicalState
    && canonicalState.pressureIndex === pressureIndex
    && canonicalState.regime === regime
    ? {
        status: "linked" as const,
        reason: null,
        originatingStateId: canonicalState.stateId,
        originatingEffectiveAt: canonicalState.effectiveAt ?? null,
        originatingGeneratedAt: canonicalState.generatedAt ?? null,
        originatingModelVersion: canonicalState.modelVersion ?? null,
        originatingConfigurationVersion: canonicalState.configurationVersion ?? null,
        originatingInputSnapshotId: canonicalState.inputSnapshotId ?? null,
      }
    : {
        status: "unavailable" as const,
        reason: canonicalState
          ? "canonical-state-did-not-match-immutable-brief-snapshot"
          : "canonical-state-unavailable-at-publication",
        originatingStateId: null,
        originatingEffectiveAt: null,
        originatingGeneratedAt: null,
        originatingModelVersion: null,
        originatingConfigurationVersion: null,
        originatingInputSnapshotId: null,
      };
  const sourceMeta = {
    source: source === "seismograph" ? "Scheduled Seismograph Core" : "FAULTLINE Pressure Engine",
    category: "faultline_output",
    asOf: source === "seismograph" ? seismograph!.computedAt : now,
    lastSuccessfulUpdate: source === "seismograph" ? seismograph!.computedAt : now,
    expectedCadence: source === "seismograph" ? "daily" : "real-time",
    expectedFreshnessHours: source === "seismograph" ? 30 : 0.5,
    freshness: sourceFreshness,
    note: source === "seismograph" ? "Daily assembled intelligence output; do not mix with later live engine readings in this brief." : "Direct generation-time pressure output; Seismograph context was unavailable.",
  } as const;
  const sourceInputs: BriefInputProvenance[] = [
    { key: "pressure_index", value: pressureIndex, ...sourceMeta },
    { key: "regime", value: regime, ...sourceMeta },
    { key: "structural_stress_classification", value: stressClassification, ...sourceMeta },
    ...(probabilities ? [
      { key: "bull_probability", value: probabilities.bull, ...sourceMeta },
      { key: "neutral_probability", value: probabilities.neutral, ...sourceMeta },
      { key: "bear_probability", value: probabilities.bear, ...sourceMeta },
      { key: "regime_transition_confidence", value: probabilities.confidence, ...sourceMeta },
    ] : []),
    ...(seismograph?.topAnalog ? [{ key: "historical_analog_similarity", value: seismograph.topAnalog.similarity, ...sourceMeta }] : []),
  ];

  const unavailableData = [
    !seismograph ? "Historical analog, transition probabilities, Market Memory, and Evidence Consensus were unavailable because the canonical Seismograph snapshot was unavailable." : null,
    !seismograph?.providerProvenance ? "Provider-level provenance was not available in this intelligence snapshot." : null,
  ].filter((value): value is string => Boolean(value));
  if (unavailableData.length) warnings.push("mixed-frequency-provider-details-unavailable");

  return {
    briefSnapshotId: randomUUID(),
    generatedAt: now,
    briefDateEt: etDate(now),
    tradingDate: etDate(sourceAsOf),
    canonicalSource: source,
    canonicalOrigin,
    pressureIndex,
    regime,
    stressClassification,
    direction: seismograph?.direction ?? null,
    probabilities,
    marketMemory: seismograph ? { streakDays: seismograph.marketMemory.streakDays, streakDirection: seismograph.marketMemory.streakDirection } : null,
    evidenceConsensus: seismograph?.evidenceConsensus ?? null,
    transition: seismograph ? {
      remainInRegime: seismograph.transitionProbabilities.remainInRegime,
      transitionToCrisis: seismograph.transitionProbabilities.transitionToCrisis,
      note: "Transition figures are scenario components, not a complete mutually exclusive probability distribution unless explicitly labeled otherwise.",
    } : null,
    historicalAnalog: seismograph?.topAnalog ? { label: seismograph.topAnalog.label, similarity: seismograph.topAnalog.similarity } : null,
    sourceInputs,
    observedMarketData: [],
    proprietaryOutputs: [
      `FAULTLINE Pressure Index: ${pressureIndex}/100`,
      `FAULTLINE Regime: ${regime}`,
      `FAULTLINE Structural Stress Classification: ${stressClassification}`,
      ...(probabilities ? [`FAULTLINE Regime Probabilities: Bull ${probabilities.bull}%, Neutral ${probabilities.neutral}%, Bear ${probabilities.bear}%`] : []),
    ],
    unavailableData,
    validation: { passed: errors.length === 0, errors, warnings },
  };
}

export function buildDailyBriefPromptContext(snapshot: DailyBriefSnapshotPayload): string {
  const observed = snapshot.observedMarketData.length ? snapshot.observedMarketData.join("\n") : "- No external observed-market facts were included in this snapshot.";
  const unavailable = snapshot.unavailableData.length ? snapshot.unavailableData.map(item => `- ${item}`).join("\n") : "- No required snapshot category was unavailable.";
  return [
    `BRIEF SNAPSHOT ID: ${snapshot.briefSnapshotId}`,
    `READING USED FOR THIS BRIEF: ${new Date(snapshot.generatedAt).toISOString()} (trading date ${snapshot.tradingDate}; canonical source ${snapshot.canonicalSource})`,
    snapshot.canonicalOrigin.status === "linked"
      ? `CANONICAL ORIGIN: ${snapshot.canonicalOrigin.originatingStateId} (effective ${snapshot.canonicalOrigin.originatingEffectiveAt})`
      : `CANONICAL ORIGIN: unavailable (${snapshot.canonicalOrigin.reason}); this is an archived generated snapshot, not a current market-state claim.`,
    "OBSERVED MARKET DATA (only these may be described as external facts):",
    observed,
    "FAULTLINE PROPRIETARY OUTPUTS (label as FAULTLINE outputs, not external observations):",
    ...snapshot.proprietaryOutputs.map(item => `- ${item}`),
    snapshot.historicalAnalog ? `- FAULTLINE Historical Analog Similarity Score: ${snapshot.historicalAnalog.similarity}% (${snapshot.historicalAnalog.label}). This is feature-set similarity, not an outcome probability or a statement about current policy.` : "- Historical analog unavailable.",
    snapshot.transition ? `- FAULTLINE Regime Transition Confidence: ${snapshot.probabilities?.confidence ?? "unavailable"}%. ${snapshot.transition.note}` : "- Transition output unavailable.",
    "UNAVAILABLE DATA:",
    unavailable,
  ].join("\n");
}

export function validateDailyBriefNarrative(content: string): { passed: boolean; issues: string[] } {
  const prohibited = [
    /confidence interval/i,
    /statistically significant/i,
    /almost perfectly mirrors/i,
    /highly predictive/i,
    /near certainty/i,
    /ground-floor entry point/i,
    /guaranteed/i,
    /inevitable/i,
    /massive opportunity/i,
    /clear winner/i,
  ];
  const issues = prohibited.filter(pattern => pattern.test(content)).map(pattern => `unsupported-language:${pattern.source}`);
  return { passed: issues.length === 0, issues };
}
