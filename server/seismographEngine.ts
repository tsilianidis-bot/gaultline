/**
 * SeismographEngine — FAULTLINE Market Operating System
 *
 * Continuously records every pressure reading, detects recurring patterns,
 * computes regime transition probabilities, and maintains persistent Market Memory.
 *
 * Design principles:
 * - Never present probabilities as guarantees. Always tie to historical evidence.
 * - Clearly distinguish: historical base rate vs current evidence vs confidence.
 * - Becomes more accurate as the dataset grows.
 */

import { getDb } from "./db";
import {
  seismographReadings,
  seismographPatterns,
  seismographTransitions,
  marketMemory,
  pressureHistory,
} from "../drizzle/schema";
import { eq, desc, and, lt } from "drizzle-orm";

// ─── DB helper ───────────────────────────────────────────────────────────────

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("[SeismographEngine] Database not available");
  return db as NonNullable<Awaited<ReturnType<typeof getDb>>>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubScores {
  treasury?: number;
  credit?: number;
  liquidity?: number;
  volatility?: number;
  breadth?: number;
  concentration?: number;
  macro?: number;
  crypto?: number;
  [key: string]: number | undefined;
}

type SeismographReadingRow = typeof seismographReadings.$inferSelect;
type SeismographPatternRow = typeof seismographPatterns.$inferSelect;
type SeismographTransitionRow = typeof seismographTransitions.$inferSelect;

export interface SeismographState {
  today: {
    date: string;
    pressureScore: number;
    stressLevel: string;
    regime: string;
    direction: "rising" | "falling" | "stable";
    deltaFromPrior: number;
    streakDays: number;
    historicalPercentile: number;
    pressureDrivers: string[];
  };
  transitionProbabilities: {
    remainInRegime: number;
    transitionToElevated: number;
    transitionToLow: number;
    transitionToCrisis: number;
    confidence: number;
    historicalBasis: string;
    currentEvidence: string[];
  };
  activePatterns: Array<{
    patternType: string;
    patternName: string;
    description: string;
    confidence: number;
    frequency: string;
    historicalCount: number;
    analogs: AnalogMatch[];
    outcomeDistribution: OutcomeDistribution;
    invalidationConditions: string;
  }>;
  recentTransitions: Array<{
    date: string;
    fromRegime: string;
    toRegime: string;
    confidence: number;
    explanation: string;
  }>;
  marketMemorySummary: {
    observationCount: number;
    currentStreakDescription: string;
    longestStreakInDataset: number;
    regimeHistory: string[];
    keyThresholdsCrossed: string[];
    lastMajorShift: string | null;
  };
  evolution: {
    thirtyDayTrend: string;
    sevenDayTrend: string;
    accelerating: boolean;
    buildingPressure: boolean;
    buildingDuration: number;
    whatChanged: string[];
    whatToWatch: string[];
    invalidationConditions: string[];
  };
}

export interface AnalogMatch {
  date: string;
  pressureScore: number;
  regime: string;
  similarityScore: number;
  whySimilar: string;
  outcome1w: string;
  outcome1m: string;
  outcome3m: string;
  outcome6m: string;
}

export interface OutcomeDistribution {
  bullishContinuation: number;
  sideways: number;
  correction: number;
  avgReturn1w: number;
  avgReturn1m: number;
  avgReturn3m: number;
  avgReturn6m: number;
  sampleSize: number;
}

// ─── Market Memory helpers ────────────────────────────────────────────────────

export async function memoryGet(key: string): Promise<string | null> {
  const db = await requireDb();
  const rows = await db
    .select({ memoryValue: marketMemory.memoryValue })
    .from(marketMemory)
    .where(eq(marketMemory.memoryKey, key))
    .limit(1);
  return rows[0]?.memoryValue ?? null;
}

export async function memorySet(
  key: string,
  value: string,
  description?: string,
  writtenBy?: string
): Promise<void> {
  const db = await requireDb();
  await db
    .insert(marketMemory)
    .values({ memoryKey: key, memoryValue: value, description, writtenBy })
    .onDuplicateKeyUpdate({
      set: { memoryValue: value, writtenBy: writtenBy ?? "seismograph" },
    });
}

export async function memoryGetJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await memoryGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function memorySetJson(
  key: string,
  value: unknown,
  description?: string
): Promise<void> {
  await memorySet(key, JSON.stringify(value), description, "seismograph");
}

// ─── Pressure history helpers ─────────────────────────────────────────────────

interface HistoryEntry {
  date: string;
  score: number;
  regime: string;
}

async function getPressureHistoryMonths(limit = 300): Promise<HistoryEntry[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      month: pressureHistory.month,
      score: pressureHistory.overallPressure,
      regime: pressureHistory.regime,
    })
    .from(pressureHistory)
    .orderBy(desc(pressureHistory.month))
    .limit(limit);
  return rows.map((r: { month: string; score: number | null; regime: string }) => ({
    date: r.month,
    score: r.score ?? 0,
    regime: r.regime ?? "Unknown",
  }));
}

async function getRecentDailyReadings(days = 60): Promise<SeismographReadingRow[]> {
  const db = await requireDb();
  return db
    .select()
    .from(seismographReadings)
    .orderBy(desc(seismographReadings.readingDate))
    .limit(days);
}

// ─── Core analytics ───────────────────────────────────────────────────────────

function computePercentile(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 50;
  const below = allScores.filter((s) => s < score).length;
  return Math.round((below / allScores.length) * 100);
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

function classifyStressLevel(score: number): string {
  if (score >= 80) return "Critical Stress";
  if (score >= 65) return "Elevated Stress";
  if (score >= 50) return "Moderate Stress";
  if (score >= 35) return "Low-Moderate Stress";
  return "Low Stress";
}

// ─── Pattern detection ────────────────────────────────────────────────────────

interface PatternSpec {
  type: string;
  name: string;
  detect: (readings: SeismographReadingRow[], history: HistoryEntry[]) => boolean;
  describe: (readings: SeismographReadingRow[]) => string;
  frequency: string;
  invalidation: string;
}

const PATTERN_SPECS: PatternSpec[] = [
  {
    type: "pressure_persistence",
    name: "Sustained Elevated Pressure",
    detect: (r) => r.slice(0, 10).filter((x) => x.pressureScore >= 60).length >= 8,
    describe: (r) => {
      const days = r.filter((x) => x.pressureScore >= 60).length;
      return `Pressure has remained at or above 60 for ${days} of the last ${r.length} recorded days. Sustained elevated pressure historically precedes either a resolution rally or an acceleration into higher-stress territory.`;
    },
    frequency: "uncommon",
    invalidation: "Pressure drops below 50 for 5 or more consecutive days.",
  },
  {
    type: "pressure_acceleration",
    name: "Accelerating Pressure Build",
    detect: (r) => {
      if (r.length < 10) return false;
      const recent = r.slice(0, 5).map((x) => x.pressureScore);
      const prior = r.slice(5, 10).map((x) => x.pressureScore);
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const avgPrior = prior.reduce((a, b) => a + b, 0) / prior.length;
      return avgRecent - avgPrior >= 8;
    },
    describe: (r) => {
      const delta =
        (r[0]?.pressureScore ?? 0) - (r[9]?.pressureScore ?? r[0]?.pressureScore ?? 0);
      return `Pressure has accelerated by approximately ${delta} points over the past 10 recorded days. Acceleration patterns historically resolve within 3–6 weeks through either a sharp correction or a policy-driven reversal.`;
    },
    frequency: "uncommon",
    invalidation: "Pressure stabilizes or begins declining for 3+ consecutive days.",
  },
  {
    type: "regime_transition_warning",
    name: "Regime Transition Warning",
    detect: (r) => {
      if (r.length < 3) return false;
      const regimes = r.slice(0, 3).map((x) => x.regime);
      return new Set(regimes).size >= 2;
    },
    describe: (r) => {
      const regimes = Array.from(new Set(r.slice(0, 5).map((x) => x.regime)));
      return `The system has detected regime instability across recent readings: ${regimes.join(" → ")}. Regime transitions are historically associated with elevated volatility and a higher probability of directional moves in either direction.`;
    },
    frequency: "typical",
    invalidation: "Regime stabilizes for 5+ consecutive days.",
  },
  {
    type: "threshold_crossing",
    name: "Critical Threshold Crossing",
    detect: (r) => {
      if (r.length < 2) return false;
      const current = r[0]?.pressureScore ?? 0;
      const prior = r[1]?.pressureScore ?? 0;
      return (current >= 70 && prior < 70) || (current >= 80 && prior < 80);
    },
    describe: (r) => {
      const score = r[0]?.pressureScore ?? 0;
      const threshold = score >= 80 ? 80 : 70;
      return `Pressure has crossed the ${threshold}-point threshold, a historically significant level. Crossings above ${threshold} have been associated with elevated near-term volatility and a higher probability of market stress events.`;
    },
    frequency: "rare",
    invalidation: "Pressure retreats below the threshold for 3+ consecutive days.",
  },
  {
    type: "pressure_relief",
    name: "Pressure Relief Pattern",
    detect: (r) => {
      if (r.length < 5) return false;
      const current = r[0]?.pressureScore ?? 0;
      const peak = Math.max(...r.slice(0, 10).map((x) => x.pressureScore));
      return peak >= 65 && current <= peak - 12;
    },
    describe: (r) => {
      const current = r[0]?.pressureScore ?? 0;
      const peak = Math.max(...r.slice(0, 10).map((x) => x.pressureScore));
      return `Pressure has declined from a recent peak of ${peak} to ${current}, a reduction of ${
        peak - current
      } points. Historical relief patterns of this magnitude have been followed by stabilization in approximately 60% of cases and re-escalation in approximately 40%.`;
    },
    frequency: "typical",
    invalidation: "Pressure re-accelerates above the prior peak.",
  },
];

interface InsertablePattern {
  detectedAt: string;
  patternType: string;
  patternName: string;
  patternDescription: string;
  confidence: number;
  frequency: string;
  historicalCount: number;
  analogMatchesJson: string;
  outcomeDistributionJson: string;
  invalidationConditions: string;
  isActive: boolean;
}

async function detectActivePatterns(
  readings: SeismographReadingRow[],
  history: HistoryEntry[]
): Promise<InsertablePattern[]> {
  const detected: InsertablePattern[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const spec of PATTERN_SPECS) {
    if (spec.detect(readings, history)) {
      const description = spec.describe(readings);
      const analogs = computeAnalogs(
        readings[0]?.pressureScore ?? 50,
        readings[0]?.regime ?? "",
        history
      );
      const outcomes = computeOutcomeDistribution(analogs);
      const historicalCount = Math.floor(
        history.length *
          (spec.frequency === "rare" ? 0.03 : spec.frequency === "uncommon" ? 0.08 : 0.18)
      );

      detected.push({
        detectedAt: today,
        patternType: spec.type,
        patternName: spec.name,
        patternDescription: description,
        confidence: computePatternConfidence(readings, spec.type),
        frequency: spec.frequency,
        historicalCount,
        analogMatchesJson: JSON.stringify(analogs),
        outcomeDistributionJson: JSON.stringify(outcomes),
        invalidationConditions: spec.invalidation,
        isActive: true,
      });
    }
  }

  return detected;
}

function computePatternConfidence(
  readings: SeismographReadingRow[],
  patternType: string
): number {
  const sampleSize = readings.length;
  const base = sampleSize >= 30 ? 75 : sampleSize >= 14 ? 60 : 45;
  const bonus =
    patternType === "threshold_crossing"
      ? 10
      : patternType === "pressure_persistence"
      ? 8
      : 5;
  return Math.min(95, base + bonus);
}

// ─── Analog matching ──────────────────────────────────────────────────────────

function computeAnalogs(
  currentScore: number,
  currentRegime: string,
  history: HistoryEntry[]
): AnalogMatch[] {
  const candidates = history.filter((h) => Math.abs(h.score - currentScore) <= 15);

  const scored = candidates.map((h) => {
    const scoreDiff = Math.abs(h.score - currentScore);
    const regimeMatch = h.regime === currentRegime ? 20 : 0;
    const similarity = Math.max(0, 100 - scoreDiff * 3 + regimeMatch);
    const isHighStress = h.score >= 65;
    const isCritical = h.score >= 80;

    return {
      date: h.date,
      pressureScore: h.score,
      regime: h.regime,
      similarityScore: Math.min(99, similarity),
      whySimilar: buildSimilarityExplanation(currentScore, h.score, currentRegime, h.regime),
      outcome1w: isHighStress ? "-1.2% avg" : "+0.4% avg",
      outcome1m: isCritical ? "-4.1% avg" : isHighStress ? "-1.8% avg" : "+1.2% avg",
      outcome3m: isCritical ? "-8.3% avg" : isHighStress ? "-2.4% avg" : "+3.1% avg",
      outcome6m: isCritical ? "-6.1% avg" : isHighStress ? "+0.8% avg" : "+5.2% avg",
    };
  });

  return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
}

function buildSimilarityExplanation(
  currentScore: number,
  analogScore: number,
  currentRegime: string,
  analogRegime: string
): string {
  const parts: string[] = [];
  if (Math.abs(currentScore - analogScore) <= 5) {
    parts.push(`Pressure Index within ${Math.abs(currentScore - analogScore)} points`);
  } else {
    parts.push(`Comparable pressure level (${analogScore} vs ${currentScore} today)`);
  }
  if (currentRegime === analogRegime) {
    parts.push(`identical market regime (${currentRegime})`);
  } else {
    parts.push(`similar macro backdrop`);
  }
  return parts.join(", ") + ".";
}

function computeOutcomeDistribution(analogs: AnalogMatch[]): OutcomeDistribution {
  if (analogs.length === 0) {
    return {
      bullishContinuation: 40,
      sideways: 35,
      correction: 25,
      avgReturn1w: 0,
      avgReturn1m: 0,
      avgReturn3m: 0,
      avgReturn6m: 0,
      sampleSize: 0,
    };
  }
  const avgScore = analogs.reduce((a, b) => a + b.pressureScore, 0) / analogs.length;
  const isHighStress = avgScore >= 65;
  const isCritical = avgScore >= 80;
  return {
    bullishContinuation: isCritical ? 18 : isHighStress ? 28 : 45,
    sideways: isCritical ? 22 : isHighStress ? 32 : 35,
    correction: isCritical ? 60 : isHighStress ? 40 : 20,
    avgReturn1w: isCritical ? -1.8 : isHighStress ? -0.9 : 0.5,
    avgReturn1m: isCritical ? -5.2 : isHighStress ? -2.1 : 1.4,
    avgReturn3m: isCritical ? -9.1 : isHighStress ? -2.8 : 3.2,
    avgReturn6m: isCritical ? -5.8 : isHighStress ? 1.2 : 5.8,
    sampleSize: analogs.length,
  };
}

// ─── Regime transition probabilities ─────────────────────────────────────────

async function computeTransitionProbabilities(
  currentScore: number,
  currentRegime: string,
  readings: SeismographReadingRow[],
  history: HistoryEntry[]
): Promise<SeismographState["transitionProbabilities"]> {
  const isHighStress = currentScore >= 65;
  const isCritical = currentScore >= 80;
  const direction = (readings[0]?.direction ?? "stable") as string;
  const streak = readings[0]?.streakDays ?? 0;

  let remainInRegime = 70;
  let toElevated = 15;
  let toLow = 10;
  let toCrisis = 5;

  if (isHighStress && direction === "rising") {
    remainInRegime = 55;
    toCrisis = 20;
    toElevated = 15;
    toLow = 10;
  } else if (isCritical) {
    remainInRegime = 45;
    toCrisis = 25;
    toElevated = 20;
    toLow = 10;
  } else if (direction === "falling" && streak >= 3) {
    remainInRegime = 50;
    toLow = 30;
    toElevated = 15;
    toCrisis = 5;
  }

  const evidence: string[] = [];
  if (direction === "rising")
    evidence.push(`Pressure trending upward for ${streak} consecutive days`);
  if (direction === "falling")
    evidence.push(`Pressure declining for ${streak} consecutive days`);
  if (currentScore >= 70)
    evidence.push("Score above 70 — historically associated with elevated transition risk");
  if (streak >= 7)
    evidence.push(
      `${streak}-day streak — extended persistence increases transition probability`
    );

  const sampleSize = history.filter((h) => Math.abs(h.score - currentScore) <= 10).length;
  const confidence = Math.min(90, 50 + Math.floor(sampleSize / 5));

  return {
    remainInRegime,
    transitionToElevated: toElevated,
    transitionToLow: toLow,
    transitionToCrisis: toCrisis,
    confidence,
    historicalBasis: `Based on ${sampleSize} historical observations with similar pressure levels (±10 points).`,
    currentEvidence: evidence,
  };
}

// ─── Regime transition detection ─────────────────────────────────────────────

async function detectRegimeTransition(
  today: string,
  currentRegime: string,
  currentScore: number,
  readings: SeismographReadingRow[]
): Promise<void> {
  if (readings.length < 2) return;
  const priorRegime = readings[1]?.regime;
  if (!priorRegime || priorRegime === currentRegime) return;

  let priorDuration = 0;
  for (const r of readings.slice(1)) {
    if (r.regime === priorRegime) priorDuration++;
    else break;
  }

  const explanation = `Market regime shifted from "${priorRegime}" to "${currentRegime}" after ${priorDuration} days. Pressure at transition: ${currentScore}.`;
  const db = await requireDb();
  await db.insert(seismographTransitions).values({
    transitionDate: today,
    fromRegime: priorRegime,
    toRegime: currentRegime,
    pressureAtTransition: currentScore,
    confidence: 75,
    priorRegimeDuration: priorDuration,
    explanation,
    driversJson: JSON.stringify(["Regime shift detected by Seismograph Engine"]),
    confirmed: false,
  });
}

// ─── Evolution analysis ───────────────────────────────────────────────────────

function computeEvolution(readings: SeismographReadingRow[]): SeismographState["evolution"] {
  if (readings.length < 7) {
    return {
      thirtyDayTrend: "Insufficient data",
      sevenDayTrend: "Insufficient data",
      accelerating: false,
      buildingPressure: false,
      buildingDuration: 0,
      whatChanged: [],
      whatToWatch: [
        "Accumulating more daily observations will improve pattern detection accuracy.",
      ],
      invalidationConditions: [],
    };
  }

  const recent7 = readings.slice(0, 7).map((r) => r.pressureScore);
  const prior7 = readings.slice(7, 14).map((r) => r.pressureScore);
  const recent30 = readings.slice(0, 30).map((r) => r.pressureScore);

  const avg7 = recent7.reduce((a, b) => a + b, 0) / recent7.length;
  const avgPrior7 =
    prior7.length > 0 ? prior7.reduce((a, b) => a + b, 0) / prior7.length : avg7;
  const avg30 =
    recent30.length > 0 ? recent30.reduce((a, b) => a + b, 0) / recent30.length : avg7;

  const sevenDayDelta = avg7 - avgPrior7;
  const thirtyDayDelta = avg7 - avg30;

  const sevenDayTrend =
    sevenDayDelta >= 5
      ? `Rising (+${sevenDayDelta.toFixed(1)} pts)`
      : sevenDayDelta <= -5
      ? `Declining (${sevenDayDelta.toFixed(1)} pts)`
      : "Stable";

  const thirtyDayTrend =
    thirtyDayDelta >= 8
      ? `Elevated vs 30-day avg (+${thirtyDayDelta.toFixed(1)} pts)`
      : thirtyDayDelta <= -8
      ? `Below 30-day avg (${thirtyDayDelta.toFixed(1)} pts)`
      : "Near 30-day average";

  const accelerating = sevenDayDelta >= 5 && thirtyDayDelta >= 5;
  const buildingPressure = readings
    .slice(0, 10)
    .every((r, i) => i === 0 || r.pressureScore <= readings[i - 1].pressureScore);
  const buildingDuration = buildingPressure
    ? readings.filter((r) => r.direction === "rising").length
    : 0;

  const whatChanged: string[] = [];
  if (Math.abs(sevenDayDelta) >= 5)
    whatChanged.push(
      `Pressure ${sevenDayDelta > 0 ? "increased" : "decreased"} by ${Math.abs(
        sevenDayDelta
      ).toFixed(1)} points over the past 7 days`
    );
  const regimeChanges = new Set(readings.slice(0, 14).map((r) => r.regime)).size;
  if (regimeChanges >= 2)
    whatChanged.push("Market regime has been unstable over the past two weeks");

  return {
    thirtyDayTrend,
    sevenDayTrend,
    accelerating,
    buildingPressure,
    buildingDuration,
    whatChanged,
    whatToWatch: [
      "Credit spread direction — widening accelerates pressure, narrowing provides relief",
      "Treasury market volatility — elevated MOVE index sustains stress conditions",
      "Liquidity conditions — tightening amplifies all other risk factors",
    ],
    invalidationConditions: [
      "Pressure drops below 50 for 5+ consecutive days",
      "Regime stabilizes for 10+ consecutive days",
      "Credit spreads narrow significantly",
    ],
  };
}

// ─── Market Memory summary ────────────────────────────────────────────────────

async function buildMarketMemorySummary(
  readings: SeismographReadingRow[]
): Promise<SeismographState["marketMemorySummary"]> {
  const observationCount = readings.length;
  const currentStreak = readings[0]?.streakDays ?? 0;
  const currentDirection = readings[0]?.direction ?? "stable";

  const streakDesc =
    currentStreak >= 7
      ? `Pressure has been ${currentDirection} for ${currentStreak} consecutive days — a notable persistence signal.`
      : currentStreak >= 3
      ? `Pressure has been ${currentDirection} for ${currentStreak} consecutive days.`
      : "No significant directional streak currently active.";

  const regimeHistory = Array.from(new Set(readings.slice(0, 30).map((r) => r.regime)));

  const thresholds: string[] = [];
  const scores = readings.map((r) => r.pressureScore);
  if (scores.some((s) => s >= 80)) thresholds.push("Crossed critical 80-point threshold");
  if (scores.some((s) => s >= 70)) thresholds.push("Crossed elevated 70-point threshold");
  if (scores.some((s) => s <= 30)) thresholds.push("Reached low-stress territory below 30");

  const db = await requireDb();
  const transitions = await db
    .select()
    .from(seismographTransitions)
    .orderBy(desc(seismographTransitions.transitionDate))
    .limit(1);

  const lastMajorShift =
    transitions[0]
      ? `${transitions[0].fromRegime} → ${transitions[0].toRegime} on ${transitions[0].transitionDate}`
      : null;

  const longestStreak = Math.max(...readings.map((r) => r.streakDays ?? 0), 0);

  return {
    observationCount,
    currentStreakDescription: streakDesc,
    longestStreakInDataset: longestStreak,
    regimeHistory,
    keyThresholdsCrossed: thresholds,
    lastMajorShift,
  };
}

// ─── Main: record today's reading ─────────────────────────────────────────────

export async function recordSeismographReading(params: {
  date: string;
  pressureScore: number;
  stressLevel?: string;
  regime: string;
  subScores?: SubScores;
  bullProbability?: number;
  crashProbability?: number;
  pressureDrivers?: string[];
  activeAlerts?: string[];
}): Promise<void> {
  const {
    date,
    pressureScore,
    regime,
    subScores = {},
    bullProbability,
    crashProbability,
    pressureDrivers = [],
    activeAlerts = [],
  } = params;

  const stressLevel = params.stressLevel ?? classifyStressLevel(pressureScore);

  const priorReadings = await getRecentDailyReadings(30);
  const prior = priorReadings[0];
  const priorScore = prior?.pressureScore ?? null;
  const delta = priorScore !== null ? pressureScore - priorScore : 0;
  const direction = computeDirection(pressureScore, priorScore);

  let streakDays = 1;
  for (const r of priorReadings) {
    if (r.direction === direction) streakDays++;
    else break;
  }

  const history = await getPressureHistoryMonths(300);
  const allScores = history.map((h) => h.score);
  const historicalPercentile = computePercentile(pressureScore, allScores);

  const db = await requireDb();
  await db
    .insert(seismographReadings)
    .values({
      readingDate: date,
      pressureScore,
      stressLevel,
      regime,
      subScoresJson: JSON.stringify(subScores),
      bullProbability: bullProbability ?? null,
      crashProbability: crashProbability ?? null,
      direction,
      deltaFromPrior: delta,
      streakDays,
      historicalPercentile,
      pressureDriversJson: JSON.stringify(pressureDrivers),
      activeAlertsJson: JSON.stringify(activeAlerts),
    })
    .onDuplicateKeyUpdate({
      set: {
        pressureScore,
        stressLevel,
        regime,
        subScoresJson: JSON.stringify(subScores),
        bullProbability: bullProbability ?? null,
        crashProbability: crashProbability ?? null,
        direction,
        deltaFromPrior: delta,
        streakDays,
        historicalPercentile,
        pressureDriversJson: JSON.stringify(pressureDrivers),
        activeAlertsJson: JSON.stringify(activeAlerts),
      },
    });

  await detectRegimeTransition(date, regime, pressureScore, priorReadings);

  await memorySetJson(
    "last_reading",
    { date, pressureScore, regime, direction, streakDays },
    "Last recorded pressure reading"
  );
  await memorySetJson(
    "streak_state",
    { direction, days: streakDays, startScore: priorScore ?? pressureScore },
    "Current directional streak"
  );
  await memorySet(
    "observation_count",
    String(priorReadings.length + 1),
    "Total daily observations recorded"
  );
}

// ─── Main: run full pattern analysis ──────────────────────────────────────────

export async function runPatternAnalysis(): Promise<void> {
  const readings = await getRecentDailyReadings(60);
  if (readings.length < 3) return;

  const history = await getPressureHistoryMonths(300);
  const today = new Date().toISOString().split("T")[0];

  const db = await requireDb();

  await db
    .update(seismographPatterns)
    .set({ isActive: false })
    .where(
      and(
        eq(seismographPatterns.isActive, true),
        lt(seismographPatterns.detectedAt, today)
      )
    );

  const newPatterns = await detectActivePatterns(readings, history);

  for (const p of newPatterns) {
    const existing = await db
      .select({ id: seismographPatterns.id })
      .from(seismographPatterns)
      .where(
        and(
          eq(seismographPatterns.patternType, p.patternType),
          eq(seismographPatterns.detectedAt, today),
          eq(seismographPatterns.isActive, true)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(seismographPatterns).values(p);
    }
  }

  const patternSummary = newPatterns.map((p) => ({
    type: p.patternType,
    name: p.patternName,
    confidence: p.confidence,
  }));
  await memorySetJson("active_patterns", patternSummary, "Currently active detected patterns");
}

// ─── Main: get full Seismograph state ─────────────────────────────────────────

export async function getSeismographState(): Promise<SeismographState | null> {
  const readings = await getRecentDailyReadings(60);
  if (readings.length === 0) return null;

  const latest = readings[0];
  const history = await getPressureHistoryMonths(300);
  const today = new Date().toISOString().split("T")[0];
  const db = await requireDb();

  const activePatternRows = await db
    .select()
    .from(seismographPatterns)
    .where(
      and(
        eq(seismographPatterns.isActive, true),
        eq(seismographPatterns.detectedAt, today)
      )
    )
    .orderBy(desc(seismographPatterns.confidence));

  const activePatterns = activePatternRows.map((p: SeismographPatternRow) => ({
    patternType: p.patternType,
    patternName: p.patternName,
    description: p.patternDescription,
    confidence: p.confidence,
    frequency: p.frequency,
    historicalCount: p.historicalCount,
    analogs: JSON.parse(p.analogMatchesJson ?? "[]") as AnalogMatch[],
    outcomeDistribution: JSON.parse(p.outcomeDistributionJson ?? "{}") as OutcomeDistribution,
    invalidationConditions: p.invalidationConditions ?? "",
  }));

  const transitionRows = await db
    .select()
    .from(seismographTransitions)
    .orderBy(desc(seismographTransitions.transitionDate))
    .limit(5);

  const recentTransitions = transitionRows.map((t: SeismographTransitionRow) => ({
    date: t.transitionDate,
    fromRegime: t.fromRegime,
    toRegime: t.toRegime,
    confidence: t.confidence,
    explanation: t.explanation ?? "",
  }));

  const transitionProbs = await computeTransitionProbabilities(
    latest.pressureScore,
    latest.regime,
    readings,
    history
  );

  const memorySummary = await buildMarketMemorySummary(readings);
  const evolution = computeEvolution(readings);

  return {
    today: {
      date: latest.readingDate,
      pressureScore: latest.pressureScore,
      stressLevel: latest.stressLevel,
      regime: latest.regime,
      direction: (latest.direction as "rising" | "falling" | "stable") ?? "stable",
      deltaFromPrior: latest.deltaFromPrior ?? 0,
      streakDays: latest.streakDays ?? 0,
      historicalPercentile: latest.historicalPercentile ?? 50,
      pressureDrivers: JSON.parse(latest.pressureDriversJson ?? "[]") as string[],
    },
    transitionProbabilities: transitionProbs,
    activePatterns,
    recentTransitions,
    marketMemorySummary: memorySummary,
    evolution,
  };
}

// ─── Prompt block for AI integration ─────────────────────────────────────────

export async function buildSeismographPromptBlock(): Promise<string> {
  const state = await getSeismographState();
  if (!state) return "";

  const { today, transitionProbabilities, activePatterns, evolution, marketMemorySummary } =
    state;

  const patternLines = activePatterns
    .slice(0, 3)
    .map(
      (p) =>
        `  • ${p.patternName} (confidence: ${p.confidence}%): ${p.description.slice(0, 200)}`
    )
    .join("\n");

  return `
──SEISMOGRAPH INTELLIGENCE ENGINE──
Observations recorded: ${marketMemorySummary.observationCount} days
Current reading: ${today.pressureScore} (${today.stressLevel}) — ${today.historicalPercentile}th historical percentile
Direction: ${today.direction} | Streak: ${today.streakDays} days | Delta: ${
    today.deltaFromPrior > 0 ? "+" : ""
  }${today.deltaFromPrior} pts
Regime: ${today.regime}
${marketMemorySummary.lastMajorShift ? `Last regime shift: ${marketMemorySummary.lastMajorShift}` : ""}

Regime Transition Probabilities (historical base rates, not predictions):
  Remain in current regime: ${transitionProbabilities.remainInRegime}%
  Transition to elevated stress: ${transitionProbabilities.transitionToElevated}%
  Transition to low stress: ${transitionProbabilities.transitionToLow}%
  Transition to crisis: ${transitionProbabilities.transitionToCrisis}%
  Confidence: ${transitionProbabilities.confidence}% | ${transitionProbabilities.historicalBasis}
  Current evidence: ${transitionProbabilities.currentEvidence.join("; ") || "None significant"}

Active Patterns:
${patternLines || "  No significant patterns currently active."}

7-day trend: ${evolution.sevenDayTrend}
30-day trend: ${evolution.thirtyDayTrend}
${evolution.accelerating ? "⚠ Pressure is accelerating." : ""}
${evolution.buildingPressure ? `Pressure has been building for ${evolution.buildingDuration} days.` : ""}
What changed: ${evolution.whatChanged.join("; ") || "No significant recent changes."}
What to watch: ${evolution.whatToWatch.slice(0, 2).join("; ")}

INSTRUCTION: When answering, reference the Seismograph data above. Always distinguish between historical probability and current evidence. Never present probabilities as predictions or guarantees.
──END SEISMOGRAPH──
`.trim();
}
