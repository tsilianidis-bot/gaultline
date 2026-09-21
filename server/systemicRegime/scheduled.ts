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
import { persistApprovedModelRegistry, persistSignalConvergence, persistSystemicRegimeHistory, persistSystemicRegimeReading } from "./writer";
import type { SystemicRegimeHistoryPoint, SystemicRegimeReading } from "../../shared/systemicRegime";

const QUANT_DIR = resolve(process.cwd(), "quant/systemic-regime");
const ARTIFACT_DIR = resolve(QUANT_DIR, "artifacts");
const MODEL_DIR = resolve(ARTIFACT_DIR, "approved");
const PANEL_JSON = resolve(ARTIFACT_DIR, "fred_panel.json");
const INFERENCE_JSON = resolve(ARTIFACT_DIR, "latest_inference.json");
const HISTORY_JSON = resolve(ARTIFACT_DIR, "oos_regime_path.json");

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
  const bulk = await fetchFredBulk(FRED_SERIES.map(spec => ({ id: spec.id, limit: spec.limit, sortOrder: "asc" })));
  const payload = { exportedAt: new Date().toISOString(), provider: "FRED", source: "server/fredClient.ts", series: bulk.results };
  writeFileSync(PANEL_JSON, JSON.stringify(payload));
  return { path: PANEL_JSON, series: Object.keys(bulk.results) };
}

export async function runSystemicRegimeInferenceJob(): Promise<Record<string, unknown>> {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const approved = existsSync(resolve(MODEL_DIR, "approved.joblib"));
  if (!approved) {
    return { ok: false, skipped: "no approved model; weekly train has not produced a frozen bundle" };
  }
  try {
    await exportFredPanelForQuant();
  } catch (error) {
    log.warn("[SystemicRegime] FRED export failed; inference may use last panel", { err: error as Error });
  }
  const panelArg = existsSync(PANEL_JSON) ? ["--from-json", PANEL_JSON] : [];
  const result = await runPython(["inference.py", "--model-dir", MODEL_DIR, ...panelArg, "--out", INFERENCE_JSON, "--history-out", HISTORY_JSON]);
  if (result.skipped) return { ok: false, skipped: result.skipped };
  if (!result.ok || !existsSync(INFERENCE_JSON)) {
    return { ok: false, error: result.stderr || "inference failed", stdout: result.stdout };
  }
  const reading = JSON.parse(readFileSync(INFERENCE_JSON, "utf8")) as SystemicRegimeReading;
  reading.contributesToPressureIndex = false;
  const persisted = await persistSystemicRegimeReading(reading, "LIVE_INFERENCE");
  const canonical = await getAuthoritativeCanonicalIntelligenceState();
  const seismograph = await memoryGetJson<SeismographOutput | null>("seismograph:latest_output", null);
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
  return { ok: true, persisted, regime: reading.currentRegime, dataAsOf: reading.dataAsOf, convergence: convergence.level };
}

export async function runSystemicRegimeTrainJob(): Promise<Record<string, unknown>> {
  mkdirSync(MODEL_DIR, { recursive: true });
  try {
    await exportFredPanelForQuant();
  } catch (error) {
    return { ok: false, error: `FRED export failed: ${String(error)}` };
  }
  const result = await runPython(
    ["train.py", "--from-json", PANEL_JSON, "--model-dir", MODEL_DIR],
    10 * 60_000,
  );
  if (!result.ok) return { ok: false, error: result.stderr || result.skipped || "train failed", stdout: result.stdout };
  try {
    const registryPath = resolve(MODEL_DIR, "registry.json");
    if (existsSync(registryPath)) {
      await persistApprovedModelRegistry(JSON.parse(readFileSync(registryPath, "utf8")) as Record<string, unknown>);
    }
  } catch (error) {
    log.warn("[SystemicRegime] Registry persist failed", { err: error as Error });
  }
  return { ok: true, stdout: result.stdout };
}

export async function ingestPackagedResearchHistory(): Promise<number> {
  if (!existsSync(HISTORY_JSON)) return 0;
  const points = JSON.parse(readFileSync(HISTORY_JSON, "utf8")) as SystemicRegimeHistoryPoint[];
  return persistSystemicRegimeHistory(points, "sre-hmm3-v1.0.0", "gaussian-hmm-3state");
}

export async function handleScheduledSystemicRegimeInfer(_req: Request, res: Response): Promise<void> {
  try {
    const result = await runSystemicRegimeInferenceJob();
    res.json(result);
  } catch (error) {
    log.error("[SystemicRegime] Infer job failed", { err: error as Error });
    res.status(500).json({ ok: false, error: "Failed" });
  }
}

export async function handleScheduledSystemicRegimeTrain(_req: Request, res: Response): Promise<void> {
  try {
    const result = await runSystemicRegimeTrainJob();
    res.status(result.ok ? 200 : 500).json(result);
  } catch (error) {
    log.error("[SystemicRegime] Train job failed", { err: error as Error });
    res.status(500).json({ ok: false, error: "Failed" });
  }
}
