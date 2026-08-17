import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { risingStarHistoryJobs } from "../drizzle/schema";
import { getDb } from "./db";
import { recordDailyRisingStarsContinuity } from "./risingStarsHistory";
import { getOpportunityDiscovery } from "./signalOutlook";
import { collectRisingStarEventOutcomes } from "./symbolEventOutcomes";

/**
 * Project-owned Heartbeat handler.  Daily entries are idempotent by
 * ticker/date, while material event records are created only when the live
 * engine state transitions.  No historical reconstruction occurs here.
 */
export async function handleScheduledRisingStarsContinuity(_req: Request, res: Response) {
  try {
    const discovery = await getOpportunityDiscovery({ forceRefresh: true, captureEngineEvents: false });
    const continuity = await recordDailyRisingStarsContinuity(discovery.risingStars, {
      pressureIndex: discovery.pressureIndex,
      regime: discovery.regime,
      observedAt: discovery.generatedAt,
      source: "rising_stars_engine",
    });
    const outcomes = await collectRisingStarEventOutcomes();

    const db = await getDb();
    if (db) {
      await db.update(risingStarHistoryJobs)
        .set({ lastRunAt: new Date() })
        .where(eq(risingStarHistoryJobs.jobKey, "rising-stars-daily-continuity"));
    }

    res.json({ ok: true, historyClass: "live_verified", generatedAt: discovery.generatedAt, ...continuity, outcomes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[RisingStarsHistory] Daily continuity capture failed", { message });
    res.status(500).json({
      error: "rising_stars_daily_continuity_failed",
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
