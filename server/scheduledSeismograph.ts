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
import { randomUUID } from "node:crypto";
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
import { invalidateCanonicalMarketStateCache } from "./marketStateCache";
import { collectBroadInstitutionalEventOutcomes, recordDailyMarketEvidence } from "./institutionalMemory";
import { collectForwardChampionOutcomesV2, recordForwardChampionProvenance } from "./algorithmProvenance";
import { capturesForwardEvidence, championProvenanceKey, resolveRunContext, type RunContext } from "./forwardRunProvenance";
import { buildAtomicIntelligenceStateManifest, persistAtomicIntelligenceStateManifest } from "./intelligenceGovernance";

function mapPressureLevelToSeismographStress(level: string | null | undefined): SeismographOutput["stressLevel"] {
  if (level === "Critical" || level === "Crisis") return "Crisis";
  if (level === "High") return "High";
  if (level === "Elevated") return "Elevated";
  if (level === "Moderate") return "Moderate";
  return "Low";
}
import { getAuthoritativeCrossEngineSynthesis, persistCrossEngineSynthesis } from "./crossEngineSynthesis";
import { evaluateAndPersistCandidateDetections } from "./candidateDetection";
import { evaluateAndPersistImportanceQualification } from "./importanceQualification";
import { evaluateAndPersistLifecycle } from "./earlyWarningLifecycle";
import { evaluateAndPersistPhase9ForCurrentStream } from "./confirmationInvalidation";
import { resolveBuildIdentity } from "./buildIdentity";

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

export type ForwardOutcomeLink = {
  status: "CAPTURED" | "DAY_ALREADY_CAPTURED" | "PROVENANCE_UNAVAILABLE" | "PROVENANCE_CAPTURE_FAILED" | "NOT_CAPTURED_NON_SCHEDULED_RUN";
  championProvenanceKey: string | null;
  championProvenanceId: number | null;
  championProvenanceCreatedByThisRun: boolean;
  outcomeKeyVersion: "v2";
};

/**
 * A4/A5: the scheduled run (only) records the day's Champion provenance BEFORE its manifest,
 * so the manifest names the exact provenance row it created. Non-blocking.
 */
export async function captureChampionProvenanceForRun(
  runContext: RunContext,
  pressure: FaultlinePressureOutput,
  generatedAt: string,
  record: typeof recordForwardChampionProvenance = recordForwardChampionProvenance,
): Promise<ForwardOutcomeLink> {
  if (!capturesForwardEvidence(runContext)) {
    return { status: "NOT_CAPTURED_NON_SCHEDULED_RUN", championProvenanceKey: null, championProvenanceId: null, championProvenanceCreatedByThisRun: false, outcomeKeyVersion: "v2" };
  }
  const key = championProvenanceKey(new Date(generatedAt));
  try {
    const provenance = await record(pressure, new Date(generatedAt));
    const status = provenance.id === null ? "PROVENANCE_UNAVAILABLE" : provenance.created ? "CAPTURED" : "DAY_ALREADY_CAPTURED";
    return { status, championProvenanceKey: key, championProvenanceId: provenance.id, championProvenanceCreatedByThisRun: provenance.created, outcomeKeyVersion: "v2" };
  } catch (error) {
    console.warn("[Seismograph] Champion provenance capture deferred:", error);
    return { status: "PROVENANCE_CAPTURE_FAILED", championProvenanceKey: key, championProvenanceId: null, championProvenanceCreatedByThisRun: false, outcomeKeyVersion: "v2" };
  }
}

/**
 * A5: completed-bar outcomes (broad institutional-event outcomes, then Champion v2) are
 * appended on the scheduled cycle only. Non-blocking.
 */
export async function collectForwardOutcomesForRun(
  runContext: RunContext,
  collect: typeof collectForwardChampionOutcomesV2 = collectForwardChampionOutcomesV2,
  collectBroad: typeof collectBroadInstitutionalEventOutcomes = collectBroadInstitutionalEventOutcomes,
): Promise<{ collected: boolean }> {
  if (!capturesForwardEvidence(runContext)) {
    console.log(`[Seismograph] ${runContext.trigger} run: Champion provenance and outcomes not captured (scheduled run only).`);
    return { collected: false };
  }
  try {
    const broad = await collectBroad();
    console.log(`[Seismograph] Broad event outcomes: ${broad.appended} appended, ${broad.deferred} deferred`);
  } catch (error) {
    console.warn("[Seismograph] Broad event outcome collection deferred:", error);
  }
  try {
    const outcomes = await collect();
    console.log(`[Seismograph] Forward outcomes v2: ${outcomes.appended} appended, ${outcomes.deferred} deferred ${JSON.stringify(outcomes.reasons)}`);
  } catch (error) {
    console.warn("[Seismograph] Champion outcome collection deferred:", error);
  }
  return { collected: true };
}

/**
 * Core pipeline — runs the full Seismograph evidence collection and assembly.
 * Can be called from the scheduled handler OR from an on-demand tRPC mutation.
 */
export async function runSeismographPipeline(options: { runContext?: RunContext } = {}): Promise<SeismographOutput> {
  // Unattributed callers (scripts, tests) are AD_HOC: they never capture forward evidence.
  const runContext = options.runContext ?? resolveRunContext("unspecified");
  const today = new Date().toISOString().split("T")[0];
  const originatingRunId = `seismograph:${randomUUID()}`;
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
  await recordDailyMarketEvidence({
    observedAt: new Date(),
    pressureIndex: seismographOutput.pressureScore,
    regime: seismographOutput.regime,
    stressLevel: seismographOutput.stressLevel,
    direction: seismographOutput.direction,
    dataFreshness: seismographOutput.dataFreshness ?? "unknown",
    probabilities: {
      bull: seismographOutput.probabilities.bull,
      neutral: seismographOutput.probabilities.neutral,
      bear: seismographOutput.probabilities.bear,
      confidence: seismographOutput.probabilities.confidence,
    },
    sourceState: {
      activeContributors: seismographOutput.activeContributors,
      evidenceConsensus: seismographOutput.evidenceConsensus,
      analogCount: seismographOutput.analogMatches.length,
      activePatternCount: seismographOutput.activePatterns.length,
      vectorScores: Object.fromEntries((pressureOutput.vectors ?? []).filter(vector => vector.id && typeof vector.score === "number").map(vector => [vector.id, vector.score])),
    },
  });
  // Phase 1B governance capture is append-only and deliberately non-blocking.
  // It records this exact run's source quality, governed claim references, and
  // score/regime coherence without changing the canonical output.
  try {
    const generatedAt = new Date().toISOString();
    // A5: Champion provenance is captured only by the scheduled daily run, BEFORE the
    // manifest, so the manifest names the exact provenance row this run created (A4).
    const outcomeLink = await captureChampionProvenanceForRun(runContext, pressureOutput, generatedAt);
    const governanceState = buildAtomicIntelligenceStateManifest({
      pressure: pressureOutput,
      seismograph: seismographOutput,
      originatingRunId,
      generatedAt,
      runContext,
      outcomeLink,
      persistedHooks: await import("./systemicRegime/hooks").then(mod => mod.getPersistedRegimeHooks(seismographOutput)).catch(() => undefined),
      // Code version of the build that produced this forward record (provenance only).
      codeVersion: (() => { try { return resolveBuildIdentity().commit; } catch { return null; } })(),
    });
    const persisted = await persistAtomicIntelligenceStateManifest(governanceState);
    console.log(`[Seismograph] Governance manifest ${persisted.created ? "recorded" : "already present"}: ${persisted.stateId} (${governanceState.manifest.coherenceStatus})`);
    const synthesis = await getAuthoritativeCrossEngineSynthesis();
    if (synthesis) {
      const outcome = await persistCrossEngineSynthesis(synthesis);
      console.log(`[Seismograph] Cross-engine synthesis ${synthesis.synthesisId} persisted; ${outcome.archivedMaterialEventCount} material archive events.`);
      const candidates = await evaluateAndPersistCandidateDetections(synthesis);
      console.log(`[Seismograph] Candidate detection evaluated ${candidates.evaluation.candidates.length} governed candidate observations; ${candidates.appendedObservationCount} append-only observations.`);
      const qualification = await evaluateAndPersistImportanceQualification(candidates.evaluation.candidates);
      console.log(`[Seismograph] Importance qualification evaluated ${qualification.evaluation.scoredCandidates.length} candidates; ${qualification.evaluation.qualifiedCandidates.length} internal qualified candidates, ${qualification.appendedEvaluationCount} append-only evaluations.`);
      const lifecycle = await evaluateAndPersistLifecycle(qualification.evaluation);
      console.log(`[Seismograph] Lifecycle evaluated ${qualification.evaluation.scoredCandidates.length} candidates; ${lifecycle.appendedObservationCount} append-only lifecycle observations, ${lifecycle.ignoredCount} governed duplicate/out-of-order/no-lifecycle results.`);
      const phase9 = await evaluateAndPersistPhase9ForCurrentStream(synthesis, candidates.evaluation.candidates, qualification.evaluation, lifecycle.observations);
      console.log(`[Seismograph] Phase 9 evaluated ${phase9.evaluatedCount} governed lifecycle theses; ${phase9.authorityEventCount} typed authority events.`);
    }
  } catch (error) {
    console.warn("[Seismograph] Governance manifest capture deferred:", error);
  }
  // Forward-only research evidence (scheduled run only). Failures are non-blocking because
  // they must never interrupt the canonical production Seismograph score. v1 outcome
  // collection (intraday target bars) is retired; v2 appends completed-bar outcomes.
  await collectForwardOutcomesForRun(runContext);
  invalidateCanonicalMarketStateCache();
  console.log("[Seismograph] Output persisted to Market Memory");

  return seismographOutput;
}

export async function handleScheduledSeismograph(
  _req: Request,
  res: Response
): Promise<void> {
  // The cron schedule and a cron-service redeploy hit this same endpoint; the start time
  // decides SCHEDULED_CRON ([18:00, 18:30) UTC) vs CRON_DEPLOY.
  const runContext = resolveRunContext("cron-endpoint", new Date());
  try {
    const seismographOutput = await runSeismographPipeline({ runContext });
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

export function buildStateForAssembly(
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

  // Champion V1 is the frozen canonical score and regime. FMOS remains a
  // contributor to evidence and descriptive context, but it must not silently
  // substitute a different score or regime into the canonical user state.
  const pressureScore = pressure.overallPressure;
  const regime = pressure.regime;

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
    stressLevel: mapPressureLevelToSeismographStress(pressure.level),
    direction,
    historicalPercentile,
    analogMatches,
    activePatterns,
    transitionProbabilities,
    marketMemory,
  };
}
