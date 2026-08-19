import { createHash } from "node:crypto";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { verifiedHistoricalOutcomes, verifiedHistoricalScores } from "../drizzle/schema";
import { getDb } from "./db";
import { getDailyBars, type YahooDailyBar } from "./yahooProxy";

const OUTCOME_SYMBOL = "^GSPC";
const OUTCOME_HORIZONS = [1, 5, 20, 60] as const;

export type VerifiedOutcomeStatus = "COMPLETE" | "PENDING" | "UNAVAILABLE";

export type CalculatedVerifiedOutcome = {
  outcomeStatus: VerifiedOutcomeStatus;
  startDate: string;
  endDate: string | null;
  forwardReturnPct: number | null;
  maximumDrawdownPct: number | null;
  maximumAdverseExcursionPct: number | null;
  realizedVolatilityPct: number | null;
  observationCount: number;
};

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toUtcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Derives an independent market-outcome observation after a frozen score.
 * The score itself is never an input to these calculations.
 */
export function calculateIndependentSp500Outcome(
  decisionDate: string,
  horizonTradingDays: number,
  bars: YahooDailyBar[],
): CalculatedVerifiedOutcome {
  const orderedBars = [...bars].sort((left, right) => left.timestamp - right.timestamp);
  const startIndex = orderedBars.reduce<number>((eligibleIndex, bar, index) => {
    return toUtcDate(bar.timestamp) <= decisionDate ? index : eligibleIndex;
  }, -1);

  if (startIndex < 0) {
    return { outcomeStatus: "UNAVAILABLE", startDate: decisionDate, endDate: null, forwardReturnPct: null, maximumDrawdownPct: null, maximumAdverseExcursionPct: null, realizedVolatilityPct: null, observationCount: 0 };
  }

  const startBar = orderedBars[startIndex]!;
  const endIndex = startIndex + horizonTradingDays;
  if (!orderedBars[endIndex]) {
    return { outcomeStatus: "PENDING", startDate: toUtcDate(startBar.timestamp), endDate: null, forwardReturnPct: null, maximumDrawdownPct: null, maximumAdverseExcursionPct: null, realizedVolatilityPct: null, observationCount: Math.max(0, orderedBars.length - startIndex - 1) };
  }

  const window = orderedBars.slice(startIndex, endIndex + 1);
  const endBar = window.at(-1)!;
  const forwardReturnPct = ((endBar.close / startBar.close) - 1) * 100;
  let runningPeak = startBar.close;
  let maximumDrawdownPct = 0;
  let minimumLow = startBar.low;
  for (const bar of window) {
    runningPeak = Math.max(runningPeak, bar.close);
    maximumDrawdownPct = Math.min(maximumDrawdownPct, ((bar.close / runningPeak) - 1) * 100);
    minimumLow = Math.min(minimumLow, bar.low);
  }
  const maximumAdverseExcursionPct = ((minimumLow / startBar.close) - 1) * 100;
  const dailyReturns = window.slice(1).map((bar, index) => Math.log(bar.close / window[index]!.close));
  const standardDeviation = sampleStandardDeviation(dailyReturns);
  const realizedVolatilityPct = standardDeviation === null ? null : standardDeviation * Math.sqrt(252) * 100;

  return {
    outcomeStatus: "COMPLETE",
    startDate: toUtcDate(startBar.timestamp),
    endDate: toUtcDate(endBar.timestamp),
    forwardReturnPct,
    maximumDrawdownPct,
    maximumAdverseExcursionPct,
    realizedVolatilityPct,
    observationCount: window.length - 1,
  };
}

export async function buildIndependentSp500Outcomes(fromMonth: string, toMonth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const scores = await db.select().from(verifiedHistoricalScores).where(and(
    eq(verifiedHistoricalScores.scoreStatus, "COMPLETE"),
    gte(verifiedHistoricalScores.scoreMonth, fromMonth),
    lte(verifiedHistoricalScores.scoreMonth, toMonth),
  )).orderBy(asc(verifiedHistoricalScores.scoreTimestamp));
  const bars = await getDailyBars(OUTCOME_SYMBOL, "5y");
  if (!bars.length) throw new Error("Independent S&P 500 outcome source returned no daily bars");

  const summary = { scoreCount: scores.length, barCount: bars.length, complete: 0, pending: 0, unavailable: 0, insertedOrRetained: 0 };
  for (const score of scores) {
    const decisionDate = score.scoreTimestamp.toISOString().slice(0, 10);
    for (const horizonTradingDays of OUTCOME_HORIZONS) {
      const result = calculateIndependentSp500Outcome(decisionDate, horizonTradingDays, bars);
      const outcomeKey = sha256({ verifiedScoreId: score.id, horizonTradingDays, decisionDate, result });
      await db.insert(verifiedHistoricalOutcomes).values({
        outcomeKey,
        verifiedScoreId: score.id,
        horizonTradingDays,
        startDate: result.startDate,
        endDate: result.endDate,
        forwardReturnPct: result.forwardReturnPct,
        maximumDrawdownPct: result.maximumDrawdownPct,
        maximumAdverseExcursionPct: result.maximumAdverseExcursionPct,
        realizedVolatilityPct: result.realizedVolatilityPct,
        outcomeStatus: result.outcomeStatus,
        outcomeJson: JSON.stringify({ ...result, instrument: "S&P 500 Price Index", symbol: OUTCOME_SYMBOL }),
        sourceMetadataJson: JSON.stringify({
          provider: "Yahoo Finance chart endpoint",
          instrument: "S&P 500 Price Index",
          symbol: OUTCOME_SYMBOL,
          interval: "1d",
          priceField: "close",
          returnBasis: "Price return only; no synthetic composite and no score input",
          retrievalDate: new Date().toISOString(),
        }),
      }).onDuplicateKeyUpdate({ set: { outcomeKey } });
      summary.insertedOrRetained += 1;
      if (result.outcomeStatus === "COMPLETE") summary.complete += 1;
      else if (result.outcomeStatus === "PENDING") summary.pending += 1;
      else summary.unavailable += 1;
    }
  }
  return summary;
}

export const VERIFIED_OUTCOME_HORIZONS = OUTCOME_HORIZONS;
