// ============================================================
// FAULTLINE Seismograph Adapters™ — server/seismographAdapters.ts
//
// Non-breaking adapter functions that wrap each engine's existing
// output into the standardized EvidencePacket format required by
// the Seismograph Core.
//
// Each adapter:
//   1. Accepts the engine's existing output type (unchanged)
//   2. Returns an EvidencePacket
//   3. Does NOT modify the engine's existing exports
//
// Usage in Heartbeat job:
//   const pressureEvidence = pressureToEvidencePacket(pressureOutput);
//   const fmosEvidence = fmosToEvidencePackets(fmosOutput);
//   const packets = [pressureEvidence, ...fmosEvidence, ...];
//   const seismographOutput = assembleSeismographOutput(state, packets);
// ============================================================

import type { FaultlinePressureOutput } from "./pressure/engine";
import type { FMOSUniversalOutput } from "./fmos/types";
import type { CrossMarketIntelligence } from "./crossMarketEngine";
import type { SOBResult } from "./sobEngine";
import type { EvidencePacket, EvidenceSignal } from "./seismographCore";

// ── Pressure Engine Adapter ───────────────────────────────────

/**
 * Convert FaultlinePressureOutput → EvidencePacket (macro_pressure)
 */
export function pressureToEvidencePacket(
  output: FaultlinePressureOutput
): EvidencePacket {
  const score = output.overallPressure; // 0–100
  const strength = score; // already 0–100
  const signal: EvidenceSignal =
    score >= 65 ? "stressed" :
    score >= 45 ? "bearish" :
    score >= 25 ? "neutral" :
    "bullish";

  const levelToConfidence: Record<string, number> = {
    Critical: 90,
    High: 85,
    Elevated: 80,
    Moderate: 75,
    Low: 70,
  };

  return {
    source: "pressure-engine",
    timestamp: Date.now(),
    evidenceType: "macro_pressure",
    signal,
    strength,
    confidence: levelToConfidence[output.level] ?? 75,
    primaryReading: `pressure=${score} regime=${output.regime} level=${output.level}`,
    humanReadable: `Pressure Index at ${score}/100 — ${output.regime} (${output.level})`,
    subScores: Object.fromEntries(
      output.vectors.map((v) => [v.id, v.score])
    ),
    metadata: {
      regime: output.regime,
      level: output.level,
      topAnalog: output.topAnalog?.label,
      dataSource: output.dataSource,
    },
  };
}

// ── FMOS Pipeline Adapters ────────────────────────────────────

/**
 * Convert FMOSUniversalOutput → multiple EvidencePackets
 * (one per evidence type the FMOS pipeline produces)
 */
export function fmosToEvidencePackets(
  output: FMOSUniversalOutput
): EvidencePacket[] {
  const packets: EvidencePacket[] = [];
  const ts = Date.now();

  // 1. Regime Classification
  const regimeSignal: EvidenceSignal =
    output.regime.pressureLevel === "Critical" ? "stressed" :
    output.regime.pressureLevel === "High" ? "bearish" :
    output.regime.pressureLevel === "Elevated" ? "bearish" :
    output.regime.pressureLevel === "Moderate" ? "neutral" :
    "bullish";

  packets.push({
    source: "fmos-regime",
    timestamp: ts,
    evidenceType: "regime_classification",
    signal: regimeSignal,
    strength: output.regime.confidence,
    confidence: output.confidence.score,
    primaryReading: `regime=${output.regime.currentRegime} confidence=${output.regime.confidence}`,
    humanReadable: `FMOS classifies regime as ${output.regime.currentRegime} (${output.regime.confidence}% confidence)`,
    metadata: {
      regime: output.regime.currentRegime,
      pressureLevel: output.regime.pressureLevel,
      description: output.regime.description,
    },
  });

  // 2. Probability Distribution
  const probSignal: EvidenceSignal =
    output.probability.bull > 55 ? "bullish" :
    output.probability.bear > 55 ? "bearish" :
    "neutral";

  packets.push({
    source: "fmos-probability",
    timestamp: ts,
    evidenceType: "probability_distribution",
    signal: probSignal,
    strength: Math.max(output.probability.bull, output.probability.bear),
    confidence: output.probability.confidence,
    primaryReading: `bull=${output.probability.bull} neutral=${output.probability.neutral} bear=${output.probability.bear}`,
    humanReadable: `${output.probability.bull}% bull / ${output.probability.neutral}% neutral / ${output.probability.bear}% bear — ${output.probability.primaryDriver}`,
    subScores: {
      bull: output.probability.bull,
      neutral: output.probability.neutral,
      bear: output.probability.bear,
    },
    metadata: {
      primaryDriver: output.probability.primaryDriver,
      bullEvidence: output.probability.bullEvidence,
      bearEvidence: output.probability.bearEvidence,
    },
  });

  // 3. Historical Analogs
  if (output.analogs && output.analogs.length > 0) {
    const topAnalog = output.analogs[0];
    const analogSignal: EvidenceSignal =
      topAnalog.similarity > 70 ? "stressed" :
      topAnalog.similarity > 50 ? "bearish" :
      "neutral";

    packets.push({
      source: "fmos-historical-analogs",
      timestamp: ts,
      evidenceType: "historical_analog",
      signal: analogSignal,
      strength: topAnalog.similarity,
      confidence: Math.min(95, topAnalog.similarity + 10),
      primaryReading: `topAnalog=${topAnalog.label} similarity=${topAnalog.similarity}`,
      humanReadable: `Closest historical analog: ${topAnalog.label} (${topAnalog.similarity}% similarity)`,
      metadata: {
        analogs: output.analogs.slice(0, 3).map((a) => ({
          label: a.label,
          similarity: a.similarity,
          year: a.year,
          outcome: a.outcome,
        })),
      },
    });
  }

  // 4. Transition Signal
  if (output.transition) {
    const tp = output.transition.transitionProbability;
    const transSignal: EvidenceSignal =
      tp > 60 ? "transitioning" :
      tp > 30 ? "neutral" :
      "neutral";

    packets.push({
      source: "fmos-transition",
      timestamp: ts,
      evidenceType: "transition_signal",
      signal: transSignal,
      strength: tp,
      confidence: 75,
      primaryReading: `transitionProbability=${tp} direction=${output.transition.transitionDirection}`,
      humanReadable: `${tp}% probability of regime transition (${output.transition.transitionDirection})`,
      metadata: {
        transitionProbability: tp,
        transitionDirection: output.transition.transitionDirection,
        estimatedTimeToTransition: output.transition.estimatedTimeToTransition,
      },
    });
  }

  return packets;
}

// ── Cross-Market Engine Adapter ───────────────────────────────

/**
 * Convert CrossMarketIntelligence → EvidencePacket (cross_market_alignment)
 */
export function crossMarketToEvidencePacket(
  output: CrossMarketIntelligence
): EvidencePacket {
  const alignScore = output.alignmentScore; // 0–100
  const signal: EvidenceSignal =
    output.forwardBias?.toLowerCase().includes("bullish") ? "bullish" :
    output.forwardBias?.toLowerCase().includes("bearish") ? "bearish" :
    alignScore > 70 ? "bullish" :
    alignScore < 30 ? "bearish" :
    "neutral";

  return {
    source: "cross-market-engine",
    timestamp: Date.now(),
    evidenceType: "cross_market_alignment",
    signal,
    strength: alignScore,
    confidence: 75,
    primaryReading: `alignmentScore=${alignScore} forwardBias=${output.forwardBias}`,
    humanReadable: `Stock/crypto alignment: ${alignScore}% — ${output.forwardBias ?? "neutral bias"}`,
    subScores: { alignmentScore: alignScore },
    metadata: {
      forwardBias: output.forwardBias,
      alignmentStatus: output.alignmentStatus,
      plainEnglishSummary: output.plainEnglishSummary,
      keyInsights: output.keyInsights,
    },
  };
}

// ── SOB Engine Adapter ────────────────────────────────────────

/**
 * Convert SOBResult → EvidencePacket (breakdown_signals)
 */
export function sobToEvidencePacket(output: SOBResult): EvidencePacket {
  // SOBResult.level is 0–6; normalize to 0–100
  const score = Math.round((output.level / 6) * 100);
  const signal: EvidenceSignal =
    score >= 70 ? "stressed" :
    score >= 50 ? "bearish" :
    score >= 30 ? "neutral" :
    "bullish";

  return {
    source: "sob-engine",
    timestamp: Date.now(),
    evidenceType: "breakdown_signals",
    signal,
    strength: score,
    confidence: output.confidence,
    primaryReading: `sobLevel=${output.level} label=${output.label} trend=${output.trend}`,
    humanReadable: `Signals of Breakdown: Level ${output.level}/6 — ${output.label} (${output.trend})`,
    subScores: Object.fromEntries(
      output.pillars.map((p) => [p.name, p.active ? 100 : 0])
    ),
    metadata: {
      level: output.level,
      label: output.label,
      trend: output.trend,
      pillars: output.pillars,
      explanation: output.explanation,
      whatChanged: output.whatChanged,
    },
  };
}

// ── Collect All Evidence ──────────────────────────────────────

/**
 * Collect evidence packets from all available contributors.
 * Called by the Seismograph Heartbeat job each cycle.
 *
 * Returns an array of EvidencePackets, gracefully handling
 * any contributor that fails (logs error, continues).
 */
export async function collectAllEvidence(params: {
  pressureOutput?: FaultlinePressureOutput;
  fmosOutput?: FMOSUniversalOutput;
  crossMarketOutput?: CrossMarketIntelligence;
  sobOutput?: SOBResult;
}): Promise<EvidencePacket[]> {
  const packets: EvidencePacket[] = [];

  try {
    if (params.pressureOutput) {
      packets.push(pressureToEvidencePacket(params.pressureOutput));
    }
  } catch (e) {
    console.error("[SeismographAdapters] pressure adapter failed:", e);
  }

  try {
    if (params.fmosOutput) {
      packets.push(...fmosToEvidencePackets(params.fmosOutput));
    }
  } catch (e) {
    console.error("[SeismographAdapters] fmos adapter failed:", e);
  }

  try {
    if (params.crossMarketOutput) {
      packets.push(crossMarketToEvidencePacket(params.crossMarketOutput));
    }
  } catch (e) {
    console.error("[SeismographAdapters] cross-market adapter failed:", e);
  }

  try {
    if (params.sobOutput) {
      packets.push(sobToEvidencePacket(params.sobOutput));
    }
  } catch (e) {
    console.error("[SeismographAdapters] sob adapter failed:", e);
  }

  return packets;
}
