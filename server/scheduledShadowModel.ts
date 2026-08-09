import type { Request, Response } from "express";
import { getDb } from "./db";
import { shadowModelReadings, shadowForwardOutcomes, shadowDailySummaries } from "../drizzle/schema";
import { and, lt, isNull, gte, lte, desc } from "drizzle-orm";
import { log } from "./logger";

export async function handleShadowForwardOutcomes(_req: Request, res: Response): Promise<void> {
  const db = await getDb();
  if (!db) { res.json({ ok: false, error: "DB unavailable" }); return; }
  try {
    const now = new Date();
    const overdue = await db.select().from(shadowForwardOutcomes)
      .where(and(isNull(shadowForwardOutcomes.collectedAt), lt(shadowForwardOutcomes.dueAt, now)))
      .limit(100);
    if (overdue.length === 0) { res.json({ ok: true, collected: 0 }); return; }
    let collected = 0;
    for (const outcome of overdue) {
      try {
        const [reading] = await db.select().from(shadowModelReadings)
          .where((t => t.id === outcome.shadowReadingId) as any).limit(1);
        await db.update(shadowForwardOutcomes).set({
          collectedAt: now,
          notes: `Auto-collected at ${now.toISOString()}. V1: ${reading?.v1Pressure ?? "?"}, V3-H: ${reading?.v3hPressure ?? "?"}.`,
        }).where((t => t.id === outcome.id) as any);
        collected++;
      } catch {}
    }
    res.json({ ok: true, collected, total: overdue.length });
  } catch (err) {
    log.error("[Shadow Forward Outcomes] Job failed", { err: err as Error });
    res.status(500).json({ ok: false, error: "Failed" });
  }
}

export async function handleShadowDailySummary(_req: Request, res: Response): Promise<void> {
  const db = await getDb();
  if (!db) { res.json({ ok: false, error: "DB unavailable" }); return; }
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const startOfDay = new Date(dateStr + "T00:00:00.000Z");
    const endOfDay = new Date(dateStr + "T23:59:59.999Z");
    const readings = await db.select().from(shadowModelReadings)
      .where(and(gte(shadowModelReadings.readingAt, startOfDay), lte(shadowModelReadings.readingAt, endOfDay)));
    if (readings.length === 0) { res.json({ ok: true, message: "No readings today" }); return; }
    const v1Avg = Math.round(readings.reduce((s, r) => s + r.v1Pressure, 0) / readings.length);
    const v3hAvg = Math.round(readings.reduce((s, r) => s + r.v3hPressure, 0) / readings.length);
    const diffAvg = v3hAvg - v1Avg;
    const latest = readings[readings.length - 1]!;
    const anyDivergence10 = readings.some(r => r.flagDivergence10);
    const anyRegimeDisagreement = readings.some(r => r.flagRegimeDisagreement);
    const anyStlfsiSpike = readings.some(r => r.flagStlfsiSpike);
    const anyFallback = readings.some(r => r.flagFallback);
    const anomalousFlag = anyDivergence10 || anyRegimeDisagreement || anyStlfsiSpike;
    const reviewRequired = anyDivergence10 && anyRegimeDisagreement;
    await db.insert(shadowDailySummaries).values({
      summaryDate: dateStr, v1Pressure: v1Avg, v3hPressure: v3hAvg, scoreDiff: diffAvg,
      v1Regime: latest.v1Regime, v3hRegime: latest.v3hRegime, regimeAgreement: latest.regimeAgreement,
      stlfsiRaw: latest.stlfsiRaw, stlfsiZ: latest.stlfsiZ,
      largestComponentChange: `V3-H ${v3hAvg > v1Avg ? "higher" : "lower"} by ${Math.abs(diffAvg)} pts`,
      fallbackUsed: anyFallback, anomalousFlag, reviewRequired, readingCount: readings.length,
    }).onDuplicateKeyUpdate({ set: {
      v1Pressure: v1Avg, v3hPressure: v3hAvg, scoreDiff: diffAvg,
      v1Regime: latest.v1Regime, v3hRegime: latest.v3hRegime, regimeAgreement: latest.regimeAgreement,
      anomalousFlag, reviewRequired, readingCount: readings.length, generatedAt: new Date(),
    }});
    res.json({ ok: true, date: dateStr, v1Pressure: v1Avg, v3hPressure: v3hAvg, scoreDiff: diffAvg, readingCount: readings.length });
  } catch (err) {
    log.error("[Shadow Daily Summary] Job failed", { err: err as Error });
    res.status(500).json({ ok: false, error: "Failed" });
  }
}
