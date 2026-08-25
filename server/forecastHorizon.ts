import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { forecastObservations, forecastResolutions } from "../drizzle/schema";
import type { ForecastMetadata } from "../shared/forecastMetadata";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);

export async function recordForecastObservation(input: { sourceType: string; sourceKey: string; sourceModel: string; modelVersion: string; metadata: ForecastMetadata; sourceVersions: Record<string, string> }) {
  const db = await getDb();
  if (!db) throw new Error("Forecast observation ledger unavailable");
  const forecastKey = `${input.sourceType}:${input.sourceKey}:${hash({ metadata: input.metadata, sourceVersions: input.sourceVersions })}`;
  const existing = await db.select({ id: forecastObservations.id }).from(forecastObservations).where(eq(forecastObservations.forecastKey, forecastKey)).limit(1);
  if (existing[0]) return { id: existing[0].id, forecastKey, created: false };
  const result = await db.insert(forecastObservations).values({
    forecastKey, sourceType: input.sourceType, sourceKey: input.sourceKey, sourceModel: input.sourceModel, modelVersion: input.modelVersion,
    evidenceClass: input.metadata.evidenceClass, horizonStatus: input.metadata.expectedHorizonStatus,
    forecastGeneratedAt: new Date(input.metadata.forecastGeneratedAt), forecastExpiresAt: input.metadata.forecastExpiresAt ? new Date(input.metadata.forecastExpiresAt) : null,
    originalForecastJson: JSON.stringify(input.metadata), sourceVersionsJson: JSON.stringify(input.sourceVersions),
  });
  return { id: Number(result[0].insertId), forecastKey, created: true };
}

export async function appendForecastResolution(input: { forecastObservationId: number; resolutionKey: string; resolutionStatus: "PENDING" | "TARGET_REACHED" | "INVALIDATED" | "EXPIRED" | "UNAVAILABLE"; resolvedAt: Date; outcome: unknown; sourceVersions: Record<string, string> }) {
  const db = await getDb();
  if (!db) throw new Error("Forecast resolution ledger unavailable");
  const existing = await db.select({ id: forecastResolutions.id }).from(forecastResolutions).where(eq(forecastResolutions.resolutionKey, input.resolutionKey)).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const result = await db.insert(forecastResolutions).values({ ...input, outcomeValueJson: JSON.stringify(input.outcome), sourceVersionsJson: JSON.stringify(input.sourceVersions) });
  return { id: Number(result[0].insertId), created: true };
}
