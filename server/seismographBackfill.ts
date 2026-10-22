/**
 * seismographBackfill.ts
 *
 * Converts the existing pressureHistory table (317 months, 2000–present)
 * into daily seismographReadings so the Seismograph Intelligence engine
 * has years of historical data from day one.
 *
 * Strategy:
 * - Each month in pressureHistory becomes a daily reading for the 15th of that month.
 * - Sub-scores are derived from the existing domain columns.
 * - Direction, delta, streak, and percentile are computed from the series.
 * - Existing readings are never modified (duplicate key is a no-op).
 * - Rows are tagged RECONSTRUCTED_FROM_MONTHLY_PRESSURE_HISTORY in subScoresJson,
 *   carry no bull/crash probability and no synthesised sub-scores.
 * - Also seeds regime transitions from significant month-to-month regime changes.
 */
import { getDb } from "./db";
import {
  pressureHistory,
  seismographReadings,
  seismographTransitions,
  marketMemory,
} from "../drizzle/schema";
import { asc, sql } from "drizzle-orm";
import { Request, Response } from "express";

interface PressureRow {
  month: string;
  overallPressure: number;
  regime: string;
  liquidityStress: number | null;
  creditContagion: number | null;
  volatilityRegime: number | null;
  macroSensitivity: number | null;
  marketBreadth: number | null;
  aiBubble: number | null;
}

function classifyStressLevel(score: number): string {
  if (score >= 80) return "Crisis";
  if (score >= 65) return "High";
  if (score >= 50) return "Elevated";
  if (score >= 35) return "Moderate";
  return "Low";
}

function computeDirection(
  current: number,
  prior: number | null
): "rising" | "falling" | "stable" {
  if (prior === null) return "stable";
  const delta = current - prior;
  if (delta >= 3) return "rising";
  if (delta <= -3) return "falling";
  return "stable";
}

function computePercentile(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 50;
  const below = allScores.filter((s) => s < score).length;
  return Math.round((below / allScores.length) * 100);
}

function buildPressureDrivers(row: PressureRow): string[] {
  const drivers: string[] = [];
  const score = row.overallPressure;
  if (row.creditContagion != null && row.creditContagion >= 60) drivers.push("Credit Stress");
  if (row.liquidityStress != null && row.liquidityStress >= 60) drivers.push("Liquidity Risk");
  if (row.volatilityRegime != null && row.volatilityRegime >= 60) drivers.push("Volatility Regime");
  if (row.macroSensitivity != null && row.macroSensitivity >= 60) drivers.push("Fed Pressure");
  if (row.aiBubble != null && row.aiBubble >= 60) drivers.push("AI Bubble Risk");
  if (row.marketBreadth != null && row.marketBreadth >= 60) drivers.push("Market Breadth Deterioration");
  if (drivers.length === 0) {
    if (score >= 65) drivers.push("Elevated Macro Pressure");
    else if (score >= 50) drivers.push("Moderate Systemic Stress");
    else drivers.push("Low Systemic Pressure");
  }
  return drivers;
}

/**
 * Provenance marker for rows written by this backfill. These are historical
 * RECONSTRUCTIONS from the monthly pressureHistory table, not readings or
 * predictions made at the time. Stored inside the existing subScoresJson
 * column (no migration) so readers can exclude them from live history.
 */
export const RECONSTRUCTED_RECORD_CLASS = "RECONSTRUCTED_FROM_MONTHLY_PRESSURE_HISTORY";

/**
 * Sub-scores for a reconstructed row: only domain values that actually exist
 * in pressureHistory. Missing domains are omitted, never synthesised as a
 * multiple of the overall score.
 */
export function buildSubScores(row: PressureRow): Record<string, number | string> {
  const domains: Array<[string, number | null]> = [
    ["treasury", row.macroSensitivity],
    ["credit", row.creditContagion],
    ["liquidity", row.liquidityStress],
    ["volatility", row.volatilityRegime],
    ["breadth", row.marketBreadth],
    ["concentration", row.aiBubble],
    ["macro", row.macroSensitivity],
  ];
  const out: Record<string, number | string> = { recordClass: RECONSTRUCTED_RECORD_CLASS };
  for (const [key, value] of domains) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

/** True when an insert actually created a row (MySQL affectedRows 1; a no-op duplicate is 0). */
function rowCreated(result: unknown): boolean {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0) === 1;
}

export async function runSeismographBackfill(): Promise<{
  inserted: number;
  skipped: number;
  transitions: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("[Backfill] Database not available");

  // Load all pressure history ordered oldest first
  const rows = await db
    .select({
      month: pressureHistory.month,
      overallPressure: pressureHistory.overallPressure,
      regime: pressureHistory.regime,
      liquidityStress: pressureHistory.liquidityStress,
      creditContagion: pressureHistory.creditContagion,
      volatilityRegime: pressureHistory.volatilityRegime,
      macroSensitivity: pressureHistory.macroSensitivity,
      marketBreadth: pressureHistory.marketBreadth,
      aiBubble: pressureHistory.aiBubble,
    })
    .from(pressureHistory)
    .orderBy(asc(pressureHistory.month));

  if (rows.length === 0) return { inserted: 0, skipped: 0, transitions: 0 };

  const allScores = rows.map((r) => r.overallPressure);
  let inserted = 0;
  let skipped = 0;
  let transitionCount = 0;
  let prevRegime: string | null = null;
  let prevScore: number | null = null;
  let streakDir: "rising" | "falling" | "stable" = "stable";
  let streakDays = 1;

  // Process in batches of 50 to avoid timeouts
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      // Use the 15th of each month as the representative daily reading
      const readingDate = `${row.month}-15`;
      const score = row.overallPressure;
      const stressLevel = classifyStressLevel(score);
      const direction = computeDirection(score, prevScore);
      const delta = prevScore !== null ? Math.round(score - prevScore) : 0;
      const historicalPercentile = computePercentile(score, allScores);
      const pressureDrivers = buildPressureDrivers(row as PressureRow);
      const subScores = buildSubScores(row as PressureRow);

      // Streak tracking
      if (direction === streakDir && direction !== "stable") {
        streakDays++;
      } else if (direction !== "stable") {
        streakDir = direction;
        streakDays = 1;
      }

      try {
        const result = await db
          .insert(seismographReadings)
          .values({
            readingDate,
            pressureScore: score,
            stressLevel,
            regime: row.regime,
            subScoresJson: JSON.stringify(subScores),
            // A reconstruction carries no retrospective bull/crash "probability".
            bullProbability: null,
            crashProbability: null,
            direction,
            deltaFromPrior: delta,
            streakDays,
            historicalPercentile,
            pressureDriversJson: JSON.stringify(pressureDrivers),
            activeAlertsJson: "[]",
          })
          // Never modify an existing (original) reading: duplicate key is a no-op.
          .onDuplicateKeyUpdate({ set: { readingDate: sql`readingDate` } });
        if (rowCreated(result)) inserted++;
        else skipped++;
      } catch {
        skipped++;
      }

      // Record regime transitions
      if (prevRegime !== null && prevRegime !== row.regime) {
        // Reconstructed, not detected at the time: no detection confidence is claimed.
        const confidence = 0;
        const explanation = `Reconstructed from monthly pressure history (not detected at the time): regime ${prevRegime} → ${row.regime} in ${row.month}; pressure ${delta > 0 ? "rose" : "fell"} by ${Math.abs(delta)} points.`;
        try {
          await db
            .insert(seismographTransitions)
            .values({
              transitionDate: readingDate,
              fromRegime: prevRegime,
              toRegime: row.regime,
              confidence,
              explanation,
              pressureAtTransition: score,
              driversJson: JSON.stringify(pressureDrivers.slice(0, 3)),
            })
            .onDuplicateKeyUpdate({ set: { transitionDate: sql`transitionDate` } });
          transitionCount++;
        } catch {
          // ignore duplicate transitions
        }
      }

      prevRegime = row.regime;
      prevScore = score;
    }
  }

  // Update market memory with observation count
  const totalObs = inserted + skipped;
  try {
    await db
      .insert(marketMemory)
      .values({
        memoryKey: "observation_count",
        memoryValue: String(totalObs),
        description: "Total daily observations recorded (including backfilled)",
        writtenBy: "seismographBackfill",
      })
      .onDuplicateKeyUpdate({
        set: {
          memoryValue: String(totalObs),
          writtenBy: "seismographBackfill",
        },
      });
  } catch { /* ignore */ }

  return { inserted, skipped, transitions: transitionCount };
}

export async function handleSeismographBackfill(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await runSeismographBackfill();
    res.json({
      ok: true,
      ...result,
      message: `Backfill complete. ${result.inserted} readings inserted, ${result.skipped} skipped (already existed), ${result.transitions} regime transitions recorded.`,
    });
  } catch (err) {
    console.error("[Backfill] Failed:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
