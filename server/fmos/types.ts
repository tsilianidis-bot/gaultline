// ============================================================
// FMOS — Shared Type Definitions  (server/fmos/types.ts)
//
// Single canonical type definitions for all FMOS engines.
// Replaces duplicate interfaces scattered across engine files.
//
// MIGRATION STATUS:
//   FMOSHistoricalAnalog — unifies 2 incompatible HistoricalAnalog
//                          interfaces (pressure/engine.ts + tradePreflight.ts)
//   FMOSProbabilityDistribution — canonical probability type
//   FMOSEvidenceFamily — canonical evidence organization
//   FMOSRegimeOutput — canonical regime classification
//   FMOSMarketDNA — long-term structural environment
//   FMOSMarketWeather — daily tactical conditions
//   FMOSDecisionOutput — unified decision output
//   FMOSUniversalOutput — full pipeline output
// ============================================================

import type { PressureLevel, ActionBias } from "./utils";
import type { FaultlinePressureOutput } from "../pressure/engine";

// ── Re-exports for convenience ────────────────────────────────
export type { PressureLevel, ActionBias };

// ── Historical Analog (Unified) ───────────────────────────────

/**
 * Unified HistoricalAnalog type that merges:
 *   - pressure/engine.ts: { year, label, similarity, description }
 *   - tradePreflight.ts:  { label, similarity, period, outcome }
 *
 * All fields are present; engines populate what they know.
 */
export interface FMOSHistoricalAnalog {
  /** Numeric year of the analog period (e.g., 2008) */
  year?: number;
  /** Human-readable label (e.g., "Global Financial Crisis") */
  label: string;
  /** Similarity score 0–100 (higher = more similar to current conditions) */
  similarity: number;
  /** Human-readable period string (e.g., "Sep 2008 – Mar 2009") */
  period?: string;
  /** Brief description of the analog environment */
  description?: string;
  /** What happened historically in this analog */
  outcome?: string;
  /** Key similarities between current conditions and this analog */
  similarities?: string[];
  /** Key differences between current conditions and this analog */
  differences?: string[];
  /** Typical duration of this type of regime */
  typicalDuration?: string;
  /** Historical risks that materialized in this analog */
  historicalRisks?: string[];
}

// ── Probability Distribution ──────────────────────────────────

/**
 * Canonical FMOS probability distribution.
 * bull + neutral + bear = 100 (always).
 *
 * Replaces the two competing bullProbability formulas in
 * preFlight.ts and signalOutlook.ts.
 */
export interface FMOSProbabilityDistribution {
  /** Bull case probability (0–100) */
  bull: number;
  /** Neutral / sideways probability (0–100) */
  neutral: number;
  /** Bear case probability (0–100) */
  bear: number;
  /** Primary driver of the probability distribution */
  primaryDriver: string;
  /** Evidence supporting the bull case */
  bullEvidence: string[];
  /** Evidence supporting the bear case */
  bearEvidence: string[];
  /** Confidence in this distribution (0–100) */
  confidence: number;
  /** What would invalidate the primary thesis */
  invalidationConditions: string[];
}

// ── Evidence Engine Types ─────────────────────────────────────

export type EvidenceFamilyName =
  | "macro"
  | "liquidity"
  | "technical"
  | "fundamental"
  | "sentiment"
  | "cross_asset"
  | "geopolitical"
  | "news";

export type EvidenceSignal = "bullish" | "bearish" | "neutral" | "mixed";

export interface FMOSEvidenceItem {
  /** Human-readable name of this evidence item */
  name: string;
  /** Which evidence family this belongs to */
  family: EvidenceFamilyName;
  /** Signal direction */
  signal: EvidenceSignal;
  /** Strength of this evidence (0–100) */
  strength: number;
  /** Brief explanation of this evidence item */
  description: string;
  /** Data source for this evidence */
  source: string;
  /** Whether this evidence is correlated with other items (reduces weight) */
  isCorrelated?: boolean;
  /** Effective weight after diminishing returns applied */
  effectiveWeight?: number;
}

export interface FMOSEvidenceFamily {
  /** Family identifier */
  name: EvidenceFamilyName;
  /** Human-readable label */
  label: string;
  /** Aggregate signal for this family */
  signal: EvidenceSignal;
  /** Aggregate strength (0–100) after diminishing returns */
  strength: number;
  /** Individual evidence items in this family */
  items: FMOSEvidenceItem[];
  /** Whether this family is available (has data) */
  available: boolean;
}

export interface FMOSEvidenceOutput {
  /** All evidence families */
  families: FMOSEvidenceFamily[];
  /** Number of independent families with bullish signal */
  bullishFamilies: number;
  /** Number of independent families with bearish signal */
  bearishFamilies: number;
  /** Overall evidence strength (0–100) */
  overallStrength: number;
  /** Overall evidence signal */
  overallSignal: EvidenceSignal;
  /** Evidence diversity score (0–100) — how many independent families agree */
  diversityScore: number;
  /** Contradictions detected across families */
  contradictions: string[];
  /** Missing data that would improve confidence */
  missingData: string[];
}

// ── Market DNA Engine Types ───────────────────────────────────

export type MarketDNARegime =
  | "Recovery"
  | "Expansion"
  | "Late Cycle"
  | "Bubble"
  | "Correction"
  | "Bear Market"
  | "Recession"
  | "Stagflation"
  | "Disinflation"
  | "Liquidity Expansion"
  | "Liquidity Contraction";

export interface FMOSMarketDNA {
  /** Current long-term structural regime */
  currentDNA: MarketDNARegime;
  /** Confidence in this classification (0–100) */
  confidence: number;
  /** Historical frequency of this regime (%) */
  historicalFrequency: number;
  /** Key characteristics of this regime */
  characteristics: string[];
  /** Portfolio implications of this regime */
  portfolioImplications: string[];
  /** How long this regime has been in effect (estimated) */
  estimatedDuration: string;
  /** When this regime typically transitions */
  typicalTransitionTriggers: string[];
}

// ── Market Weather Engine Types ───────────────────────────────

export type MarketWeatherCondition =
  | "Clear"
  | "Partly Cloudy"
  | "Overcast"
  | "Stormy"
  | "Severe";

export interface FMOSMarketWeather {
  /** Overall tactical market condition */
  condition: MarketWeatherCondition;
  /** Weather score (0–100, higher = more adverse) */
  score: number;
  /** Breadth score (0–100, higher = more stress) */
  breadth: number;
  /** Momentum score (0–100, higher = more negative) */
  momentum: number;
  /** Volatility score (0–100, higher = more volatile) */
  volatility: number;
  /** Leadership quality score (0–100, higher = worse leadership) */
  leadership: number;
  /** Sector rotation score (0–100, higher = more rotation) */
  sectorRotation: number;
  /** Risk appetite score (0–100, higher = more risk-off) */
  riskAppetite: number;
  /** Key tactical observations */
  observations: string[];
  /** Tactical recommendation given current weather */
  tacticalBias: string;
}

// ── Regime Engine Types ───────────────────────────────────────

export interface FMOSRegimeOutput {
  /** Current regime label */
  currentRegime: string;
  /** Confidence in this regime classification (0–100) */
  confidence: number;
  /** Regime stability score (0–100, higher = more stable) */
  stability: number;
  /** Transition risk score (0–100, higher = more likely to transition) */
  transitionRisk: number;
  /** Most likely next regime */
  mostLikelyNextRegime: string;
  /** Probability of transitioning in the next 30 days (0–100) */
  transitionProbability30d: number;
  /** Alternative regime scenarios with probabilities */
  alternativeScenarios: Array<{
    regime: string;
    probability: number;
    trigger: string;
  }>;
  /** Pressure level classification */
  pressureLevel: PressureLevel;
  /** Human-readable regime description */
  description: string;
}

// ── Transition Engine Types ───────────────────────────────────

export interface FMOSTransitionSignal {
  /** Signal name */
  name: string;
  /** Whether this signal is currently active */
  active: boolean;
  /** Signal strength (0–100) */
  strength: number;
  /** Description of what this signal indicates */
  description: string;
}

export interface FMOSTransitionOutput {
  /** Overall transition probability (0–100) */
  transitionProbability: number;
  /** Direction of potential transition */
  transitionDirection: "deteriorating" | "improving" | "stable";
  /** Active transition signals */
  activeSignals: FMOSTransitionSignal[];
  /** Breadth deterioration score (0–100) */
  breadthDeterioration: number;
  /** Credit spread widening score (0–100) */
  creditSpreadWidening: number;
  /** Liquidity deterioration score (0–100) */
  liquidityDeterioration: number;
  /** Volatility regime score (0–100) */
  volatilityRegime: number;
  /** Sector leadership breakdown score (0–100) */
  sectorLeadershipBreakdown: number;
  /** Key warning signs currently active */
  warningSignals: string[];
  /** Estimated time to potential regime change */
  estimatedTimeToTransition: string;
}

// ── Confidence Engine Types ───────────────────────────────────

export interface FMOSConfidenceOutput {
  /** Overall confidence score (0–100) */
  score: number;
  /** Qualitative confidence label */
  label: "Very High" | "High" | "Moderate" | "Low" | "Very Low";
  /** Evidence strength score (0–100) */
  evidenceStrength: number;
  /** Evidence diversity score (0–100) — independent families agreeing */
  evidenceDiversity: number;
  /** Number of contradictions detected */
  contradictionCount: number;
  /** Contradictions that reduce confidence */
  contradictions: string[];
  /** Missing data that would improve confidence */
  missingData: string[];
  /** Data freshness score (0–100) */
  dataFreshness: number;
  /** Explanation of confidence level */
  explanation: string;
}

// ── Decision Engine Types ─────────────────────────────────────

export type DecisionVerdict =
  | "STRONG BUY"
  | "BUY"
  | "ACCUMULATE"
  | "HOLD"
  | "WATCH"
  | "TRIM"
  | "REDUCE"
  | "SELL"
  | "AVOID";

export interface FMOSDecisionOutput {
  /** Primary decision verdict */
  verdict: DecisionVerdict;
  /** Action bias (broader category) */
  actionBias: ActionBias;
  /** Conviction level (0–100) */
  conviction: number;
  /** Primary reasoning for this decision */
  primaryReason: string;
  /** Bull case for this decision */
  bullCase: string;
  /** Bear case / risk for this decision */
  bearCase: string;
  /** Key catalysts that could drive the bull case */
  catalysts: string[];
  /** Key threats that could drive the bear case */
  threats: string[];
  /** Key price levels to watch */
  keyLevels: {
    support?: number;
    resistance?: number;
    entry?: number;
    stopLoss?: number;
    target?: number;
  };
  /** What would invalidate this decision */
  invalidationConditions: string[];
  /** Suggested position sizing guidance */
  positionSizing: string;
  /** Suggested timeframe for this decision */
  timeframe: string;
  /** Probability distribution supporting this decision */
  probability: FMOSProbabilityDistribution;
}

// ── AI Interpretation Engine Types ───────────────────────────

export interface FMOSAIInterpretation {
  /** Primary narrative explaining current conditions */
  headline: string;
  /** Why this signal/condition matters right now */
  whyNow: string;
  /** Supporting evidence summary */
  supportingEvidence: string;
  /** Contradicting evidence summary */
  contradictingEvidence: string;
  /** Historical context from analogs */
  historicalContext: string;
  /** Portfolio implications */
  portfolioImplications: string;
  /** What to watch for next */
  watchFor: string[];
  /** Educational explanation for less experienced investors */
  educationalNote: string;
}

// ── Calibration Engine Types ──────────────────────────────────

export interface FMOSCalibrationMetrics {
  /** Brier score (0–1, lower = better calibrated) */
  brierScore: number;
  /** Calibration error (mean absolute difference between predicted and actual) */
  calibrationError: number;
  /** False positive rate (predicted bullish, was bearish) */
  falsePositiveRate: number;
  /** False negative rate (predicted bearish, was bullish) */
  falseNegativeRate: number;
  /** Transition prediction accuracy (0–100%) */
  transitionAccuracy: number;
  /** Probability reliability (how often predicted probabilities matched outcomes) */
  probabilityReliability: number;
  /** Number of predictions evaluated */
  sampleSize: number;
  /** Date range of evaluation */
  evaluationPeriod: { from: string; to: string };
}

// ── Universal Intelligence Pipeline Output ────────────────────

/**
 * The complete output of the FMOS Universal Intelligence Pipeline.
 * Every feature in FAULTLINE should ultimately consume this type
 * (or a subset of it) rather than calling individual engines directly.
 */
export interface FMOSUniversalOutput {
  /** The ticker or asset being analyzed (null for market-wide analysis) */
  symbol: string | null;
  /** Asset type */
  assetType: "stock" | "crypto" | "etf" | "market" | null;
  /** ISO timestamp of this analysis */
  timestamp: string;
  /** Engine version */
  engineVersion: string;

  // ── Layer 1: Foundation ──────────────────────────────────────
  /** Raw pressure engine output (backward compatible) */
  pressure: FaultlinePressureOutput;

  // ── Layer 2: Market Context ──────────────────────────────────
  /** Long-term structural market environment */
  marketDNA: FMOSMarketDNA;
  /** Daily tactical market conditions */
  marketWeather: FMOSMarketWeather;

  // ── Layer 3: Analysis ────────────────────────────────────────
  /** Regime classification with transition risk */
  regime: FMOSRegimeOutput;
  /** Transition detection and warning signals */
  transition: FMOSTransitionOutput;
  /** Organized evidence families */
  evidence: FMOSEvidenceOutput;

  // ── Layer 4: Synthesis ───────────────────────────────────────
  /** Canonical probability distribution */
  probability: FMOSProbabilityDistribution;
  /** Confidence assessment */
  confidence: FMOSConfidenceOutput;
  /** Historical analog comparisons */
  analogs: FMOSHistoricalAnalog[];
  /** Best matching analog */
  topAnalog: FMOSHistoricalAnalog;

  // ── Layer 5: Decision ────────────────────────────────────────
  /** Decision recommendation */
  decision: FMOSDecisionOutput;
  /** AI interpretation narrative */
  interpretation: FMOSAIInterpretation;

  // ── Metadata ─────────────────────────────────────────────────
  /** Data source status */
  dataSource: "live" | "fallback";
  /** Whether all engines ran successfully */
  complete: boolean;
  /** Any engine errors that occurred */
  errors: string[];
}

// ── Pipeline Options ────────────────────────────────────────

export interface FMOSPipelineOptions {
  /** Optional ticker symbol for symbol-specific analysis */
  symbol?: string;
  /** Skip AI interpretation (LLM call) for faster execution */
  skipAIInterpretation?: boolean;
  /** Number of historical analogs to return (default: 3) */
  topAnalogCount?: number;
}

// ── Partial Pipeline Output ───────────────────────────────────

/**
 * Partial FMOS output when only some engines have run.
 * Used during progressive feature migration.
 */
export type FMOSPartialOutput = Partial<FMOSUniversalOutput> & {
  symbol: string | null;
  timestamp: string;
  pressure: FaultlinePressureOutput;
};
