/**
 * Scheduled Decision Ledger Evaluation Handler
 *
 * Called by the Manus Heartbeat cron every 6 hours.
 * Evaluates all pending Decision Ledger entries whose timeframe has elapsed.
 *
 * Route: POST /api/scheduled/ledger-evaluation
 *
 * Conservative by design:
 * - Never overwrites user-driven outcomes (autoEvaluated = false, outcome != pending)
 * - Falls back to "still_active" when data is ambiguous or unavailable
 * - Processes at most 100 entries per run to stay within the 2-minute timeout
 */

import type { Request, Response } from "express";
import { evaluateExpiredEntries } from "./decisionLedgerEvaluator";

export async function handleScheduledLedgerEvaluation(req: Request, res: Response) {
  try {
    console.log("[LedgerEval] Starting scheduled evaluation run…");

    const summary = await evaluateExpiredEntries();

    console.log(`[LedgerEval] Run complete: evaluated=${summary.evaluated}, skipped=${summary.skipped}, errors=${summary.errors}`);

    return res.json({
      ok: true,
      evaluated: summary.evaluated,
      skipped: summary.skipped,
      errors: summary.errors,
      results: summary.results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[LedgerEval] Scheduled evaluation failed:", err);
    return res.status(500).json({
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
