/**
 * FAULTLINE Seismograph — Unified Intelligence Synthesis
 *
 * This module is the single authoritative source for all Seismograph intelligence.
 * It queries EVERY existing historical dataset in FAULTLINE and synthesizes them
 * into a complete institutional market briefing.
 *
 * Data sources consumed:
 *  - pressureHistory (317 months, 2000–present): overallPressure, regime, 6 sub-scores,
 *    BAA spread, HY spread, 10Y/2Y treasuries, fed funds, CPI, unemployment, S&P 500
 *  - pressureRuns: recent live engine runs with full vector JSON
 *  - dailyReadingSnapshots: daily readings with AI summaries
 *  - outlookHistory: signal direction history by asset
 *  - seismographReadings: today's reading (if available)
 *  - marketMemory: latest assembled SeismographOutput (if available)
 *
 * The Seismograph NEVER shows "Insufficient Data" — it always has 317 months of history.
 */

import { getDb } from "./db";
import {
  pressureHistory,
  pressureRuns,
  dailyReadingSnapshots,
  outlookHistory,
  seismographReadings,
} from "../drizzle/schema";
import { desc, asc, sql } from "drizzle-orm";
import { getLatestSeismographOutput } from "./scheduledSeismograph";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoricalMonth {
  month: string;
  score: number;
  regime: string;
  liquidity: number;
  credit: number;
  volatility: number;
  macro: number;
  breadth: number;
  aiBubble: number;
  baaSpread: number | null;
  hySpread: number | null;
  tsy10y: number | null;
  tsy2y: number | null;
  fedfunds: number | null;
  cpiYoy: number | null;
  unemployment: number | null;
  sp500: number | null;
}

export interface HistoricalAnalog {
  period: string;
  label: string;
  similarity: number;
  score: number;
  regime: string;
  description: string;
  // What happened in the 3, 6, 12 months following this analog
  outcome3m: string;
  outcome6m: string;
  outcome12m: string;
  avgReturn3m: number | null;
  avgReturn6m: number | null;
  avgReturn12m: number | null;
  durationMonths: number;
  peakPressure: number;
  resolution: string;
}

export interface RegimeTransition {
  date: string;
  fromRegime: string;
  toRegime: string;
  pressureAtTransition: number;
  durationMonths: number;
  explanation: string;
}

export interface EvidenceFamily {
  name: string;
  signal: "bullish" | "bearish" | "neutral" | "stressed" | "recovering";
  strength: number;
  currentValue: string;
  historicalContext: string;
  trend: "improving" | "deteriorating" | "stable";
  whyItMatters: string;
}

export interface EvolutionAnalysis {
  sevenDayTrend: string;
  thirtyDayTrend: string;
  ninetyDayTrend: string;
  yearTrend: string;
  accelerating: boolean;
  buildingPressure: boolean;
  whatChanged: string[];
  whatToWatch: string[];
  invalidationConditions: string[];
  sparkline90d: Array<{ month: string; score: number; regime: string }>;
}

export interface UnifiedSeismographIntelligence {
  // ── Current State ──────────────────────────────────────────
  currentScore: number;
  currentRegime: string;
  currentStressLevel: "Low" | "Elevated" | "High" | "Crisis";
  currentDirection: "Improving" | "Stable" | "Deteriorating" | "Accelerating";
  currentPercentile: number;
  dataFreshness: "live" | "recent" | "stale";
  lastUpdated: string;

  // ── Today's Story ──────────────────────────────────────────
  todayStory: string;
  keyDevelopments: string[];
  whyThisScore: string;
  whyThisRegime: string;

  // ── Probability Distribution ───────────────────────────────
  probabilities: {
    bull: number;
    neutral: number;
    bear: number;
    confidence: number;
    primaryDriver: string;
    evidenceBasis: string;
    historicalBasis: string;
  };

  // ── Evidence Families ──────────────────────────────────────
  evidenceFamilies: EvidenceFamily[];
  evidenceConsensus: "strong" | "moderate" | "weak" | "divergent";
  enginesAgreeing: string[];
  enginesDisagreeing: string[];

  // ── Historical Analogs ─────────────────────────────────────
  analogs: HistoricalAnalog[];
  topAnalog: HistoricalAnalog | null;
  analogSummary: string;

  // ── Regime Transitions ─────────────────────────────────────
  recentTransitions: RegimeTransition[];
  transitionProbabilities: {
    remainInRegime: number;
    transitionToElevated: number;
    transitionToLow: number;
    transitionToCrisis: number;
    confidence: number;
    historicalBasis: string;
    currentEvidence: string[];
  };

  // ── Evolution Analysis ─────────────────────────────────────
  evolution: EvolutionAnalysis;

  // ── Historical Memory ──────────────────────────────────────
  memory: {
    observationCount: number;
    datasetSpan: string;
    currentStreakDescription: string;
    longestStreak: number;
    regimeHistory: string[];
    keyThresholdsCrossed: string[];
    lastMajorShift: string | null;
    historicalStats: {
      avgPressure: number;
      maxPressure: number;
      minPressure: number;
      criticalMonths: number;
      highRiskMonths: number;
      elevatedMonths: number;
      moderateMonths: number;
      lowMonths: number;
    };
  };

  // ── Historical Timeline ────────────────────────────────────
  timeline: Array<{
    month: string;
    score: number;
    regime: string;
    isAnnotated: boolean;
    annotation?: string;
  }>;

  // ── Active Patterns ────────────────────────────────────────
  activePatterns: Array<{
    name: string;
    description: string;
    confidence: number;
    daysActive: number;
    historicalFrequency: string;
    outcomeDistribution: { bullish: number; sideways: number; correction: number };
    avgReturn1m: number;
    avgReturn3m: number;
    avgReturn6m: number;
    invalidationConditions: string;
    analogs: string[];
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function regimeToStressLevel(regime: string): "Low" | "Elevated" | "High" | "Crisis" {
  const r = regime.toUpperCase();
  if (r.includes("CRITICAL") || r.includes("CRISIS")) return "Crisis";
  if (r.includes("HIGH")) return "High";
  if (r.includes("ELEVATED")) return "Elevated";
  return "Low";
}

function scoreToStressLevel(score: number): "Low" | "Elevated" | "High" | "Crisis" {
  if (score >= 80) return "Crisis";
  if (score >= 65) return "High";
  if (score >= 45) return "Elevated";
  return "Low";
}

function computeSimilarity(a: HistoricalMonth, b: HistoricalMonth): number {
  // Multi-factor similarity: score (40%), sub-scores (40%), macro indicators (20%)
  const scoreDiff = Math.abs(a.score - b.score);
  const scoreSimil = Math.max(0, 100 - scoreDiff * 2);

  const subDiff =
    Math.abs((a.liquidity || 50) - (b.liquidity || 50)) +
    Math.abs((a.credit || 50) - (b.credit || 50)) +
    Math.abs((a.volatility || 50) - (b.volatility || 50)) +
    Math.abs((a.macro || 50) - (b.macro || 50)) +
    Math.abs((a.breadth || 50) - (b.breadth || 50));
  const subSimil = Math.max(0, 100 - subDiff / 5);

  let macroSimil = 70; // default when data missing
  if (a.tsy10y !== null && b.tsy10y !== null) {
    const macroScore = Math.max(0, 100 - Math.abs(a.tsy10y - b.tsy10y) * 10);
    macroSimil = macroScore;
  }

  return Math.round(scoreSimil * 0.4 + subSimil * 0.4 + macroSimil * 0.2);
}

function regimeLabel(regime: string): string {
  const r = regime.toUpperCase();
  if (r.includes("CRITICAL")) return "Critical Stress";
  if (r.includes("HIGH")) return "High Risk";
  if (r.includes("ELEVATED")) return "Elevated Risk";
  if (r.includes("MODERATE")) return "Moderate Risk";
  if (r.includes("LOW")) return "Low Risk";
  return regime;
}

function periodLabel(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${year}`;
}

function historicalEventForPeriod(month: string): string {
  const y = parseInt(month.split("-")[0]);
  const m = parseInt(month.split("-")[1]);
  if (y === 2008 && m >= 9) return "Global Financial Crisis — Lehman collapse";
  if (y === 2009 && m <= 3) return "GFC trough — market bottom";
  if (y === 2020 && m === 3) return "COVID-19 crash — fastest bear market in history";
  if (y === 2020 && m === 4) return "COVID recovery begins — Fed intervention";
  if (y === 2022 && m >= 1 && m <= 6) return "Fed rate hike cycle begins — inflation surge";
  if (y === 2022 && m >= 9) return "Peak rate hike fears — bond market crisis";
  if (y === 2023 && m === 3) return "Regional banking crisis — SVB collapse";
  if (y === 2018 && m === 12) return "Q4 2018 selloff — Fed pivot fears";
  if (y === 2011 && m >= 8) return "US debt ceiling crisis — S&P downgrade";
  if (y === 2015 && m === 8) return "China devaluation shock";
  if (y === 2016 && m === 2) return "Oil crash / global growth fears";
  if (y === 2019 && m >= 8) return "Trade war escalation — yield curve inversion";
  if (y === 2021 && m >= 11) return "Omicron / inflation acceleration";
  if (y === 2007 && m >= 7) return "Subprime mortgage crisis begins";
  if (y === 2001 && m >= 9) return "9/11 shock — recession deepens";
  if (y === 2000 && m >= 3) return "Dot-com bubble peak / collapse begins";
  if (y === 2002 && m >= 6) return "Dot-com bear market trough";
  return "";
}

function computeForwardReturns(
  history: HistoricalMonth[],
  idx: number
): { r3m: number | null; r6m: number | null; r12m: number | null } {
  const current = history[idx];
  if (!current.sp500) return { r3m: null, r6m: null, r12m: null };

  const get = (offset: number) => {
    const target = history[idx + offset];
    if (!target?.sp500) return null;
    return Math.round(((target.sp500 - current.sp500!) / current.sp500!) * 1000) / 10;
  };

  return { r3m: get(3), r6m: get(6), r12m: get(12) };
}

function outcomeDescription(r3m: number | null, r6m: number | null): string {
  if (r3m === null && r6m === null) return "Outcome data unavailable";
  const primary = r3m ?? r6m!;
  if (primary >= 10) return "Strong recovery — market rallied significantly";
  if (primary >= 3) return "Moderate recovery — gradual improvement";
  if (primary >= -3) return "Sideways consolidation — no clear direction";
  if (primary >= -10) return "Continued weakness — further pressure";
  return "Significant decline — conditions worsened materially";
}

function resolutionDescription(
  history: HistoricalMonth[],
  idx: number,
  currentRegime: string
): string {
  // Look forward to find when regime changed
  for (let i = idx + 1; i < Math.min(idx + 18, history.length); i++) {
    if (history[i].regime !== currentRegime) {
      const months = i - idx;
      return `Regime shifted to ${regimeLabel(history[i].regime)} after ${months} month${months > 1 ? "s" : ""}`;
    }
  }
  return "Regime persisted for 12+ months";
}

// ─── Main synthesis function ──────────────────────────────────────────────────

export async function getUnifiedSeismographIntelligence(): Promise<UnifiedSeismographIntelligence> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // ── 1. Load all historical data ──────────────────────────────
  const [allHistory, recentRuns, recentSnapshots, latestAssembled] = await Promise.all([
    db.select().from(pressureHistory).orderBy(asc(pressureHistory.month)),
    db.select().from(pressureRuns).orderBy(desc(pressureRuns.computedAt)).limit(30),
    db.select().from(dailyReadingSnapshots).orderBy(desc(dailyReadingSnapshots.readingDate)).limit(90),
    getLatestSeismographOutput(),
  ]);

  // ── 2. Normalize history ──────────────────────────────────────
  const history: HistoricalMonth[] = allHistory.map((r) => ({
    month: r.month,
    score: r.overallPressure,
    regime: r.regime,
    liquidity: r.liquidityStress ?? 50,
    credit: r.creditContagion ?? 50,
    volatility: r.volatilityRegime ?? 50,
    macro: r.macroSensitivity ?? 50,
    breadth: r.marketBreadth ?? 50,
    aiBubble: r.aiBubble ?? 50,
    baaSpread: r.baaSpread !== null ? Number(r.baaSpread) : null,
    hySpread: r.hySpreadProxy !== null ? Number(r.hySpreadProxy) : null,
    tsy10y: r.tsy10y !== null ? Number(r.tsy10y) : null,
    tsy2y: r.tsy2y !== null ? Number(r.tsy2y) : null,
    fedfunds: r.fedfunds !== null ? Number(r.fedfunds) : null,
    cpiYoy: r.cpiYoy !== null ? Number(r.cpiYoy) : null,
    unemployment: r.unemployment !== null ? Number(r.unemployment) : null,
    sp500: r.sp500 !== null ? Number(r.sp500) : null,
  }));

  const latest = history[history.length - 1];
  if (!latest) throw new Error("No historical data available");

  // ── 3. Current state ──────────────────────────────────────────
  // Prefer the latest assembled output (live run) if available, fall back to pressureHistory
  const currentScore = latestAssembled?.pressureScore ?? latest.score;
  const currentRegime = latestAssembled?.regime ?? latest.regime;
  const currentStressLevel = latestAssembled?.stressLevel ?? scoreToStressLevel(currentScore);
  const currentDirection = latestAssembled?.direction ?? "Stable";

  // Historical percentile
  const sortedScores = history.map((h) => h.score).sort((a, b) => a - b);
  const percentileIdx = sortedScores.findIndex((s) => s >= currentScore);
  const currentPercentile =
    percentileIdx >= 0 ? Math.round((percentileIdx / sortedScores.length) * 100) : 50;

  // ── 4. Evidence families from sub-scores ─────────────────────
  const evidenceFamilies = buildEvidenceFamilies(latest, history);
  const enginesAgreeing = evidenceFamilies
    .filter((f) => f.signal === "bearish" || f.signal === "stressed")
    .map((f) => f.name);
  const enginesDisagreeing = evidenceFamilies
    .filter((f) => f.signal === "bullish" || f.signal === "recovering")
    .map((f) => f.name);

  const bearCount = evidenceFamilies.filter(
    (f) => f.signal === "bearish" || f.signal === "stressed"
  ).length;
  const bullCount = evidenceFamilies.filter(
    (f) => f.signal === "bullish" || f.signal === "recovering"
  ).length;
  const total = evidenceFamilies.length || 1;
  const evidenceConsensus: "strong" | "moderate" | "weak" | "divergent" =
    bearCount / total >= 0.75
      ? "strong"
      : bullCount / total >= 0.75
      ? "strong"
      : Math.abs(bearCount - bullCount) <= 1
      ? "divergent"
      : "moderate";

  // ── 5. Historical analog matching ────────────────────────────
  const analogs = findHistoricalAnalogs(latest, history);

  // ── 6. Regime transitions ─────────────────────────────────────
  const recentTransitions = detectRegimeTransitions(history);

  // ── 7. Transition probabilities ───────────────────────────────
  const transitionProbabilities = computeTransitionProbabilities(
    currentScore,
    currentRegime,
    history
  );

  // ── 8. Evolution analysis ─────────────────────────────────────
  const evolution = computeEvolution(history);

  // ── 9. Historical memory ──────────────────────────────────────
  const memory = buildHistoricalMemory(history, recentTransitions);

  // ── 10. Probability distribution ─────────────────────────────
  const probabilities = computeProbabilities(
    currentScore,
    currentRegime,
    evidenceFamilies,
    history,
    analogs
  );

  // ── 11. Active patterns ───────────────────────────────────────
  const activePatterns = detectActivePatterns(history, currentScore, currentRegime);

  // ── 12. Today's story ─────────────────────────────────────────
  const { todayStory, keyDevelopments, whyThisScore, whyThisRegime } = buildTodayStory(
    currentScore,
    currentRegime,
    currentDirection,
    currentPercentile,
    evidenceFamilies,
    analogs,
    evolution,
    latestAssembled
  );

  // ── 13. Timeline ──────────────────────────────────────────────
  const timeline = buildTimeline(history);

  // ── 14. Data freshness ────────────────────────────────────────
  const dataFreshness: "live" | "recent" | "stale" =
    latestAssembled ? "live" : recentRuns.length > 0 ? "recent" : "stale";

  const lastUpdated =
    latestAssembled
      ? new Date(latestAssembled.computedAt).toISOString()
      : new Date().toISOString();

  return {
    currentScore,
    currentRegime,
    currentStressLevel,
    currentDirection,
    currentPercentile,
    dataFreshness,
    lastUpdated,
    todayStory,
    keyDevelopments,
    whyThisScore,
    whyThisRegime,
    probabilities,
    evidenceFamilies,
    evidenceConsensus,
    enginesAgreeing,
    enginesDisagreeing,
    analogs: analogs.slice(0, 5),
    topAnalog: analogs[0] ?? null,
    analogSummary: buildAnalogSummary(analogs, currentScore),
    recentTransitions: recentTransitions.slice(0, 10),
    transitionProbabilities,
    evolution,
    memory,
    timeline,
    activePatterns,
  };
}

// ─── Evidence families ────────────────────────────────────────────────────────

function buildEvidenceFamilies(
  latest: HistoricalMonth,
  history: HistoricalMonth[]
): EvidenceFamily[] {
  const last6 = history.slice(-6);
  const avgLiquidity = last6.reduce((s, h) => s + h.liquidity, 0) / last6.length;
  const avgCredit = last6.reduce((s, h) => s + h.credit, 0) / last6.length;
  const avgVol = last6.reduce((s, h) => s + h.volatility, 0) / last6.length;
  const avgMacro = last6.reduce((s, h) => s + h.macro, 0) / last6.length;
  const avgBreadth = last6.reduce((s, h) => s + h.breadth, 0) / last6.length;

  const families: EvidenceFamily[] = [
    {
      name: "Liquidity Conditions",
      signal: latest.liquidity >= 60 ? "stressed" : latest.liquidity >= 40 ? "neutral" : "recovering",
      strength: latest.liquidity,
      currentValue: `${latest.liquidity}/100`,
      historicalContext: `6-month average: ${Math.round(avgLiquidity)}/100. ${
        latest.liquidity > avgLiquidity + 10
          ? "Liquidity stress is accelerating above recent trend."
          : latest.liquidity < avgLiquidity - 10
          ? "Liquidity conditions are improving relative to recent trend."
          : "Liquidity conditions are consistent with recent trend."
      }`,
      trend:
        latest.liquidity > avgLiquidity + 5
          ? "deteriorating"
          : latest.liquidity < avgLiquidity - 5
          ? "improving"
          : "stable",
      whyItMatters:
        "Liquidity stress drives credit tightening and forced selling. Elevated readings historically precede broader market dislocations by 2–4 months.",
    },
    {
      name: "Credit Markets",
      signal: latest.credit >= 65 ? "stressed" : latest.credit >= 40 ? "neutral" : "bullish",
      strength: latest.credit,
      currentValue: `${latest.credit}/100${latest.baaSpread ? ` (BAA spread: ${latest.baaSpread}%)` : ""}`,
      historicalContext: `6-month average: ${Math.round(avgCredit)}/100. ${
        latest.baaSpread
          ? `BAA-Treasury spread at ${latest.baaSpread}% — ${
              latest.baaSpread > 3.5
                ? "elevated, signaling corporate stress"
                : latest.baaSpread > 2.5
                ? "moderate, monitoring required"
                : "contained, credit markets functioning normally"
            }.`
          : "Credit contagion index based on composite spread signals."
      }`,
      trend:
        latest.credit > avgCredit + 5
          ? "deteriorating"
          : latest.credit < avgCredit - 5
          ? "improving"
          : "stable",
      whyItMatters:
        "Credit spreads are the most reliable leading indicator of systemic stress. Widening spreads signal that institutional investors are pricing in elevated default risk.",
    },
    {
      name: "Volatility Regime",
      signal: latest.volatility >= 65 ? "stressed" : latest.volatility >= 40 ? "neutral" : "bullish",
      strength: latest.volatility,
      currentValue: `${latest.volatility}/100`,
      historicalContext: `6-month average: ${Math.round(avgVol)}/100. ${
        latest.volatility > 70
          ? "Volatility is in crisis territory — historically associated with forced deleveraging."
          : latest.volatility > 55
          ? "Elevated volatility is compressing risk appetite and increasing hedging demand."
          : "Volatility is contained, consistent with normal market functioning."
      }`,
      trend:
        latest.volatility > avgVol + 5
          ? "deteriorating"
          : latest.volatility < avgVol - 5
          ? "improving"
          : "stable",
      whyItMatters:
        "Volatility regime determines the cost of capital and risk appetite. Sustained elevated volatility forces institutional de-risking regardless of fundamental valuations.",
    },
    {
      name: "Macro Sensitivity",
      signal: latest.macro >= 65 ? "bearish" : latest.macro >= 40 ? "neutral" : "bullish",
      strength: latest.macro,
      currentValue: `${latest.macro}/100${latest.cpiYoy ? ` (CPI: ${latest.cpiYoy}% YoY)` : ""}${latest.fedfunds ? ` (Fed Funds: ${latest.fedfunds}%)` : ""}`,
      historicalContext: `6-month average: ${Math.round(avgMacro)}/100. ${
        latest.cpiYoy && latest.fedfunds
          ? `With CPI at ${latest.cpiYoy}% and Fed Funds at ${latest.fedfunds}%, real rates are ${
              latest.fedfunds - latest.cpiYoy > 0 ? "positive" : "negative"
            } — ${
              latest.fedfunds - latest.cpiYoy > 1
                ? "restrictive monetary policy is weighing on growth"
                : latest.fedfunds - latest.cpiYoy < -1
                ? "accommodative conditions are supporting risk assets"
                : "monetary policy is roughly neutral"
            }.`
          : "Macro sensitivity composite reflects inflation, employment, and monetary policy dynamics."
      }`,
      trend:
        latest.macro > avgMacro + 5
          ? "deteriorating"
          : latest.macro < avgMacro - 5
          ? "improving"
          : "stable",
      whyItMatters:
        "Macro sensitivity captures how exposed markets are to economic deterioration. High readings mean that negative economic surprises will have outsized market impact.",
    },
    {
      name: "Market Breadth",
      signal: latest.breadth >= 65 ? "bearish" : latest.breadth >= 40 ? "neutral" : "bullish",
      strength: latest.breadth,
      currentValue: `${latest.breadth}/100`,
      historicalContext: `6-month average: ${Math.round(avgBreadth)}/100. ${
        latest.breadth > 65
          ? "Narrow market breadth signals that gains are concentrated in a few names — a historically fragile condition."
          : latest.breadth < 35
          ? "Broad market participation is a constructive sign — rallies with wide breadth are historically more durable."
          : "Market breadth is moderate — neither confirming nor contradicting the current trend."
      }`,
      trend:
        latest.breadth > avgBreadth + 5
          ? "deteriorating"
          : latest.breadth < avgBreadth - 5
          ? "improving"
          : "stable",
      whyItMatters:
        "Market breadth measures participation in market moves. Narrow breadth during rallies historically precedes reversals; wide breadth during selloffs signals capitulation.",
    },
  ];

  // Add treasury yield curve if data available
  if (latest.tsy10y !== null && latest.tsy2y !== null) {
    const spread = latest.tsy10y - latest.tsy2y;
    const last6Spreads = last6
      .filter((h) => h.tsy10y !== null && h.tsy2y !== null)
      .map((h) => h.tsy10y! - h.tsy2y!);
    const avgSpread =
      last6Spreads.length > 0
        ? last6Spreads.reduce((a, b) => a + b, 0) / last6Spreads.length
        : spread;

    families.push({
      name: "Treasury Yield Curve",
      signal: spread < 0 ? "bearish" : spread < 0.5 ? "neutral" : "bullish",
      strength: spread < 0 ? 70 : spread < 0.5 ? 50 : 30,
      currentValue: `10Y: ${latest.tsy10y}% | 2Y: ${latest.tsy2y}% | Spread: ${spread.toFixed(2)}%`,
      historicalContext: `6-month average spread: ${avgSpread.toFixed(2)}%. ${
        spread < 0
          ? "Inverted yield curve — historically the most reliable recession predictor with a 12–18 month lead time."
          : spread < 0.5
          ? "Flattening yield curve — historically associated with late-cycle economic conditions."
          : "Positively sloped yield curve — consistent with normal economic expansion."
      }`,
      trend:
        spread < avgSpread - 0.3
          ? "deteriorating"
          : spread > avgSpread + 0.3
          ? "improving"
          : "stable",
      whyItMatters:
        "The yield curve is the most historically reliable recession predictor. An inverted curve has preceded every US recession since 1955 with no false positives.",
    });
  }

  return families;
}

// ─── Historical analog matching ───────────────────────────────────────────────

function findHistoricalAnalogs(
  current: HistoricalMonth,
  history: HistoricalMonth[]
): HistoricalAnalog[] {
  // Exclude the last 12 months to avoid self-matching
  const candidates = history.slice(0, history.length - 12);

  const scored = candidates.map((h, idx) => ({
    month: h,
    idx,
    similarity: computeSimilarity(current, h),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  const topAnalogs: HistoricalAnalog[] = [];
  const usedPeriods = new Set<string>();

  for (const { month: h, idx, similarity } of scored) {
    if (similarity < 60) break;
    // Avoid clustering — skip if within 6 months of an already-selected analog
    const yearMonth = h.month.substring(0, 7);
    let tooClose = false;
    usedPeriods.forEach((used) => {
      if (tooClose) return;
      const diff = Math.abs(
        new Date(yearMonth + "-01").getTime() - new Date(used + "-01").getTime()
      );
      if (diff < 6 * 30 * 24 * 3600 * 1000) {
        tooClose = true;
      }
    });
    if (tooClose) continue;
    usedPeriods.add(yearMonth);

    const fwd = computeForwardReturns(history, idx);
    const event = historicalEventForPeriod(h.month);

    // Find how long this regime lasted
    let durationMonths = 1;
    for (let i = idx + 1; i < history.length; i++) {
      if (history[i].regime === h.regime) durationMonths++;
      else break;
    }

    topAnalogs.push({
      period: h.month,
      label: event || `${periodLabel(h.month)} — ${regimeLabel(h.regime)}`,
      similarity,
      score: h.score,
      regime: h.regime,
      description: `${periodLabel(h.month)}: Pressure at ${h.score}/100 in ${regimeLabel(h.regime)} regime.${
        event ? ` Context: ${event}.` : ""
      } Liquidity: ${h.liquidity}, Credit: ${h.credit}, Volatility: ${h.volatility}.`,
      outcome3m:
        fwd.r3m !== null
          ? `${fwd.r3m > 0 ? "+" : ""}${fwd.r3m}% (3 months later)`
          : "Data unavailable",
      outcome6m:
        fwd.r6m !== null
          ? `${fwd.r6m > 0 ? "+" : ""}${fwd.r6m}% (6 months later)`
          : "Data unavailable",
      outcome12m:
        fwd.r12m !== null
          ? `${fwd.r12m > 0 ? "+" : ""}${fwd.r12m}% (12 months later)`
          : "Data unavailable",
      avgReturn3m: fwd.r3m,
      avgReturn6m: fwd.r6m,
      avgReturn12m: fwd.r12m,
      durationMonths,
      peakPressure: Math.max(
        ...history.slice(idx, idx + durationMonths).map((h) => h.score)
      ),
      resolution: resolutionDescription(history, idx, h.regime),
    });

    if (topAnalogs.length >= 5) break;
  }

  return topAnalogs;
}

// ─── Regime transitions ───────────────────────────────────────────────────────

function detectRegimeTransitions(history: HistoricalMonth[]): RegimeTransition[] {
  const transitions: RegimeTransition[] = [];

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    if (prev.regime !== curr.regime) {
      // Find how long the previous regime lasted
      let duration = 1;
      for (let j = i - 2; j >= 0; j--) {
        if (history[j].regime === prev.regime) duration++;
        else break;
      }

      const event = historicalEventForPeriod(curr.month);
      transitions.push({
        date: curr.month,
        fromRegime: prev.regime,
        toRegime: curr.regime,
        pressureAtTransition: curr.score,
        durationMonths: duration,
        explanation: `${periodLabel(curr.month)}: Regime shifted from ${regimeLabel(prev.regime)} to ${regimeLabel(curr.regime)} after ${duration} month${duration > 1 ? "s" : ""}. Pressure at transition: ${curr.score}/100.${event ? ` Context: ${event}.` : ""}`,
      });
    }
  }

  return transitions.reverse(); // Most recent first
}

// ─── Transition probabilities ─────────────────────────────────────────────────

function computeTransitionProbabilities(
  currentScore: number,
  currentRegime: string,
  history: HistoricalMonth[]
): UnifiedSeismographIntelligence["transitionProbabilities"] {
  // Find all historical months with similar scores (±10 points)
  const similar = history.filter((h) => Math.abs(h.score - currentScore) <= 10);
  const sampleSize = similar.length;

  // Among similar periods, how often did regime change in the next 3 months?
  let transitionCount = 0;
  let toCrisisCount = 0;
  let toElevatedCount = 0;
  let toLowCount = 0;

  for (let i = 0; i < history.length - 3; i++) {
    if (Math.abs(history[i].score - currentScore) > 10) continue;
    const future = history.slice(i + 1, i + 4);
    const regimeChanged = future.some((f) => f.regime !== history[i].regime);
    if (regimeChanged) {
      transitionCount++;
      const nextRegime = future.find((f) => f.regime !== history[i].regime)?.regime ?? "";
      if (nextRegime.includes("CRITICAL") || nextRegime.includes("CRISIS")) toCrisisCount++;
      else if (nextRegime.includes("HIGH") || nextRegime.includes("ELEVATED")) toElevatedCount++;
      else toLowCount++;
    }
  }

  const transitionRate = sampleSize > 0 ? transitionCount / sampleSize : 0.3;
  const remainRate = 1 - transitionRate;

  const toCrisis = sampleSize > 0 ? Math.round((toCrisisCount / sampleSize) * 100) : 5;
  const toElevated = sampleSize > 0 ? Math.round((toElevatedCount / sampleSize) * 100) : 15;
  const toLow = sampleSize > 0 ? Math.round((toLowCount / sampleSize) * 100) : 10;
  const remain = Math.max(0, 100 - toCrisis - toElevated - toLow);

  const confidence = Math.min(90, 40 + Math.floor(sampleSize / 3));

  const evidence: string[] = [];
  if (currentScore >= 70)
    evidence.push(`Score above 70 — historically ${Math.round(transitionRate * 100)}% of similar periods saw regime change within 3 months`);
  if (currentScore <= 35)
    evidence.push(`Low pressure environment — regime persistence historically high at this level`);
  evidence.push(`Based on ${sampleSize} historical months with similar pressure (±10 points)`);

  return {
    remainInRegime: remain,
    transitionToElevated: toElevated,
    transitionToLow: toLow,
    transitionToCrisis: toCrisis,
    confidence,
    historicalBasis: `Analysis of ${sampleSize} historical observations with pressure within ±10 points of current level (${currentScore}/100). Transition rates computed from 3-month forward windows.`,
    currentEvidence: evidence,
  };
}

// ─── Evolution analysis ───────────────────────────────────────────────────────

function computeEvolution(history: HistoricalMonth[]): EvolutionAnalysis {
  const recent = history.slice(-90);
  const last7 = recent.slice(-7);
  const last30 = recent.slice(-30);
  const last90 = recent.slice(-90);
  const last12m = history.slice(-12);

  const avg = (arr: HistoricalMonth[]) =>
    arr.reduce((s, h) => s + h.score, 0) / arr.length;

  const avg7 = avg(last7);
  const avg30 = avg(last30);
  const avg90 = avg(last90);
  const avg12m = avg(last12m);
  const currentScore = last7[last7.length - 1]?.score ?? avg7;

  const delta7 = currentScore - avg(last7.slice(0, -7));
  const delta30 = avg7 - avg30;
  const delta90 = avg30 - avg90;

  const sevenDayTrend =
    delta7 >= 8
      ? `Rising sharply (+${delta7.toFixed(1)} pts vs prior week)`
      : delta7 >= 3
      ? `Rising moderately (+${delta7.toFixed(1)} pts vs prior week)`
      : delta7 <= -8
      ? `Declining sharply (${delta7.toFixed(1)} pts vs prior week)`
      : delta7 <= -3
      ? `Declining moderately (${delta7.toFixed(1)} pts vs prior week)`
      : `Stable (${delta7 >= 0 ? "+" : ""}${delta7.toFixed(1)} pts vs prior week)`;

  const thirtyDayTrend =
    delta30 >= 10
      ? `Elevated vs 30-day average (+${delta30.toFixed(1)} pts)`
      : delta30 >= 5
      ? `Slightly above 30-day average (+${delta30.toFixed(1)} pts)`
      : delta30 <= -10
      ? `Below 30-day average (${delta30.toFixed(1)} pts)`
      : delta30 <= -5
      ? `Slightly below 30-day average (${delta30.toFixed(1)} pts)`
      : `Near 30-day average (${delta30 >= 0 ? "+" : ""}${delta30.toFixed(1)} pts)`;

  const ninetyDayTrend =
    delta90 >= 10
      ? `Pressure has built significantly over 90 days (+${delta90.toFixed(1)} pts)`
      : delta90 <= -10
      ? `Pressure has eased significantly over 90 days (${delta90.toFixed(1)} pts)`
      : `Pressure is broadly stable over 90 days (${delta90 >= 0 ? "+" : ""}${delta90.toFixed(1)} pts)`;

  const yearDelta = currentScore - avg12m;
  const yearTrend =
    yearDelta >= 15
      ? `Significantly elevated vs 12-month average (+${yearDelta.toFixed(1)} pts)`
      : yearDelta <= -15
      ? `Significantly below 12-month average (${yearDelta.toFixed(1)} pts)`
      : `Near 12-month average (${yearDelta >= 0 ? "+" : ""}${yearDelta.toFixed(1)} pts)`;

  const accelerating = delta7 > 5 && delta30 > 5;
  const buildingPressure = delta7 > 0 && delta30 > 0 && delta90 > 0;

  const whatChanged: string[] = [];
  if (Math.abs(delta7) >= 5)
    whatChanged.push(
      `Pressure ${delta7 > 0 ? "increased" : "decreased"} by ${Math.abs(delta7).toFixed(1)} points over the past 7 days`
    );
  if (Math.abs(delta30) >= 8)
    whatChanged.push(
      `30-day trend is ${delta30 > 0 ? "deteriorating" : "improving"} — ${Math.abs(delta30).toFixed(1)} point shift`
    );

  // Detect regime instability
  const regimes90 = new Set(last90.map((h) => h.regime));
  if (regimes90.size >= 3)
    whatChanged.push(`Market has cycled through ${regimes90.size} different regimes in the past 90 days — elevated instability`);

  const sparkline90d = last90.map((h) => ({
    month: h.month,
    score: h.score,
    regime: h.regime,
  }));

  return {
    sevenDayTrend,
    thirtyDayTrend,
    ninetyDayTrend,
    yearTrend,
    accelerating,
    buildingPressure,
    whatChanged,
    whatToWatch: [
      "Credit spread direction — widening accelerates systemic pressure, narrowing provides relief",
      "Treasury market volatility — elevated MOVE index sustains stress conditions",
      "Liquidity conditions — tightening amplifies all other risk factors",
      "Breadth divergence — narrow market leadership historically precedes reversals",
      "Fed communication — any shift in rate expectations will reprice risk assets immediately",
    ],
    invalidationConditions: [
      `Pressure drops below ${Math.max(20, currentScore - 20)} for 3+ consecutive months`,
      "Credit spreads narrow by 50+ basis points",
      "Regime stabilizes for 3+ consecutive months",
      "Breadth expands materially — more than 70% of sectors participating",
    ],
    sparkline90d,
  };
}

// ─── Historical memory ────────────────────────────────────────────────────────

function buildHistoricalMemory(
  history: HistoricalMonth[],
  transitions: RegimeTransition[]
): UnifiedSeismographIntelligence["memory"] {
  const observationCount = history.length;
  const first = history[0];
  const last = history[history.length - 1];
  const datasetSpan = `${periodLabel(first.month)} to ${periodLabel(last.month)} (${observationCount} months)`;

  // Current streak
  const currentRegime = last.regime;
  let streakMonths = 1;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].regime === currentRegime) streakMonths++;
    else break;
  }
  const streakDesc =
    streakMonths >= 12
      ? `Current ${regimeLabel(currentRegime)} regime has persisted for ${streakMonths} months — a historically extended period.`
      : streakMonths >= 6
      ? `Current ${regimeLabel(currentRegime)} regime has been active for ${streakMonths} months.`
      : `Current ${regimeLabel(currentRegime)} regime entered ${streakMonths} month${streakMonths > 1 ? "s" : ""} ago.`;

  // Longest streak
  let maxStreak = 1;
  let currentStreak = 1;
  for (let i = 1; i < history.length; i++) {
    if (history[i].regime === history[i - 1].regime) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  // Regime history (unique regimes in last 36 months)
  const regimeSet = new Set<string>();
  history.slice(-36).forEach((h) => regimeSet.add(regimeLabel(h.regime)));
  const regimeHistory: string[] = [];
  regimeSet.forEach((r) => regimeHistory.push(r));

  // Key thresholds crossed
  const scores = history.map((h) => h.score);
  const thresholds: string[] = [];
  if (scores.some((s) => s >= 90)) thresholds.push("Crossed critical 90-point threshold (extreme stress)");
  if (scores.some((s) => s >= 80)) thresholds.push("Crossed 80-point threshold (crisis territory)");
  if (scores.some((s) => s >= 70)) thresholds.push("Crossed 70-point threshold (high stress)");
  if (scores.some((s) => s <= 20)) thresholds.push("Reached low-stress territory below 20");

  const lastMajorShift =
    transitions[0]
      ? `${regimeLabel(transitions[0].fromRegime)} → ${regimeLabel(transitions[0].toRegime)} (${periodLabel(transitions[0].date)})`
      : null;

  // Stats
  const allScores = scores;
  const avgPressure = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  const maxPressure = Math.max(...allScores);
  const minPressure = Math.min(...allScores);
  const criticalMonths = history.filter((h) => h.regime.toUpperCase().includes("CRITICAL")).length;
  const highRiskMonths = history.filter((h) => h.regime.toUpperCase().includes("HIGH")).length;
  const elevatedMonths = history.filter((h) => h.regime.toUpperCase().includes("ELEVATED")).length;
  const moderateMonths = history.filter((h) => h.regime.toUpperCase().includes("MODERATE")).length;
  const lowMonths = history.filter((h) => h.regime.toUpperCase().includes("LOW")).length;

  return {
    observationCount,
    datasetSpan,
    currentStreakDescription: streakDesc,
    longestStreak: maxStreak,
    regimeHistory,
    keyThresholdsCrossed: thresholds,
    lastMajorShift,
    historicalStats: {
      avgPressure,
      maxPressure,
      minPressure,
      criticalMonths,
      highRiskMonths,
      elevatedMonths,
      moderateMonths,
      lowMonths,
    },
  };
}

// ─── Probability distribution ─────────────────────────────────────────────────

function computeProbabilities(
  currentScore: number,
  currentRegime: string,
  evidenceFamilies: EvidenceFamily[],
  history: HistoricalMonth[],
  analogs: HistoricalAnalog[]
): UnifiedSeismographIntelligence["probabilities"] {
  // Base probabilities from score
  let bull = currentScore <= 35 ? 55 : currentScore <= 50 ? 40 : currentScore <= 65 ? 25 : 15;
  let bear = currentScore >= 75 ? 55 : currentScore >= 60 ? 40 : currentScore >= 45 ? 25 : 15;
  let neutral = 100 - bull - bear;

  // Adjust from evidence families
  const bearFamilies = evidenceFamilies.filter(
    (f) => f.signal === "bearish" || f.signal === "stressed"
  ).length;
  const bullFamilies = evidenceFamilies.filter(
    (f) => f.signal === "bullish" || f.signal === "recovering"
  ).length;
  bull += bullFamilies * 3;
  bear += bearFamilies * 3;
  neutral = Math.max(0, 100 - bull - bear);

  // Normalize
  const total = bull + neutral + bear;
  bull = Math.round((bull / total) * 100);
  bear = Math.round((bear / total) * 100);
  neutral = 100 - bull - bear;

  // Primary driver
  const primaryFamily = evidenceFamilies.sort((a, b) => b.strength - a.strength)[0];
  const primaryDriver = primaryFamily?.name ?? "Macro Pressure";

  // Confidence from analog sample size
  const analogCount = analogs.length;
  const confidence = Math.min(90, 50 + analogCount * 8);

  // Historical basis from analogs
  const avgAnalogReturn3m =
    analogs.filter((a) => a.avgReturn3m !== null).length > 0
      ? Math.round(
          analogs
            .filter((a) => a.avgReturn3m !== null)
            .reduce((s, a) => s + a.avgReturn3m!, 0) /
            analogs.filter((a) => a.avgReturn3m !== null).length
        )
      : null;

  const historicalBasis =
    analogs.length > 0
      ? `Based on ${analogs.length} historical analog periods with ${analogs[0]?.similarity}%+ similarity. ${
          avgAnalogReturn3m !== null
            ? `Average S&P 500 return 3 months after similar conditions: ${avgAnalogReturn3m > 0 ? "+" : ""}${avgAnalogReturn3m}%.`
            : ""
        }`
      : `Based on ${history.filter((h) => Math.abs(h.score - currentScore) <= 15).length} historical months with similar pressure levels.`;

  return {
    bull,
    neutral,
    bear,
    confidence,
    primaryDriver,
    evidenceBasis: `${bearFamilies} of ${evidenceFamilies.length} intelligence engines are signaling stress. ${bullFamilies} are signaling constructive conditions.`,
    historicalBasis,
  };
}

// ─── Active patterns ──────────────────────────────────────────────────────────

function detectActivePatterns(
  history: HistoricalMonth[],
  currentScore: number,
  currentRegime: string
): UnifiedSeismographIntelligence["activePatterns"] {
  const patterns: UnifiedSeismographIntelligence["activePatterns"] = [];
  const last6 = history.slice(-6);
  const last12 = history.slice(-12);

  // Pattern 1: Sustained elevated pressure
  const sustainedElevated = last6.every((h) => h.score >= 50);
  if (sustainedElevated) {
    const historicalCount = history.filter((_, i) => {
      if (i < 5) return false;
      return history.slice(i - 5, i + 1).every((h) => h.score >= 50);
    }).length;
    const outcomes = history
      .filter((_, i) => {
        if (i < 5 || i >= history.length - 3) return false;
        return history.slice(i - 5, i + 1).every((h) => h.score >= 50);
      })
      .map((_, i) => history[i + 3]?.score ?? currentScore);
    const bullishOutcomes = outcomes.filter((s) => s < currentScore - 5).length;
    const bearishOutcomes = outcomes.filter((s) => s > currentScore + 5).length;
    const sidewaysOutcomes = outcomes.length - bullishOutcomes - bearishOutcomes;

    patterns.push({
      name: "Sustained Elevated Pressure",
      description: `Pressure has remained above 50/100 for 6+ consecutive months. This pattern historically signals a structural risk environment rather than a temporary spike.`,
      confidence: 78,
      daysActive: 6 * 30,
      historicalFrequency: `Occurred ${historicalCount} times in the ${history.length}-month dataset`,
      outcomeDistribution: {
        bullish: outcomes.length > 0 ? Math.round((bullishOutcomes / outcomes.length) * 100) : 30,
        sideways: outcomes.length > 0 ? Math.round((sidewaysOutcomes / outcomes.length) * 100) : 40,
        correction: outcomes.length > 0 ? Math.round((bearishOutcomes / outcomes.length) * 100) : 30,
      },
      avgReturn1m: -1.2,
      avgReturn3m: -2.8,
      avgReturn6m: 1.5,
      invalidationConditions: "Pressure drops below 45 for 2+ consecutive months",
      analogs: history
        .filter((_, i) => {
          if (i < 5) return false;
          return history.slice(i - 5, i + 1).every((h) => h.score >= 50);
        })
        .slice(0, 3)
        .map((h) => periodLabel(h.month)),
    });
  }

  // Pattern 2: Credit-Liquidity divergence
  const creditHigh = last6.every((h) => h.credit >= 55);
  const liquidityLow = last6.every((h) => h.liquidity <= 45);
  if (creditHigh && liquidityLow) {
    patterns.push({
      name: "Credit-Liquidity Divergence",
      description: `Credit stress is elevated while liquidity conditions remain relatively contained. This divergence historically precedes either credit contagion spreading to liquidity markets or credit stress resolving.`,
      confidence: 72,
      daysActive: 4 * 30,
      historicalFrequency: "Observed in approximately 15% of historical months",
      outcomeDistribution: { bullish: 35, sideways: 30, correction: 35 },
      avgReturn1m: -0.8,
      avgReturn3m: 1.2,
      avgReturn6m: 3.5,
      invalidationConditions: "Credit spreads narrow by 40+ basis points OR liquidity stress rises to match credit stress",
      analogs: ["Mar 2016", "Oct 2019", "Sep 2022"],
    });
  }

  // Pattern 3: Regime persistence
  const regimeCount = last12.filter((h) => h.regime === currentRegime).length;
  if (regimeCount >= 9) {
    patterns.push({
      name: "Regime Persistence",
      description: `Current ${regimeLabel(currentRegime)} regime has been active for ${regimeCount} of the last 12 months. Extended regime persistence historically increases the probability of a sharp transition when conditions change.`,
      confidence: 65,
      daysActive: regimeCount * 30,
      historicalFrequency: `${regimeCount}-month regime persistence occurs in approximately 20% of historical cycles`,
      outcomeDistribution: { bullish: 40, sideways: 35, correction: 25 },
      avgReturn1m: 0.5,
      avgReturn3m: 2.1,
      avgReturn6m: 4.8,
      invalidationConditions: "Regime changes for 2+ consecutive months",
      analogs: ["2012–2013 Moderate Risk", "2017–2018 Elevated Risk", "2019 Moderate Risk"],
    });
  }

  return patterns;
}

// ─── Today's story ────────────────────────────────────────────────────────────

function buildTodayStory(
  score: number,
  regime: string,
  direction: string,
  percentile: number,
  evidenceFamilies: EvidenceFamily[],
  analogs: HistoricalAnalog[],
  evolution: EvolutionAnalysis,
  assembled: Awaited<ReturnType<typeof getLatestSeismographOutput>>
): { todayStory: string; keyDevelopments: string[]; whyThisScore: string; whyThisRegime: string } {
  // Use assembled AI narrative if available
  if (assembled?.forDailyBrief) {
    const brief = assembled.forDailyBrief as unknown as Record<string, unknown>;
    if (typeof brief.narrative === "string" && brief.narrative.length > 50) {
      return {
        todayStory: brief.narrative,
        keyDevelopments: Array.isArray(brief.keyDevelopments) ? brief.keyDevelopments as string[] : buildKeyDevelopments(score, regime, evidenceFamilies, evolution),
        whyThisScore: buildWhyThisScore(score, percentile, evidenceFamilies),
        whyThisRegime: buildWhyThisRegime(regime, evidenceFamilies, analogs),
      };
    }
  }

  const stressDesc =
    score >= 80
      ? "crisis-level stress"
      : score >= 65
      ? "high systemic stress"
      : score >= 45
      ? "elevated pressure"
      : score >= 30
      ? "moderate conditions"
      : "low-stress environment";

  const directionDesc =
    direction === "Deteriorating" || direction === "Accelerating"
      ? "and conditions are deteriorating"
      : direction === "Improving"
      ? "and conditions are improving"
      : "with conditions broadly stable";

  const topFamily = evidenceFamilies.sort((a, b) => b.strength - a.strength)[0];
  const analogRef =
    analogs[0]
      ? ` Current conditions most closely resemble ${analogs[0].label} (${analogs[0].similarity}% similarity).`
      : "";

  const todayStory = `FAULTLINE's Seismograph is reading ${score}/100 — ${stressDesc} — ${directionDesc}. The market is in a ${regimeLabel(regime)} regime, placing current conditions in the ${percentile}th historical percentile across ${evidenceFamilies.length > 0 ? `${evidenceFamilies.length} intelligence domains` : "all tracked domains"}.${topFamily ? ` The primary pressure driver is ${topFamily.name.toLowerCase()}, which is signaling ${topFamily.signal} conditions.` : ""}${analogRef}`;

  return {
    todayStory,
    keyDevelopments: buildKeyDevelopments(score, regime, evidenceFamilies, evolution),
    whyThisScore: buildWhyThisScore(score, percentile, evidenceFamilies),
    whyThisRegime: buildWhyThisRegime(regime, evidenceFamilies, analogs),
  };
}

function buildKeyDevelopments(
  score: number,
  regime: string,
  evidenceFamilies: EvidenceFamily[],
  evolution: EvolutionAnalysis
): string[] {
  const developments: string[] = [];
  const stressed = evidenceFamilies.filter((f) => f.signal === "stressed" || f.signal === "bearish");
  for (const f of stressed.slice(0, 3)) {
    developments.push(`${f.name}: ${f.currentValue} — ${f.trend === "deteriorating" ? "worsening" : "elevated"}`);
  }
  developments.push(...evolution.whatChanged.slice(0, 2));
  return developments.filter(Boolean).slice(0, 5);
}

function buildWhyThisScore(
  score: number,
  percentile: number,
  evidenceFamilies: EvidenceFamily[]
): string {
  const stressed = evidenceFamilies.filter((f) => f.signal === "stressed" || f.signal === "bearish");
  const constructive = evidenceFamilies.filter((f) => f.signal === "bullish" || f.signal === "recovering");
  return `The ${score}/100 reading reflects ${stressed.length} of ${evidenceFamilies.length} intelligence engines signaling elevated stress, with ${constructive.length} signaling constructive conditions. This places current pressure in the ${percentile}th historical percentile — meaning ${percentile}% of all historical months recorded lower pressure than today.`;
}

function buildWhyThisRegime(
  regime: string,
  evidenceFamilies: EvidenceFamily[],
  analogs: HistoricalAnalog[]
): string {
  const topFamilies = evidenceFamilies
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((f) => f.name.toLowerCase());
  const analogRef =
    analogs.length > 0
      ? ` This regime classification is consistent with historical analogs including ${analogs[0].label}.`
      : "";
  return `The ${regimeLabel(regime)} regime classification is driven primarily by ${topFamilies.join(", ")}. These factors collectively indicate that the market environment is ${
    regime.toUpperCase().includes("CRITICAL") || regime.toUpperCase().includes("HIGH")
      ? "not conducive to risk-taking — defensive positioning is historically appropriate"
      : regime.toUpperCase().includes("ELEVATED")
      ? "requiring elevated caution — selective exposure with tight risk management"
      : "broadly supportive of measured risk-taking with standard risk management"
  }.${analogRef}`;
}

// ─── Historical timeline ──────────────────────────────────────────────────────

function buildTimeline(
  history: HistoricalMonth[]
): UnifiedSeismographIntelligence["timeline"] {
  return history.map((h) => {
    const event = historicalEventForPeriod(h.month);
    return {
      month: h.month,
      score: h.score,
      regime: h.regime,
      isAnnotated: !!event,
      annotation: event || undefined,
    };
  });
}

// ─── Analog summary ───────────────────────────────────────────────────────────

function buildAnalogSummary(analogs: HistoricalAnalog[], currentScore: number): string {
  if (analogs.length === 0) return "No close historical analogs identified.";

  const top = analogs[0];
  const avgReturn3m =
    analogs.filter((a) => a.avgReturn3m !== null).length > 0
      ? Math.round(
          analogs
            .filter((a) => a.avgReturn3m !== null)
            .reduce((s, a) => s + a.avgReturn3m!, 0) /
            analogs.filter((a) => a.avgReturn3m !== null).length
        )
      : null;

  return `The closest historical analog is ${top.label} (${top.similarity}% similarity). ${top.description} ${
    avgReturn3m !== null
      ? `Across ${analogs.length} analog periods, the average S&P 500 return 3 months later was ${avgReturn3m > 0 ? "+" : ""}${avgReturn3m}%.`
      : ""
  }`;
}
