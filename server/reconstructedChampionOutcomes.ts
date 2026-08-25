import { createHash } from "node:crypto";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { reconstructedHistoricalOutcomes, reconstructedHistoricalScores } from "../drizzle/schema";
import { getDb } from "./db";
import { calculateIndependentSp500Outcome } from "./verifiedHistoricalOutcomes";
import { getDailyBarsForPeriod } from "./yahooProxy";

const OUTCOME_HORIZONS = [1, 5, 20, 60, 120, 252] as const;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buildReconstructedIndependentSp500Outcomes(fromMonth = "2000-01", toMonth = "2026-07") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const scores = await db.select().from(reconstructedHistoricalScores).where(and(
    eq(reconstructedHistoricalScores.scoreStatus, "COMPLETE"),
    gte(reconstructedHistoricalScores.scoreMonth, fromMonth),
    lte(reconstructedHistoricalScores.scoreMonth, toMonth),
  )).orderBy(asc(reconstructedHistoricalScores.scoreTimestamp));
  const bars = await getDailyBarsForPeriod("^GSPC", "1999-12-01", "2026-12-31");
  if (!bars.length) throw new Error("Independent S&P 500 source returned no daily bars");

  const summary = { scoreCount: scores.length, barCount: bars.length, complete: 0, pending: 0, unavailable: 0, insertedOrRetained: 0 };
  for (const score of scores) {
    const decisionDate = score.scoreTimestamp.toISOString().slice(0, 10);
    for (const horizonTradingDays of OUTCOME_HORIZONS) {
      const result = calculateIndependentSp500Outcome(decisionDate, horizonTradingDays, bars);
      const outcomeKey = sha256({ reconstructedScoreId: score.id, horizonTradingDays, decisionDate, result });
      await db.insert(reconstructedHistoricalOutcomes).values({
        outcomeKey,
        reconstructedScoreId: score.id,
        horizonTradingDays,
        startDate: result.startDate,
        endDate: result.endDate,
        forwardReturnPct: result.forwardReturnPct,
        maximumDrawdownPct: result.maximumDrawdownPct,
        maximumAdverseExcursionPct: result.maximumAdverseExcursionPct,
        realizedVolatilityPct: result.realizedVolatilityPct,
        outcomeStatus: result.outcomeStatus,
        outcomeJson: JSON.stringify({ ...result, datasetTier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY", instrument: "S&P 500 Price Index", symbol: "^GSPC" }),
        sourceMetadataJson: JSON.stringify({ provider: "Yahoo Finance chart endpoint", instrument: "S&P 500 Price Index", symbol: "^GSPC", interval: "1d", dataCadence: "DAILY_CONFIRMED_PERIOD_QUERY", priceField: "close", returnBasis: "Price return only; outcomes are never inputs to reconstructed Champion score construction", retrievalDate: new Date().toISOString() }),
      }).onDuplicateKeyUpdate({ set: { outcomeKey } });
      summary.insertedOrRetained += 1;
      if (result.outcomeStatus === "COMPLETE") summary.complete += 1;
      else if (result.outcomeStatus === "PENDING") summary.pending += 1;
      else summary.unavailable += 1;
    }
  }
  return summary;
}

export const RECONSTRUCTED_OUTCOME_HORIZONS = OUTCOME_HORIZONS;
