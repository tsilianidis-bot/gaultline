import { and, asc, eq, gte, like, lte } from "drizzle-orm";
import { pressureHistory, reconstructedHistoricalOutcomes, reconstructedHistoricalScores } from "../drizzle/schema";
import { getDb } from "./db";
import { getDailyBarsForPeriod, type YahooDailyBar } from "./yahooProxy";

type CompleteScore = { id: number; scoreMonth: string; scoreTimestamp: Date; overallPressure: number; regime: string; vectors: Record<string, number> };
type Outcome = { scoreId: number; horizon: number; forwardReturnPct: number; maximumDrawdownPct: number; realizedVolatilityPct: number; startDate: string; endDate: string };
type Event = { startDate: string; troughDate: string; drawdownPct: number; peakIndex: number; troughIndex: number };

const VECTOR_WEIGHTS: Record<string, number> = { liquidityStress: 0.2, creditContagion: 0.2, volatilityRegime: 0.15, macroSensitivity: 0.2, marketBreadth: 0.1, aiBubble: 0.15 };
const DAILY_CONFIRMED_MARKER = "%\"dataCadence\":\"DAILY_CONFIRMED_PERIOD_QUERY\"%";

function dateOf(bar: YahooDailyBar) { return new Date(bar.timestamp).toISOString().slice(0, 10); }
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = mean(values)!;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}
function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper ? sorted[lower]! : sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}
function correlation(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = mean(left)!;
  const rightMean = mean(right)!;
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean), 0);
  const denominator = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return denominator === 0 ? null : numerator / denominator;
}

export function scoreBucket(score: number) {
  if (score <= 24) return "0-24";
  if (score <= 44) return "25-44";
  if (score <= 64) return "45-64";
  if (score <= 79) return "65-79";
  return "80-100";
}

/** Locked protocol: local peak followed by >=10% close drawdown within 60 trading days. */
export function detectEquityDrawdownEvents(bars: YahooDailyBar[]): Event[] {
  const ordered = [...bars].sort((left, right) => left.timestamp - right.timestamp);
  const events: Event[] = [];
  let lastTrough = -1;
  for (let peakIndex = 20; peakIndex < ordered.length - 60; peakIndex++) {
    if (peakIndex <= lastTrough) continue;
    const peak = ordered[peakIndex]!;
    const preceding = ordered.slice(peakIndex - 20, peakIndex).map(bar => bar.close);
    if (peak.close < Math.max(...preceding)) continue;
    const forward = ordered.slice(peakIndex + 1, peakIndex + 61);
    let troughIndex = peakIndex;
    let troughClose = peak.close;
    forward.forEach((bar, index) => {
      if (bar.close < troughClose) { troughClose = bar.close; troughIndex = peakIndex + index + 1; }
    });
    const drawdownPct = ((troughClose / peak.close) - 1) * 100;
    if (drawdownPct <= -10) {
      events.push({ startDate: dateOf(peak), troughDate: dateOf(ordered[troughIndex]!), drawdownPct, peakIndex, troughIndex });
      lastTrough = troughIndex;
    }
  }
  return events;
}

export function mechanicalAblation(score: CompleteScore, excludedVector: string) {
  const remainingWeight = Object.entries(VECTOR_WEIGHTS).filter(([key]) => key !== excludedVector).reduce((sum, [, weight]) => sum + weight, 0);
  const recalculated = Math.round(Object.entries(VECTOR_WEIGHTS)
    .filter(([key]) => key !== excludedVector)
    .reduce((sum, [key, weight]) => sum + (score.vectors[key] ?? 0) * (weight / remainingWeight), 0));
  return { score: recalculated, differenceFromBaseline: recalculated - score.overallPressure };
}

export function tradingDayWindowEndDate(bars: YahooDailyBar[], decisionDate: string, horizonTradingDays: number) {
  const decisionIndex = bars.reduce((latest, bar, index) => dateOf(bar) <= decisionDate ? index : latest, -1);
  if (decisionIndex < 0) return null;
  return dateOf(bars[Math.min(bars.length - 1, decisionIndex + horizonTradingDays)]!);
}

function twoMonthsBefore(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() - 2);
  return value.toISOString().slice(0, 10);
}

function partitionForMonth(month: string) {
  if (month <= "2011-12") return "development";
  if (month <= "2019-12") return "validation";
  return "holdout";
}

function summarizeValues(values: number[]) {
  return { count: values.length, mean: mean(values), standardDeviation: standardDeviation(values), minimum: values.length ? Math.min(...values) : null, p25: quantile(values, 0.25), median: quantile(values, 0.5), p75: quantile(values, 0.75), maximum: values.length ? Math.max(...values) : null };
}

export async function runReconstructedChampionMetrics() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const scoreRows = await db.select().from(reconstructedHistoricalScores).where(eq(reconstructedHistoricalScores.scoreStatus, "COMPLETE")).orderBy(asc(reconstructedHistoricalScores.scoreTimestamp));
  const scores: CompleteScore[] = scoreRows.map(score => ({ id: score.id, scoreMonth: score.scoreMonth, scoreTimestamp: score.scoreTimestamp, overallPressure: score.overallPressure!, regime: score.regime!, vectors: JSON.parse(score.vectorScoresJson) as Record<string, number> }));
  const outcomeRows = await db.select({ outcome: reconstructedHistoricalOutcomes }).from(reconstructedHistoricalOutcomes).where(and(eq(reconstructedHistoricalOutcomes.outcomeStatus, "COMPLETE"), like(reconstructedHistoricalOutcomes.sourceMetadataJson, DAILY_CONFIRMED_MARKER))).orderBy(asc(reconstructedHistoricalOutcomes.id));
  const outcomes = new Map<string, Outcome>();
  for (const { outcome } of outcomeRows) {
    outcomes.set(`${outcome.reconstructedScoreId}:${outcome.horizonTradingDays}`, { scoreId: outcome.reconstructedScoreId, horizon: outcome.horizonTradingDays, forwardReturnPct: outcome.forwardReturnPct!, maximumDrawdownPct: outcome.maximumDrawdownPct!, realizedVolatilityPct: outcome.realizedVolatilityPct!, startDate: outcome.startDate, endDate: outcome.endDate! });
  }
  const dailyBars = await getDailyBarsForPeriod("^GSPC", "1999-12-01", "2026-12-31");
  if (dailyBars.length < 1_000) throw new Error(`Daily S&P 500 source insufficient for reconstructed metrics: ${dailyBars.length} bars`);
  const events = detectEquityDrawdownEvents(dailyBars);
  const eventWindows = events.map(event => ({ ...event, warningStart: twoMonthsBefore(event.startDate) }));
  const warnings = eventWindows.map(event => ({ ...event, qualifyingScores: scores.filter(score => {
    const date = score.scoreTimestamp.toISOString().slice(0, 10);
    return date >= event.warningStart && date <= event.startDate && score.overallPressure >= 45;
  }) }));
  const evaluatedEvents = warnings.filter(event => event.startDate >= scores[0]!.scoreTimestamp.toISOString().slice(0, 10) && event.startDate <= scores.at(-1)!.scoreTimestamp.toISOString().slice(0, 10));
  const missedEvents = evaluatedEvents.filter(event => event.qualifyingScores.length === 0);
  const falseAlarms = scores.filter(score => {
    if (score.overallPressure < 45) return false;
    const decisionDate = score.scoreTimestamp.toISOString().slice(0, 10);
    const endDate = tradingDayWindowEndDate(dailyBars, decisionDate, 60);
    if (!endDate) return false;
    return !events.some(event => event.startDate >= decisionDate && event.startDate <= endDate);
  });
  const eventScoreIds = new Set(warnings.flatMap(event => event.qualifyingScores.map(score => score.id)));
  const stressValues = warnings.flatMap(event => event.qualifyingScores.map(score => score.overallPressure));
  const calmValues = scores.filter(score => !eventScoreIds.has(score.id) && score.overallPressure < 45).map(score => score.overallPressure);
  const regimes = Object.fromEntries(["LOW RISK", "MODERATE RISK", "ELEVATED RISK", "HIGH STRESS", "SYSTEMIC CRISIS"].map(regime => [regime, scores.filter(score => score.regime === regime).length]));
  const buckets = Object.fromEntries(["0-24", "25-44", "45-64", "65-79", "80-100"].map(bucket => {
    const bucketScores = scores.filter(score => scoreBucket(score.overallPressure) === bucket);
    const byHorizon = Object.fromEntries([1, 5, 20, 60, 120, 252].map(horizon => {
      const values = bucketScores.map(score => outcomes.get(`${score.id}:${horizon}`)).filter((outcome): outcome is Outcome => Boolean(outcome));
      return [String(horizon), { count: values.length, meanForwardReturnPct: mean(values.map(value => value.forwardReturnPct)), meanMaximumDrawdownPct: mean(values.map(value => value.maximumDrawdownPct)), meanRealizedVolatilityPct: mean(values.map(value => value.realizedVolatilityPct)) }];
    }));
    return [bucket, { scoreCount: bucketScores.length, outcomes: byHorizon }];
  }));
  const stabilityCorrelations = scores.length >= 61 ? Array.from({ length: scores.length - 60 }, (_, index) => correlation(scores.slice(index, index + 60).map(score => score.overallPressure), scores.slice(index + 1, index + 61).map(score => score.overallPressure))).filter((value): value is number => value !== null) : [];
  const vectorCorrelations = Object.fromEntries(Object.keys(VECTOR_WEIGHTS).map(left => [left, Object.fromEntries(Object.keys(VECTOR_WEIGHTS).map(right => [right, correlation(scores.map(score => score.vectors[left] ?? 0), scores.map(score => score.vectors[right] ?? 0))]))]));
  const ablation = Object.fromEntries(Object.keys(VECTOR_WEIGHTS).map(vector => {
    const effects = scores.map(score => mechanicalAblation(score, vector).differenceFromBaseline);
    return [vector, { meanDifference: mean(effects), meanAbsoluteDifference: mean(effects.map(Math.abs)), maximumAbsoluteDifference: effects.length ? Math.max(...effects.map(Math.abs)) : null }];
  }));
  const partitions = Object.fromEntries(["development", "validation", "holdout"].map(partition => {
    const values = scores.filter(score => partitionForMonth(score.scoreMonth) === partition).map(score => score.overallPressure);
    return [partition, summarizeValues(values)];
  }));
  const legacy = await db.select().from(pressureHistory).where(and(gte(pressureHistory.month, scores[0]!.scoreMonth), lte(pressureHistory.month, scores.at(-1)!.scoreMonth))).orderBy(asc(pressureHistory.month));
  const byMonth = new Map(scores.map(score => [score.scoreMonth, score]));
  const legacyPairs = legacy.flatMap(row => {
    const reconstructed = byMonth.get(row.month);
    return reconstructed ? [{ legacy: row.overallPressure, reconstructed: reconstructed.overallPressure }] : [];
  });
  const majorPeriods: Record<string, [string, string]> = { "dot-com": ["2000-01", "2002-12"], "gfc-lead": ["2007-01", "2007-12"], "gfc": ["2008-01", "2009-03"], "euro-2011": ["2011-01", "2011-12"], "oil-2015-16": ["2015-01", "2016-12"], "q4-2018": ["2018-10", "2018-12"], "covid": ["2020-02", "2020-04"], "rates-2022": ["2022-01", "2022-12"], "ai-2023": ["2023-01", "2023-12"] };
  const majorEventScores = Object.fromEntries(Object.entries(majorPeriods).map(([name, [start, end]]) => {
    const period = scores.filter(score => score.scoreMonth >= start && score.scoreMonth <= end);
    return [name, { months: period.map(score => ({ month: score.scoreMonth, score: score.overallPressure, regime: score.regime })), maximumScore: period.length ? Math.max(...period.map(score => score.overallPressure)) : null, minimumScore: period.length ? Math.min(...period.map(score => score.overallPressure)) : null }];
  }));
  return {
    protocol: "RECONSTRUCTED_CHAMPION_V1_EVALUATION_PROTOCOL.md",
    datasetTier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY",
    scoreDistribution: summarizeValues(scores.map(score => score.overallPressure)),
    regimeDistribution: regimes,
    stressVsCalm: { stressScoreCount: stressValues.length, calmScoreCount: calmValues.length, stressMean: mean(stressValues), calmMean: mean(calmValues), difference: stressValues.length && calmValues.length ? mean(stressValues)! - mean(calmValues)! : null },
    events: { detectedDailyEvents: events.length, evaluatedEvents: evaluatedEvents.length, warnedEvents: evaluatedEvents.length - missedEvents.length, missedEvents: missedEvents.map(event => ({ startDate: event.startDate, troughDate: event.troughDate, drawdownPct: event.drawdownPct })), falseAlarmCount: falseAlarms.length, warnings: warnings.map(event => ({ startDate: event.startDate, troughDate: event.troughDate, drawdownPct: event.drawdownPct, warningScores: event.qualifyingScores.map(score => ({ month: score.scoreMonth, score: score.overallPressure })) })) },
    forwardOutcomesByBucket: buckets,
    temporalStability: { method: "mean of 60-month rolling one-month-lag score correlations", windows: stabilityCorrelations.length, meanCorrelation: mean(stabilityCorrelations), minimumCorrelation: stabilityCorrelations.length ? Math.min(...stabilityCorrelations) : null },
    vectorCorrelations,
    ablation,
    partitions,
    legacyComparison: { overlappingMonths: legacyPairs.length, scoreCorrelation: correlation(legacyPairs.map(pair => pair.legacy), legacyPairs.map(pair => pair.reconstructed)), meanDifferenceReconstructedMinusLegacy: mean(legacyPairs.map(pair => pair.reconstructed - pair.legacy)), maxAbsoluteDifference: legacyPairs.length ? Math.max(...legacyPairs.map(pair => Math.abs(pair.reconstructed - pair.legacy))) : null, interpretation: "Descriptive only; legacy history is not a calibration target." },
    majorEventScores,
    limitations: ["All extended scores are reconstructed and aggregate revised historical/proxy inputs.", "The exact high-yield spread uses an archived FRED capture subject to ICE/FRED restrictions, not ALFRED vintages.", "Pre-2018 SOFR uses the explicitly disclosed official primary-dealer repo proxy; 2018-03 remains incomplete.", "Outcomes use S&P 500 price returns only and only daily-cadence-confirmed observations.", "No result establishes a real-time historical FAULTLINE warning claim."],
  };
}
