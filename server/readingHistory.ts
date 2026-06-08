/**
 * FAULTLINE Reading History + Outcome Support Engine
 *
 * Stores one official system-wide reading snapshot per calendar day.
 * Provides helpers for Today / Week / Month / Year analysis and
 * the Outcome Support Engine (scenario support scoring).
 *
 * Rules:
 * - No personal user data
 * - No trade recommendations
 * - No buy/sell/hold instructions
 * - No predictions
 * - Scenario-based language only
 * - All data clearly labelled: live | fallback | stale | demo | ai-generated
 */

import { getDb } from "./db";
import { dailyReadingSnapshots } from "../drizzle/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { calculateFaultlinePressure, type FaultlinePressureOutput } from "./pressure/engine";
import { getDiagnosticReport } from "./diagnosticAI";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SnapshotDriver {
  name: string;
  score: number;
  trend: string;
}

export interface SnapshotAlert {
  level: string;
  message: string;
}

export interface DataStatus {
  source: "live" | "fallback" | "stale" | "demo";
  label: string;
  note?: string;
}

export interface ScenarioSupport {
  scenario: "bullish_continuation" | "neutral_sideways" | "bearish_risk_off" | "systemic_stress";
  label: string;
  supportScore: number; // 0–100
  confidence: "Low" | "Moderate" | "Elevated" | "High";
  supportingEvidence: string[];
  weakeningEvidence: string[];
  confirmationSignals: string[];
  invalidatingSignals: string[];
  watchNext: string[];
}

export interface DailySnapshot {
  id: number;
  readingDate: string;
  faultlineScore: number;
  stressLevel: string;
  regime: string;
  crashProbability: number | null;
  bullProbability: number | null;
  pressureDrivers: SnapshotDriver[];
  activeAlerts: SnapshotAlert[];
  topSignals: string[];
  dataStatus: DataStatus;
  readingSummary: string | null;
  possibleOutcomes: string[];
  scenarioSupport: ScenarioSupport[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeframeReading {
  timeframe: "today" | "week" | "month" | "year";
  label: string;
  available: boolean;
  /** null when not enough data */
  scoreStart: number | null;
  scoreEnd: number | null;
  scoreDelta: number | null;
  direction: "improving" | "stable" | "deteriorating" | "unknown";
  directionLabel: string;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  regimeChanges: string[];
  mainDriver: string | null;
  mostSupportedScenario: string | null;
  watchNext: string[];
  dataNote: string | null;
  snapshots: DailySnapshot[];
}

export interface OutcomeSupportResult {
  scenarios: ScenarioSupport[];
  generatedAt: string;
  dataSource: "live" | "fallback" | "demo";
  disclaimer: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysAgoDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function rowToSnapshot(row: typeof dailyReadingSnapshots.$inferSelect): DailySnapshot {
  return {
    id: row.id,
    readingDate: row.readingDate,
    faultlineScore: row.faultlineScore,
    stressLevel: row.stressLevel,
    regime: row.regime,
    crashProbability: row.crashProbability ?? null,
    bullProbability: row.bullProbability ?? null,
    pressureDrivers: parseJson<SnapshotDriver[]>(row.pressureDriversJson, []),
    activeAlerts: parseJson<SnapshotAlert[]>(row.activeAlertsJson, []),
    topSignals: parseJson<string[]>(row.topSignalsJson, []),
    dataStatus: parseJson<DataStatus>(row.dataStatusJson, { source: "fallback", label: "Fallback data" }),
    readingSummary: row.readingSummary ?? null,
    possibleOutcomes: parseJson<string[]>(row.possibleOutcomesJson, []),
    scenarioSupport: parseJson<ScenarioSupport[]>(row.scenarioSupportJson, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Compute scenario support scores from a live engine output */
function computeScenarioSupport(
  pressure: FaultlinePressureOutput,
  crashScore: number | null,
  bullScore: number | null,
): ScenarioSupport[] {
  const p = pressure.overallPressure;
  const regime = pressure.regime;
  const dataSource = pressure.dataSource;
  const topDrivers = pressure.vectors
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(v => v.driver);

  // Direction from vectors trend
  const improvingCount = pressure.vectors.filter(v => v.trend === "falling").length; // falling pressure = improving conditions
  const deterioratingCount = pressure.vectors.filter(v => v.trend === "rising").length; // rising pressure = deteriorating conditions
  const trendDir = improvingCount > deterioratingCount ? "improving"
    : deterioratingCount > improvingCount ? "deteriorating" : "stable";

  const dataNote = dataSource === "fallback"
    ? "Based on fallback data — live data unavailable at time of calculation."
    : undefined;

  // ── Bullish Continuation ──────────────────────────────────────────────────
  // High support when pressure is low and improving
  let bullishSupport = Math.max(0, 100 - p);
  if (trendDir === "improving") bullishSupport = Math.min(100, bullishSupport + 10);
  if (trendDir === "deteriorating") bullishSupport = Math.max(0, bullishSupport - 15);
  if (bullScore !== null) bullishSupport = Math.round((bullishSupport + bullScore) / 2);
  bullishSupport = Math.round(bullishSupport);

  // ── Neutral / Sideways ────────────────────────────────────────────────────
  // High support when pressure is mid-range (25–55) and stable
  const midRange = p >= 25 && p <= 55;
  let neutralSupport = midRange ? 70 : Math.max(20, 70 - Math.abs(p - 40));
  if (trendDir === "stable") neutralSupport = Math.min(100, neutralSupport + 10);
  neutralSupport = Math.round(neutralSupport);

  // ── Bearish / Risk-Off ────────────────────────────────────────────────────
  // High support when pressure is elevated and deteriorating
  let bearishSupport = Math.round(p * 0.8);
  if (trendDir === "deteriorating") bearishSupport = Math.min(100, bearishSupport + 15);
  if (trendDir === "improving") bearishSupport = Math.max(0, bearishSupport - 10);
  bearishSupport = Math.round(bearishSupport);

  // ── Systemic Stress ───────────────────────────────────────────────────────
  // High support only when pressure is very high (65+)
  let systemicSupport = p >= 65 ? Math.round((p - 65) * 2.5) : 0;
  if (crashScore !== null && crashScore > 60) systemicSupport = Math.min(100, systemicSupport + 20);
  systemicSupport = Math.round(Math.min(100, systemicSupport));

  function confidenceLabel(score: number): "Low" | "Moderate" | "Elevated" | "High" {
    if (score >= 75) return "High";
    if (score >= 55) return "Elevated";
    if (score >= 35) return "Moderate";
    return "Low";
  }

  const regimeLower = regime.toLowerCase();

  const scenarios: ScenarioSupport[] = [
    {
      scenario: "bullish_continuation",
      label: "Bullish Continuation",
      supportScore: bullishSupport,
      confidence: confidenceLabel(bullishSupport),
      supportingEvidence: [
        p < 35 ? `Pressure index at ${p} — below elevated threshold` : `Pressure index at ${p}`,
        trendDir === "improving" ? "Pressure trend is improving" : `Pressure trend is ${trendDir}`,
        bullScore !== null ? `Bull continuation score: ${bullScore}/100` : "Diagnostic data unavailable",
      ].filter(Boolean),
      weakeningEvidence: [
        p >= 45 ? `Pressure at ${p} — elevated conditions present` : null,
        trendDir === "deteriorating" ? "Pressure trend is deteriorating" : null,
        pressure.alerts.length > 2 ? `${pressure.alerts.length} active alerts` : null,
      ].filter((x): x is string => x !== null),
      confirmationSignals: [
        "Pressure index falls below 35",
        "Regime shifts to LOW RISK or MODERATE RISK",
        "Alert count drops to 0–1",
      ],
      invalidatingSignals: [
        "Pressure index rises above 55",
        "Credit or liquidity stress increases",
        "Regime shifts to HIGH STRESS or SYSTEMIC CRISIS",
      ],
      watchNext: [
        "Credit spread direction",
        "Liquidity stress trend",
        topDrivers[0] ? `${topDrivers[0]} — top driver` : "Top pressure driver",
      ],
    },
    {
      scenario: "neutral_sideways",
      label: "Neutral / Sideways",
      supportScore: neutralSupport,
      confidence: confidenceLabel(neutralSupport),
      supportingEvidence: [
        midRange ? `Pressure at ${p} — mid-range conditions` : `Pressure at ${p}`,
        trendDir === "stable" ? "Pressure trend is stable" : `Pressure trend is ${trendDir}`,
      ],
      weakeningEvidence: [
        p < 20 ? "Low pressure may support risk-on conditions" : null,
        p > 60 ? "High pressure may push toward risk-off" : null,
        trendDir !== "stable" ? `Trend is ${trendDir} — not stable` : null,
      ].filter((x): x is string => x !== null),
      confirmationSignals: [
        "Pressure remains in 25–55 range",
        "No new regime shifts",
        "Alert count stays at 1–3",
      ],
      invalidatingSignals: [
        "Pressure breaks decisively above 60 or below 20",
        "Major regime change",
        "Spike in volatility or credit stress",
      ],
      watchNext: [
        "Whether pressure stays range-bound",
        "Regime stability",
        "Signal alignment across sectors",
      ],
    },
    {
      scenario: "bearish_risk_off",
      label: "Bearish / Risk-Off",
      supportScore: bearishSupport,
      confidence: confidenceLabel(bearishSupport),
      supportingEvidence: [
        p >= 45 ? `Pressure at ${p} — elevated or above` : `Pressure at ${p}`,
        trendDir === "deteriorating" ? "Pressure trend is deteriorating" : `Trend is ${trendDir}`,
        pressure.alerts.length > 0 ? `${pressure.alerts.length} active alert(s)` : "No active alerts",
      ],
      weakeningEvidence: [
        p < 35 ? "Low pressure reduces risk-off support" : null,
        trendDir === "improving" ? "Improving trend reduces risk-off support" : null,
      ].filter((x): x is string => x !== null),
      confirmationSignals: [
        "Pressure rises above 55",
        "Credit or liquidity stress increases",
        "Regime shifts to HIGH STRESS",
        topDrivers[0] ? `${topDrivers[0]} worsens` : "Top driver worsens",
      ],
      invalidatingSignals: [
        "Pressure falls below 35",
        "Regime shifts to LOW RISK",
        "Alert count drops to 0",
      ],
      watchNext: [
        "Credit spread direction",
        "Volatility regime",
        topDrivers[1] ? `${topDrivers[1]}` : "Secondary pressure driver",
      ],
    },
    {
      scenario: "systemic_stress",
      label: "Systemic Stress",
      supportScore: systemicSupport,
      confidence: confidenceLabel(systemicSupport),
      supportingEvidence: [
        p >= 65 ? `Pressure at ${p} — high or critical range` : `Pressure at ${p} — below systemic threshold`,
        regimeLower.includes("high stress") || regimeLower.includes("systemic") ? `Regime: ${regime}` : null,
        crashScore !== null && crashScore > 60 ? `Crash risk score: ${crashScore}/100` : null,
      ].filter((x): x is string => x !== null),
      weakeningEvidence: [
        p < 65 ? `Pressure at ${p} — below systemic stress threshold (65)` : null,
        crashScore !== null && crashScore < 40 ? `Crash risk score low: ${crashScore}/100` : null,
      ].filter((x): x is string => x !== null),
      confirmationSignals: [
        "Pressure rises above 75",
        "Regime shifts to SYSTEMIC CRISIS",
        "Multiple simultaneous alerts across credit, liquidity, and volatility",
        "Crash risk score exceeds 70",
      ],
      invalidatingSignals: [
        "Pressure falls below 55",
        "Credit spreads stabilize",
        "Liquidity conditions improve",
        "Alert count drops significantly",
      ],
      watchNext: [
        "Credit contagion signals",
        "Liquidity stress indicators",
        "Volatility regime",
        crashScore !== null ? `Crash risk score trend (currently ${crashScore})` : "Crash risk score",
      ],
    },
  ];

  // Attach data note to all scenarios if fallback
  if (dataNote) {
    return scenarios.map(s => ({
      ...s,
      supportingEvidence: [...s.supportingEvidence, `Data note: ${dataNote}`],
    }));
  }

  return scenarios;
}

/** Determine direction label from score delta */
function scoreDeltaToDirection(delta: number | null): {
  direction: "improving" | "stable" | "deteriorating" | "unknown";
  directionLabel: string;
} {
  if (delta === null) return { direction: "unknown", directionLabel: "Unknown" };
  if (delta <= -5) return { direction: "improving", directionLabel: "Improving" };
  if (delta >= 5) return { direction: "deteriorating", directionLabel: "Deteriorating" };
  return { direction: "stable", directionLabel: "Stable" };
}

// ── DB Helpers ─────────────────────────────────────────────────────────────────

export async function getTodaySnapshot(): Promise<DailySnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select()
    .from(dailyReadingSnapshots)
    .where(eq(dailyReadingSnapshots.readingDate, todayDateStr()))
    .limit(1);
  return rows[0] ? rowToSnapshot(rows[0]) : null;
}

export async function hasTodaySnapshot(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: dailyReadingSnapshots.id })
    .from(dailyReadingSnapshots)
    .where(eq(dailyReadingSnapshots.readingDate, todayDateStr()))
    .limit(1);
  return rows.length > 0;
}

export async function getSnapshotRange(fromDate: string, toDate: string): Promise<DailySnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(dailyReadingSnapshots)
    .where(and(
      gte(dailyReadingSnapshots.readingDate, fromDate),
      lte(dailyReadingSnapshots.readingDate, toDate),
    ))
    .orderBy(desc(dailyReadingSnapshots.readingDate));
  return rows.map(rowToSnapshot);
}

export async function getLatestSnapshot(): Promise<DailySnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select()
    .from(dailyReadingSnapshots)
    .orderBy(desc(dailyReadingSnapshots.readingDate))
    .limit(1);
  return rows[0] ? rowToSnapshot(rows[0]) : null;
}

export async function getAllSnapshots(limit = 400): Promise<DailySnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(dailyReadingSnapshots)
    .orderBy(desc(dailyReadingSnapshots.readingDate))
    .limit(limit);
  return rows.map(rowToSnapshot);
}

/** Upsert today's snapshot from live engine output */
export async function upsertTodaySnapshot(
  pressure: FaultlinePressureOutput,
  crashScore: number | null,
  bullScore: number | null,
  readingSummary: string | null,
): Promise<DailySnapshot> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const today = todayDateStr();
  const scenarios = computeScenarioSupport(pressure, crashScore, bullScore);
  const topDrivers = pressure.vectors
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(v => ({ name: v.driver, score: v.score, trend: v.trend }));

  const dataStatus: DataStatus = {
    source: pressure.dataSource === "live" ? "live" : "fallback",
    label: pressure.dataSource === "live" ? "Live data" : "Fallback data",
    note: pressure.dataSource === "fallback"
      ? "FRED live data unavailable — using cached/fallback values."
      : undefined,
  };

  const row = {
    readingDate: today,
    faultlineScore: Math.round(pressure.overallPressure),
    stressLevel: pressure.level,
    regime: pressure.regime,
    crashProbability: crashScore !== null ? Math.round(crashScore) : null,
    bullProbability: bullScore !== null ? Math.round(bullScore) : null,
    pressureDriversJson: JSON.stringify(topDrivers),
    activeAlertsJson: JSON.stringify(pressure.alerts.map(a => ({ level: a.severity, message: a.title + " — " + a.detail }))),
    topSignalsJson: JSON.stringify([]),
    dataStatusJson: JSON.stringify(dataStatus),
    readingSummary: readingSummary ?? null,
    possibleOutcomesJson: JSON.stringify([]),
    scenarioSupportJson: JSON.stringify(scenarios),
  };

  // Check if today's snapshot already exists
  const existing = await db.select({ id: dailyReadingSnapshots.id })
    .from(dailyReadingSnapshots)
    .where(eq(dailyReadingSnapshots.readingDate, today))
    .limit(1);

  if (existing.length > 0) {
    await db.update(dailyReadingSnapshots)
      .set(row)
      .where(eq(dailyReadingSnapshots.readingDate, today));
  } else {
    await db.insert(dailyReadingSnapshots).values(row);
  }

  const updated = await getTodaySnapshot();
  if (!updated) throw new Error("Failed to retrieve snapshot after upsert");
  return updated;
}

// ── Timeframe Analysis ─────────────────────────────────────────────────────────

export async function getTimeframeReading(
  timeframe: "today" | "week" | "month" | "year",
  currentSnapshot: DailySnapshot | null,
): Promise<TimeframeReading> {
  const daysMap = { today: 0, week: 7, month: 30, year: 365 };
  const labelMap = { today: "Today", week: "This Week", month: "This Month", year: "This Year" };
  const days = daysMap[timeframe];
  const label = labelMap[timeframe];

  if (timeframe === "today") {
    if (!currentSnapshot) {
      return {
        timeframe,
        label,
        available: false,
        scoreStart: null,
        scoreEnd: null,
        scoreDelta: null,
        direction: "unknown",
        directionLabel: "Unknown",
        averageScore: null,
        highestScore: null,
        lowestScore: null,
        regimeChanges: [],
        mainDriver: null,
        mostSupportedScenario: null,
        watchNext: [],
        dataNote: "No snapshot available for today. Generate today's snapshot to see the current reading.",
        snapshots: [],
      };
    }
    const topScenario = currentSnapshot.scenarioSupport
      .sort((a, b) => b.supportScore - a.supportScore)[0];
    const topDriver = currentSnapshot.pressureDrivers[0]?.name ?? null;
    return {
      timeframe,
      label,
      available: true,
      scoreStart: currentSnapshot.faultlineScore,
      scoreEnd: currentSnapshot.faultlineScore,
      scoreDelta: 0,
      direction: "stable",
      directionLabel: "Current reading",
      averageScore: currentSnapshot.faultlineScore,
      highestScore: currentSnapshot.faultlineScore,
      lowestScore: currentSnapshot.faultlineScore,
      regimeChanges: [],
      mainDriver: topDriver,
      mostSupportedScenario: topScenario?.label ?? null,
      watchNext: topScenario?.watchNext ?? [],
      dataNote: currentSnapshot.dataStatus.source !== "live"
        ? `Data note: ${currentSnapshot.dataStatus.label}`
        : null,
      snapshots: [currentSnapshot],
    };
  }

  // For week/month/year: fetch historical snapshots
  const fromDate = daysAgoDateStr(days);
  const toDate = todayDateStr();
  const snapshots = await getSnapshotRange(fromDate, toDate);

  if (snapshots.length < 2) {
    const dataNote = snapshots.length === 0
      ? `No historical snapshots available for this timeframe. Generate daily snapshots to build reading history.`
      : `Only ${snapshots.length} snapshot(s) available. More data will accumulate as daily snapshots are generated.`;

    // Still show current reading if available
    const current = snapshots[0] ?? currentSnapshot;
    return {
      timeframe,
      label,
      available: snapshots.length > 0,
      scoreStart: current?.faultlineScore ?? null,
      scoreEnd: current?.faultlineScore ?? null,
      scoreDelta: null,
      direction: "unknown",
      directionLabel: "Insufficient history",
      averageScore: current?.faultlineScore ?? null,
      highestScore: current?.faultlineScore ?? null,
      lowestScore: current?.faultlineScore ?? null,
      regimeChanges: [],
      mainDriver: current?.pressureDrivers[0]?.name ?? null,
      mostSupportedScenario: null,
      watchNext: [],
      dataNote,
      snapshots: snapshots,
    };
  }

  // Oldest first for delta calculation
  const sorted = [...snapshots].sort((a, b) => a.readingDate.localeCompare(b.readingDate));
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const scoreDelta = newest.faultlineScore - oldest.faultlineScore;
  const { direction, directionLabel } = scoreDeltaToDirection(scoreDelta);

  const scores = sorted.map(s => s.faultlineScore);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);

  // Regime changes
  const regimes = sorted.map(s => s.regime);
  const regimeChanges: string[] = [];
  for (let i = 1; i < regimes.length; i++) {
    if (regimes[i] !== regimes[i - 1]) {
      regimeChanges.push(`${regimes[i - 1]} → ${regimes[i]} (${sorted[i].readingDate})`);
    }
  }

  // Most common driver across snapshots
  const driverCounts: Record<string, number> = {};
  for (const snap of sorted) {
    for (const d of snap.pressureDrivers.slice(0, 2)) {
      driverCounts[d.name] = (driverCounts[d.name] ?? 0) + 1;
    }
  }
  const mainDriver = Object.entries(driverCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Most supported scenario from latest snapshot
  const latestScenarios = newest.scenarioSupport;
  const topScenario = latestScenarios.sort((a, b) => b.supportScore - a.supportScore)[0];

  // Watch next from top scenario
  const watchNext = topScenario?.watchNext ?? [];

  // Data note if any snapshot used fallback
  const hasFallback = sorted.some(s => s.dataStatus.source !== "live");
  const dataNote = hasFallback
    ? "Some readings in this timeframe used fallback data. Live data was unavailable at those times."
    : null;

  return {
    timeframe,
    label,
    available: true,
    scoreStart: oldest.faultlineScore,
    scoreEnd: newest.faultlineScore,
    scoreDelta,
    direction,
    directionLabel,
    averageScore,
    highestScore,
    lowestScore,
    regimeChanges,
    mainDriver,
    mostSupportedScenario: topScenario?.label ?? null,
    watchNext,
    dataNote,
    snapshots: sorted,
  };
}

// ── Outcome Support Engine ─────────────────────────────────────────────────────

export async function computeOutcomeSupport(): Promise<OutcomeSupportResult> {
  const pressure = await calculateFaultlinePressure();
  let crashScore: number | null = null;
  let bullScore: number | null = null;

  try {
    const diag = await getDiagnosticReport("today");
    crashScore = diag.crashRisk.score;
    bullScore = diag.bullContinuation.score;
  } catch {
    // Diagnostic unavailable — proceed without it
  }

  const scenarios = computeScenarioSupport(pressure, crashScore, bullScore);

  return {
    scenarios,
    generatedAt: new Date().toISOString(),
    dataSource: pressure.dataSource,
    disclaimer: "Outcome support reflects how current and historical FAULTLINE readings align with possible market scenarios. It is not a prediction, guarantee, or personalized financial advice.",
  };
}

// ── Summary ────────────────────────────────────────────────────────────────────

export interface ReadingHistorySummary {
  totalSnapshots: number;
  oldestDate: string | null;
  newestDate: string | null;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  elevatedDays: number;
  highDays: number;
  criticalDays: number;
  mostFrequentRegime: string | null;
}

export async function getReadingHistorySummary(): Promise<ReadingHistorySummary> {
  const snapshots = await getAllSnapshots(400);
  if (snapshots.length === 0) {
    return {
      totalSnapshots: 0,
      oldestDate: null,
      newestDate: null,
      averageScore: null,
      highestScore: null,
      lowestScore: null,
      elevatedDays: 0,
      highDays: 0,
      criticalDays: 0,
      mostFrequentRegime: null,
    };
  }
  const scores = snapshots.map(s => s.faultlineScore);
  const regimeCounts: Record<string, number> = {};
  for (const s of snapshots) {
    regimeCounts[s.regime] = (regimeCounts[s.regime] ?? 0) + 1;
  }
  const sorted = [...snapshots].sort((a, b) => a.readingDate.localeCompare(b.readingDate));
  return {
    totalSnapshots: snapshots.length,
    oldestDate: sorted[0].readingDate,
    newestDate: sorted[sorted.length - 1].readingDate,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    elevatedDays: snapshots.filter(s => s.stressLevel === "Elevated").length,
    highDays: snapshots.filter(s => s.stressLevel === "High").length,
    criticalDays: snapshots.filter(s => s.stressLevel === "Critical").length,
    mostFrequentRegime: Object.entries(regimeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}
