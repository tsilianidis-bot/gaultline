import { desc, eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  signalConvergenceReadings,
  systemicRegimeReadings,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  EMPTY_SYSTEMIC_REGIME_READING,
  type HistoryClass,
  type SignalConvergenceSnapshot,
  type SystemicRegimeHistoryPoint,
  type SystemicRegimeReading,
} from "../../shared/systemicRegime";

export async function getLatestSystemicRegimeReading(
  historyClass: HistoryClass = "LIVE_INFERENCE",
): Promise<SystemicRegimeReading | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(systemicRegimeReadings)
    .where(eq(systemicRegimeReadings.historyClass, historyClass))
    .orderBy(desc(systemicRegimeReadings.computedAt))
    .limit(1);
  if (!row) return null;
  return parseReading(row.payloadJson);
}

export async function getSystemicRegimeHistory(
  historyClass: HistoryClass = "OOS_RESEARCH",
  limit = 2500,
): Promise<SystemicRegimeHistoryPoint[]> {
  const db = await getDb();
  if (!db) return loadPackagedResearchHistory(limit);
  const rows = await db
    .select()
    .from(systemicRegimeReadings)
    .where(eq(systemicRegimeReadings.historyClass, historyClass))
    .orderBy(desc(systemicRegimeReadings.dataAsOf))
    .limit(limit);
  if (rows.length === 0 && historyClass === "OOS_RESEARCH") return loadPackagedResearchHistory(limit);
  return rows
    .map(row => parseHistoryPoint(row.payloadJson, row.dataAsOf, row.currentRegime, row.systemicRiskScore))
    .reverse();
}

export async function getLatestSignalConvergence(): Promise<SignalConvergenceSnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(signalConvergenceReadings)
    .orderBy(desc(signalConvergenceReadings.computedAt))
    .limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.payloadJson) as SignalConvergenceSnapshot;
  } catch {
    return null;
  }
}

export function parseReading(payloadJson: string): SystemicRegimeReading {
  try {
    const parsed = JSON.parse(payloadJson) as Partial<SystemicRegimeReading>;
    return {
      ...EMPTY_SYSTEMIC_REGIME_READING,
      ...parsed,
      contributesToPressureIndex: false,
      pcaMethod: "standard_scaler_pca",
    };
  } catch {
    return EMPTY_SYSTEMIC_REGIME_READING;
  }
}

function parseHistoryPoint(
  payloadJson: string,
  dataAsOf: string,
  regime: string,
  score: number | null,
): SystemicRegimeHistoryPoint {
  try {
    const parsed = JSON.parse(payloadJson) as SystemicRegimeHistoryPoint;
    return {
      date: parsed.date ?? dataAsOf,
      currentRegime: parsed.currentRegime ?? regime,
      crisisProbability: parsed.crisisProbability ?? null,
      stressBuildingProbability: parsed.stressBuildingProbability ?? null,
      transitionProbability: parsed.transitionProbability ?? null,
      regimeConfidence: parsed.regimeConfidence ?? null,
      systemicRiskScore: parsed.systemicRiskScore ?? score,
      pc1: parsed.pc1 ?? null,
      spx: parsed.spx ?? null,
      pressureIndex: parsed.pressureIndex ?? null,
    };
  } catch {
    return {
      date: dataAsOf,
      currentRegime: regime,
      crisisProbability: null,
      stressBuildingProbability: null,
      transitionProbability: null,
      regimeConfidence: null,
      systemicRiskScore: score,
      pc1: null,
      spx: null,
    };
  }
}

function loadPackagedResearchHistory(limit: number): SystemicRegimeHistoryPoint[] {
  try {
    const path = resolve(process.cwd(), "quant/systemic-regime/artifacts/oos_regime_path.json");
    if (!existsSync(path)) return [];
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Array<SystemicRegimeHistoryPoint & { regime?: string }>;
    return (Array.isArray(parsed) ? parsed : []).slice(-limit).map(row => ({
      date: row.date,
      currentRegime: row.currentRegime ?? row.regime ?? "NORMAL",
      crisisProbability: row.crisisProbability ?? null,
      stressBuildingProbability: row.stressBuildingProbability ?? null,
      transitionProbability: row.transitionProbability ?? null,
      regimeConfidence: row.regimeConfidence ?? null,
      systemicRiskScore: row.systemicRiskScore ?? null,
      pc1: row.pc1 ?? null,
      spx: row.spx ?? null,
      pressureIndex: row.pressureIndex ?? null,
    }));
  } catch {
    return [];
  }
}
