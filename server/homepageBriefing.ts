/**
 * Homepage Briefing Engine
 *
 * Computes all data needed for the three new dashboard sections:
 *   1. Today's Market Story (LLM-generated institutional briefing)
 *   2. Why Today Is Different (delta cards from pressureRuns history)
 *   3. History Says (percentile, analogs, streak, probabilities)
 *   4. Market Evolution Timeline (last 28 pressure readings)
 *
 * Current readings bind to the authoritative canonical state.
 * Missing evidence is withheld as UNAVAILABLE — never invented from a live recalc.
 */

import { computeHistoricalContext } from "./historicalContextEngine";
import { getPressureHistory, getRecentPressureRuns } from "./db";
import { invokeLLM } from "./_core/llm";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import {
  projectPressureFromCanonical,
  selectScenarioProbabilities,
} from "./canonicalPressureProjection";
import { describeHistoricalPercentile, formatOrdinal } from "../shared/historicalPercentile";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeltaCard {
  label: string;
  current: string;
  previous: string | null;
  change: string | null;
  direction: "up" | "down" | "neutral";
  color: string;
  significance: "high" | "medium" | "low";
}

export interface HomepageBriefingResult {
  /** ISO timestamp of when this briefing was computed */
  computedAt: string;
  /** Canonical bind status — never a live recalc or silent fallback */
  dataSource: "canonical" | "unavailable";
  availability: "AVAILABLE" | "UNAVAILABLE";
  canonicalStateId: string | null;
  qualityStatus: string | null;

  // ── Section 1: Today's Market Story ──────────────────────────────────────
  marketStory: string;
  marketStoryHeadline: string;

  // ── Section 2: Why Today Is Different ────────────────────────────────────
  whyTodayIsDifferent: {
    pressureDelta: DeltaCard;
    regimeDelta: DeltaCard;
    bullProbDelta: DeltaCard;
    crashProbDelta: DeltaCard;
    biggestImproving: DeltaCard | null;
    biggestDeteriorating: DeltaCard | null;
    biggestMacroDriver: string;
    biggestRiskIncrease: string;
    biggestPositiveDevelopment: string;
    hasPreviousReading: boolean;
    previousReadingAge: string | null;
  };

  // ── Section 3: History Says ───────────────────────────────────────────────
  historySays: {
    historicalPercentile: number;
    percentileLabel: string;
    closestAnalogs: Array<{
      label: string;
      year: number;
      similarity: number;
      outcome: string;
    }>;
    currentRegimeDuration: number; // months
    consecutiveElevatedStreak: number; // months above 45
    avgDurationSimilarEnvironments: number | null;
    historicalBullContinuationRate: number | null;
    historicalElevatedVolatilityRate: number | null;
    historicalCorrectionProbability: number | null;
    historicalRecoveryProbability: number | null;
    confidenceLevel: "high" | "medium" | "low" | "insufficient";
    historicalSampleSize: number;
    historicalDateRange: string;
    plainEnglishSummary: string;
    insufficientData: boolean;
  };

  // ── Section 4: Market Evolution Timeline ─────────────────────────────────
  timeline: Array<{
    label: string; // "Today", "1d ago", "7d ago", etc.
    pressure: number;
    regime: string;
  }>;
  timelineCaption: string;

  // ── Enhanced metric context ───────────────────────────────────────────────
  metrics: {
    pressureIndex: {
      current: number | null;
      todayChange: number | null;
      sevenDayChange: number | null;
      thirtyDayChange: number | null;
      streak: number;
      streakDirection: "rising" | "falling" | "stable";
      historicalPercentile: number | null;
      historicalComparison: string;
      institutionalInterpretation: string;
    };
    regime: string | null;
    regimeLevel: string | null;
    bullProbability: number | null;
    crashProbability: number | null;
    opportunityScore: number | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAge(computedAt: Date): string {
  const mins = Math.floor((Date.now() - computedAt.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function directionOf(current: number, previous: number): "up" | "down" | "neutral" {
  if (current > previous + 0.5) return "up";
  if (current < previous - 0.5) return "down";
  return "neutral";
}

function colorForDirection(dir: "up" | "down" | "neutral", higherIsBad: boolean): string {
  if (dir === "neutral") return "#64748B";
  if (higherIsBad) return dir === "up" ? "#FF2D55" : "#00FF88";
  return dir === "up" ? "#00FF88" : "#FF2D55";
}

function unavailableHomepageBriefing(
  computedAt: string,
  canonicalStateId: string | null = null,
  qualityStatus: string | null = "UNAVAILABLE",
): HomepageBriefingResult {
  const unavailableCard = (label: string): DeltaCard => ({
    label,
    current: "UNAVAILABLE",
    previous: null,
    change: null,
    direction: "neutral",
    color: "#64748B",
    significance: "low",
  });
  return {
    computedAt,
    dataSource: "unavailable",
    availability: "UNAVAILABLE",
    canonicalStateId,
    qualityStatus,
    marketStory: "CURRENT market briefing is UNAVAILABLE. No canonical intelligence state is bound — readings are withheld rather than recalculated.",
    marketStoryHeadline: "UNAVAILABLE — NO CANONICAL STATE",
    whyTodayIsDifferent: {
      pressureDelta: unavailableCard("Pressure Index"),
      regimeDelta: unavailableCard("Regime"),
      bullProbDelta: unavailableCard("Bull Continuation"),
      crashProbDelta: unavailableCard("Crash / Drawdown"),
      biggestImproving: null,
      biggestDeteriorating: null,
      biggestMacroDriver: "UNAVAILABLE",
      biggestRiskIncrease: "UNAVAILABLE",
      biggestPositiveDevelopment: "UNAVAILABLE",
      hasPreviousReading: false,
      previousReadingAge: null,
    },
    historySays: {
      historicalPercentile: 0,
      percentileLabel: "UNAVAILABLE",
      closestAnalogs: [],
      currentRegimeDuration: 0,
      consecutiveElevatedStreak: 0,
      avgDurationSimilarEnvironments: null,
      historicalBullContinuationRate: null,
      historicalElevatedVolatilityRate: null,
      historicalCorrectionProbability: null,
      historicalRecoveryProbability: null,
      confidenceLevel: "insufficient",
      historicalSampleSize: 0,
      historicalDateRange: "UNAVAILABLE",
      plainEnglishSummary: "Historical comparison is withheld until a canonical CURRENT state is available.",
      insufficientData: true,
    },
    timeline: [],
    timelineCaption: "UNAVAILABLE",
    metrics: {
      pressureIndex: {
        current: null,
        todayChange: null,
        sevenDayChange: null,
        thirtyDayChange: null,
        streak: 0,
        streakDirection: "stable",
        historicalPercentile: null,
        historicalComparison: "UNAVAILABLE",
        institutionalInterpretation: "Canonical market state is unavailable. No CURRENT briefing is manufactured.",
      },
      regime: null,
      regimeLevel: null,
      bullProbability: null,
      crashProbability: null,
      opportunityScore: null,
    },
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function computeHomepageBriefing(): Promise<HomepageBriefingResult> {
  const now = new Date();
  const canonical = await getAuthoritativeCanonicalIntelligenceState().catch(() => null);
  const pressure = projectPressureFromCanonical(canonical);
  if (!canonical || !pressure) {
    return unavailableHomepageBriefing(
      now.toISOString(),
      canonical?.stateId ?? null,
      canonical?.confidenceOrEvidenceQuality ?? "UNAVAILABLE",
    );
  }

  const [histContext, recentRuns, historyRows] = await Promise.all([
    computeHistoricalContext(pressure).catch(() => null),
    getRecentPressureRuns(90),
    getPressureHistory({ limit: 36 }),
  ]);
  const scenarios = selectScenarioProbabilities(canonical);

  // ── Section 2: Why Today Is Different ──────────────────────────────────────
  // Use pressureRuns for recent delta (last run vs current)
  const prevRun = recentRuns.length > 1 ? recentRuns[1] : null;
  const prevVectors = prevRun?.vectorsJson ? (() => {
    try { return JSON.parse(prevRun.vectorsJson) as Array<{ id: string; score: number; label: string }>; }
    catch { return null; }
  })() : null;

  const currentOverall = pressure.overallPressure;
  const prevOverall = prevRun ? prevRun.overallPressure : null;
  const overallDelta = prevOverall !== null ? currentOverall - prevOverall : null;
  const overallDir = prevOverall !== null ? directionOf(currentOverall, prevOverall) : "neutral";

  // Vector deltas
  const vectorDeltas: DeltaCard[] = pressure.vectors.map(v => {
    const prevV = prevVectors?.find(p => p.id === v.id);
    const delta = prevV ? v.score - prevV.score : null;
    const dir = prevV ? directionOf(v.score, prevV.score) : "neutral";
    return {
      label: v.label,
      current: `${v.score.toFixed(1)}/100`,
      previous: prevV ? `${prevV.score.toFixed(1)}/100` : null,
      change: delta !== null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` : null,
      direction: dir,
      color: colorForDirection(dir, true),
      significance: Math.abs(delta ?? 0) >= 1.5 ? "high" : Math.abs(delta ?? 0) >= 0.5 ? "medium" : "low",
    };
  });

  const improving = vectorDeltas
    .filter(d => d.direction === "down" && d.change !== null)
    .sort((a, b) => parseFloat(a.change!) - parseFloat(b.change!));
  const deteriorating = vectorDeltas
    .filter(d => d.direction === "up" && d.change !== null)
    .sort((a, b) => parseFloat(b.change!) - parseFloat(a.change!));

  const bullProb = scenarios.bull;
  const crashProb = scenarios.crash;

  const whyTodayIsDifferent = {
    pressureDelta: {
      label: "Pressure Index",
      current: `${currentOverall}/100`,
      previous: prevOverall !== null ? `${prevOverall}/100` : null,
      change: overallDelta !== null ? `${overallDelta >= 0 ? "+" : ""}${overallDelta}` : null,
      direction: overallDir,
      color: colorForDirection(overallDir, true),
      significance: (Math.abs(overallDelta ?? 0) >= 5 ? "high" : Math.abs(overallDelta ?? 0) >= 2 ? "medium" : "low") as "high" | "medium" | "low",
    },
    regimeDelta: {
      label: "Regime",
      current: pressure.regime,
      previous: prevRun?.regime ?? null,
      change: prevRun && prevRun.regime !== pressure.regime ? "Changed" : prevRun ? "Unchanged" : null,
      direction: "neutral" as const,
      color: "#00D4FF",
      significance: (prevRun && prevRun.regime !== pressure.regime ? "high" : "low") as "high" | "medium" | "low",
    },
    bullProbDelta: {
      label: "Bull Continuation",
      current: bullProb !== null ? `${Math.round(bullProb)}%` : "UNAVAILABLE",
      previous: null,
      change: null,
      direction: "neutral" as const,
      color: "#00FF88",
      significance: "medium" as const,
    },
    crashProbDelta: {
      label: "Crash / Drawdown",
      current: crashProb !== null ? `${Math.round(crashProb)}%` : "UNAVAILABLE",
      previous: null,
      change: null,
      direction: "neutral" as const,
      color: "#FF2D55",
      significance: "medium" as const,
    },
    biggestImproving: improving[0] ?? null,
    biggestDeteriorating: deteriorating[0] ?? null,
    biggestMacroDriver: deteriorating[0]?.label ?? pressure.vectors.sort((a, b) => b.score - a.score)[0]?.label ?? "Macro Sensitivity",
    biggestRiskIncrease: deteriorating[0]?.label ?? "No significant risk increase detected",
    biggestPositiveDevelopment: improving[0]?.label ?? "No significant positive development detected",
    hasPreviousReading: prevRun !== null,
    previousReadingAge: prevRun ? formatAge(new Date(prevRun.computedAt)) : null,
  };

  // ── Section 3: History Says ─────────────────────────────────────────────────
  const histRows = historyRows;
  const N = histRows.length;
  const INSUFFICIENT_THRESHOLD = 12;

  let historySays: HomepageBriefingResult["historySays"];

  if (N < INSUFFICIENT_THRESHOLD) {
    historySays = {
      historicalPercentile: 0,
      percentileLabel: "Insufficient data",
      closestAnalogs: [],
      currentRegimeDuration: 0,
      consecutiveElevatedStreak: 0,
      avgDurationSimilarEnvironments: null,
      historicalBullContinuationRate: null,
      historicalElevatedVolatilityRate: null,
      historicalCorrectionProbability: null,
      historicalRecoveryProbability: null,
      confidenceLevel: "insufficient",
      historicalSampleSize: N,
      historicalDateRange: N > 0 ? `${histRows[0].month} – ${histRows[N - 1].month}` : "No data",
      plainEnglishSummary: "Insufficient historical data for reliable comparison.",
      insufficientData: true,
    };
  } else {
    // Percentile: rank current pressure among all historical months
    const sorted = [...histRows].sort((a, b) => a.overallPressure - b.overallPressure);
    const rank = sorted.filter(r => r.overallPressure <= currentOverall).length;
    const percentile = Math.round((rank / N) * 100);

    // Regime duration: count consecutive months ending at latest with same regime
    const latestRegime = pressure.regime;
    const sortedDesc = [...histRows].sort((a, b) => b.month.localeCompare(a.month));
    let regimeDuration = 0;
    for (const row of sortedDesc) {
      if (row.regime === latestRegime) regimeDuration++;
      else break;
    }

    // Consecutive elevated streak (pressure >= 45)
    let elevatedStreak = 0;
    for (const row of sortedDesc) {
      if (row.overallPressure >= 45) elevatedStreak++;
      else break;
    }

    // Historical rates from analog context
    const analogMatches = histContext?.analogMatches ?? [];
    const analogs = analogMatches.slice(0, 3).map(a => ({
      label: a.label,
      year: a.year,
      similarity: a.similarity,
      outcome: a.outcome ?? "Historical outcome data available",
    }));

    // Outcome stats from historical context
    const outcomeStats = histContext?.outcomeStats;
    const bullContinuation = null;
    const correctionProb = outcomeStats?.avgDrawdownPct != null ? Math.min(95, Math.round(Math.abs(outcomeStats.avgDrawdownPct))) : null;
    const recoveryProb = null;
    const elevatedVolRate = null;

    const percentileLabel =
      percentile >= 90 ? "Extreme — top 10% of all historical readings" :
      percentile >= 75 ? "Very High — top 25% of all historical readings" :
      percentile >= 60 ? "Elevated — above 60% of all historical readings" :
      percentile >= 40 ? "Moderate — near historical median" :
      percentile >= 25 ? "Low — below 75% of all historical readings" :
      "Very Low — bottom 25% of all historical readings";

    const confidence: "high" | "medium" | "low" = N >= 60 ? "high" : N >= 24 ? "medium" : "low";

    const plainEnglishSummary = analogMatches.length > 0
      ? `Today's pressure reading of ${currentOverall}/100 ranks at the ${formatOrdinal(percentile)} percentile (${describeHistoricalPercentile(percentile)}) of all ${N} historical months analyzed. The closest historical analog is ${analogMatches[0].label} (${analogMatches[0].similarity}% similarity). Current conditions have persisted for approximately ${regimeDuration} month${regimeDuration !== 1 ? "s" : ""}.`
      : `Today's pressure reading of ${currentOverall}/100 ranks at the ${formatOrdinal(percentile)} percentile (${describeHistoricalPercentile(percentile)}) of all ${N} historical months analyzed. Current ${latestRegime} conditions have persisted for approximately ${regimeDuration} month${regimeDuration !== 1 ? "s" : ""}.`;

    historySays = {
      historicalPercentile: percentile,
      percentileLabel,
      closestAnalogs: analogs,
      currentRegimeDuration: regimeDuration,
      consecutiveElevatedStreak: elevatedStreak,
      avgDurationSimilarEnvironments: outcomeStats?.avgRecoveryMonths ?? null,
      historicalBullContinuationRate: bullContinuation,
      historicalElevatedVolatilityRate: elevatedVolRate,
      historicalCorrectionProbability: correctionProb,
      historicalRecoveryProbability: recoveryProb,
      confidenceLevel: confidence,
      historicalSampleSize: N,
      historicalDateRange: `${histRows[0].month} – ${histRows[N - 1].month}`,
      plainEnglishSummary,
      insufficientData: false,
    };
  }

  // ── Section 4: Market Evolution Timeline ──────────────────────────────────
  // Use pressureRuns for recent readings (up to 8 most recent)
  const timelineRuns = recentRuns.slice(0, 8).reverse();
  const timeline = timelineRuns.map((run, i) => {
    const isToday = i === timelineRuns.length - 1;
    const ageHrs = Math.round((Date.now() - new Date(run.computedAt).getTime()) / 3600000);
    return {
      label: isToday ? "Today" : ageHrs < 24 ? `${ageHrs}h ago` : `${Math.floor(ageHrs / 24)}d ago`,
      pressure: run.overallPressure,
      regime: run.regime,
    };
  });

  // Timeline caption
  let timelineCaption = "";
  if (timeline.length >= 2) {
    const first = timeline[0].pressure;
    const last = timeline[timeline.length - 1].pressure;
    const delta = last - first;
    const risingCount = timeline.filter((t, i) => i > 0 && t.pressure > timeline[i - 1].pressure).length;
    const fallingCount = timeline.filter((t, i) => i > 0 && t.pressure < timeline[i - 1].pressure).length;
    if (risingCount >= timeline.length - 2) {
      timelineCaption = `Systemic pressure has increased across ${risingCount} of the last ${timeline.length - 1} readings (+${delta} total).`;
    } else if (fallingCount >= timeline.length - 2) {
      timelineCaption = `Systemic pressure has decreased across ${fallingCount} of the last ${timeline.length - 1} readings (${delta} total).`;
    } else {
      timelineCaption = `Systemic pressure has been mixed across the last ${timeline.length} readings, ranging from ${Math.min(...timeline.map(t => t.pressure))} to ${Math.max(...timeline.map(t => t.pressure))}.`;
    }
  }

  // ── Enhanced metric context ────────────────────────────────────────────────
  // Daily/7d/30d changes from pressureRuns
  const runs = recentRuns;
  const todayPressure = runs[0]?.overallPressure ?? currentOverall;
  const ydayPressure = runs[1]?.overallPressure ?? null;
  const sevenDayRun = runs.find(r => {
    const age = (Date.now() - new Date(r.computedAt).getTime()) / 86400000;
    return age >= 6.5 && age <= 8;
  });
  const thirtyDayRun = runs.find(r => {
    const age = (Date.now() - new Date(r.computedAt).getTime()) / 86400000;
    return age >= 28 && age <= 32;
  });

  // Streak direction
  let streak = 0;
  let streakDir: "rising" | "falling" | "stable" = "stable";
  if (runs.length >= 2) {
    const dir = runs[0].overallPressure >= runs[1].overallPressure ? "rising" : "falling";
    streakDir = dir;
    for (let i = 0; i < runs.length - 1; i++) {
      const isRising = runs[i].overallPressure >= runs[i + 1].overallPressure;
      if ((dir === "rising" && isRising) || (dir === "falling" && !isRising)) streak++;
      else break;
    }
  }

  const percentileForMetric = histRows.length >= INSUFFICIENT_THRESHOLD
    ? Math.round((histRows.filter(r => r.overallPressure <= currentOverall).length / histRows.length) * 100)
    : null;

  const historicalComparison = histContext?.analogMatches?.[0]
    ? `Most similar to ${histContext.analogMatches[0].label}`
    : "Insufficient historical data for comparison";

  const institutionalInterpretation = histContext?.institutionalInterpretation
    ? histContext.institutionalInterpretation.slice(0, 200)
    : `${pressure.regime} conditions. ${pressure.vectors.sort((a, b) => b.score - a.score)[0]?.label ?? "Macro"} is the primary driver.`;

  const metrics: HomepageBriefingResult["metrics"] = {
    pressureIndex: {
      current: currentOverall,
      todayChange: ydayPressure !== null ? currentOverall - ydayPressure : null,
      sevenDayChange: sevenDayRun ? currentOverall - sevenDayRun.overallPressure : null,
      thirtyDayChange: thirtyDayRun ? currentOverall - thirtyDayRun.overallPressure : null,
      streak,
      streakDirection: streakDir,
      historicalPercentile: percentileForMetric,
      historicalComparison,
      institutionalInterpretation,
    },
    regime: pressure.regime,
    regimeLevel: pressure.level,
    bullProbability: bullProb !== null ? Math.round(bullProb) : null,
    crashProbability: crashProb !== null ? Math.round(crashProb) : null,
    opportunityScore: null,
  };

  // ── Section 1: Today's Market Story (LLM) ─────────────────────────────────
  const topVector = [...pressure.vectors].sort((a, b) => b.score - a.score)[0];
  const analogLabel = histContext?.analogMatches?.[0]?.label ?? "no close historical match";
  const analogSim = histContext?.analogMatches?.[0]?.similarity ?? 0;
  const bullLabel = bullProb !== null ? `${Math.round(bullProb)}%` : "UNAVAILABLE";
  const crashLabel = crashProb !== null ? `${Math.round(crashProb)}%` : "UNAVAILABLE";
  const percentileLabel = percentileForMetric !== null
    ? `${formatOrdinal(percentileForMetric)} (${describeHistoricalPercentile(percentileForMetric)})`
    : "UNAVAILABLE";

  const storyPrompt = `You are FAULTLINE's institutional market intelligence engine. Generate a concise, professional market briefing (3-4 sentences, no bullet points) for today's conditions.

Current data (canonical state ${canonical.stateId}):
- Pressure Index: ${currentOverall}/100 (${pressure.level} — ${pressure.regime})
- Primary driver: ${topVector?.label ?? "UNAVAILABLE"} at ${topVector?.score?.toFixed(1) ?? "N/A"}/100
- Bull continuation: ${bullLabel} | Crash / drawdown: ${crashLabel}
- Historical percentile: ${percentileLabel} (N=${histRows.length} months)
- Closest historical analog: ${analogLabel} (${analogSim}% similarity)
- Pressure trend: ${streakDir} for ${streak} consecutive readings
${whyTodayIsDifferent.biggestDeteriorating ? `- Biggest deteriorating factor: ${whyTodayIsDifferent.biggestDeteriorating.label}` : ""}
${whyTodayIsDifferent.biggestImproving ? `- Biggest improving factor: ${whyTodayIsDifferent.biggestImproving.label}` : ""}

Write a 3-4 sentence institutional briefing covering: what is happening, why it is happening, whether pressure is increasing or decreasing, and how today compares with history. Tone: professional, institutional, factual. No predictions. No hype. No bullet points. Keep bull-continuation and crash/drawdown as separate facts. If a field is UNAVAILABLE, say so — do not invent it.`;

  let marketStory = "";
  let marketStoryHeadline = `${pressure.regime} — ${pressure.level} Systemic Pressure`;

  try {
    const llmResult = await invokeLLM({
      messages: [
        { role: "system", content: "You are a senior macro strategist writing institutional market intelligence briefings. Be concise, factual, and professional. Never make price predictions. Never use bullet points. Write in flowing prose." },
        { role: "user", content: storyPrompt },
      ],
    });
    marketStory = (llmResult.choices?.[0]?.message?.content as string ?? "").trim();
    // Generate a one-line headline from the story
    const headlineResult = await invokeLLM({
      messages: [
        { role: "system", content: "Generate a single institutional headline (max 12 words) summarizing the market story. No punctuation at end. No quotes." },
        { role: "user", content: `Market story: ${marketStory}\n\nGenerate a single headline (max 12 words):` },
      ],
    });
    marketStoryHeadline = (headlineResult.choices?.[0]?.message?.content as string ?? marketStoryHeadline).trim();
  } catch {
    // Fallback: use the historical context engine's market story if available
    marketStory = histContext?.marketStory ?? `The FAULTLINE Pressure Index currently reads ${currentOverall}/100, indicating ${pressure.level.toLowerCase()} systemic pressure in a ${pressure.regime} regime. ${topVector ? `${topVector.label} is the primary driver at ${topVector.score.toFixed(1)}/100.` : ""} Historical percentile: ${percentileLabel}.`;
  }

  return {
    computedAt: now.toISOString(),
    dataSource: "canonical",
    availability: "AVAILABLE",
    canonicalStateId: canonical.stateId,
    qualityStatus: canonical.confidenceOrEvidenceQuality,
    marketStory,
    marketStoryHeadline,
    whyTodayIsDifferent,
    historySays,
    timeline,
    timelineCaption,
    metrics,
  };
}
