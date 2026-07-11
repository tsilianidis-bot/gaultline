/**
 * Scheduled Seismograph Handler — v2 (Market Operating System)
 *
 * Runs daily to:
 * 1. Pull the latest FAULTLINE Pressure reading
 * 2. Run FMOS pipeline for regime + probability + analogs
 * 3. Run Cross-Market and SOB engines
 * 4. Collect all evidence via seismographAdapters
 * 5. Assemble the canonical SeismographOutput via seismographCore
 * 6. Record the daily observation and run pattern analysis
 * 7. Persist the assembled SeismographOutput to Market Memory
 *
 * Registered at: POST /api/scheduled/seismograph-daily
 * Cron: "0 0 18 * * *" (18:00 UTC / 2pm ET daily, after market close)
 */
import type { Request, Response } from "express";
import { calculateFaultlinePressure, type PressureAlert } from "./pressure/engine";
import { runFMOSPipeline } from "./fmos/pipeline";
import { computeCrossMarketIntelligence } from "./crossMarketEngine";
import { computeSOB } from "./sobEngine";
import {
  recordSeismographReading,
  runPatternAnalysis,
  getSeismographState,
  memorySetJson,
  type SeismographState,
} from "./seismographEngine";
import { collectAllEvidence } from "./seismographAdapters";
import {
  assembleSeismographOutput,
  type SeismographOutput,
  type SeismographAnalog,
  type SeismographPattern,
  type SeismographTransitionProbabilities,
  type SeismographMarketMemory,
} from "./seismographCore";
import type { FaultlinePressureOutput } from "./pressure/engine";
import type { FMOSUniversalOutput } from "./fmos/types";

/** Cache key for the latest assembled SeismographOutput in Market Memory */
export const SEISMOGRAPH_OUTPUT_KEY = "seismograph:latest_output";

/**
 * Retrieve the latest assembled SeismographOutput from Market Memory.
 * Returns null if no output has been assembled yet.
 */
export async function getLatestSeismographOutput(): Promise<SeismographOutput | null> {
  const { memoryGetJson } = await import("./seismographEngine");
  return memoryGetJson<SeismographOutput | null>(SEISMOGRAPH_OUTPUT_KEY, null);
}

/**
 * Core pipeline — runs the full Seismograph evidence collection and assembly.
 * Can be called from the scheduled handler OR from an on-demand tRPC mutation.
 */
export async function runSeismographPipeline(): Promise<SeismographOutput> {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[Seismograph] Pipeline starting for ${today}`);

  // Step 1: Collect evidence from all contributors in parallel
  const [pressureResult, fmosResult, crossMarketResult] =
    await Promise.allSettled([
      calculateFaultlinePressure(),
      runFMOSPipeline({ skipAIInterpretation: false }),
      computeCrossMarketIntelligence(),
    ]);
  const pressureOutput =
    pressureResult.status === "fulfilled" ? pressureResult.value : null;
  const fmosOutput =
    fmosResult.status === "fulfilled" ? fmosResult.value : null;
  const crossMarketOutput =
    crossMarketResult.status === "fulfilled" ? crossMarketResult.value : null;
  if (!pressureOutput) {
    throw new Error("Pressure engine failed — cannot proceed without core data");
  }
  const sobResult = await Promise.allSettled([
    computeSOB({
      regime: pressureOutput.regime,
      pressureIndex: pressureOutput.overallPressure,
    }),
  ]);
  const sobOutput =
    sobResult[0].status === "fulfilled" ? sobResult[0].value : null;

  // Step 2: Record the daily pressure reading
  const subScores: Record<string, number> = {};
  for (const v of pressureOutput.vectors ?? []) {
    if (v.id && typeof v.score === "number") subScores[v.id] = v.score;
  }
  const pressureDrivers: string[] = (pressureOutput.alerts ?? [])
    .filter((a: PressureAlert) => a.severity === "high" || a.severity === "critical")
    .map((a: PressureAlert) => a.title)
    .filter(Boolean)
    .slice(0, 5);
  await recordSeismographReading({
    date: today,
    pressureScore: pressureOutput.overallPressure,
    stressLevel: pressureOutput.level,
    regime: pressureOutput.regime,
    subScores,
    pressureDrivers,
    activeAlerts: (pressureOutput.alerts ?? [])
      .map((a: PressureAlert) => `${a.title}: ${a.detail}`)
      .filter(Boolean),
  });
  console.log(`[Seismograph] Reading recorded: score=${pressureOutput.overallPressure}, regime=${pressureOutput.regime}`);

  // Step 3: Run pattern analysis
  await runPatternAnalysis();
  console.log("[Seismograph] Pattern analysis complete");

  // Step 4: Collect all evidence packets
  const packets = await collectAllEvidence({
    pressureOutput,
    fmosOutput: fmosOutput ?? undefined,
    crossMarketOutput: crossMarketOutput ?? undefined,
    sobOutput: sobOutput ?? undefined,
  });
  console.log(`[Seismograph] Collected ${packets.length} evidence packets`);

  // Step 5: Get the current Seismograph state
  const state = await getSeismographState();

  // Step 6: Build the state shape for assembleSeismographOutput
  const stateForAssembly = buildStateForAssembly(pressureOutput, fmosOutput, state);

  // Step 7: Assemble the canonical SeismographOutput
  const seismographOutput = assembleSeismographOutput(stateForAssembly, packets);
  console.log(
    `[Seismograph] Output assembled: pressure=${seismographOutput.pressureScore}, regime=${seismographOutput.regime}, ` +
    `evidence=${seismographOutput.activeContributors.length} contributors, consensus=${seismographOutput.evidenceConsensus}`
  );

  // Step 8: Persist to Market Memory
  await memorySetJson(SEISMOGRAPH_OUTPUT_KEY, seismographOutput);
  console.log("[Seismograph] Output persisted to Market Memory");

  return seismographOutput;
}

export async function handleScheduledSeismograph(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const seismographOutput = await runSeismographPipeline();
    res.json({
      ok: true,
      date: new Date().toISOString().split("T")[0],
      pressureScore: seismographOutput.pressureScore,
      regime: seismographOutput.regime,
      stressLevel: seismographOutput.stressLevel,
      direction: seismographOutput.direction,
      evidenceContributors: seismographOutput.activeContributors,
      evidenceConsensus: seismographOutput.evidenceConsensus,
      activePatterns: seismographOutput.activePatterns.length,
      dataFreshness: seismographOutput.dataFreshness,
    });
  } catch (err) {
    console.error("[Seismograph] Daily job failed:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}

// ── Helper: Build state shape for assembleSeismographOutput ───

function buildStateForAssembly(
  pressure: FaultlinePressureOutput,
  fmos: FMOSUniversalOutput | null,
  state: SeismographState | null
): Parameters<typeof assembleSeismographOutput>[0] {
  // Analog matches — prefer FMOS analogs, fall back to pressure analogs
  const analogMatches: SeismographAnalog[] = [];
  if (fmos?.analogs && fmos.analogs.length > 0) {
    for (const a of fmos.analogs.slice(0, 5)) {
      analogMatches.push({
        year: a.year,
        label: a.label,
        similarity: a.similarity,
        description: a.description ?? "",
        period: a.period,
        outcome: a.outcome,
      });
    }
  } else if (pressure.analogs && pressure.analogs.length > 0) {
    for (const a of pressure.analogs.slice(0, 5)) {
      analogMatches.push({
        year: a.year,
        label: a.label,
        similarity: a.similarity,
        description: a.description ?? "",
      });
    }
  }

  // Active patterns from SeismographState
  const activePatterns: SeismographPattern[] = [];
  if (state?.activePatterns) {
    for (const p of state.activePatterns) {
      activePatterns.push({
        patternId: p.patternType,
        name: p.patternName,
        description: p.description,
        confidence: p.confidence,
        daysActive: 0,
        historicalOutcome: p.outcomeDistribution
          ? `${p.outcomeDistribution.bullishContinuation}% bullish / ${p.outcomeDistribution.correction}% correction`
          : undefined,
      });
    }
  }

  // Transition probabilities
  const tp = state?.transitionProbabilities;
  const transitionProbabilities: SeismographTransitionProbabilities = {
    remainInRegime: tp?.remainInRegime ?? 70,
    transitionToElevated: tp?.transitionToElevated ?? 15,
    transitionToLow: tp?.transitionToLow ?? 10,
    transitionToCrisis: tp?.transitionToCrisis ?? 5,
    primaryDriver:
      tp?.currentEvidence?.[0] ?? fmos?.regime?.description ?? "Macro conditions",
  };

  // Market memory
  const mm = state?.marketMemorySummary;
  const todayState = state?.today;
  const marketMemory: SeismographMarketMemory = {
    streakDays: todayState?.streakDays ?? 0,
    streakDirection:
      todayState?.direction === "rising"
        ? "rising"
        : todayState?.direction === "falling"
        ? "falling"
        : "stable",
    peakPressureThisCycle: pressure.overallPressure,
    troughPressureThisCycle: pressure.overallPressure,
    daysSinceLastTransition: 0,
    lastRegimeTransition: mm?.regimeHistory?.[0] ?? undefined,
    keyMemoryPoints: [
      ...(mm?.keyThresholdsCrossed ?? []),
      ...(state?.evolution?.whatChanged ?? []),
    ].slice(0, 6),
  };

  // Pressure score — use FMOS-blended if available, else raw pressure
  const pressureScore = fmos?.pressure?.overallPressure ?? pressure.overallPressure;

  // Regime — prefer FMOS regime classification
  const regime = fmos?.regime?.currentRegime ?? pressure.regime;

  // Direction
  const direction: "Improving" | "Stable" | "Deteriorating" | "Accelerating" =
    state?.evolution?.accelerating
      ? "Accelerating"
      : todayState?.direction === "rising"
      ? "Deteriorating"
      : todayState?.direction === "falling"
      ? "Improving"
      : "Stable";

  // Historical percentile
  const historicalPercentile = todayState?.historicalPercentile ?? 50;

  return {
    pressureScore,
    regime,
    stressLevel: pressure.level,
    direction,
    historicalPercentile,
    analogMatches,
    activePatterns,
    transitionProbabilities,
    marketMemory,
  };
}
