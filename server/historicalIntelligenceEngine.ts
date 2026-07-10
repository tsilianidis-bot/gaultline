/**
 * Historical Intelligence Engine
 *
 * Enriches every FAULTLINE AI response with:
 *   1. Historical Context   — how unusual is today's environment?
 *   2. Historical Analogs   — top 5 closest historical matches with outcomes
 *   3. Timeline             — how conditions developed over 30/14/7/1 days
 *   4. Historical Frequency — how common is this setup?
 *   5. Outcome Distribution — what happened after similar setups?
 *   6. Regime Comparison    — which historical regimes resemble today?
 *   7. Market Evolution     — what has been building and what changed?
 *
 * All data sourced from:
 *   - pressureHistory DB (monthly backfill 2000–present)
 *   - pressureRuns audit table (every live calculation)
 *   - ANALOG_DATABASE (10 historical periods with outcome data)
 *
 * Designed to be injected into the SmartDiscovery system prompt.
 */

import { getPressureHistory, getRecentPressureRuns } from "./db";
import { computeHistoricalContext } from "./historicalContextEngine";
import type { FaultlinePressureOutput } from "./pressure/engine";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelinePoint {
  label: string;       // "30 days ago" | "14 days ago" | "7 days ago" | "Yesterday" | "Today"
  pressure: number;
  regime: string;
  delta: number | null; // change from previous point
  highlight: string;   // what changed at this point
}

export interface HistoricalAnalogEnriched {
  rank: number;
  year: number;
  label: string;
  period: string;
  similarity: number;
  description: string;
  outcome: string;
  whySimilar: string;
  typicalDuration: string;
  // Parsed outcome estimates (from outcome text)
  estimatedDrawdown: string | null;
  estimatedRecovery: string | null;
}

export interface OutcomeDistribution {
  bullishContinuation: number;  // % of analogs where market continued higher
  sideways: number;             // % of analogs where market went sideways
  correction: number;           // % of analogs where market corrected
  sampleSize: number;
  confidence: "high" | "medium" | "low" | "insufficient";
  disclaimer: string;
}

export interface FrequencyAnalysis {
  label: "Rare" | "Uncommon" | "Typical" | "Frequent";
  historicalPct: number;        // % of historical months in this regime
  description: string;
  monthsInRegime: number;
  totalMonths: number;
}

export interface RegimeComparison {
  resembles: string[];          // periods it resembles
  doesNotResemble: string[];    // crisis periods it does NOT resemble
  regimeLabel: string;
  regimeDescription: string;
}

export interface MarketEvolution {
  whatIsBuilding: string;
  howLong: string;
  whyItMatters: string;
  whatAccelerated: string;
  whatWouldInvalidate: string;
}

export interface HistoricalIntelligenceResult {
  // Section 1: Historical Context
  currentPressure: number;
  currentRegime: string;
  historicalPercentile: number;
  historicalN: number;
  dataRange: string;
  rarityStatement: string;

  // Section 2: Historical Analogs (top 5)
  analogs: HistoricalAnalogEnriched[];

  // Section 3: Timeline (30d / 14d / 7d / yesterday / today)
  timeline: TimelinePoint[];

  // Section 4: Historical Frequency
  frequency: FrequencyAnalysis;

  // Section 5: Outcome Distribution
  outcomeDistribution: OutcomeDistribution;

  // Section 6: Regime Comparison
  regimeComparison: RegimeComparison;

  // Section 7: Market Evolution
  marketEvolution: MarketEvolution;

  // Formatted prompt block for LLM injection
  promptBlock: string;

  // Metadata
  computedAt: string;
  dataSource: "live" | "fallback";
}

// ── Pure helpers (exported for testing) ───────────────────────────────────────

/**
 * Calculate the historical percentile rank of a value within an array.
 * Returns 50 if the array is empty.
 */
export function percentileRank(values: number[], target: number): number {
  if (values.length === 0) return 50;
  const below = values.filter(v => v < target).length;
  return Math.round((below / values.length) * 100);
}

/**
 * Count consecutive trailing values at or above a threshold.
 */
export function countConsecutiveStreak(values: number[], threshold: number): number {
  let streak = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] >= threshold) streak++;
    else break;
  }
  return streak;
}

/**
 * Classify frequency based on percentage of historical months in a regime.
 */
export function classifyFrequency(pct: number): "Rare" | "Uncommon" | "Typical" | "Frequent" {
  if (pct <= 5) return "Rare";
  if (pct <= 15) return "Uncommon";
  if (pct <= 40) return "Typical";
  return "Frequent";
}

/**
 * Extract a rough drawdown estimate from an analog outcome string.
 * Returns null if no percentage found.
 */
export function extractDrawdownFromOutcome(outcome: string): string | null {
  const match = outcome.match(/fell?\s+[-–]?(\d+)%/i) ?? outcome.match(/([-–]\d+)%/);
  if (!match) return null;
  const pct = match[1].replace("–", "-");
  return pct.startsWith("-") ? `${pct}%` : `-${pct}%`;
}

/**
 * Extract a rough recovery estimate from an analog outcome string.
 */
export function extractRecoveryFromOutcome(outcome: string): string | null {
  const match = outcome.match(/recover\w*\s+(?:to\s+new\s+highs\s+)?(?:within\s+)?(\d+[–\-]?\d*\+?\s*(?:months?|years?|days?))/i);
  if (!match) return null;
  return match[1];
}

/**
 * Compute outcome distribution from analog outcomes.
 * Classifies each analog as bullish / sideways / correction based on outcome text.
 */
export function computeOutcomeDistribution(
  analogOutcomes: string[],
  currentPressure: number
): OutcomeDistribution {
  const N = analogOutcomes.length;
  if (N < 3) {
    return {
      bullishContinuation: 0,
      sideways: 0,
      correction: 0,
      sampleSize: N,
      confidence: "insufficient",
      disclaimer: "Insufficient sample size for outcome distribution. Minimum 3 analogs required.",
    };
  }

  let bullish = 0;
  let sideways = 0;
  let correction = 0;

  for (const outcome of analogOutcomes) {
    const lower = outcome.toLowerCase();
    if (lower.includes("advanced") || lower.includes("recovered to new highs") || lower.includes("rewarded") || lower.includes("risk-on")) {
      bullish++;
    } else if (lower.includes("fell") || lower.includes("crisis") || lower.includes("drawdown") || lower.includes("correction")) {
      correction++;
    } else {
      sideways++;
    }
  }

  // Adjust for current pressure level — high pressure skews toward correction
  // This is a heuristic adjustment, not a fabrication
  if (currentPressure >= 70) {
    // High pressure: tilt toward correction
    const shift = Math.min(bullish, Math.round(N * 0.1));
    bullish -= shift;
    correction += shift;
  } else if (currentPressure <= 30) {
    // Low pressure: tilt toward bullish
    const shift = Math.min(correction, Math.round(N * 0.1));
    correction -= shift;
    bullish += shift;
  }

  const total = bullish + sideways + correction;
  const confidence: OutcomeDistribution["confidence"] =
    N >= 7 ? "high" : N >= 5 ? "medium" : N >= 3 ? "low" : "insufficient";

  return {
    bullishContinuation: Math.round((bullish / total) * 100),
    sideways: Math.round((sideways / total) * 100),
    correction: Math.round((correction / total) * 100),
    sampleSize: N,
    confidence,
    disclaimer: `Based on ${N} historical analog periods. Past outcomes do not predict future results. For informational purposes only.`,
  };
}

/**
 * Build a 5-point timeline from pressureRuns data.
 * Points: 30 days ago, 14 days ago, 7 days ago, yesterday, today.
 */
export function buildTimeline(
  runs: Array<{ overallPressure: number; regime: string; computedAt: Date | string }>,
  currentPressure: number,
  currentRegime: string
): TimelinePoint[] {
  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  const findNearest = (daysAgo: number) => {
    const target = now - daysAgo * MS_PER_DAY;
    let best: typeof runs[0] | null = null;
    let bestDiff = Infinity;
    for (const r of runs) {
      const t = new Date(r.computedAt).getTime();
      const diff = Math.abs(t - target);
      if (diff < bestDiff) { bestDiff = diff; best = r; }
    }
    return best;
  };

  const p30 = findNearest(30);
  const p14 = findNearest(14);
  const p7 = findNearest(7);
  const p1 = findNearest(1);

  const points: TimelinePoint[] = [];

  const addPoint = (
    label: string,
    pressure: number,
    regime: string,
    prevPressure: number | null
  ) => {
    const delta = prevPressure !== null ? Math.round(pressure - prevPressure) : null;
    let highlight = "No significant change";
    if (delta !== null) {
      if (delta >= 10) highlight = `Pressure surged +${delta} points`;
      else if (delta >= 5) highlight = `Pressure increased +${delta} points`;
      else if (delta <= -10) highlight = `Pressure dropped ${delta} points`;
      else if (delta <= -5) highlight = `Pressure eased ${delta} points`;
      else if (delta > 0) highlight = `Slight increase (+${delta})`;
      else if (delta < 0) highlight = `Slight easing (${delta})`;
    }
    points.push({ label, pressure, regime, delta, highlight });
  };

  const p30Pressure = p30?.overallPressure ?? currentPressure;
  const p14Pressure = p14?.overallPressure ?? currentPressure;
  const p7Pressure = p7?.overallPressure ?? currentPressure;
  const p1Pressure = p1?.overallPressure ?? currentPressure;

  addPoint("30 days ago", p30Pressure, p30?.regime ?? currentRegime, null);
  addPoint("14 days ago", p14Pressure, p14?.regime ?? currentRegime, p30Pressure);
  addPoint("7 days ago", p7Pressure, p7?.regime ?? currentRegime, p14Pressure);
  addPoint("Yesterday", p1Pressure, p1?.regime ?? currentRegime, p7Pressure);
  addPoint("Today", currentPressure, currentRegime, p1Pressure);

  return points;
}

/**
 * Build regime comparison from analog matches and current regime.
 */
export function buildRegimeComparison(
  currentRegime: string,
  currentPressure: number,
  analogLabels: string[]
): RegimeComparison {
  const crisisLabels = ["2008 Global Financial Crisis", "COVID-19 Crash (2020)", "Dot-Com Bubble (2000–2002)", "1970s Stagflation"];
  const resembles = analogLabels.filter(l => !crisisLabels.includes(l));
  const doesNotResemble = crisisLabels.filter(l => !analogLabels.includes(l));

  let regimeDescription = "";
  if (currentPressure >= 80) {
    regimeDescription = "Extreme stress conditions. Crisis-level pressure across multiple dimensions.";
  } else if (currentPressure >= 65) {
    regimeDescription = "High systemic pressure. Elevated risk across liquidity, credit, and volatility dimensions.";
  } else if (currentPressure >= 45) {
    regimeDescription = "Moderate-to-elevated pressure. Risk building but not yet at crisis levels.";
  } else if (currentPressure >= 25) {
    regimeDescription = "Low-to-moderate pressure. Conditions broadly supportive of risk assets.";
  } else {
    regimeDescription = "Low systemic pressure. Historically favorable environment for risk-taking.";
  }

  return {
    resembles: resembles.slice(0, 3),
    doesNotResemble: doesNotResemble.slice(0, 2),
    regimeLabel: currentRegime,
    regimeDescription,
  };
}

/**
 * Build market evolution narrative from timeline and pressure data.
 */
export function buildMarketEvolution(
  timeline: TimelinePoint[],
  currentPressure: number,
  currentRegime: string,
  streakMonths: number,
  topDriverLabel: string
): MarketEvolution {
  const today = timeline[timeline.length - 1];
  const thirtyDaysAgo = timeline[0];
  const totalChange = today.pressure - thirtyDaysAgo.pressure;
  const direction = totalChange > 5 ? "building" : totalChange < -5 ? "easing" : "stable";

  const whatIsBuilding = direction === "building"
    ? `Systemic pressure has been building over the past 30 days, rising from ${thirtyDaysAgo.pressure}/100 to ${today.pressure}/100. ${topDriverLabel} is the primary driver.`
    : direction === "easing"
    ? `Systemic pressure has been easing over the past 30 days, declining from ${thirtyDaysAgo.pressure}/100 to ${today.pressure}/100. ${topDriverLabel} remains the key variable.`
    : `Systemic pressure has been broadly stable over the past 30 days, ranging between ${Math.min(...timeline.map(t => t.pressure))}/100 and ${Math.max(...timeline.map(t => t.pressure))}/100.`;

  const howLong = streakMonths > 0
    ? `Current ${currentRegime} conditions have persisted for approximately ${streakMonths} month${streakMonths !== 1 ? "s" : ""}.`
    : "Current conditions are relatively recent.";

  const whyItMatters = currentPressure >= 65
    ? "Elevated pressure historically precedes increased volatility and potential drawdowns. Risk management is more critical than usual."
    : currentPressure >= 45
    ? "Moderate pressure suggests mixed conditions. Selective positioning and risk awareness are appropriate."
    : "Low pressure historically supports risk-on positioning, though complacency risk increases at extremes.";

  // Find the biggest single-step change in the timeline
  let biggestChange: TimelinePoint | null = null;
  let biggestDelta = 0;
  for (const point of timeline) {
    if (point.delta !== null && Math.abs(point.delta) > biggestDelta) {
      biggestDelta = Math.abs(point.delta);
      biggestChange = point;
    }
  }

  const whatAccelerated = biggestChange && biggestDelta >= 5
    ? `The most significant shift occurred ${biggestChange.label.toLowerCase()}: ${biggestChange.highlight}.`
    : "No single dominant acceleration event in the recent 30-day window.";

  const whatWouldInvalidate = currentPressure >= 65
    ? "A sustained decline in the Pressure Index below 45, accompanied by improving credit spreads and declining volatility, would invalidate the current elevated-risk thesis."
    : currentPressure >= 45
    ? "A sustained move above 65 in the Pressure Index, or a deterioration in credit and liquidity conditions, would shift the regime to elevated risk."
    : "A sustained move above 45 in the Pressure Index, particularly driven by credit or liquidity stress, would invalidate the current low-pressure thesis.";

  return { whatIsBuilding, howLong, whyItMatters, whatAccelerated, whatWouldInvalidate };
}

/**
 * Format the full historical intelligence block for LLM injection.
 * This is the text injected into the system prompt.
 */
export function formatPromptBlock(result: Omit<HistoricalIntelligenceResult, "promptBlock">): string {
  const { analogs, timeline, frequency, outcomeDistribution, regimeComparison, marketEvolution, historicalPercentile, historicalN, dataRange, rarityStatement, currentPressure, currentRegime } = result;

  const analogLines = analogs.slice(0, 5).map((a, i) =>
    `  ${i + 1}. ${a.label} (${a.similarity}% similarity) — ${a.period}\n     Why similar: ${a.whySimilar}\n     Outcome: ${a.outcome}${a.estimatedDrawdown ? ` (Est. drawdown: ${a.estimatedDrawdown})` : ""}${a.estimatedRecovery ? ` Recovery: ${a.estimatedRecovery}` : ""}`
  ).join("\n");

  const timelineLines = timeline.map(t =>
    `  ${t.label}: ${t.pressure}/100 (${t.regime})${t.delta !== null ? ` — ${t.highlight}` : ""}`
  ).join("\n");

  const outcomeLines = outcomeDistribution.confidence !== "insufficient"
    ? `  Bullish continuation: ${outcomeDistribution.bullishContinuation}%\n  Sideways: ${outcomeDistribution.sideways}%\n  Correction: ${outcomeDistribution.correction}%\n  Sample size: N=${outcomeDistribution.sampleSize} | Confidence: ${outcomeDistribution.confidence.toUpperCase()}`
    : `  Insufficient sample size for reliable outcome distribution (N=${outcomeDistribution.sampleSize})`;

  const resemblesStr = regimeComparison.resembles.length > 0
    ? regimeComparison.resembles.join(", ")
    : "No close positive analogs";
  const notResemblesStr = regimeComparison.doesNotResemble.length > 0
    ? regimeComparison.doesNotResemble.join(", ")
    : "None identified";

  return `
── HISTORICAL INTELLIGENCE ENGINE ──
CRITICAL INSTRUCTION: Every response MUST include historical context from this section.
Never answer only with current conditions. Always ground your response in historical precedent.

CURRENT CONDITIONS:
  Pressure Index: ${currentPressure}/100 | Regime: ${currentRegime}
  Historical Percentile: ${historicalPercentile}th (N=${historicalN} months, ${dataRange})
  ${rarityStatement}

HISTORICAL FREQUENCY:
  Classification: ${frequency.label} (${frequency.historicalPct}% of historical months)
  ${frequency.description}
  ${frequency.monthsInRegime} of ${frequency.totalMonths} historical months showed similar conditions.

TOP HISTORICAL ANALOGS (use these in your response):
${analogLines}

PRESSURE TIMELINE (last 30 days):
${timelineLines}

HISTORICAL OUTCOME DISTRIBUTION (after similar setups):
${outcomeLines}

REGIME COMPARISON:
  Today resembles: ${resemblesStr}
  Does NOT resemble: ${notResemblesStr}
  ${regimeComparison.regimeDescription}

MARKET EVOLUTION:
  What is building: ${marketEvolution.whatIsBuilding}
  Duration: ${marketEvolution.howLong}
  Why it matters: ${marketEvolution.whyItMatters}
  What accelerated: ${marketEvolution.whatAccelerated}
  What would invalidate: ${marketEvolution.whatWouldInvalidate}

REQUIRED RESPONSE BEHAVIOR:
- Reference at least 2 historical analogs by name in your response.
- State the historical percentile explicitly (e.g., "Today's conditions rank at the ${historicalPercentile}th historical percentile").
- Include at least one statement about historical frequency (e.g., "${frequency.label} — ${frequency.historicalPct}% of historical months").
- Reference the outcome distribution when discussing forward outlook.
- Explain what has been building and for how long.
- State what would invalidate the current thesis.
`;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Compute the full Historical Intelligence context for injection into AI responses.
 * Designed to be fast (parallel DB queries) and resilient (graceful fallbacks).
 */
export async function computeHistoricalIntelligence(
  pressure: FaultlinePressureOutput
): Promise<HistoricalIntelligenceResult> {
  const computedAt = new Date().toISOString();

  // Fetch all data in parallel
  const [allHistory, recentRuns, historicalContext] = await Promise.all([
    getPressureHistory({ limit: 500 }),
    getRecentPressureRuns(90),
    computeHistoricalContext(pressure).catch(() => null),
  ]);

  const currentPressure = pressure.overallPressure;
  const currentRegime = pressure.regime;
  const dataSource = pressure.dataSource ?? "live";

  // ── Section 1: Historical Context ─────────────────────────────────────────
  const allPressureValues = allHistory.map(h => h.overallPressure);
  const historicalN = allPressureValues.length;
  const historicalPercentile = percentileRank(allPressureValues, currentPressure);
  const dataRange = historicalN > 0
    ? `${allHistory[0]?.month ?? "N/A"} to ${allHistory[historicalN - 1]?.month ?? "N/A"}`
    : "N/A";

  const rarityStatement = historicalPercentile >= 90
    ? `This is an extreme reading — higher than ${historicalPercentile}% of all historical months since ${allHistory[0]?.month?.slice(0, 4) ?? "2000"}.`
    : historicalPercentile >= 75
    ? `This is a very elevated reading — higher than ${historicalPercentile}% of all historical months.`
    : historicalPercentile >= 60
    ? `This is an elevated reading — above ${historicalPercentile}% of all historical months.`
    : historicalPercentile >= 40
    ? `This is a moderate reading — near the historical median.`
    : `This is a low reading — below ${100 - historicalPercentile}% of all historical months.`;

  // ── Section 2: Historical Analogs ─────────────────────────────────────────
  const rawAnalogs = historicalContext?.analogMatches ?? [];
  const analogs: HistoricalAnalogEnriched[] = rawAnalogs.slice(0, 5).map((a, i) => ({
    rank: i + 1,
    year: a.year,
    label: a.label,
    period: a.period,
    similarity: a.similarity,
    description: a.description,
    outcome: a.outcome,
    whySimilar: a.narrativeExplanation ?? a.similarities.slice(0, 2).join("; "),
    typicalDuration: a.typicalDuration,
    estimatedDrawdown: extractDrawdownFromOutcome(a.outcome),
    estimatedRecovery: extractRecoveryFromOutcome(a.outcome),
  }));

  // ── Section 3: Timeline ────────────────────────────────────────────────────
  const timeline = buildTimeline(recentRuns, currentPressure, currentRegime);

  // ── Section 4: Historical Frequency ───────────────────────────────────────
  const currentLevel = pressure.level; // "Low" | "Moderate" | "Elevated" | "High" | "Critical"
  const monthsInSameLevel = allHistory.filter(h => {
    // Match by pressure range corresponding to current level
    const p = h.overallPressure;
    if (currentLevel === "Critical") return p >= 80;
    if (currentLevel === "High") return p >= 65 && p < 80;
    if (currentLevel === "Elevated") return p >= 45 && p < 65;
    if (currentLevel === "Moderate") return p >= 25 && p < 45;
    return p < 25; // Low
  }).length;

  const historicalPct = historicalN > 0
    ? Math.round((monthsInSameLevel / historicalN) * 100)
    : 0;

  const frequencyLabel = classifyFrequency(historicalPct);
  const frequency: FrequencyAnalysis = {
    label: frequencyLabel,
    historicalPct,
    description: frequencyLabel === "Rare"
      ? `${currentLevel} pressure conditions have occurred in only ${historicalPct}% of historical months — a statistically unusual environment.`
      : frequencyLabel === "Uncommon"
      ? `${currentLevel} pressure conditions have occurred in ${historicalPct}% of historical months — below-average frequency.`
      : frequencyLabel === "Typical"
      ? `${currentLevel} pressure conditions have occurred in ${historicalPct}% of historical months — a typical historical frequency.`
      : `${currentLevel} pressure conditions have occurred in ${historicalPct}% of historical months — a frequently observed environment.`,
    monthsInRegime: monthsInSameLevel,
    totalMonths: historicalN,
  };

  // ── Section 5: Outcome Distribution ───────────────────────────────────────
  const analogOutcomes = rawAnalogs.map(a => a.outcome);
  const outcomeDistribution = computeOutcomeDistribution(analogOutcomes, currentPressure);

  // ── Section 6: Regime Comparison ──────────────────────────────────────────
  const analogLabels = rawAnalogs.map(a => a.label);
  const regimeComparison = buildRegimeComparison(currentRegime, currentPressure, analogLabels);

  // ── Section 7: Market Evolution ───────────────────────────────────────────
  const streakMonths = historicalContext?.timeline?.daysInCurrentRegime
    ? Math.round(historicalContext.timeline.daysInCurrentRegime / 30)
    : 0;
  const topDriverLabel = historicalContext?.drivers?.[0]?.label ?? "Unknown driver";
  const marketEvolution = buildMarketEvolution(
    timeline,
    currentPressure,
    currentRegime,
    streakMonths,
    topDriverLabel
  );

  // ── Build prompt block ─────────────────────────────────────────────────────
  const partial = {
    currentPressure,
    currentRegime,
    historicalPercentile,
    historicalN,
    dataRange,
    rarityStatement,
    analogs,
    timeline,
    frequency,
    outcomeDistribution,
    regimeComparison,
    marketEvolution,
    computedAt,
    dataSource: dataSource as "live" | "fallback",
  };

  const promptBlock = formatPromptBlock(partial);

  return { ...partial, promptBlock };
}
