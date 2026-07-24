// ============================================================
// FAULTLINE Seismograph Core™ — server/seismographCore.ts
//
// The central integration interface for the FAULTLINE Market
// Operating System. Defines:
//
//   1. EvidencePacket — the contract every engine must implement
//      to contribute evidence to the Seismograph.
//
//   2. SeismographOutput — the single canonical market state
//      object distributed to all user-facing surfaces.
//
//   3. Distribution payload types — pre-formatted context
//      blocks for ASHA, Daily Brief, Dashboard, Stock Pages,
//      Alerts, and Reports.
//
// Architecture:
//   Evidence Contributors → Seismograph Core → SeismographOutput
//                                                       │
//                    ┌──────────────────────────────────┤
//                    ▼          ▼          ▼            ▼
//                  ASHA    Daily Brief  Dashboard  Stock Pages
//
// All engines contribute EvidencePackets.
// No engine independently determines market state for users.
// The Seismograph is the only synthesis layer.
// ============================================================

import type {
  EvidencePacket,
  EvidenceSignal,
  EvidenceType,
  SeismographProviderProvenance,
} from "./seismographCore.contract";

export type {
  EvidenceContributor,
  EvidencePacket,
  EvidenceSignal,
  EvidenceType,
  SeismographProviderProvenance,
} from "./seismographCore.contract";

export function deriveProviderProvenance(
  packets: EvidencePacket[],
  computedAt: number = Date.now(),
): SeismographProviderProvenance {
  const pressurePacket = packets.find(packet => packet.source === "pressure-engine");
  const dataSource = pressurePacket?.metadata?.dataSource;
  const fallbackReason = pressurePacket?.metadata?.fallbackReason;

  if (dataSource === "live") {
    return {
      fred: {
        status: "live",
        detail: "Live FRED macro and credit observations contributed through the pressure engine.",
        asOf: pressurePacket?.timestamp ?? computedAt,
      },
    };
  }

  if (dataSource === "fallback") {
    return {
      fred: {
        status: "fallback",
        detail: typeof fallbackReason === "string" && fallbackReason.length > 0
          ? fallbackReason
          : "FRED was unavailable; explicitly labeled fallback observations contributed through the pressure engine.",
        asOf: pressurePacket?.timestamp ?? computedAt,
      },
    };
  }

  return {
    fred: {
      status: "unavailable",
      detail: "No pressure-engine FRED provenance was present in this Seismograph output.",
      asOf: computedAt,
    },
  };
}

// ── Historical Analog ─────────────────────────────────────────
export interface SeismographAnalog {
  year?: number;
  label: string;
  similarity: number;
  description: string;
  period?: string;
  outcome?: string;
  durationMonths?: number;
  peakPressure?: number;
  resolution?: string;
}

// ── Active Pattern ────────────────────────────────────────────
export interface SeismographPattern {
  patternId: string;
  name: string;
  description: string;
  confidence: number;
  daysActive: number;
  historicalOutcome?: string;
}

// ── Evidence Family ───────────────────────────────────────────
export interface SeismographEvidenceFamily {
  name: string;
  signal: EvidenceSignal;
  strength: number;
  contributors: string[];
  summary: string;
}

// ── Transition Probabilities ──────────────────────────────────
export interface SeismographTransitionProbabilities {
  remainInRegime: number;
  transitionToElevated: number;
  transitionToLow: number;
  transitionToCrisis: number;
  primaryDriver: string;
}

// ── Market Memory Summary ─────────────────────────────────────
export interface SeismographMarketMemory {
  streakDays: number;
  streakDirection: "rising" | "falling" | "stable";
  peakPressureThisCycle: number;
  troughPressureThisCycle: number;
  daysSinceLastTransition: number;
  lastRegimeTransition?: string;
  keyMemoryPoints: string[];
}

// ── Distribution Payloads ─────────────────────────────────────

/** Pre-formatted context block injected into every ASHA query */
export interface ASHAContextBlock {
  systemPromptBlock: string;
  pressureScore: number;
  regime: string;
  stressLevel: string;
  probabilities: { bull: number; neutral: number; bear: number };
  topAnalog: string;
  activePatterns: string[];
  marketMemoryHighlights: string[];
  dataFreshness: "live" | "recent" | "stale";
}

/** Context used to generate the Daily Brief */
export interface DailyBriefContext {
  date: string;
  pressureScore: number;
  regime: string;
  stressLevel: string;
  direction: string;
  probabilities: { bull: number; neutral: number; bear: number };
  evidenceSummary: string;
  topAnalog: SeismographAnalog | null;
  activePatterns: SeismographPattern[];
  transitionProbabilities: SeismographTransitionProbabilities;
  marketMemory: SeismographMarketMemory;
  keyDevelopments: string[];
  narrativeContext: string;
}

/** Payload for dashboard and pressure page */
export interface DashboardPayload {
  pressureScore: number;
  regime: string;
  stressLevel: string;
  direction: string;
  probabilities: { bull: number; neutral: number; bear: number };
  evidenceFamilies: SeismographEvidenceFamily[];
  topAnalog: SeismographAnalog | null;
  activePatterns: SeismographPattern[];
  transitionProbabilities: SeismographTransitionProbabilities;
  marketMemory: SeismographMarketMemory;
  lastUpdated: number;
  dataFreshness: "live" | "recent" | "stale";
}

/** Macro context block consumed by stock and crypto pages */
export interface MacroContextBlock {
  pressureScore: number;
  regime: string;
  stressLevel: string;
  direction: string;
  probabilities: { bull: number; neutral: number; bear: number };
  macroHeadwinds: string[];
  macroTailwinds: string[];
  regimeImplication: string;
  historicalContext: string;
  dataFreshness: "live" | "recent" | "stale";
}

/** Context for alert evaluation */
export interface AlertEvaluationContext {
  pressureScore: number;
  regime: string;
  stressLevel: string;
  direction: string;
  activePatterns: SeismographPattern[];
  transitionProbabilities: SeismographTransitionProbabilities;
  significantChanges: string[];
}

/** Context for reports, X posts, and blog content */
export interface ReportContext {
  pressureScore: number;
  regime: string;
  stressLevel: string;
  direction: string;
  probabilities: { bull: number; neutral: number; bear: number };
  topAnalog: SeismographAnalog | null;
  activePatterns: SeismographPattern[];
  keyDevelopments: string[];
  marketMemory: SeismographMarketMemory;
  narrativeContext: string;
}

// ── SeismographOutput — the canonical market state object ─────
/**
 * The single source of truth for FAULTLINE's market understanding.
 * Computed by the Seismograph Core from all evidence contributors.
 * Distributed to all user-facing surfaces via pre-formatted payloads.
 *
 * All surfaces read from this object. No surface independently
 * determines market state.
 */
export interface SeismographOutput {
  // ── Identity ──────────────────────────────────────────────
  version: string;
  computedAt: number;
  dataFreshness: "live" | "recent" | "stale";

  // ── Core Market Assessment ────────────────────────────────
  pressureScore: number;
  regime: string;
  stressLevel: "Low" | "Elevated" | "High" | "Crisis";
  direction: "Improving" | "Stable" | "Deteriorating" | "Accelerating";

  // ── Probability Distribution ──────────────────────────────
  probabilities: {
    bull: number;
    neutral: number;
    bear: number;
    primaryDriver: string;
    confidence: number;
  };

  // ── Historical Context ────────────────────────────────────
  historicalPercentile: number;
  analogMatches: SeismographAnalog[];
  topAnalog: SeismographAnalog | null;

  // ── Pattern Intelligence ──────────────────────────────────
  activePatterns: SeismographPattern[];
  patternsSummary: string;

  // ── Transition Intelligence ───────────────────────────────
  transitionProbabilities: SeismographTransitionProbabilities;

  // ── Evidence Summary ──────────────────────────────────────
  evidenceFamilies: SeismographEvidenceFamily[];
  activeContributors: string[];
  evidenceConsensus: "strong" | "moderate" | "weak" | "divergent";
  providerProvenance?: SeismographProviderProvenance;

  // ── Market Memory ─────────────────────────────────────────
  marketMemory: SeismographMarketMemory;

  // ── Distribution Payloads ─────────────────────────────────
  forDashboard: DashboardPayload;
  forASHA: ASHAContextBlock;
  forDailyBrief: DailyBriefContext;
  forAlerts: AlertEvaluationContext;
  forStockPages: MacroContextBlock;
  forReports: ReportContext;
}

// ── Synthesis Helpers ─────────────────────────────────────────

/**
 * Synthesize a unified pressure score from multiple evidence packets.
 * Weights evidence by type and confidence.
 */
export function synthesizePressureScore(packets: EvidencePacket[]): number {
  if (packets.length === 0) return 5.0;

  const weights: Record<EvidenceType, number> = {
    macro_pressure: 2.5,
    regime_classification: 2.0,
    probability_distribution: 1.5,
    historical_analog: 1.0,
    transition_signal: 1.5,
    liquidity_conditions: 1.8,
    credit_stress: 1.8,
    momentum: 1.2,
    volatility: 1.3,
    cross_market_alignment: 1.2,
    crypto_cycle: 0.8,
    breakdown_signals: 2.0,
    recovery_confirmation: 1.5,
    sentiment: 0.7,
    insider_flow: 0.6,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const packet of packets) {
    const w = (weights[packet.evidenceType] ?? 1.0) * (packet.confidence / 100);
    // Convert signal to pressure contribution (0–10 scale)
    const signalScore = signalToPressure(packet.signal, packet.strength);
    weightedSum += signalScore * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return 5.0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

function signalToPressure(signal: EvidenceSignal, strength: number): number {
  const base = strength / 10; // 0–10
  switch (signal) {
    case "bullish":
    case "recovering":
      return Math.max(0, 5 - base * 0.5);
    case "bearish":
    case "stressed":
      return Math.min(10, 5 + base * 0.5);
    case "transitioning":
      return 5 + (base * 0.3);
    case "neutral":
    default:
      return 5;
  }
}

/**
 * Determine evidence consensus from all packets.
 * Returns "strong" when 80%+ agree, "moderate" when 60%+,
 * "weak" when 40%+, "divergent" otherwise.
 */
export function computeEvidenceConsensus(
  packets: EvidencePacket[]
): "strong" | "moderate" | "weak" | "divergent" {
  if (packets.length === 0) return "weak";

  const bullish = packets.filter(
    (p) => p.signal === "bullish" || p.signal === "recovering"
  ).length;
  const bearish = packets.filter(
    (p) => p.signal === "bearish" || p.signal === "stressed"
  ).length;
  const total = packets.length;

  const dominantCount = Math.max(bullish, bearish);
  const ratio = dominantCount / total;

  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.6) return "moderate";
  if (ratio >= 0.4) return "weak";
  return "divergent";
}

/**
 * Group evidence packets into evidence families for display.
 */
export function groupIntoFamilies(
  packets: EvidencePacket[]
): SeismographEvidenceFamily[] {
  const familyMap: Record<string, EvidencePacket[]> = {};

  for (const packet of packets) {
    const family = evidenceTypeToFamily(packet.evidenceType);
    if (!familyMap[family]) familyMap[family] = [];
    familyMap[family].push(packet);
  }

  return Object.entries(familyMap).map(([name, pkts]) => {
    const avgStrength =
      pkts.reduce((s, p) => s + p.strength, 0) / pkts.length;
    const signals = pkts.map((p) => p.signal);
    const dominantSignal = getDominantSignal(signals);

    return {
      name,
      signal: dominantSignal,
      strength: Math.round(avgStrength),
      contributors: pkts.map((p) => p.source),
      summary: pkts.map((p) => p.humanReadable).join(" "),
    };
  });
}

function evidenceTypeToFamily(type: EvidenceType): string {
  const map: Record<EvidenceType, string> = {
    macro_pressure: "Macro Pressure",
    regime_classification: "Market Regime",
    probability_distribution: "Probability",
    historical_analog: "Historical Context",
    transition_signal: "Regime Transition",
    liquidity_conditions: "Liquidity",
    credit_stress: "Credit Stress",
    momentum: "Momentum",
    volatility: "Volatility",
    cross_market_alignment: "Cross-Market",
    crypto_cycle: "Crypto Cycle",
    breakdown_signals: "Breakdown Signals",
    recovery_confirmation: "Recovery",
    sentiment: "Sentiment",
    insider_flow: "Insider Flow",
  };
  return map[type] ?? "Other";
}

function getDominantSignal(signals: EvidenceSignal[]): EvidenceSignal {
  const counts: Record<string, number> = {};
  for (const s of signals) {
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "neutral") as EvidenceSignal;
}

/**
 * Build the ASHA context block from a SeismographOutput.
 * This is the system prompt injection for every ASHA query.
 */
export function buildASHAContextBlock(output: SeismographOutput): ASHAContextBlock {
  const { pressureScore, regime, stressLevel, probabilities, analogMatches, activePatterns, marketMemory } = output;

  const topAnalog = analogMatches[0];
  const patternNames = activePatterns.slice(0, 3).map((p) => p.name);
  const memoryHighlights = marketMemory.keyMemoryPoints.slice(0, 4);

  const systemPromptBlock = `
## FAULTLINE SEISMOGRAPH™ — Current Market State
**Pressure Score:** ${pressureScore}/10 | **Regime:** ${regime} | **Stress Level:** ${stressLevel}
**Direction:** ${output.direction} | **Evidence Consensus:** ${output.evidenceConsensus}

**Probability Distribution:**
- Bull: ${probabilities.bull}% | Neutral: ${probabilities.neutral}% | Bear: ${probabilities.bear}%
- Primary Driver: ${probabilities.primaryDriver}
- Confidence: ${probabilities.confidence}%

**Historical Context:**
- Percentile: ${output.historicalPercentile}th (${output.historicalPercentile > 75 ? "historically elevated" : output.historicalPercentile > 50 ? "above average" : "below average"})
- Closest Analog: ${topAnalog ? `${topAnalog.label} (${topAnalog.similarity}% similarity)` : "No close analog"}
- Market Streak: ${marketMemory.streakDays} days ${marketMemory.streakDirection}

**Active Patterns:** ${patternNames.length > 0 ? patternNames.join(", ") : "No significant patterns detected"}

**Market Memory:**
${memoryHighlights.map((h) => `- ${h}`).join("\n")}

**Transition Risk:**
- Remain in regime: ${output.transitionProbabilities.remainInRegime}%
- Transition to elevated: ${output.transitionProbabilities.transitionToElevated}%
- Transition to crisis: ${output.transitionProbabilities.transitionToCrisis}%

Data freshness: ${output.dataFreshness} | Last updated: ${new Date(output.computedAt).toISOString()}
`.trim();

  return {
    systemPromptBlock,
    pressureScore,
    regime,
    stressLevel,
    probabilities: {
      bull: probabilities.bull,
      neutral: probabilities.neutral,
      bear: probabilities.bear,
    },
    topAnalog: topAnalog ? `${topAnalog.label} (${topAnalog.similarity}% similarity)` : "None",
    activePatterns: patternNames,
    marketMemoryHighlights: memoryHighlights,
    dataFreshness: output.dataFreshness,
  };
}

/**
 * Build the Daily Brief context from a SeismographOutput.
 */
export function buildDailyBriefContext(output: SeismographOutput): DailyBriefContext {
  const today = new Date().toISOString().split("T")[0];

  const keyDevelopments: string[] = [];
  if (output.direction === "Deteriorating" || output.direction === "Accelerating") {
    keyDevelopments.push(`Pressure ${output.direction.toLowerCase()} — ${output.regime}`);
  }
  for (const pattern of output.activePatterns.slice(0, 3)) {
    keyDevelopments.push(`Pattern detected: ${pattern.name} (${pattern.confidence}% confidence)`);
  }
  if (output.transitionProbabilities.transitionToCrisis > 20) {
    keyDevelopments.push(
      `Elevated transition risk: ${output.transitionProbabilities.transitionToCrisis}% probability of crisis regime`
    );
  }

  const narrativeContext = `
Current market conditions reflect a ${output.stressLevel.toLowerCase()} stress environment with a Pressure Score of ${output.pressureScore}/10. 
The regime is classified as ${output.regime} with a ${output.direction.toLowerCase()} trend. 
Evidence consensus is ${output.evidenceConsensus} across ${output.activeContributors.length} contributing intelligence engines.
${output.topAnalog ? `The closest historical analog is ${output.topAnalog.label} (${output.topAnalog.similarity}% similarity).` : ""}
`.trim();

  return {
    date: today,
    pressureScore: output.pressureScore,
    regime: output.regime,
    stressLevel: output.stressLevel,
    direction: output.direction,
    probabilities: {
      bull: output.probabilities.bull,
      neutral: output.probabilities.neutral,
      bear: output.probabilities.bear,
    },
    evidenceSummary: output.evidenceFamilies
      .map((f) => `${f.name}: ${f.signal} (${f.strength}%)`)
      .join("; "),
    topAnalog: output.topAnalog,
    activePatterns: output.activePatterns,
    transitionProbabilities: output.transitionProbabilities,
    marketMemory: output.marketMemory,
    keyDevelopments,
    narrativeContext,
  };
}

/**
 * Build the macro context block for stock and crypto pages.
 */
export function buildMacroContextBlock(output: SeismographOutput): MacroContextBlock {
  const macroHeadwinds: string[] = [];
  const macroTailwinds: string[] = [];

  for (const family of output.evidenceFamilies) {
    if (family.signal === "bearish" || family.signal === "stressed") {
      macroHeadwinds.push(`${family.name}: ${family.summary}`);
    } else if (family.signal === "bullish" || family.signal === "recovering") {
      macroTailwinds.push(`${family.name}: ${family.summary}`);
    }
  }

  const regimeImplication = `In a ${output.regime} regime with ${output.stressLevel.toLowerCase()} stress, ` +
    `the macro environment is ${output.direction.toLowerCase()}. ` +
    `${output.probabilities.bear > 50 ? "Defensive positioning is favored." : output.probabilities.bull > 50 ? "Risk assets have macro tailwinds." : "Selective positioning is warranted."}`;

  const historicalContext = output.topAnalog
    ? `Current conditions most closely resemble ${output.topAnalog.label} (${output.topAnalog.similarity}% similarity). ${output.topAnalog.description}`
    : `At the ${output.historicalPercentile}th historical percentile, current conditions are ${output.historicalPercentile > 75 ? "historically elevated" : "within normal range"}.`;

  return {
    pressureScore: output.pressureScore,
    regime: output.regime,
    stressLevel: output.stressLevel,
    direction: output.direction,
    probabilities: {
      bull: output.probabilities.bull,
      neutral: output.probabilities.neutral,
      bear: output.probabilities.bear,
    },
    macroHeadwinds: macroHeadwinds.slice(0, 4),
    macroTailwinds: macroTailwinds.slice(0, 4),
    regimeImplication,
    historicalContext,
    dataFreshness: output.dataFreshness,
  };
}

/**
 * Build the alert evaluation context from a SeismographOutput.
 */
export function buildAlertEvaluationContext(output: SeismographOutput): AlertEvaluationContext {
  const significantChanges: string[] = [];

  if (output.pressureScore >= 7) {
    significantChanges.push(`High pressure: ${output.pressureScore}/10`);
  }
  if (output.transitionProbabilities.transitionToCrisis > 25) {
    significantChanges.push(
      `Crisis transition risk: ${output.transitionProbabilities.transitionToCrisis}%`
    );
  }
  for (const pattern of output.activePatterns) {
    if (pattern.confidence > 70) {
      significantChanges.push(`High-confidence pattern: ${pattern.name}`);
    }
  }

  return {
    pressureScore: output.pressureScore,
    regime: output.regime,
    stressLevel: output.stressLevel,
    direction: output.direction,
    activePatterns: output.activePatterns,
    transitionProbabilities: output.transitionProbabilities,
    significantChanges,
  };
}

/**
 * Build the report context from a SeismographOutput.
 */
export function buildReportContext(output: SeismographOutput): ReportContext {
  const keyDevelopments: string[] = [];

  if (output.direction !== "Stable") {
    keyDevelopments.push(`Market pressure is ${output.direction.toLowerCase()}`);
  }
  for (const pattern of output.activePatterns.slice(0, 2)) {
    keyDevelopments.push(`${pattern.name} pattern active (${pattern.confidence}% confidence)`);
  }
  if (output.evidenceConsensus === "strong" || output.evidenceConsensus === "divergent") {
    keyDevelopments.push(`Evidence consensus: ${output.evidenceConsensus}`);
  }

  const narrativeContext = `${output.regime} regime. Pressure ${output.pressureScore}/10. ` +
    `${output.probabilities.bull > output.probabilities.bear ? "Bullish" : "Bearish"} bias ` +
    `(${Math.max(output.probabilities.bull, output.probabilities.bear)}% probability). ` +
    `${output.topAnalog ? `Analog: ${output.topAnalog.label}.` : ""}`;

  return {
    pressureScore: output.pressureScore,
    regime: output.regime,
    stressLevel: output.stressLevel,
    direction: output.direction,
    probabilities: {
      bull: output.probabilities.bull,
      neutral: output.probabilities.neutral,
      bear: output.probabilities.bear,
    },
    topAnalog: output.topAnalog,
    activePatterns: output.activePatterns,
    keyDevelopments,
    marketMemory: output.marketMemory,
    narrativeContext,
  };
}

/**
 * Assemble a complete SeismographOutput from a SeismographState
 * (from seismographEngine.ts) plus a set of EvidencePackets.
 *
 * This is called by the Seismograph Heartbeat job after collecting
 * all evidence from contributors.
 */
export function assembleSeismographOutput(
  state: {
    pressureScore: number;
    regime: string;
    stressLevel: string;
    direction: string;
    historicalPercentile: number;
    analogMatches: SeismographAnalog[];
    activePatterns: SeismographPattern[];
    transitionProbabilities: SeismographTransitionProbabilities;
    marketMemory: SeismographMarketMemory;
  },
  packets: EvidencePacket[]
): SeismographOutput {
  const synthesizedPressure = packets.length > 0
    ? synthesizePressureScore(packets)
    : state.pressureScore;

  // Blend synthesized score with direct pressure score (60/40)
  const blendedPressure = packets.length > 0
    ? Math.round((synthesizedPressure * 0.4 + state.pressureScore * 0.6) * 10) / 10
    : state.pressureScore;

  const evidenceFamilies = groupIntoFamilies(packets);
  const evidenceConsensus = computeEvidenceConsensus(packets);

  // Compute probability distribution from evidence
  const bullPackets = packets.filter(
    (p) => p.signal === "bullish" || p.signal === "recovering"
  );
  const bearPackets = packets.filter(
    (p) => p.signal === "bearish" || p.signal === "stressed"
  );
  const total = packets.length || 1;
  const bullPct = Math.round((bullPackets.length / total) * 100);
  const bearPct = Math.round((bearPackets.length / total) * 100);
  const neutralPct = 100 - bullPct - bearPct;

  const primaryDriver =
    evidenceFamilies.sort((a, b) => b.strength - a.strength)[0]?.name ??
    "Macro Pressure";

  const avgConfidence =
    packets.length > 0
      ? Math.round(packets.reduce((s, p) => s + p.confidence, 0) / packets.length)
      : 70;

  const stressLevel = blendedPressure >= 8
    ? "Crisis"
    : blendedPressure >= 6.5
    ? "High"
    : blendedPressure >= 4.5
    ? "Elevated"
    : "Low";

  const topAnalog = state.analogMatches[0] ?? null;

  const patternsSummary =
    state.activePatterns.length > 0
      ? `${state.activePatterns.length} active pattern${state.activePatterns.length > 1 ? "s" : ""}: ${state.activePatterns.map((p) => p.name).join(", ")}`
      : "No significant patterns detected";

  const dataFreshness: "live" | "recent" | "stale" =
    packets.length >= 5 ? "live" : packets.length >= 2 ? "recent" : "stale";

  const computedAt = Date.now();
  const output: SeismographOutput = {
    version: "2.0",
    computedAt,
    dataFreshness,
    pressureScore: blendedPressure,
    regime: state.regime,
    stressLevel: stressLevel as SeismographOutput["stressLevel"],
    direction: state.direction as SeismographOutput["direction"],
    probabilities: {
      bull: bullPct,
      neutral: Math.max(0, neutralPct),
      bear: bearPct,
      primaryDriver,
      confidence: avgConfidence,
    },
    historicalPercentile: state.historicalPercentile,
    analogMatches: state.analogMatches,
    topAnalog,
    activePatterns: state.activePatterns,
    patternsSummary,
    transitionProbabilities: state.transitionProbabilities,
    evidenceFamilies,
    activeContributors: Array.from(new Set(packets.map((p) => p.source))),
    evidenceConsensus,
    providerProvenance: deriveProviderProvenance(packets, computedAt),
    marketMemory: state.marketMemory,
    // Distribution payloads — built below
    forDashboard: {} as DashboardPayload,
    forASHA: {} as ASHAContextBlock,
    forDailyBrief: {} as DailyBriefContext,
    forAlerts: {} as AlertEvaluationContext,
    forStockPages: {} as MacroContextBlock,
    forReports: {} as ReportContext,
  };

  // Build distribution payloads
  output.forDashboard = {
    pressureScore: blendedPressure,
    regime: state.regime,
    stressLevel: stressLevel as DashboardPayload["stressLevel"],
    direction: state.direction,
    probabilities: { bull: bullPct, neutral: Math.max(0, neutralPct), bear: bearPct },
    evidenceFamilies,
    topAnalog,
    activePatterns: state.activePatterns,
    transitionProbabilities: state.transitionProbabilities,
    marketMemory: state.marketMemory,
    lastUpdated: Date.now(),
    dataFreshness,
  };
  output.forASHA = buildASHAContextBlock(output);
  output.forDailyBrief = buildDailyBriefContext(output);
  output.forAlerts = buildAlertEvaluationContext(output);
  output.forStockPages = buildMacroContextBlock(output);
  output.forReports = buildReportContext(output);

  return output;
}
