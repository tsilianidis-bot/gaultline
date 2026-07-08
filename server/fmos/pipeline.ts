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

import { calculateFaultlinePressure } from "../pressure/engine";
import { fetchMacroData } from "./engines/dataAcquisition";
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
  } = options;

  const startTime = Date.now();

  // ── Stage 1: Data Acquisition ─────────────────────────────
  const macro = await fetchMacroData();

  // ── Stage 2: Pressure Engine ──────────────────────────────
  // The pressure engine is the foundation — all other engines
  // consume its output.
  const pressure = await calculateFaultlinePressure();

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
      historicalContext: `Most similar to ${topAnalog.label} (${topAnalog.similarity}% similarity)`,
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

  const isComplete = missingFields.length === 0 && pipelineErrors.length === 0;

  return {
    // Metadata
    symbol: symbol ?? null,
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
    dataSource: pressure.dataSource,
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
