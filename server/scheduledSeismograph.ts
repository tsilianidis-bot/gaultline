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
 * Host schedule: 4:15 PM America/New_York on valid NYSE sessions.
 * Railway cannot express that timezone. The candidate crontab is
 * `15 20,21 * * 1-5` UTC: exactly one fire is 16:15 ET. The handler admits
 * only 16:15–16:45 America/New_York. Every other callback, including the
 * current production `0 18 * * *` UTC cron and the DST companion hour,
 * returns non-2xx so `curl -f` fails and the skip is alerted.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { seismographReadings } from "../drizzle/schema";
import { getDb } from "./db";
import { isDstCompanionSeismographCallback, nyseSeismographRunWindow } from "../shared/nyseSession";
import { calculateFaultlinePressure, type PressureAlert } from "./pressure/engine";
import { persistPressureRunAndShadows } from "./pressure/scheduledPersistence";
import { refreshPriorComponentsAfterVerifiedRun } from "./pressure/priorComponents";
import { runFMOSPipeline } from "./fmos/pipeline";
import { computeCrossMarketIntelligence } from "./crossMarketEngine";
import { computeSOB } from "./sobEngine";
import {
  recordSeismographReading,
  runPatternAnalysis,
  getSeismographState,
  memorySetJson,
  patternHistoricalOutcome,
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
import { capturesForwardEvidence, championProvenanceKey, etDateOf, resolveRunContext, type RunContext } from "./forwardRunProvenance";
import { captureTrackRecordFromScheduledRun } from "./trackRecordCapture";
import { buildAtomicIntelligenceStateManifest, persistAtomicIntelligenceStateManifest } from "./intelligenceGovernance";
import {
  admitScheduledSessionOutcome,
  sealFinishedSessionClaim,
  claimScheduledSeismographSession,
  failScheduledSession,
  finalizeStaleScheduledSessionOutcomes,
  heartbeatScheduledSession,
  markScheduledSessionOutcomeScored,
  normalizeSessionClaim,
  reconcileScheduledSessionScore,
  type ScheduledSessionClaimResult,
  type ScheduledSessionClaimStatus,
} from "./scheduledSessionClaim";

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
import { captureMessage } from "./errorTracking";

/** Cache key for the latest assembled SeismographOutput in Market Memory */
export const SEISMOGRAPH_OUTPUT_KEY = "seismograph:latest_output";

type ScheduledExecutionDisposition = "executed" | "joined_inflight" | "already_completed";
type ScheduledExecutionResult = { output: SeismographOutput; disposition: ScheduledExecutionDisposition };

// The host must schedule one authenticated callback per session. This guard makes
// that invariant safe within a running service: a retry cannot mutate daily state
// twice while a run is active, and a completed session cannot be re-run until a
// process restart. It deliberately does not infer a durable lock from a manual
// run or create a new database record/schema.
const scheduledExecutions = new Map<string, Promise<SeismographOutput>>();
const completedScheduledExecutions = new Map<string, SeismographOutput>();
const MAX_COMPLETED_SCHEDULED_SESSIONS = 3;

function rememberCompletedScheduledExecution(etDate: string, output: SeismographOutput) {
  completedScheduledExecutions.set(etDate, output);
  while (completedScheduledExecutions.size > MAX_COMPLETED_SCHEDULED_SESSIONS) {
    const oldest = completedScheduledExecutions.keys().next().value;
    if (oldest === undefined) break;
    completedScheduledExecutions.delete(oldest);
  }
}

export async function runScheduledSeismographOnce(
  etDate: string,
  runContext: RunContext,
  run: (options: { runContext: RunContext }) => Promise<SeismographOutput> = runSeismographPipeline,
): Promise<ScheduledExecutionResult> {
  const completed = completedScheduledExecutions.get(etDate);
  if (completed) return { output: completed, disposition: "already_completed" };
  const active = scheduledExecutions.get(etDate);
  if (active) return { output: await active, disposition: "joined_inflight" };
  const execution = run({ runContext });
  scheduledExecutions.set(etDate, execution);
  try {
    const output = await execution;
    rememberCompletedScheduledExecution(etDate, output);
    return { output, disposition: "executed" };
  } finally {
    scheduledExecutions.delete(etDate);
  }
}

/** Test-only isolation for the in-process duplicate-callback guard. */
export function resetScheduledSeismographExecutionGuard() {
  scheduledExecutions.clear();
  completedScheduledExecutions.clear();
}

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
  // The daily record belongs to the market's Eastern session date, never the host's
  // UTC calendar day. This is especially important for a post-close scheduled run.
  const today = etDateOf(runContext.runStartedAt);
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
  // FAIL CLOSED (Phase 1, 2026-10-13): a new canonical reading is recorded only
  // from a fully verified input set. A stale preserved reading must never be
  // re-recorded as today's observation; the last canonical state stays in force.
  if (pressureOutput.verification?.status !== "verified") {
    throw new Error(`Pressure inputs not verified (${pressureOutput.verification?.problems?.join("; ") ?? "unknown"}) — preserving last canonical state`);
  }
  // The outcome row is the persisted session result recovery checks. It is
  // inserted only for the scheduled run, and only after verification. A duplicate
  // stops this run before the daily score upsert and before forward capture.
  if (capturesForwardEvidence(runContext)) {
    const admitted = await admitScheduledSessionOutcome(today, {
      pressureScore: pressureOutput.overallPressure,
      regime: pressureOutput.regime,
    });
    if (admitted !== "admitted") {
      throw new Error(`Scheduled session outcome ${admitted}; refusing a second score capture for ${today}`);
    }
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
  if (capturesForwardEvidence(runContext)) {
    await markScheduledSessionOutcomeScored(today);
  }
  console.log(`[Seismograph] Reading recorded: score=${pressureOutput.overallPressure}, regime=${pressureOutput.regime}`);
  // Persistence moved here from the public pressure.getCurrentPressure query
  // (Phase 2 #7): audit run + shadow readings are written only by this
  // scheduled/admin-authorized workflow, never by a public read.
  if (runContext.trigger !== "AD_HOC") {
    await persistPressureRunAndShadows(pressureOutput, runContext.trigger);
    // Direction priors (QA B-3): computed here after a verified run, cached for the request path.
    await refreshPriorComponentsAfterVerifiedRun(runContext.trigger).catch(() => null);
  }

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

  // Track record is read-only against Core evidence and no-ops unless the flag
  // and TRACK_RECORD_CRON_WRITES are both explicitly on. Failures never change the score.
  try {
    const capture = await captureTrackRecordFromScheduledRun({
      run: runContext,
      pressureIndex: seismographOutput.pressureScore,
      regime: seismographOutput.regime,
      generatedAt: runContext.runStartedAt,
    });
    if (capture.reason !== "not_scheduled" && capture.reason !== "cron_writes_disabled" && capture.reason !== "flag_disabled") {
      console.log(`[Seismograph] Track record capture: ${capture.reason}`);
    }
  } catch (error) {
    console.warn("[Seismograph] Track record capture skipped:", error instanceof Error ? error.message : "unavailable");
  }

  return seismographOutput;
}

async function seismographReadingExists(date: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("seismograph reading lookup unavailable");
  const rows = await db
    .select({ id: seismographReadings.id })
    .from(seismographReadings)
    .where(eq(seismographReadings.readingDate, date))
    .limit(1);
  return rows.length > 0;
}

function alertSkippedSchedule(skipped: string, detail: Record<string, unknown>): void {
  console.error(`[Seismograph][SCHEDULE-ALERT] ${skipped}`);
  void captureMessage(`Scheduled seismograph callback rejected: ${skipped}`, "error", {
    procedure: "scheduled.seismograph-daily",
    skipped,
    alert: true,
    ...detail,
  }).catch(() => undefined);
}

function isExpectedScheduleSkip(skipped: string, session: unknown): boolean {
  if (skipped === "dst_companion_outside_window") return true;
  return skipped === "outside_nyse_post_close_window" && session === "CLOSED";
}

function rejectScheduledCallback(res: Response, statusCode: number, body: Record<string, unknown>): void {
  const skipped = String(body.skipped ?? "skipped");
  if (isExpectedScheduleSkip(skipped, body.session)) {
    console.log(`[Seismograph] Expected schedule skip: ${skipped}`);
    res.status(200).json({ ok: true, alert: false, ...body });
    return;
  }
  alertSkippedSchedule(skipped, body);
  res.status(statusCode).json({ ok: false, alert: true, ...body });
}

type ScheduledSeismographHooks = {
  sessionClaim?: (etDate: string) => Promise<ScheduledSessionClaimStatus | ScheduledSessionClaimResult>;
  sessionStore?: Parameters<typeof claimScheduledSeismographSession>[1];
  runPipeline?: () => Promise<ScheduledExecutionResult>;
};

async function executeScheduledSeismograph(res: Response, hooks: ScheduledSeismographHooks = {}): Promise<void> {
  const now = new Date();
  const runWindow = nyseSeismographRunWindow(now);
  const sessionStore = hooks.sessionStore;
  // This handler is mounted only behind requireCron. The out-of-window fire is
  // classified CRON_DEPLOY so it cannot run the pipeline or capture a forward
  // record. It is still the real dual-cron callback, so it may finalize stale
  // pending rows. Claim and reconcile below still require an in-window
  // SCHEDULED_CRON context.
  let finalized: { status: "finalized" | "unavailable"; marked: number } = { status: "unavailable", marked: 0 };
  try {
    finalized = await finalizeStaleScheduledSessionOutcomes(sessionStore ?? getDb, {
      nowMs: now.getTime(),
      trigger: "SCHEDULED_CRON",
    });
  } catch (error) {
    console.warn("[Seismograph] Stale session finalize failed:", error);
  }
  // The host scheduler and a cron-service redeploy hit the same endpoint. A callback
  // outside the documented NYSE post-close window must not record a pre-close canonical
  // observation or forward ledger provenance.
  if (!runWindow.isScheduledWindow) {
    const companion = isDstCompanionSeismographCallback(now);
    const skipped = companion ? "dst_companion_outside_window" : "outside_nyse_post_close_window";
    console.error(`[Seismograph] Scheduled callback rejected: ${runWindow.reason}`);
    rejectScheduledCallback(res, 409, {
      skipped,
      session: runWindow.session,
      etDate: runWindow.etDate,
      expectedRunAtEt: runWindow.scheduledRunAtEt,
      reason: runWindow.reason,
      finalized,
    });
    return;
  }
  const scheduledEtDate = runWindow.etDate ?? etDateOf(now);
  const runContext = resolveRunContext("cron-endpoint", now);
  // Database claim is in addition to the in-process guard. Fail closed when the
  // claim cannot be recorded so a second container cannot capture forward evidence.
  const sessionClaim = normalizeSessionClaim(await (hooks.sessionClaim
    ? hooks.sessionClaim(scheduledEtDate)
    : claimScheduledSeismographSession(scheduledEtDate, sessionStore, { nowMs: now.getTime(), trigger: runContext.trigger })));
  if (sessionClaim.status === "exhausted") {
    rejectScheduledCallback(res, 409, {
      skipped: "session_recovery_exhausted",
      date: scheduledEtDate,
      etDate: scheduledEtDate,
      generation: sessionClaim.generation ?? null,
    });
    return;
  }
  if (sessionClaim.status === "reconcile") {
    try {
      const pressureOutput = await calculateFaultlinePressure();
      const verified = pressureOutput.verification?.status === "verified";
      const resolution = await reconcileScheduledSessionScore(scheduledEtDate, sessionStore, {
        nowMs: now.getTime(),
        trigger: runContext.trigger,
        evidenceVerified: verified,
        readingExists: () => seismographReadingExists(scheduledEtDate),
        recordScore: async () => {
          const subScores: Record<string, number> = {};
          for (const vector of pressureOutput.vectors ?? []) {
            if (vector.id && typeof vector.score === "number") subScores[vector.id] = vector.score;
          }
          await recordSeismographReading({
            date: scheduledEtDate,
            pressureScore: pressureOutput.overallPressure,
            stressLevel: pressureOutput.level,
            regime: pressureOutput.regime,
            subScores,
            pressureDrivers: (pressureOutput.alerts ?? [])
              .filter((alert: PressureAlert) => alert.severity === "high" || alert.severity === "critical")
              .map((alert: PressureAlert) => alert.title)
              .filter(Boolean)
              .slice(0, 5),
            activeAlerts: (pressureOutput.alerts ?? [])
              .map((alert: PressureAlert) => `${alert.title}: ${alert.detail}`)
              .filter(Boolean),
          });
        },
      });
      if (resolution === "unrecoverable" || resolution === "unavailable") {
        rejectScheduledCallback(res, resolution === "unavailable" ? 503 : 409, {
          skipped: resolution === "unrecoverable" ? "session_unrecoverable" : "session_reconcile_unavailable",
          execution: resolution,
          date: scheduledEtDate,
          etDate: scheduledEtDate,
        });
        return;
      }
      res.json({
        ok: true,
        execution: resolution,
        date: scheduledEtDate,
        etDate: scheduledEtDate,
      });
    } catch (err) {
      console.error("[Seismograph] Score reconcile failed:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
    return;
  }
  if (sessionClaim.status !== "claimed") {
    if (sessionClaim.status === "unavailable") {
      rejectScheduledCallback(res, 503, {
        skipped: "session_claim_unavailable",
        etDate: scheduledEtDate,
        reason: "Database session claim unavailable; the scheduled run and its forward capture were not started.",
      });
      return;
    }
    if (sessionClaim.status === "incomplete") {
      rejectScheduledCallback(res, 409, {
        skipped: "session_incomplete",
        execution: "in_progress",
        date: scheduledEtDate,
        etDate: scheduledEtDate,
        generation: sessionClaim.generation ?? null,
        reason: "The session claim is leased or failed and is not a completed run.",
      });
      return;
    }
    res.json({
      ok: true,
      skipped: "session_already_claimed",
      date: scheduledEtDate,
      etDate: scheduledEtDate,
      execution: "already_completed",
    });
    return;
  }
  const generation = sessionClaim.generation;
  const heartbeat = generation == null ? undefined : setInterval(() => {
    void heartbeatScheduledSession(scheduledEtDate, generation, sessionStore).catch(() => undefined);
  }, 30_000);
  heartbeat?.unref?.();
  try {
    const execution = hooks.runPipeline
      ? await hooks.runPipeline()
      : await runScheduledSeismographOnce(scheduledEtDate, runContext);
    if (generation != null) {
      const sealed = await sealFinishedSessionClaim(scheduledEtDate, generation, sessionStore ?? getDb);
      if (!sealed) {
        console.error("[Seismograph][SCHEDULE-ALERT] session claim was not marked completed");
        void captureMessage("Scheduled seismograph claim was not marked completed", "error", {
          procedure: "scheduled.seismograph-daily",
          etDate: scheduledEtDate,
          alert: true,
        }).catch(() => undefined);
        res.status(500).json({
          ok: false,
          alert: true,
          error: "Scheduled run finished but the session claim was not marked completed.",
          date: scheduledEtDate,
          etDate: scheduledEtDate,
        });
        return;
      }
    }
    const seismographOutput = execution.output;
    res.json({
      ok: true,
      date: scheduledEtDate,
      execution: execution.disposition,
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
    if (generation != null) await failScheduledSession(scheduledEtDate, generation, sessionStore).catch(() => undefined);
    const recovered = normalizeSessionClaim(await claimScheduledSeismographSession(scheduledEtDate, sessionStore ?? getDb, {
      nowMs: Date.now(),
      trigger: runContext.trigger,
    }).catch(() => ({ status: "unavailable" as const })));
    if (recovered.status === "claimed" && recovered.generation != null) {
      try {
        const retried = hooks.runPipeline
          ? await hooks.runPipeline()
          : await runScheduledSeismographOnce(scheduledEtDate, runContext);
        const sealed = await sealFinishedSessionClaim(scheduledEtDate, recovered.generation, sessionStore ?? getDb);
        if (!sealed) {
          res.status(500).json({
            ok: false,
            alert: true,
            error: "Scheduled run finished but the session claim was not marked completed.",
            date: scheduledEtDate,
            etDate: scheduledEtDate,
          });
          return;
        }
        res.json({
          ok: true,
          date: scheduledEtDate,
          execution: retried.disposition,
          recovered: true,
          pressureScore: retried.output.pressureScore,
          regime: retried.output.regime,
          stressLevel: retried.output.stressLevel,
          direction: retried.output.direction,
          evidenceContributors: retried.output.activeContributors,
          evidenceConsensus: retried.output.evidenceConsensus,
          activePatterns: retried.output.activePatterns.length,
          dataFreshness: retried.output.dataFreshness,
        });
        return;
      } catch (retryError) {
        await failScheduledSession(scheduledEtDate, recovered.generation, sessionStore).catch(() => undefined);
        await claimScheduledSeismographSession(scheduledEtDate, sessionStore ?? getDb, {
          nowMs: Date.now(),
          trigger: runContext.trigger,
        }).catch(() => undefined);
        console.error("[Seismograph][SCHEDULE-ALERT] Daily job failed after the in-request recovery:", retryError);
        void captureMessage("Scheduled seismograph run failed", "error", {
          procedure: "scheduled.seismograph-daily",
          etDate: scheduledEtDate,
          alert: true,
        }).catch(() => undefined);
        res.status(500).json({ ok: false, alert: true, error: String(retryError) });
        return;
      }
    }
    console.error("[Seismograph][SCHEDULE-ALERT] Daily job failed:", err);
    void captureMessage("Scheduled seismograph run failed", "error", {
      procedure: "scheduled.seismograph-daily",
      etDate: scheduledEtDate,
      alert: true,
    }).catch(() => undefined);
    res.status(500).json({ ok: false, alert: true, error: String(err) });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

export function handleScheduledSeismograph(_req: Request, res: Response): Promise<void> {
  return executeScheduledSeismograph(res);
}

/** Tests pass hooks here. The production route never does. */
export function runScheduledSeismographForTests(res: Response, hooks: ScheduledSeismographHooks = {}): Promise<void> {
  return executeScheduledSeismograph(res, hooks);
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
        historicalOutcome: patternHistoricalOutcome(p.outcomeDistribution),
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

  // Historical percentile. A missing reading is withheld; it is not the 50th percentile.
  const historicalPercentile = typeof todayState?.historicalPercentile === "number" && Number.isFinite(todayState.historicalPercentile)
    ? todayState.historicalPercentile
    : null;

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
