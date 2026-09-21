import { signalConvergenceReadings, systemicRegimeModels, systemicRegimeReadings } from "../../drizzle/schema";
import { getDb } from "../db";
import type { HistoryClass, SignalConvergenceSnapshot, SystemicRegimeHistoryPoint, SystemicRegimeReading } from "../../shared/systemicRegime";
import { log } from "../logger";

function decimal(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(6);
}

export async function persistSystemicRegimeReading(
  reading: SystemicRegimeReading,
  historyClass: HistoryClass = "LIVE_INFERENCE",
): Promise<{ ok: boolean; id?: number }> {
  const db = await getDb();
  if (!db) return { ok: false };
  if (!reading.currentRegime || !reading.dataAsOf) return { ok: false };
  const [result] = await db.insert(systemicRegimeReadings).values({
    dataAsOf: reading.dataAsOf,
    computedAt: reading.computedAt ? new Date(reading.computedAt) : new Date(),
    historyClass,
    currentRegime: reading.currentRegime,
    systemicRiskScore: reading.systemicRiskScore,
    crisisProbability: decimal(reading.crisisProbability),
    stressBuildingProbability: decimal(reading.stressBuildingProbability),
    transitionProbability: decimal(reading.transitionProbability),
    regimeConfidence: decimal(reading.regimeConfidence),
    creditStressZ: decimal(reading.creditStressZ),
    volStressZ: decimal(reading.volStressZ),
    ratesStressZ: decimal(reading.ratesStressZ),
    pc1: decimal(reading.pc1),
    factorArrowsJson: JSON.stringify(reading.factorArrows),
    freshnessStatus: reading.freshnessStatus,
    modelVersion: reading.modelVersion,
    modelType: reading.modelType,
    payloadJson: JSON.stringify({ ...reading, contributesToPressureIndex: false }),
    contributesToPressureIndex: false,
  });
  return { ok: true, id: Number((result as { insertId?: number }).insertId ?? 0) };
}

export async function persistSystemicRegimeHistory(
  points: SystemicRegimeHistoryPoint[],
  modelVersion: string,
  modelType: string,
): Promise<number> {
  const db = await getDb();
  if (!db || points.length === 0) return 0;
  let written = 0;
  const chunk = 200;
  for (let i = 0; i < points.length; i += chunk) {
    const slice = points.slice(i, i + chunk);
    await db.insert(systemicRegimeReadings).values(
      slice.map(point => ({
        dataAsOf: point.date,
        computedAt: new Date(`${point.date}T21:00:00.000Z`),
        historyClass: "OOS_RESEARCH" as const,
        currentRegime: String(point.currentRegime),
        systemicRiskScore: point.systemicRiskScore,
        crisisProbability: decimal(point.crisisProbability),
        stressBuildingProbability: decimal(point.stressBuildingProbability),
        transitionProbability: decimal(point.transitionProbability ?? null),
        regimeConfidence: decimal(point.regimeConfidence ?? null),
        pc1: decimal(point.pc1),
        freshnessStatus: "CURRENT",
        modelVersion,
        modelType,
        payloadJson: JSON.stringify(point),
        contributesToPressureIndex: false,
      })),
    );
    written += slice.length;
  }
  return written;
}

export async function persistSignalConvergence(snapshot: SignalConvergenceSnapshot): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(signalConvergenceReadings).values({
    computedAt: new Date(snapshot.computedAt),
    level: snapshot.level,
    deterioratingCount: snapshot.deterioratingCount,
    availableCount: snapshot.availableCount,
    voteCount: snapshot.voteCount,
    methodology: snapshot.methodology,
    payloadJson: JSON.stringify({ ...snapshot, contributesToPressureIndex: false }),
    contributesToPressureIndex: false,
  });
}

export async function persistApprovedModelRegistry(registry: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const modelVersion = String(registry.modelVersion ?? "unknown");
  try {
    await db.insert(systemicRegimeModels).values({
      modelVersion,
      modelType: String(registry.modelType ?? "gaussian-hmm-3state"),
      pcaMethod: String((registry.pca as { pcaMethod?: string } | undefined)?.pcaMethod ?? registry.pcaMethod ?? "standard_scaler_pca"),
      nStates: Number(registry.nStates ?? 3),
      featureSchemaVersion: String(registry.featureSchemaVersion ?? "sre-features-v1"),
      trainingStart: (registry.pca as { trainingStart?: string } | undefined)?.trainingStart ?? null,
      trainingEnd: (registry.pca as { trainingEnd?: string } | undefined)?.trainingEnd ?? null,
      approved: Boolean(registry.approved),
      registryJson: JSON.stringify(registry),
    });
  } catch (error) {
    log.warn("[SystemicRegime] Model registry persist skipped", { err: error as Error, modelVersion });
  }
}
