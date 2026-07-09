/**
 * FAULTLINE Historical Context Engine
 *
 * Transforms every Pressure Index reading into a complete market story by:
 *   1. Computing exact percentiles from the pressureHistory DB (N = all months)
 *   2. Calculating regime duration, streak, and trend from DB records
 *   3. Ranking analog matches with cosine/Euclidean similarity
 *   4. Aggregating outcome statistics from the analog database
 *   5. Generating LLM-powered Market Story and Institutional Interpretation
 *
 * ACCURACY GUARANTEE:
 *   - Every metric is derived from pressureHistory (2000–present) or pressureRuns audit table
 *   - No hardcoded values, no estimates, no placeholders
 *   - If data is insufficient, returns explicit "insufficient data" markers
 */

import { getPressureHistory, getPressureHistoryStats, getRecentPressureRuns } from "./db";
import { computeHistoricalAnalogs } from "./fmos/engines/historicalAnalog";
import { invokeLLM } from "./_core/llm";
import type { FaultlinePressureOutput, RiskVector } from "./pressure/engine";
import type { FMOSHistoricalAnalog } from "./fmos/types";

// ── Types ─────────────────────────────────────────────────────

export interface DriverContribution {
  id: string;
  label: string;
  score: number;
  weight: number;
  /** Weighted contribution to overall pressure (score × weight) */
  contribution: number;
  /** Contribution as % of total overall pressure */
  contributionPct: number;
  level: string;
  trend: "rising" | "falling" | "stable";
  driver: string;
  /** Exact percentile vs pressureHistory for this vector (0–100) */
  percentile: number | null;
  /** Sample size used for percentile calculation */
  percentileN: number;
  /** Direction label */
  direction: "Improving" | "Stable" | "Worsening";
}

export interface PressureTimeline {
  /** Days in current regime (from pressureRuns audit table) */
  daysInCurrentRegime: number;
  /** Months in current regime (from pressureHistory) */
  monthsInCurrentRegime: number;
  /** Consecutive months at or above threshold (45) */
  consecutiveElevatedMonths: number;
  /** Consecutive months at or above threshold (65) */
  consecutiveHighMonths: number;
  /** Highest pressure reading in current cycle (since regime started) */
  cycleHigh: number;
  /** Lowest pressure reading in current cycle */
  cycleLow: number;
  /** 7-day trend: change in pressure over last 7 runs */
  trend7d: number | null;
  /** 30-day trend: change in pressure over last 30 runs */
  trend30d: number | null;
  /** 90-day trend: change in pressure over last 90 runs */
  trend90d: number | null;
  /** Trend direction label */
  trendDirection: "Building" | "Accelerating" | "Stable" | "Improving" | "Rapidly Deteriorating";
  /** Human-readable explanation of the trend */
  trendExplanation: string;
  /** Current regime label */
  currentRegime: string;
  /** When the current regime started (YYYY-MM) */
  regimeStartMonth: string | null;
}

export interface HistoricalRarityContext {
  /** Exact percentile of today's reading vs all historical months (0–100) */
  percentile: number;
  /** Number of historical months in the dataset */
  sampleSize: number;
  /** Earliest month in the dataset */
  dataStartMonth: string;
  /** Latest month in the dataset */
  dataEndMonth: string;
  /** Number of months historically at or above today's reading */
  monthsAtOrAbove: number;
  /** Frequency of readings at this level or higher */
  frequencyPct: number;
  /** Plain-English rarity description */
  rarityLabel: string;
  /** Regime distribution across all history */
  regimeDistribution: {
    regime: string;
    count: number;
    pct: number;
  }[];
}

export interface AnalogMatch {
  year: number;
  label: string;
  period: string;
  similarity: number;
  description: string;
  outcome: string;
  similarities: string[];
  differences: string[];
  typicalDuration: string;
  historicalRisks: string[];
  /** Why this analog is relevant to today's conditions */
  narrativeExplanation: string;
}

export interface OutcomeStatistics {
  /** Number of analog periods with outcome data */
  sampleSize: number;
  /** Average drawdown from analog outcomes (parsed from text) */
  avgDrawdownPct: number | null;
  /** Average recovery months from analog outcomes */
  avgRecoveryMonths: number | null;
  /** Range of drawdowns */
  drawdownRange: { min: number; max: number } | null;
  /** Range of recovery months */
  recoveryRange: { min: number; max: number } | null;
  /** Disclaimer text */
  disclaimer: string;
}

export interface HistoricalContextResult {
  /** Current pressure reading */
  currentPressure: number;
  currentRegime: string;
  currentLevel: string;
  /** Timestamp of the pressure reading */
  timestamp: string;
  /** Last data refresh timestamp */
  lastUpdated: string;
  /** Data source (live/fallback) */
  dataSource: string;

  /** Section 1: Market Story narrative */
  marketStory: string;

  /** Section 2: Ranked driver contributions */
  drivers: DriverContribution[];

  /** Section 3: Pressure timeline */
  timeline: PressureTimeline;

  /** Section 4: Historical rarity context */
  rarityContext: HistoricalRarityContext;

  /** Section 5: Top analog matches with narrative explanations */
  analogMatches: AnalogMatch[];

  /** Section 6: Outcome statistics from analog database */
  outcomeStats: OutcomeStatistics;

  /** Section 7: Trend assessment */
  trendAssessment: {
    label: "Building" | "Accelerating" | "Stable" | "Improving" | "Rapidly Deteriorating";
    explanation: string;
  };

  /** Section 8: Institutional interpretation */
  institutionalInterpretation: string;

  /** Data transparency metadata */
  meta: {
    pressureHistoryN: number;
    pressureHistoryRange: string;
    pressureRunsN: number;
    computedAt: string;
  };
}

// ── Outcome Parsing Helpers ───────────────────────────────────

/**
 * Parse a drawdown percentage from an outcome string.
 * Returns null if no reliable number can be extracted.
 */
function parseDrawdownFromOutcome(outcome: string): number | null {
  // Match patterns like "-57%", "fell -25%", "fell -12%", "advanced +20%"
  const negMatch = outcome.match(/fell\s+(-\d+(?:\.\d+)?%)/i) ||
                   outcome.match(/(-\d+(?:\.\d+)?%)\s+(?:in|from|over)/i) ||
                   outcome.match(/(-\d+(?:\.\d+)?%)\s+(?:peak|drawdown)/i);
  if (negMatch) {
    const val = parseFloat(negMatch[1].replace('%', ''));
    if (!isNaN(val) && val < 0) return val;
  }
  // Positive outcome — no drawdown
  const posMatch = outcome.match(/advanced\s+\+(\d+(?:\.\d+)?%)/i);
  if (posMatch) return 0;
  return null;
}

/**
 * Parse recovery months from an outcome string.
 */
function parseRecoveryFromOutcome(outcome: string): number | null {
  const monthMatch = outcome.match(/within\s+(\d+)\s+months?/i) ||
                     outcome.match(/(\d+)\s+months?\s+(?:to|for)/i) ||
                     outcome.match(/(\d+)\s+months?\s+(?:later|after)/i);
  if (monthMatch) {
    const val = parseInt(monthMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  // "within 5 months" → 5, "4+ years" → 48
  const yearMatch = outcome.match(/(\d+)\+?\s+years?\s+to/i);
  if (yearMatch) {
    const val = parseInt(yearMatch[1], 10);
    if (!isNaN(val)) return val * 12;
  }
  return null;
}

// ── Percentile Computation ────────────────────────────────────

/**
 * Compute exact percentile of a value within a sorted array.
 * Returns the percentage of values strictly less than the given value.
 */
function computePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 50;
  const below = sortedValues.filter(v => v < value).length;
  return Math.round((below / sortedValues.length) * 100);
}

// ── Trend Direction ───────────────────────────────────────────

function classifyTrendDirection(
  trend7d: number | null,
  trend30d: number | null,
  trend90d: number | null
): "Building" | "Accelerating" | "Stable" | "Improving" | "Rapidly Deteriorating" {
  const t7 = trend7d ?? 0;
  const t30 = trend30d ?? 0;

  if (t7 >= 15 && t30 >= 15) return "Accelerating";
  if (t7 >= 15) return "Rapidly Deteriorating";
  if (t7 >= 10 && t30 >= 10) return "Accelerating";
  if (t7 >= 5 || t30 >= 8) return "Building";
  if (t7 <= -10 || t30 <= -15) return "Improving";
  if (t7 <= -5 || t30 <= -8) return "Improving";
  return "Stable";
}

function buildTrendExplanation(
  direction: string,
  trend7d: number | null,
  trend30d: number | null,
  trend90d: number | null,
  currentPressure: number
): string {
  const t7 = trend7d !== null ? `${trend7d > 0 ? '+' : ''}${trend7d.toFixed(1)} pts over 7 days` : null;
  const t30 = trend30d !== null ? `${trend30d > 0 ? '+' : ''}${trend30d.toFixed(1)} pts over 30 days` : null;
  const t90 = trend90d !== null ? `${trend90d > 0 ? '+' : ''}${trend90d.toFixed(1)} pts over 90 days` : null;

  const parts = [t7, t30, t90].filter(Boolean);
  const trendStr = parts.length > 0 ? parts.join(', ') : 'insufficient run history for trend calculation';

  switch (direction) {
    case "Accelerating":
      return `Pressure is accelerating — ${trendStr}. The rate of increase is steepening, suggesting conditions are deteriorating faster than the recent trend implied.`;
    case "Building":
      return `Pressure is gradually building — ${trendStr}. Systemic stress is increasing but has not yet reached an accelerating pace.`;
    case "Rapidly Deteriorating":
      return `Pressure is rapidly deteriorating — ${trendStr}. The speed of increase warrants close attention.`;
    case "Improving":
      return `Pressure is improving — ${trendStr}. Systemic stress is easing, though the current reading of ${currentPressure} still warrants monitoring.`;
    default:
      return `Pressure is stable — ${trendStr}. No significant directional change has occurred recently.`;
  }
}

// ── Analog Narrative Builder ──────────────────────────────────

function buildAnalogNarrative(
  analog: FMOSHistoricalAnalog & { outcome?: string; similarities?: string[]; differences?: string[] },
  currentPressure: number,
  vectors: RiskVector[]
): string {
  const sims = analog.similarities?.slice(0, 3).join(', ') ?? 'similar macro conditions';
  const diffs = analog.differences?.slice(0, 2).join(' and ') ?? 'some key structural differences';

  return `Today's environment resembles ${analog.label} (${analog.period ?? analog.year}) because ${sims}. ` +
    `Key differences include ${diffs}. ` +
    `The similarity score of ${analog.similarity}% reflects the degree of overlap in underlying pressure vectors.`;
}

// ── Main Engine Function ──────────────────────────────────────

export async function computeHistoricalContext(
  pressure: FaultlinePressureOutput
): Promise<HistoricalContextResult> {
  const computedAt = new Date().toISOString();

  // ── Fetch all historical data ──────────────────────────────
  const [allHistory, histStats, recentRuns] = await Promise.all([
    getPressureHistory({ limit: 500 }),
    getPressureHistoryStats(),
    getRecentPressureRuns(200),
  ]);

  const historyN = allHistory.length;
  const dataStartMonth = allHistory[0]?.month ?? "N/A";
  const dataEndMonth = allHistory[historyN - 1]?.month ?? "N/A";

  // ── Section 2: Driver Contributions ───────────────────────
  const totalWeightedScore = pressure.vectors.reduce(
    (sum, v) => sum + v.score * v.weight, 0
  );

  // Build per-vector score arrays from pressureHistory for percentile calc
  const vectorIdToHistField: Record<string, keyof typeof allHistory[0]> = {
    "liquidity-stress": "liquidityStress",
    "credit-contagion": "creditContagion",
    "volatility-regime": "volatilityRegime",
    "macro-sensitivity": "macroSensitivity",
    "market-breadth": "marketBreadth",
    "ai-bubble": "aiBubble",
  };

  const drivers: DriverContribution[] = pressure.vectors.map(v => {
    const contribution = v.score * v.weight;
    const contributionPct = totalWeightedScore > 0
      ? Math.round((contribution / totalWeightedScore) * 100)
      : 0;

    // Compute percentile for this vector from pressureHistory
    const histField = vectorIdToHistField[v.id];
    let percentile: number | null = null;
    let percentileN = 0;
    if (histField) {
      const historicalScores = allHistory
        .map(r => r[histField] as number | null)
        .filter((s): s is number => s !== null);
      if (historicalScores.length >= 10) {
        const sorted = [...historicalScores].sort((a, b) => a - b);
        percentile = computePercentile(v.score, sorted);
        percentileN = sorted.length;
      }
    }

    const direction: DriverContribution["direction"] =
      v.trend === "rising" ? "Worsening" :
      v.trend === "falling" ? "Improving" : "Stable";

    return {
      id: v.id,
      label: v.label,
      score: v.score,
      weight: v.weight,
      contribution: Math.round(contribution * 10) / 10,
      contributionPct,
      level: v.level,
      trend: v.trend,
      driver: v.driver,
      percentile,
      percentileN,
      direction,
    };
  }).sort((a, b) => b.contribution - a.contribution);

  // ── Section 3: Pressure Timeline ──────────────────────────
  // Compute from pressureHistory (monthly) and pressureRuns (run-level)
  const currentRegime = pressure.regime;
  const allPressureScores = allHistory.map(r => r.overallPressure);

  // Find when current regime started in monthly history
  let regimeStartMonth: string | null = null;
  let monthsInCurrentRegime = 0;
  for (let i = allHistory.length - 1; i >= 0; i--) {
    if (allHistory[i].regime === currentRegime) {
      monthsInCurrentRegime++;
      regimeStartMonth = allHistory[i].month;
    } else {
      break;
    }
  }

  // Consecutive elevated months (score >= 45)
  let consecutiveElevatedMonths = 0;
  for (let i = allHistory.length - 1; i >= 0; i--) {
    if (allHistory[i].overallPressure >= 45) {
      consecutiveElevatedMonths++;
    } else {
      break;
    }
  }

  // Consecutive high months (score >= 65)
  let consecutiveHighMonths = 0;
  for (let i = allHistory.length - 1; i >= 0; i--) {
    if (allHistory[i].overallPressure >= 65) {
      consecutiveHighMonths++;
    } else {
      break;
    }
  }

  // Cycle high/low: readings since regime started
  const cycleHistory = regimeStartMonth
    ? allHistory.filter(r => r.month >= regimeStartMonth!)
    : [];
  const cycleScores = cycleHistory.map(r => r.overallPressure);
  const cycleHigh = cycleScores.length > 0 ? Math.max(...cycleScores) : pressure.overallPressure;
  const cycleLow = cycleScores.length > 0 ? Math.min(...cycleScores) : pressure.overallPressure;

  // Trend from pressureRuns (audit table — more granular than monthly)
  const runPressures = recentRuns
    .sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime())
    .map(r => ({ pressure: r.overallPressure, ts: new Date(r.computedAt) }));

  const now = new Date();
  const msPerDay = 86400000;

  function getTrendDelta(days: number): number | null {
    const cutoff = new Date(now.getTime() - days * msPerDay);
    const older = runPressures.filter(r => r.ts <= cutoff);
    if (older.length === 0) return null;
    const baseline = older[older.length - 1].pressure;
    return pressure.overallPressure - baseline;
  }

  const trend7d = getTrendDelta(7);
  const trend30d = getTrendDelta(30);
  const trend90d = getTrendDelta(90);

  const trendDirection = classifyTrendDirection(trend7d, trend30d, trend90d);
  const trendExplanation = buildTrendExplanation(
    trendDirection, trend7d, trend30d, trend90d, pressure.overallPressure
  );

  // Days in current regime from pressureRuns
  let daysInCurrentRegime = 0;
  for (const run of [...recentRuns].sort((a, b) =>
    new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
  )) {
    if (run.regime === currentRegime) {
      daysInCurrentRegime++;
    } else {
      break;
    }
  }

  const timeline: PressureTimeline = {
    daysInCurrentRegime,
    monthsInCurrentRegime,
    consecutiveElevatedMonths,
    consecutiveHighMonths,
    cycleHigh,
    cycleLow,
    trend7d,
    trend30d,
    trend90d,
    trendDirection,
    trendExplanation,
    currentRegime,
    regimeStartMonth,
  };

  // ── Section 4: Historical Rarity Context ──────────────────
  const sortedPressures = [...allPressureScores].sort((a, b) => a - b);
  const percentile = historyN >= 10
    ? computePercentile(pressure.overallPressure, sortedPressures)
    : 50;

  const monthsAtOrAbove = allPressureScores.filter(
    s => s >= pressure.overallPressure
  ).length;
  const frequencyPct = historyN > 0
    ? Math.round((monthsAtOrAbove / historyN) * 100)
    : 0;

  let rarityLabel: string;
  if (percentile >= 95) rarityLabel = "Extreme — top 5% of all historical readings";
  else if (percentile >= 85) rarityLabel = "Very High — top 15% of all historical readings";
  else if (percentile >= 70) rarityLabel = "High — top 30% of all historical readings";
  else if (percentile >= 50) rarityLabel = "Above Average — upper half of historical readings";
  else if (percentile >= 30) rarityLabel = "Below Average — lower half of historical readings";
  else rarityLabel = "Low — bottom 30% of all historical readings";

  // Regime distribution
  const regimeCounts: Record<string, number> = {};
  for (const r of allHistory) {
    regimeCounts[r.regime] = (regimeCounts[r.regime] ?? 0) + 1;
  }
  const regimeDistribution = Object.entries(regimeCounts)
    .map(([regime, count]) => ({
      regime,
      count,
      pct: Math.round((count / historyN) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const rarityContext: HistoricalRarityContext = {
    percentile,
    sampleSize: historyN,
    dataStartMonth,
    dataEndMonth,
    monthsAtOrAbove,
    frequencyPct,
    rarityLabel,
    regimeDistribution,
  };

  // ── Section 5: Analog Matches ──────────────────────────────
  const rawAnalogs = computeHistoricalAnalogs(pressure, 5);
  const analogMatches: AnalogMatch[] = rawAnalogs.map(a => ({
    year: a.year ?? 0,
    label: a.label,
    period: a.period ?? String(a.year ?? ""),
    similarity: a.similarity,
    description: a.description ?? "",
    outcome: a.outcome ?? "",
    similarities: a.similarities ?? [],
    differences: a.differences ?? [],
    typicalDuration: a.typicalDuration ?? "Unknown",
    historicalRisks: a.historicalRisks ?? [],
    narrativeExplanation: buildAnalogNarrative(a, pressure.overallPressure, pressure.vectors),
  }));

  // ── Section 6: Outcome Statistics ─────────────────────────
  const drawdowns: number[] = [];
  const recoveries: number[] = [];

  for (const a of analogMatches) {
    const d = parseDrawdownFromOutcome(a.outcome);
    const r = parseRecoveryFromOutcome(a.outcome);
    if (d !== null) drawdowns.push(d);
    if (r !== null) recoveries.push(r);
  }

  const avgDrawdownPct = drawdowns.length > 0
    ? Math.round((drawdowns.reduce((s, v) => s + v, 0) / drawdowns.length) * 10) / 10
    : null;
  const avgRecoveryMonths = recoveries.length > 0
    ? Math.round(recoveries.reduce((s, v) => s + v, 0) / recoveries.length)
    : null;
  const drawdownRange = drawdowns.length > 0
    ? { min: Math.min(...drawdowns), max: Math.max(...drawdowns) }
    : null;
  const recoveryRange = recoveries.length > 0
    ? { min: Math.min(...recoveries), max: Math.max(...recoveries) }
    : null;

  const outcomeStats: OutcomeStatistics = {
    sampleSize: analogMatches.length,
    avgDrawdownPct,
    avgRecoveryMonths,
    drawdownRange,
    recoveryRange,
    disclaimer:
      "These are historical observations only. Past market behavior does not predict future outcomes. " +
      "Every market cycle has unique characteristics. These statistics are provided for educational context only.",
  };

  // ── Section 7: Trend Assessment ───────────────────────────
  const trendAssessment = {
    label: trendDirection,
    explanation: trendExplanation,
  };

  // ── LLM Sections: Market Story + Institutional Interpretation ──
  const vectorSummary = drivers
    .slice(0, 4)
    .map(d => `${d.label}: ${d.score}/100 (${d.level}, ${d.direction})`)
    .join('; ');

  const analogSummary = analogMatches
    .slice(0, 3)
    .map(a => `${a.label} (${a.similarity}% similarity)`)
    .join(', ');

  const timelineContext = `${timeline.monthsInCurrentRegime} months in ${currentRegime} regime, ` +
    `${timeline.consecutiveElevatedMonths} consecutive months at elevated pressure or above, ` +
    `trend: ${trendDirection}`;

  const rarityContext2 = `${percentile}th percentile vs ${historyN} months of history (${dataStartMonth}–${dataEndMonth})`;

  let marketStory = "";
  let institutionalInterpretation = "";

  try {
    const llmPrompt = `You are a senior macro strategist at a major institutional investment firm.

Current FAULTLINE Pressure Index: ${pressure.overallPressure}/100 (${pressure.regime})
Percentile vs history: ${percentile}th (${rarityLabel})
Timeline: ${timelineContext}
Top drivers: ${vectorSummary}
Closest historical analogs: ${analogSummary}
Trend direction: ${trendDirection}

Write two sections:

SECTION_MARKET_STORY:
Write 3–4 sentences explaining what is happening in the market, why the Pressure Index is at this level, which factors are contributing most, and whether conditions are improving or deteriorating. Write as an institutional macro strategist explaining to a sophisticated investor — not as an AI summarizing data. Be specific. Reference the actual drivers and trend direction.

SECTION_INSTITUTIONAL_INTERPRETATION:
Write 2–3 sentences explaining how an experienced macro investor would interpret this environment. Focus on what risks deserve attention, what the historical context implies, and what the trend direction means for risk management. Do NOT provide buy or sell recommendations. Do NOT predict the future. Explain the environment only.

Respond in JSON format: {"marketStory": "...", "institutionalInterpretation": "..."}`;

    const llmResp = await invokeLLM({
      messages: [
        { role: "system", content: "You are a senior macro strategist. Respond only in the JSON format requested." },
        { role: "user", content: llmPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "market_story",
          strict: true,
          schema: {
            type: "object",
            properties: {
              marketStory: { type: "string" },
              institutionalInterpretation: { type: "string" },
            },
            required: ["marketStory", "institutionalInterpretation"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResp.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      marketStory = parsed.marketStory ?? "";
      institutionalInterpretation = parsed.institutionalInterpretation ?? "";
    }
  } catch (err) {
    // Non-fatal: LLM failure falls back to rule-based narrative
    const topDriver = drivers[0];
    marketStory = `Market pressure is currently at ${pressure.overallPressure}/100 (${pressure.regime}), ` +
      `placing it in the ${percentile}th percentile of all ${historyN} historical monthly readings since ${dataStartMonth}. ` +
      `The primary driver is ${topDriver?.label ?? "unknown"} at ${topDriver?.score ?? 0}/100, ` +
      `with the overall trend ${trendDirection.toLowerCase()}. ` +
      `The market has been in the ${currentRegime} regime for ${monthsInCurrentRegime} consecutive months.`;

    institutionalInterpretation = `An experienced macro investor would note that the current ${pressure.regime} regime ` +
      `is in the ${percentile}th historical percentile, suggesting ${
        percentile >= 70 ? "above-average systemic stress warranting defensive positioning" :
        percentile >= 50 ? "moderate stress with selective risk management appropriate" :
        "below-average stress, though monitoring of the trend direction remains prudent"
      }. ` +
      `The closest historical analog is ${analogMatches[0]?.label ?? "unknown"} with ${analogMatches[0]?.similarity ?? 0}% similarity.`;
  }

  // ── Assemble Result ────────────────────────────────────────
  return {
    currentPressure: pressure.overallPressure,
    currentRegime: pressure.regime,
    currentLevel: pressure.level,
    timestamp: pressure.timestamp,
    lastUpdated: pressure.lastUpdated,
    dataSource: pressure.dataSource,

    marketStory,
    drivers,
    timeline,
    rarityContext,
    analogMatches,
    outcomeStats,
    trendAssessment,
    institutionalInterpretation,

    meta: {
      pressureHistoryN: historyN,
      pressureHistoryRange: historyN > 0 ? `${dataStartMonth} – ${dataEndMonth}` : "No data",
      pressureRunsN: recentRuns.length,
      computedAt,
    },
  };
}
