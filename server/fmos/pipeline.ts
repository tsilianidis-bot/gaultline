// ============================================================
// FMOS Engine 14 — Universal Intelligence Pipeline
// (server/fmos/pipeline.ts)
//
// The single entry point for all FMOS analysis.
// Orchestrates all 13 upstream engines in the correct order
// and returns a complete FMOSUniversalOutput.
//
// Usage:
//   import { runFMOSPipeline } from "./fmos/pipeline";
//   const result = await runFMOSPipeline({ symbol: "AAPL" });
//
// All existing features (Smart Discovery, Market Command Center,
// Trade Preflight, Signal Outlook) should call this pipeline
// instead of their own ad-hoc implementations.
//
// Pipeline Execution Order:
//   1. Data Acquisition (FRED + market data)
//   2. Market DNA (market character classification)
//   3. Market Weather (conditions assessment)
//   4. Regime (current market regime)
//   5. Transition (regime change detection)
//   6. Evidence (evidence family organization)
//   7. Probability (bull/neutral/bear distribution)
//   8. Confidence (analysis quality assessment)
//   9. Historical Analogs (similar historical periods)
//  10. Decision (actionable verdict)
//  11. AI Interpretation (narrative generation)
//
// ============================================================

import { getAuthoritativeCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { toOperationalPressure } from "../operationalSignalInputs";
import { TRPCError } from "@trpc/server";
import { adaptVerifiedPressureToFmosMacro, hasVerifiedFmosMacroInputs } from "./engines/dataAcquisition";
import { computeMarketDNA } from "./engines/marketDNA";
import { computeMarketWeather } from "./engines/marketWeather";
import { computeRegime } from "./engines/regime";
import { computeTransition } from "./engines/transition";
import { computeEvidence } from "./engines/evidence";
import { computeProbability } from "./engines/probability";
import { computeConfidence } from "./engines/confidence";
import { computeHistoricalAnalogs, getTopAnalog } from "./engines/historicalAnalog";
import { computeDecision } from "./engines/decision";
import { computeAIInterpretation, computeQuickInterpretation } from "./engines/aiInterpretation";
import type { FMOSUniversalOutput, FMOSPipelineOptions } from "./types";

// ── FMOS Version ──────────────────────────────────────────────

export const FMOS_VERSION = "1.0.0";

// ── Pipeline Execution ────────────────────────────────────────

/**
 * Run the complete FMOS Universal Intelligence Pipeline.
 *
 * @param options - Pipeline options
 * @returns Complete FMOSUniversalOutput
 */
export async function runFMOSPipeline(
  options: FMOSPipelineOptions = {}
): Promise<FMOSUniversalOutput> {
  const {
    symbol,
    skipAIInterpretation = false,
    topAnalogCount = 3,
    pressureOverride,
  } = options;

  const startTime = Date.now();

  // ── Stage 1: Pressure Engine ──────────────────────────────
  // The pressure engine is the foundation — all other engines consume its
  // output. A scheduler may supply the exact verified snapshot it already
  // acquired for this run through `options.pressureOverride`; in that case do
  // not issue a second provider calculation with a different observation set.
  const canonical = pressureOverride ? null : await getAuthoritativeCanonicalIntelligenceState();
  const pressure = pressureOverride ?? toOperationalPressure(canonical, true);

  // ── Stage 2: Data Acquisition ─────────────────────────────
  // Reuse the precise verified FRED inputs that produced `pressure`; never
  // issue a second local bulk request or manufacture a numeric fallback.
  const macro = adaptVerifiedPressureToFmosMacro(pressure);
  if (pressure.verification?.status !== "verified" || !hasVerifiedFmosMacroInputs(macro))
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "FMOS requires the exact verified macro source snapshot backing canonical Pressure; no substitute financial values are scored." });

  // ── Stage 3: Market DNA ───────────────────────────────────
  const dna = computeMarketDNA(pressure, macro);

  // ── Stage 4: Market Weather ───────────────────────────────
  const weather = computeMarketWeather(pressure);

  // ── Stage 5: Regime ───────────────────────────────────────
  const regime = computeRegime(pressure);

  // ── Stage 6: Transition ───────────────────────────────────
  const transition = computeTransition(pressure);

  // ── Stage 7: Evidence ─────────────────────────────────────
  const evidence = computeEvidence(pressure, macro);

  // ── Stage 8: Probability ──────────────────────────────────
  const probability = computeProbability(pressure, evidence);

  // ── Stage 9: Confidence ───────────────────────────────────
  const confidence = computeConfidence(pressure, evidence, probability);

  // ── Stage 10: Historical Analogs ──────────────────────────
  const historicalAnalogs = computeHistoricalAnalogs(pressure, topAnalogCount ?? 3);
  const topAnalog = historicalAnalogs[0] ?? getTopAnalog(pressure);

  // ── Stage 11: Decision ────────────────────────────────────
  const decision = computeDecision(pressure, regime, probability, confidence, weather);

  // ── Stage 12: AI Interpretation ───────────────────────────
  let aiInterpretation;
  if (skipAIInterpretation) {
    // Use quick (non-LLM) interpretation for performance-sensitive paths
    const quick = computeQuickInterpretation(pressure, regime, probability, decision);
    aiInterpretation = {
      ...quick,
      supportingEvidence: probability.bullEvidence[0] ?? "",
      contradictingEvidence: probability.bearEvidence[0] ?? "",
      historicalContext: "Historical analog output is withheld unless independently governed source evidence is supplied.",
      watchFor: decision.invalidationConditions,
      educationalNote: `FAULTLINE Pressure Index at ${pressure.overallPressure}/100`,
    };
  } else {
    aiInterpretation = await computeAIInterpretation(
      pressure,
      regime,
      probability,
      confidence,
      decision,
      topAnalog,
      dna,
      symbol
    );
  }

  const executionTimeMs = Date.now() - startTime;

  // ── Completeness check ────────────────────────────────────────
  // Determine whether the pipeline produced a fully reliable output.
  // complete=false means the user should see reduced-confidence messaging.
  const pipelineErrors: string[] = [];
  const missingFields: string[] = [];

  if (!decision.keyLevels || Object.keys(decision.keyLevels).length === 0) {
    missingFields.push("keyLevels");
  }
  if (evidence.diversityScore === 0) {
    missingFields.push("evidenceDiversity");
    pipelineErrors.push("Evidence diversity is zero — only one signal family available");
  }
  if (confidence.score < 20) {
    pipelineErrors.push(`Confidence critically low (${confidence.score}) — insufficient data`);
  }
  if (pressure.dataSource === "fallback") {
    pipelineErrors.push("Pressure engine running on fallback data — live feeds unavailable");
  }
  if (macro.dataSource === "unavailable") {
    pipelineErrors.push(`FRED macro inputs unavailable${macro.unavailableReason ? `: ${macro.unavailableReason}` : ""}`);
  }
  if (!dna.available) {
    missingFields.push("marketDNA");
    pipelineErrors.push(`Market DNA unavailable: ${dna.unavailableReason ?? "required source inputs unavailable"}`);
  }
  if (!evidence.available) {
    missingFields.push("evidence");
    pipelineErrors.push(`Evidence unavailable: ${evidence.unavailableReason ?? "required source inputs unavailable"}`);
  }

  const isComplete = missingFields.length === 0 && pipelineErrors.length === 0;
  const dataSource = macro.dataSource === "unavailable"
    ? "unavailable"
    : pressure.dataSource;

  return {
    // Metadata
    symbol: symbol ?? null,
    canonicalStateId: canonical?.stateId ?? null,
    dataAsOf: pressure.lastUpdated,
    assetType: null,
    timestamp: new Date().toISOString(),
    engineVersion: FMOS_VERSION,

    // Engine outputs
    pressure,
    marketDNA: dna,
    marketWeather: weather,
    regime,
    transition,
    evidence,
    probability,
    confidence,
    analogs: historicalAnalogs,
    topAnalog,
    decision,
    interpretation: aiInterpretation,

    // Metadata
    dataSource,
    complete: isComplete,
    errors: pipelineErrors,
  };
}

/**
 * Run the FMOS pipeline without AI interpretation (faster).
 * Use this for high-frequency calls or background processing.
 */
export async function runFMOSPipelineFast(
  options: FMOSPipelineOptions = {}
): Promise<FMOSUniversalOutput> {
  return runFMOSPipeline({ ...options, skipAIInterpretation: true });
}

/**
 * Run the FMOS pipeline for a specific symbol.
 * Includes AI interpretation with symbol context.
 */
export async function runFMOSPipelineForSymbol(
  symbol: string,
  options: Omit<FMOSPipelineOptions, "symbol"> = {}
): Promise<FMOSUniversalOutput> {
  return runFMOSPipeline({ ...options, symbol: symbol.toUpperCase() });
}
