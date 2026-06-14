/**
 * Scheduled Daily Snapshot Handler
 *
 * Called by the Manus Heartbeat cron at 6:30 AM UTC every weekday.
 * Generates (or refreshes) today's FAULTLINE reading snapshot.
 *
 * Route: POST /api/scheduled/daily-snapshot
 */
import type { Request, Response } from "express";
import { calculateFaultlinePressure } from "./pressure/engine";
import { getDiagnosticReport } from "./diagnosticAI";
import { upsertTodaySnapshot } from "./readingHistory";

export async function handleScheduledDailySnapshot(req: Request, res: Response) {
  try {
    console.log("[DailySnapshot] Starting scheduled snapshot generation…");

    const pressure = await calculateFaultlinePressure();

    let crashScore: number | null = null;
    let bullScore: number | null = null;
    try {
      const diag = await getDiagnosticReport("today");
      crashScore = diag.crashRisk.score;
      bullScore  = diag.bullContinuation.score;
    } catch (err) {
      console.warn("[DailySnapshot] Diagnostic unavailable, proceeding without scores:", err);
    }

    const snapshot = await upsertTodaySnapshot(pressure, crashScore, bullScore, null);

    console.log(`[DailySnapshot] Snapshot generated for ${snapshot.readingDate} — score: ${snapshot.faultlineScore}`);
    return res.json({ ok: true, date: snapshot.readingDate, score: snapshot.faultlineScore });
  } catch (err) {
    console.error("[DailySnapshot] Snapshot generation failed:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
