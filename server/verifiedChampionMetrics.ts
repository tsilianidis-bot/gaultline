import { writeFile } from "node:fs/promises";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { verifiedHistoricalOutcomes, verifiedHistoricalScores } from "../drizzle/schema";
import { getDb } from "./db";
import { getDailyBars, type YahooDailyBar } from "./yahooProxy";
import {
  VERIFIED_CHAMPION_EVENT_DEFINITIONS,
  VERIFIED_CHAMPION_LOCKED_PARTITIONS,
} from "./verifiedHistoricalEventDefinitions";

type ScoreRow = {
  id: number;
  scoreMonth: string;
  scoreTimestamp: Date;
  overallPressure: number | null;
  regime: string | null;
  vectorScoresJson: string;
};

type DrawdownEvent = {
  peakDate: string;
  onsetDate: string;
  troughDate: string;
  recoveryDate: string | null;
  peakClose: number;
  troughClose: number;
  drawdownPct: number;
};

const VECTOR_WEIGHTS = {
  liquidityStress: 0.2,
  creditContagion: 0.2,
  volatilityRegime: 0.15,
  macroSensitivity: 0.2,
  marketBreadth: 0.1,
  aiBubble: 0.15,
} as const;

function toDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function pearsonCorrelation(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = mean(left)!;
  const rightMean = mean(right)!;
  const numerator = left.reduce((total, value, index) => total + ((value - leftMean) * (right[index]! - rightMean)), 0);
  const leftMagnitude = Math.sqrt(left.reduce((total, value) => total + ((value - leftMean) ** 2), 0));
  const rightMagnitude = Math.sqrt(right.reduce((total, value) => total + ((value - rightMean) ** 2), 0));
  return leftMagnitude && rightMagnitude ? numerator / (leftMagnitude * rightMagnitude) : null;
}

function pressureBucket(score: number) {
  return VERIFIED_CHAMPION_EVENT_DEFINITIONS.pressureBuckets.find(bucket => score >= bucket.min && score <= bucket.max)?.label ?? "OUT_OF_RANGE";
}

/** Implements the locked 60-trading-day, 10% peak-to-trough event rule. */
export function identifyRegisteredDrawdownEvents(bars: YahooDailyBar[]): DrawdownEvent[] {
  const ordered = [...bars].sort((left, right) => left.timestamp - right.timestamp);
  const events: DrawdownEvent[] = [];
  let active: (DrawdownEvent & { peakIndex: number }) | null = null;

  for (let index = 0; index < ordered.length; index += 1) {
    const bar = ordered[index]!;
    const lookbackStart = Math.max(0, index - VERIFIED_CHAMPION_EVENT_DEFINITIONS.equityDrawdown10Within60TradingDays.lookbackTradingDays);
    const lookback = ordered.slice(lookbackStart, index + 1);
    const peakClose = Math.max(...lookback.map(candidate => candidate.close));
    const peakIndex = lookbackStart + lookback.findIndex(candidate => candidate.close === peakClose);
    const drawdownPct = ((bar.close / peakClose) - 1) * 100;
    if (!active && drawdownPct <= VERIFIED_CHAMPION_EVENT_DEFINITIONS.equityDrawdown10Within60TradingDays.thresholdPct + 1e-10) {
      active = {
        peakDate: toDate(ordered[peakIndex]!.timestamp),
        onsetDate: toDate(bar.timestamp),
        troughDate: toDate(bar.timestamp),
        recoveryDate: null,
        peakClose,
        troughClose: bar.close,
        drawdownPct,
        peakIndex,
      };
      continue;
    }
    if (!active) continue;
    if (bar.close < active.troughClose) {
      active.troughClose = bar.close;
      active.troughDate = toDate(bar.timestamp);
      active.drawdownPct = ((active.troughClose / active.peakClose) - 1) * 100;
    }
    if (bar.close >= active.peakClose) {
      active.recoveryDate = toDate(bar.timestamp);
      const { peakIndex: _peakIndex, ...event } = active;
      events.push(event);
      active = null;
    }
  }
  if (active) {
    const { peakIndex: _peakIndex, ...event } = active;
    events.push(event);
  }
  return events;
}

export function calculateAblationScore(vectorScores: Record<keyof typeof VECTOR_WEIGHTS, number>, removedVector: keyof typeof VECTOR_WEIGHTS): number {
  const activeWeight = 1 - VECTOR_WEIGHTS[removedVector];
  return Math.round(Object.entries(VECTOR_WEIGHTS)
    .filter(([key]) => key !== removedVector)
    .reduce((total, [key, weight]) => total + (vectorScores[key as keyof typeof VECTOR_WEIGHTS] * (weight / activeWeight)), 0));
}

function decisionTradingIndex(decisionDate: string, bars: YahooDailyBar[]) {
  return bars.reduce((latestIndex, bar, index) => toDate(bar.timestamp) <= decisionDate ? index : latestIndex, -1);
}

function isEventWindow(decisionDate: string, events: DrawdownEvent[], bars: YahooDailyBar[]) {
  const scoreIndex = decisionTradingIndex(decisionDate, bars);
  if (scoreIndex < 0) return false;
  return events.some(event => {
    const onsetIndex = decisionTradingIndex(event.onsetDate, bars);
    const recoveryIndex = event.recoveryDate ? decisionTradingIndex(event.recoveryDate, bars) : bars.length - 1;
    return scoreIndex >= onsetIndex - 60 && scoreIndex <= recoveryIndex + 20;
  });
}

function summarizeScores(scores: ScoreRow[]) {
  const completeScores = scores.map(score => score.overallPressure).filter((value): value is number => value !== null);
  const scoreDistribution = Object.fromEntries(["LOW_RISK", "MODERATE_RISK", "ELEVATED_RISK", "HIGH_STRESS", "SYSTEMIC_CRISIS"].map(bucket => [bucket, 0])) as Record<string, number>;
  const regimeDistribution: Record<string, number> = {};
  for (const score of scores) {
    if (score.overallPressure !== null) scoreDistribution[pressureBucket(score.overallPressure)] += 1;
    if (score.regime) regimeDistribution[score.regime] = (regimeDistribution[score.regime] ?? 0) + 1;
  }
  return { count: completeScores.length, minimum: Math.min(...completeScores), maximum: Math.max(...completeScores), mean: mean(completeScores), scoreDistribution, regimeDistribution };
}

export async function runLockedVerifiedChampionMetrics(outputPath?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const scores = await db.select({
    id: verifiedHistoricalScores.id,
    scoreMonth: verifiedHistoricalScores.scoreMonth,
    scoreTimestamp: verifiedHistoricalScores.scoreTimestamp,
    overallPressure: verifiedHistoricalScores.overallPressure,
    regime: verifiedHistoricalScores.regime,
    vectorScoresJson: verifiedHistoricalScores.vectorScoresJson,
  }).from(verifiedHistoricalScores).where(and(
    eq(verifiedHistoricalScores.scoreStatus, "COMPLETE"),
    gte(verifiedHistoricalScores.scoreMonth, VERIFIED_CHAMPION_LOCKED_PARTITIONS.development.startMonth),
    lte(verifiedHistoricalScores.scoreMonth, VERIFIED_CHAMPION_LOCKED_PARTITIONS.holdout.endMonth),
  )).orderBy(asc(verifiedHistoricalScores.scoreTimestamp)) as ScoreRow[];
  const outcomes = await db.select().from(verifiedHistoricalOutcomes).where(inArray(verifiedHistoricalOutcomes.verifiedScoreId, scores.map(score => score.id))).orderBy(desc(verifiedHistoricalOutcomes.createdAt));
  const latestOutcomeByScoreAndHorizon = new Map<string, typeof outcomes[number]>();
  for (const outcome of outcomes) {
    const key = `${outcome.verifiedScoreId}:${outcome.horizonTradingDays}`;
    if (!latestOutcomeByScoreAndHorizon.has(key)) latestOutcomeByScoreAndHorizon.set(key, outcome);
  }
  const bars = await getDailyBars("^GSPC", "5y");
  if (!bars.length) throw new Error("Independent S&P 500 source unavailable for event evaluation");
  const allDetectedEvents = identifyRegisteredDrawdownEvents(bars);
  const firstScoreDate = scores.at(0)?.scoreTimestamp.toISOString().slice(0, 10) ?? "9999-12-31";
  const lastScoreDate = scores.at(-1)?.scoreTimestamp.toISOString().slice(0, 10) ?? "0000-01-01";
  const events = allDetectedEvents.filter(event => event.onsetDate >= firstScoreDate && event.onsetDate <= lastScoreDate);
  const scoreSummary = summarizeScores(scores);
  const eventWindowScores = scores.filter(score => isEventWindow(score.scoreTimestamp.toISOString().slice(0, 10), events, bars));
  const calmScores = scores.filter(score => !isEventWindow(score.scoreTimestamp.toISOString().slice(0, 10), events, bars));
  const scoreById = new Map(scores.map(score => [score.id, score]));
  const outcomesByBucket: Record<string, Record<string, { count: number; averageForwardReturnPct: number | null; averageMaximumDrawdownPct: number | null }>> = {};
  for (const horizon of [1, 5, 20, 60]) {
    for (const bucket of VERIFIED_CHAMPION_EVENT_DEFINITIONS.pressureBuckets.map(item => item.label)) {
      const matching = [...latestOutcomeByScoreAndHorizon.values()].filter(outcome => outcome.horizonTradingDays === horizon && outcome.outcomeStatus === "COMPLETE" && pressureBucket(scoreById.get(outcome.verifiedScoreId)!.overallPressure!) === bucket);
      outcomesByBucket[String(horizon)] ??= {};
      outcomesByBucket[String(horizon)][bucket] = {
        count: matching.length,
        averageForwardReturnPct: mean(matching.map(item => item.forwardReturnPct).filter((value): value is number => value !== null)),
        averageMaximumDrawdownPct: mean(matching.map(item => item.maximumDrawdownPct).filter((value): value is number => value !== null)),
      };
    }
  }
  const qualifyingScores = scores.filter(score => score.overallPressure !== null && score.overallPressure >= 45);
  const warningLeads = events.flatMap(event => {
    const onsetIndex = decisionTradingIndex(event.onsetDate, bars);
    const candidates = qualifyingScores.map(score => ({ score, index: decisionTradingIndex(score.scoreTimestamp.toISOString().slice(0, 10), bars) }))
      .filter(candidate => candidate.index >= onsetIndex - 60 && candidate.index < onsetIndex);
    const candidate = candidates.at(-1);
    return candidate ? [{ eventOnset: event.onsetDate, scoreMonth: candidate.score.scoreMonth, leadTradingDays: onsetIndex - candidate.index }] : [];
  });
  const falseAlarms = qualifyingScores.filter(score => {
    const scoreIndex = decisionTradingIndex(score.scoreTimestamp.toISOString().slice(0, 10), bars);
    return !events.some(event => {
      const onsetIndex = decisionTradingIndex(event.onsetDate, bars);
      return onsetIndex > scoreIndex && onsetIndex <= scoreIndex + 60;
    });
  }).map(score => score.scoreMonth);
  const missedEvents = events.filter(event => !warningLeads.some(warning => warning.eventOnset === event.onsetDate));
  const vectorNames = Object.keys(VECTOR_WEIGHTS) as Array<keyof typeof VECTOR_WEIGHTS>;
  const parsedVectors = scores.map(score => JSON.parse(score.vectorScoresJson) as Record<keyof typeof VECTOR_WEIGHTS, number>);
  const vectorCorrelations = Object.fromEntries(vectorNames.map(left => [left, Object.fromEntries(vectorNames.map(right => [right, pearsonCorrelation(parsedVectors.map(vector => vector[left]), parsedVectors.map(vector => vector[right]))]))]));
  const ablation = Object.fromEntries(vectorNames.map(removed => {
    const baseline = scores.map(score => score.overallPressure!);
    const ablated = parsedVectors.map(vector => calculateAblationScore(vector, removed));
    return [removed, { correlationToBaseline: pearsonCorrelation(baseline, ablated), meanAbsoluteDifference: mean(baseline.map((value, index) => Math.abs(value - ablated[index]!))) }];
  }));
  const partitionMetrics = Object.fromEntries(Object.entries(VERIFIED_CHAMPION_LOCKED_PARTITIONS).map(([partition, range]) => {
    const partitionScores = scores.filter(score => score.scoreMonth >= range.startMonth && score.scoreMonth <= range.endMonth);
    const completed60 = partitionScores.map(score => latestOutcomeByScoreAndHorizon.get(`${score.id}:60`)).filter((outcome): outcome is NonNullable<typeof outcome> => Boolean(outcome && outcome.outcomeStatus === "COMPLETE"));
    return [partition, {
      scoreCount: partitionScores.length,
      meanScore: mean(partitionScores.map(score => score.overallPressure!).filter(Number.isFinite)),
      completed60DayOutcomes: completed60.length,
      average60DayForwardReturnPct: mean(completed60.map(outcome => outcome.forwardReturnPct).filter((value): value is number => value !== null)),
      average60DayMaximumDrawdownPct: mean(completed60.map(outcome => outcome.maximumDrawdownPct).filter((value): value is number => value !== null)),
    }];
  }));
  const result = {
    protocolVersion: "VERIFIED_CHAMPION_V1_PROTOCOL_20260819_R2",
    verdictEligibility: "INELIGIBLE_FOR_STRONG_OR_MODERATE_VERDICT",
    limitations: [
      "Only 36 verified monthly score observations are available, from 2023-08 through 2026-07.",
      "Every score carries REVISED_HISTORICAL quality because required BAMLH0A0HYM2 data lacks acceptable ALFRED vintage evidence.",
      "The verified window does not include the requested 2000-2002, 2007-2008, 2011, 2015-2016, 2018 Q4, 2020, or 2022 events; no score is reported for those periods.",
      "VIX event evaluation is pre-registered but not evaluated because no independent VIX source has been persisted.",
      "No weight, threshold, transform, or live-model change is authorized by this report.",
    ],
    coverage: { firstScoreMonth: scores.at(0)?.scoreMonth ?? null, lastScoreMonth: scores.at(-1)?.scoreMonth ?? null, scoreCount: scores.length, outcomeRecordsLatest: latestOutcomeByScoreAndHorizon.size, sp500DailyBars: bars.length, excludedEventsOutsideScoreCoverage: allDetectedEvents.filter(event => event.onsetDate < firstScoreDate || event.onsetDate > lastScoreDate) },
    scoreSummary,
    registeredDrawdownEvents: events,
    stressVsCalm: { eventWindowCount: eventWindowScores.length, calmCount: calmScores.length, eventWindowMeanScore: mean(eventWindowScores.map(score => score.overallPressure!).filter(Number.isFinite)), calmMeanScore: mean(calmScores.map(score => score.overallPressure!).filter(Number.isFinite)) },
    outcomesByPressureBucket: outcomesByBucket,
    warning: { qualifyingScoreCount: qualifyingScores.length, leads: warningLeads, falseAlarms, missedEvents: missedEvents.map(event => ({ onsetDate: event.onsetDate, peakDate: event.peakDate, drawdownPct: event.drawdownPct })) },
    temporalStability: { lag1PearsonAutocorrelation: pearsonCorrelation(scores.slice(1).map(score => score.overallPressure!), scores.slice(0, -1).map(score => score.overallPressure!)), observationPairs: Math.max(0, scores.length - 1) },
    vectorCorrelations,
    ablation,
    walkForward: partitionMetrics,
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}
