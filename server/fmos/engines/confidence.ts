// ============================================================
// FMOS Engine 8 — Confidence Engine
// (server/fmos/engines/confidence.ts)
//
// Assesses the quality and reliability of the analysis.
// Scores evidence strength, diversity, contradictions, and
// data freshness to produce an overall confidence level.
//
// This engine ensures the platform is honest about uncertainty
// rather than projecting false precision.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//   - FMOSEvidenceOutput (from Evidence Engine)
//   - FMOSProbabilityDistribution (from Probability Engine)
//
// Output: FMOSConfidenceOutput
// ============================================================

import { clamp, confidenceToLabel } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type {
  FMOSEvidenceOutput,
  FMOSProbabilityDistribution,
  FMOSConfidenceOutput,
} from "../types";

// ── Evidence Strength Score ───────────────────────────────────

function computeEvidenceStrength(evidence: FMOSEvidenceOutput): number {
  const available = evidence.families.filter(f => f.available);
  if (available.length === 0) return 0;

  const avgStrength = available.reduce((s, f) => s + f.strength, 0) / available.length;
  return clamp(Math.round(avgStrength));
}

// ── Evidence Diversity Score ──────────────────────────────────

function computeEvidenceDiversity(evidence: FMOSEvidenceOutput): number {
  const available = evidence.families.filter(f => f.available && f.strength > 20);
  if (available.length === 0) return 0;

  // Diversity is higher when more independent families agree on the same signal
  const dominantSignal = evidence.bullishFamilies > evidence.bearishFamilies ? "bullish" : "bearish";
  const agreeingFamilies = available.filter(f => f.signal === dominantSignal).length;

  return clamp(Math.round((agreeingFamilies / available.length) * 100));
}

// ── Data Freshness Score ──────────────────────────────────────

function computeDataFreshness(pressure: FaultlinePressureOutput): number {
  // Freshness based on data source
  // FaultlinePressureOutput.dataSource is "live" | "fallback"
  if (pressure.dataSource === "live") return 90;
  return 30; // fallback
}

// ── Contradiction Penalty ─────────────────────────────────────

function computeContradictionPenalty(evidence: FMOSEvidenceOutput): number {
  return Math.min(evidence.contradictions.length * 12, 36);
}

// ── Confidence Explanation ────────────────────────────────────

function buildExplanation(
  score: number,
  evidenceStrength: number,
  evidenceDiversity: number,
  contradictionCount: number,
  dataFreshness: number
): string {
  const label = confidenceToLabel(score);

  const parts: string[] = [];

  if (dataFreshness < 50) {
    parts.push("data freshness is limited (using cached/fallback values)");
  } else if (dataFreshness >= 80) {
    parts.push("live data available");
  }

  if (contradictionCount > 0) {
    parts.push(`${contradictionCount} evidence contradiction${contradictionCount > 1 ? "s" : ""} detected`);
  }

  if (evidenceDiversity >= 70) {
    parts.push("strong evidence consensus across multiple independent families");
  } else if (evidenceDiversity < 40) {
    parts.push("mixed evidence signals across families");
  }

  if (evidenceStrength >= 70) {
    parts.push("evidence signals are strong");
  } else if (evidenceStrength < 35) {
    parts.push("evidence signals are weak");
  }

  const reason = parts.length > 0 ? parts.join("; ") : "standard market conditions";
  return `${label} confidence — ${reason}.`;
}

// ── Main Confidence Engine Function ──────────────────────────

/**
 * Assess the quality and reliability of the FMOS analysis.
 *
 * @param pressure    - Output from calculateFaultlinePressure()
 * @param evidence    - Output from computeEvidence()
 * @param probability - Output from computeProbability()
 */
export function computeConfidence(
  pressure: FaultlinePressureOutput,
  evidence: FMOSEvidenceOutput,
  probability: FMOSProbabilityDistribution
): FMOSConfidenceOutput {
  const evidenceStrength = computeEvidenceStrength(evidence);
  const evidenceDiversity = computeEvidenceDiversity(evidence);
  const dataFreshness = computeDataFreshness(pressure);
  const contradictionPenalty = computeContradictionPenalty(evidence);

  // Base confidence from probability distribution decisiveness
  const decisiveness = Math.abs(probability.bull - probability.bear);
  const baseConfidence = clamp(Math.round(30 + decisiveness * 0.4));

  // Adjust for evidence quality
  const score = clamp(Math.round(
    baseConfidence * 0.3 +
    evidenceStrength * 0.25 +
    evidenceDiversity * 0.20 +
    dataFreshness * 0.25 -
    contradictionPenalty
  ));

  const label = confidenceToLabel(score);
  const explanation = buildExplanation(
    score,
    evidenceStrength,
    evidenceDiversity,
    evidence.contradictions.length,
    dataFreshness
  );

  return {
    score,
    label,
    evidenceStrength,
    evidenceDiversity,
    contradictionCount: evidence.contradictions.length,
    contradictions: evidence.contradictions,
    missingData: evidence.missingData,
    dataFreshness,
    explanation,
  };
}
