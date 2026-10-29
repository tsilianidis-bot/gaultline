import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Request, Response } from "express";
import { fetchFredBulk } from "../fredClient";
import { FRED_SERIES } from "./seriesRegistry";
import { log } from "../logger";
import { getAuthoritativeCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { memoryGetJson } from "../seismographEngine";
import type { SeismographOutput } from "../seismographCore";
import { getAuthoritativeCrossEngineSynthesis } from "../crossEngineSynthesis";
import { getCurrentGovernedEarlyWarningPresentation } from "../earlyWarningPresentation";
import { computeSignalConvergence } from "./signalConvergence";
import { assertSystemicRegimeSchemaReady, persistApprovedModelRegistry, persistSignalConvergence, persistSystemicRegimeHistory, persistSystemicRegimeReading, restoreApprovedModelFromDb } from "./writer";
import type { SystemicRegimeHistoryPoint, SystemicRegimeReading } from "../../shared/systemicRegime";
import { easternSessionStamp, nyseSeismographRunWindow, seismographFreshForInfer } from "../../shared/nyseSession";
import { scheduledSessionClaimPresence } from "../scheduledSessionClaim";

const QUANT_DIR = resolve(process.cwd(), "quant/systemic-regime");
const ARTIFACT_DIR = resolve(QUANT_DIR, "artifacts");
const MODEL_DIR = resolve(ARTIFACT_DIR, "approved");
const PANEL_JSON = resolve(ARTIFACT_DIR, "fred_panel.json");
const INFERENCE_JSON = resolve(ARTIFACT_DIR, "latest_inference.json");
const RESEARCH_HISTORY_JSON = resolve(ARTIFACT_DIR, "oos_regime_path.json");
const LIVE_HISTORY_JSON = resolve(ARTIFACT_DIR, "live_regime_path.json");

/**
 * The scheduled infer endpoint accepts Seismograph only after both halves of
 * its scheduled-session provenance agree: the durable session claim completed
 * and the cached output was computed in this Eastern post-close session. This
 * prevents a delayed infer callback from silently converging yesterday's
 * `seismograph:latest_output` with today's regime inference.
 */
export interface CurrentSessionSeismographDependency {
  claimPresence: Awaited<ReturnType<typeof scheduledSessionClaimPresence>>;
  seismograph: Pick<SeismographOutput, "computedAt"> | null;
}

export interface SystemicRegimeInferenceJobOptions {
  /** Supplied only after the scheduled endpoint validates current-session provenance. */
  currentSeismograph: SeismographOutput | null;
  now?: Date;
}

function runPython(args: string[], timeoutMs = 180_000): Promise<{ ok: boolean; stdout: string; stderr: string; skipped?: string }> {
  if (!existsSync(resolve(QUANT_DIR, "train.py"))) {
    return Promise.resolve({ ok: false, stdout: "", stderr: "", skipped: "quant worker missing" });
  }
  return new Promise(resolvePromise => {
    const child = spawn("python3", args, { cwd: QUANT_DIR, env: { ...process.env } });
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", error => {
      clearTimeout(timer);
      resolvePromise({ ok: false, stdout, stderr: String(error) });
    });
    child.on("close", code => {
      clearTimeout(timer);
      resolvePromise({ ok: code === 0, stdout, stderr });
    });
  });
}

export async function exportFredPanelForQuant(): Promise<{ path: string; series: string[] }> {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const bulk = await fetchFredBulk(FRED_SERIES.map(spec => ({ id: spec.id, limit: spec.limit, sortOrder: spec.sortOrder })));
  const payload = { exportedAt: new Date().toISOString(), provider: "FRED", source: "server/fredClient.ts", series: bulk.results };
  writeFileSync(PANEL_JSON, JSON.stringify(payload));
  return { path: PANEL_JSON, series: Object.keys(bulk.results) };
}

export async function runSystemicRegimeInferenceJob(
  options: SystemicRegimeInferenceJobOptions = { currentSeismograph: null },
): Promise<Record<string, unknown>> {
  const now = options.now ?? new Date();
  const seismograph = options.currentSeismograph;
  // Defend the exported job as well as its HTTP caller. A direct internal
  // caller without a handler-validated current-session output gets a
  // retryable no-success result before table setup, FRED export, inference,
  // or any persistence can begin.
  if (!seismograph || !seismographFreshForInfer(seismograph.computedAt, now)) {
    return {
      ok: false,
      alert: true,
      retryable: true,
      skipped: "current_session_seismograph_output_missing_or_stale",
      reason: "Systemic-regime inference requires the completed current Eastern post-close Seismograph output.",
    };
  }
  await assertSystemicRegimeSchemaReady();
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  mkdirSync(MODEL_DIR, { recursive: true });
  if (!existsSync(resolve(MODEL_DIR, "approved.joblib"))) {
    const restored = await restoreApprovedModelFromDb(MODEL_DIR);
    if (!restored) {
      return { ok: false, skipped: "no approved model; weekly train has not produced a frozen bundle" };
    }
  }
  try {
    await exportFredPanelForQuant();
  } catch (error) {
    log.warn("[SystemicRegime] FRED export failed; inference may use last panel", { err: error as Error });
  }
  const panelArg = existsSync(PANEL_JSON) ? ["--from-json", PANEL_JSON] : [];
  const result = await runPython(["inference.py", "--model-dir", MODEL_DIR, ...panelArg, "--out", INFERENCE_JSON, "--history-out", LIVE_HISTORY_JSON]);
  if (result.skipped) return { ok: false, skipped: result.skipped };
  if (!result.ok || !existsSync(INFERENCE_JSON)) {
    return { ok: false, error: result.stderr || "inference failed", stdout: result.stdout };
  }
  const reading = JSON.parse(readFileSync(INFERENCE_JSON, "utf8")) as SystemicRegimeReading;
  reading.contributesToPressureIndex = false;
  const persisted = await persistSystemicRegimeReading(reading, "LIVE_INFERENCE");
  const canonical = await getAuthoritativeCanonicalIntelligenceState();
  const synthesis = await getAuthoritativeCrossEngineSynthesis();
  const earlyWarning = await getCurrentGovernedEarlyWarningPresentation();
  const convergence = computeSignalConvergence({
    canonical,
    seismograph,
    synthesis,
    earlyWarning,
    systemicRegime: reading,
  });
  await persistSignalConvergence(convergence);
  return {
    ok: true,
    persisted,
    regime: reading.currentRegime,
    dataAsOf: reading.dataAsOf,
    convergence: convergence.level,
    seismographFreshness: "current_session",
    skippedConvergence: null,
    alert: false,
  };
}

export async function runSystemicRegimeTrainJob(): Promise<Record<string, unknown>> {
  await assertSystemicRegimeSchemaReady();
  mkdirSync(MODEL_DIR, { recursive: true });
  try {
    await exportFredPanelForQuant();
  } catch (error) {
    return { ok: false, error: `FRED export failed: ${String(error)}` };
  }
  const result = await runPython(
    ["train.py", "--from-json", PANEL_JSON, "--model-dir", MODEL_DIR, "--n-states", "2", "--skip-compare"],
    10 * 60_000,
  );
  if (!result.ok) return { ok: false, error: result.stderr || result.skipped || "train failed", stdout: result.stdout };
  try {
    const registryPath = resolve(MODEL_DIR, "registry.json");
    if (existsSync(registryPath)) {
      await persistApprovedModelRegistry(JSON.parse(readFileSync(registryPath, "utf8")) as Record<string, unknown>, MODEL_DIR);
    }
  } catch (error) {
    log.warn("[SystemicRegime] Registry persist failed", { err: error as Error });
  }
  return { ok: true, stdout: result.stdout };
}

export async function ingestPackagedResearchHistory(): Promise<number> {
  if (!existsSync(RESEARCH_HISTORY_JSON)) return 0;
  await assertSystemicRegimeSchemaReady();
  const points = JSON.parse(readFileSync(RESEARCH_HISTORY_JSON, "utf8")) as SystemicRegimeHistoryPoint[];
  return persistSystemicRegimeHistory(points, "sre-hmm2-v1.0.0", "gaussian-hmm-2state");
}

export function inferScheduleDecision(
  now: Date,
  dependency: CurrentSessionSeismographDependency,
): { status: 200 | 409 | 503; body: Record<string, unknown> } | null {
  const window = nyseSeismographRunWindow(now);
  if (window.session === "CLOSED") {
    return {
      status: 200,
      body: {
        ok: true,
        alert: false,
        skipped: "nyse_closed",
        session: window.session,
        etDate: window.etDate,
        reason: window.reason,
      },
    };
  }
  const stamp = easternSessionStamp(now);
  const afterWindow = stamp != null && stamp.minuteOfDay >= 16 * 60 + 45;
  if (dependency.claimPresence === "unavailable") {
    return {
      status: 503,
      body: {
        ok: false,
        alert: true,
        retryable: true,
        skipped: "current_session_seismograph_claim_unavailable",
        session: window.session,
        etDate: window.etDate,
        reason: "The current Seismograph session claim could not be read, so infer cannot establish same-session provenance.",
      },
    };
  }
  if (dependency.claimPresence !== "completed") {
    if (!afterWindow) {
      return {
        status: 409,
        body: {
          ok: false,
          alert: false,
          retryable: true,
          skipped: "awaiting_current_session_seismograph",
          session: window.session,
          etDate: window.etDate,
          reason: "The current Seismograph session is not completed yet. Infer did not run and the scheduler may retry.",
        },
      };
    }
    return {
      status: 409,
      body: {
        ok: false,
        alert: true,
        retryable: true,
        skipped: "missed_scheduled_run",
        session: window.session,
        etDate: window.etDate,
        reason: "The post-close window has passed and this session has no completed seismograph claim.",
      },
    };
  }
  if (!dependency.seismograph || !seismographFreshForInfer(dependency.seismograph.computedAt, now)) {
    return {
      status: 409,
      body: {
        ok: false,
        alert: true,
        retryable: true,
        skipped: "current_session_seismograph_output_missing_or_stale",
        session: window.session,
        etDate: window.etDate,
        reason: "The Seismograph claim completed but no current Eastern post-close output is available. Infer did not run and must retry from a verified dependency.",
      },
    };
  }
  return null;
}

type ScheduledSystemicRegimeInferHooks = {
  sessionClaimPresence?: (etDate: string) => Promise<CurrentSessionSeismographDependency["claimPresence"]>;
  currentSeismograph?: () => Promise<SeismographOutput | null>;
  runInference?: (options: SystemicRegimeInferenceJobOptions) => Promise<Record<string, unknown>>;
};

async function executeScheduledSystemicRegimeInfer(
  res: Response,
  hooks: ScheduledSystemicRegimeInferHooks = {},
): Promise<void> {
  try {
    const now = new Date();
    const window = nyseSeismographRunWindow(now);
    const presence = window.etDate && window.session !== "CLOSED"
      ? await (hooks.sessionClaimPresence
        ? hooks.sessionClaimPresence(window.etDate)
        : scheduledSessionClaimPresence(window.etDate))
      : "unavailable";
    const seismograph = window.session !== "CLOSED"
      ? await (hooks.currentSeismograph
        ? hooks.currentSeismograph()
        : memoryGetJson<SeismographOutput | null>("seismograph:latest_output", null))
      : null;
    const decision = inferScheduleDecision(now, { claimPresence: presence, seismograph });
    if (decision) {
      if (decision.body.alert === true) {
        console.error(`[SystemicRegime][SCHEDULE-ALERT] ${JSON.stringify({ ...decision.body, at: now.toISOString() })}`);
      } else {
        console.log(`[SystemicRegime][SCHEDULE-HEARTBEAT] ${JSON.stringify({ ...decision.body, at: now.toISOString() })}`);
      }
      res.status(decision.status).json(decision.body);
      return;
    }
    const result = await (hooks.runInference
      ? hooks.runInference({ currentSeismograph: seismograph, now })
      : runSystemicRegimeInferenceJob({ currentSeismograph: seismograph, now }));
    if (result.ok !== true && result.retryable === true) {
      res.status(409).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    log.error("[SystemicRegime] Infer job failed", { err: error as Error });
    res.status(500).json({ ok: false, error: "Failed" });
  }
}

export async function handleScheduledSystemicRegimeInfer(_req: Request, res: Response): Promise<void> {
  return executeScheduledSystemicRegimeInfer(res);
}

/** Tests inject dependencies here; the mounted production handler never does. */
export async function runScheduledSystemicRegimeInferForTests(
  res: Response,
  hooks: ScheduledSystemicRegimeInferHooks = {},
): Promise<void> {
  return executeScheduledSystemicRegimeInfer(res, hooks);
}
