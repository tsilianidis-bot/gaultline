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
import { persistApprovedModelRegistry, persistSignalConvergence, persistSystemicRegimeHistory, persistSystemicRegimeReading, restoreApprovedModelFromDb, ensureSystemicRegimeTables } from "./writer";
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

export async function runSystemicRegimeInferenceJob(): Promise<Record<string, unknown>> {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  mkdirSync(MODEL_DIR, { recursive: true });
  await ensureSystemicRegimeTables();
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
  const seismograph = await memoryGetJson<SeismographOutput | null>("seismograph:latest_output", null);
  const fresh = seismographFreshForInfer(seismograph?.computedAt, new Date());
  if (!fresh || !seismograph) {
    return {
      ok: true,
      persisted,
      regime: reading.currentRegime,
      dataAsOf: reading.dataAsOf,
      convergence: null,
      seismographFreshness: "stale_or_missing",
      skippedConvergence: "seismograph_not_from_current_post_close_session",
      alert: true,
    };
  }
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
  mkdirSync(MODEL_DIR, { recursive: true });
  await ensureSystemicRegimeTables();
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
  const points = JSON.parse(readFileSync(RESEARCH_HISTORY_JSON, "utf8")) as SystemicRegimeHistoryPoint[];
  return persistSystemicRegimeHistory(points, "sre-hmm2-v1.0.0", "gaussian-hmm-2state");
}

export function inferScheduleDecision(
  now: Date,
  claimCompleted: boolean | null,
): { status: 200 | 409; body: Record<string, unknown> } | null {
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
  if (afterWindow && claimCompleted === false) {
    return {
      status: 409,
      body: {
        ok: false,
        alert: true,
        skipped: "missed_scheduled_run",
        session: window.session,
        etDate: window.etDate,
        reason: "The post-close window has passed and this session has no completed seismograph claim.",
      },
    };
  }
  return null;
}

export async function handleScheduledSystemicRegimeInfer(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const window = nyseSeismographRunWindow(now);
    const presence = window.etDate ? await scheduledSessionClaimPresence(window.etDate) : "unavailable";
    const claimCompleted = presence === "unavailable" ? null : presence === "completed";
    const decision = inferScheduleDecision(now, claimCompleted);
    if (decision) {
      if (decision.body.skipped === "nyse_closed" || decision.body.skipped === "missed_scheduled_run") {
        console.log(`[SystemicRegime][SCHEDULE-HEARTBEAT] ${JSON.stringify({ ...decision.body, at: now.toISOString() })}`);
      }
      res.status(decision.status).json(decision.body);
      return;
    }
    const result = await runSystemicRegimeInferenceJob();
    if (result.skippedConvergence) {
      res.status(409).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    log.error("[SystemicRegime] Infer job failed", { err: error as Error });
    res.status(500).json({ ok: false, error: "Failed" });
  }
}
