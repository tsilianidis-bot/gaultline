import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
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

export async function persistApprovedModelRegistry(registry: Record<string, unknown>, modelDir?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const modelVersion = String(registry.modelVersion ?? "unknown");
  const payload = { ...registry, approved: true };
  if (modelDir) {
    const joblib = resolve(modelDir, "approved.joblib");
    if (existsSync(joblib)) {
      payload.artifactBase64 = readFileSync(joblib).toString("base64");
    }
  }
  try {
    await db.insert(systemicRegimeModels).values({
      modelVersion,
      modelType: String(payload.modelType ?? "gaussian-hmm-2state"),
      pcaMethod: String((payload.pca as { pcaMethod?: string } | undefined)?.pcaMethod ?? payload.pcaMethod ?? "standard_scaler_pca"),
      nStates: Number(payload.nStates ?? 2),
      featureSchemaVersion: String(payload.featureSchemaVersion ?? "sre-features-v1"),
      trainingStart: (payload.pca as { trainingStart?: string } | undefined)?.trainingStart ?? null,
      trainingEnd: (payload.pca as { trainingEnd?: string } | undefined)?.trainingEnd ?? null,
      approved: true,
      registryJson: JSON.stringify(payload),
    }).onDuplicateKeyUpdate({
      set: {
        modelType: String(payload.modelType ?? "gaussian-hmm-2state"),
        nStates: Number(payload.nStates ?? 2),
        approved: true,
        registryJson: JSON.stringify(payload),
      },
    });
  } catch (error) {
    log.warn("[SystemicRegime] Model registry persist skipped", { err: error as Error, modelVersion });
  }
}

/** Restore the frozen joblib onto ephemeral disk from the latest approved DB row. */
export async function restoreApprovedModelFromDb(modelDir: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select()
    .from(systemicRegimeModels)
    .where(eq(systemicRegimeModels.approved, true))
    .orderBy(desc(systemicRegimeModels.createdAt))
    .limit(1);
  if (!row) return false;
  try {
    const parsed = JSON.parse(row.registryJson) as { artifactBase64?: string };
    if (!parsed.artifactBase64) return false;
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(resolve(modelDir, "approved.joblib"), Buffer.from(parsed.artifactBase64, "base64"));
    writeFileSync(resolve(modelDir, "registry.json"), JSON.stringify({ ...parsed, artifactBase64: undefined }, null, 2));
    return true;
  } catch (error) {
    log.warn("[SystemicRegime] Approved model restore failed", { err: error as Error });
    return false;
  }
}

/** Apply 0071 CREATE TABLE IF NOT EXISTS so inference can persist without a separate migrate step. */
export async function ensureSystemicRegimeTables(): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`systemicRegimeModels\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`modelVersion\` varchar(64) NOT NULL,
      \`modelType\` varchar(64) NOT NULL,
      \`pcaMethod\` varchar(64) NOT NULL DEFAULT 'standard_scaler_pca',
      \`nStates\` int NOT NULL DEFAULT 2,
      \`featureSchemaVersion\` varchar(64) NOT NULL,
      \`trainingStart\` varchar(10),
      \`trainingEnd\` varchar(10),
      \`approved\` boolean NOT NULL DEFAULT false,
      \`registryJson\` longtext NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`systemicRegimeModels_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`systemicRegimeModels_modelVersion_uniq\` UNIQUE(\`modelVersion\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`systemicRegimeReadings\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`dataAsOf\` varchar(10) NOT NULL,
      \`computedAt\` timestamp NOT NULL,
      \`historyClass\` enum('LIVE_INFERENCE','OOS_RESEARCH') NOT NULL DEFAULT 'LIVE_INFERENCE',
      \`currentRegime\` varchar(32) NOT NULL,
      \`systemicRiskScore\` int,
      \`crisisProbability\` decimal(8,6),
      \`stressBuildingProbability\` decimal(8,6),
      \`transitionProbability\` decimal(8,6),
      \`regimeConfidence\` decimal(8,6),
      \`creditStressZ\` decimal(8,4),
      \`volStressZ\` decimal(8,4),
      \`ratesStressZ\` decimal(8,4),
      \`pc1\` decimal(10,6),
      \`factorArrowsJson\` text,
      \`freshnessStatus\` varchar(16) NOT NULL DEFAULT 'UNAVAILABLE',
      \`modelVersion\` varchar(64) NOT NULL,
      \`modelType\` varchar(64) NOT NULL,
      \`payloadJson\` text NOT NULL,
      \`contributesToPressureIndex\` boolean NOT NULL DEFAULT false,
      CONSTRAINT \`systemicRegimeReadings_id\` PRIMARY KEY(\`id\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`signalConvergenceReadings\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`computedAt\` timestamp NOT NULL,
      \`level\` varchar(16) NOT NULL,
      \`deterioratingCount\` int NOT NULL,
      \`availableCount\` int NOT NULL,
      \`voteCount\` int NOT NULL,
      \`methodology\` varchar(64) NOT NULL,
      \`payloadJson\` text NOT NULL,
      \`contributesToPressureIndex\` boolean NOT NULL DEFAULT false,
      CONSTRAINT \`signalConvergenceReadings_id\` PRIMARY KEY(\`id\`)
    )
  `);
  try {
    await db.execute(sql`ALTER TABLE \`systemicRegimeModels\` MODIFY \`registryJson\` LONGTEXT NOT NULL`);
  } catch {
    // Table missing or already LONGTEXT.
  }
  for (const statement of [
    sql`CREATE INDEX \`systemicRegimeReadings_dataAsOf_idx\` ON \`systemicRegimeReadings\` (\`dataAsOf\`)`,
    sql`CREATE INDEX \`systemicRegimeReadings_historyClass_idx\` ON \`systemicRegimeReadings\` (\`historyClass\`)`,
    sql`CREATE INDEX \`systemicRegimeReadings_computedAt_idx\` ON \`systemicRegimeReadings\` (\`computedAt\`)`,
    sql`CREATE INDEX \`signalConvergenceReadings_computedAt_idx\` ON \`signalConvergenceReadings\` (\`computedAt\`)`,
  ]) {
    try {
      await db.execute(statement);
    } catch {
      // Index already exists after the first apply.
    }
  }
  return { ok: true };
}
