// ============================================================
// FAULTLINE Diagnostic AI™ — server/diagnosticAI.ts
//
// Generates structured market-risk diagnostics for four
// timeframes: Today, This Week, This Month, This Year.
//
// Data flow:
//   FRED pressure data → score each metric → LLM interprets
//   scores in plain English → returns DiagnosticReport
//
// The AI does NOT generate market predictions. It interprets
// structured numeric scores produced by the pressure engine.
// ============================================================

import { invokeLLM } from "./_core/llm";
import { calculateFaultlinePressure, type FaultlinePressureOutput } from "./pressure/engine";
import { LRUCache } from "./lruCache";

// ── Types ────────────────────────────────────────────────────

export type ActionBias = "Bullish" | "Neutral" | "Cautious" | "Defensive" | "Critical";
export type Timeframe = "today" | "week" | "month" | "year";

export interface DiagnosticMetric {
  label: string;
  score: number;       // 0–100
  level: string;       // e.g. "Elevated", "Normal", "Critical"
  trend: "rising" | "falling" | "stable";
  note: string;        // one-line driver sentence
}

export interface DiagnosticReport {
  timeframe: Timeframe;
  generatedAt: number;
  pressureIndex: number;
  regime: string;
  regimeLabel: string;  // e.g. "Elevated Pressure"
  trendDirection: "Bullish" | "Bearish" | "Sideways" | "Deteriorating" | "Recovering";
  actionBias: ActionBias;
  actionBiasScore: number; // 0–100 (higher = more bullish)

  // 12 structured metrics
  crashRisk: DiagnosticMetric;
  bullContinuation: DiagnosticMetric;
  volatility: DiagnosticMetric;
  treasuryYield: DiagnosticMetric;
  creditRisk: DiagnosticMetric;
  liquidity: DiagnosticMetric;
  marketBreadth: DiagnosticMetric;
  sectorLeadership: DiagnosticMetric;
  aiConcentration: DiagnosticMetric;
  stockSignal: DiagnosticMetric;

  // Key narrative fields
  keyRiskDrivers: string[];   // 3–5 bullet strings
  whatChanged: string[];      // 2–4 bullet strings
  whyItMatters: string;       // 2-sentence paragraph
  aiInterpretation: string;   // 3-sentence institutional paragraph
  cached?: boolean;
}

// ── Regime scale (per brief) ─────────────────────────────────

export function classifyRegimeLabel(pressure: number): string {
  if (pressure >= 86) return "Systemic Break Zone";
  if (pressure >= 76) return "Critical Stress";
  if (pressure >= 61) return "Elevated Pressure";
  if (pressure >= 41) return "Watch Zone";
  if (pressure >= 21) return "Normal Risk";
  return "Calm";
}

export function pressureToActionBias(pressure: number): ActionBias {
  if (pressure >= 76) return "Critical";
  if (pressure >= 61) return "Defensive";
  if (pressure >= 41) return "Cautious";
  if (pressure >= 21) return "Neutral";
  return "Bullish";
}

export function actionBiasScore(pressure: number): number {
  // Invert: 0 pressure → 100 bullish, 100 pressure → 0 bullish
  return Math.max(0, Math.min(100, Math.round(100 - pressure)));
}

// ── Score derivation from pressure vectors ───────────────────

function getVectorScore(
  vectors: FaultlinePressureOutput["vectors"],
  id: string,
  fallback = 30
): number {
  return vectors.find(v => v.id === id)?.score ?? fallback;
}

function getVectorTrend(
  vectors: FaultlinePressureOutput["vectors"],
  id: string
): "rising" | "falling" | "stable" {
  return vectors.find(v => v.id === id)?.trend ?? "stable";
}

function scoreToLevel(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 65) return "Elevated";
  if (score >= 45) return "Moderate";
  if (score >= 25) return "Low";
  return "Minimal";
}

function invertScore(score: number): number {
  return Math.max(0, Math.min(100, 100 - score));
}

// ── Timeframe modifiers ──────────────────────────────────────
// Different timeframes apply different smoothing/weighting to
// the same underlying pressure data. Today = raw; Year = smoothed.

const TIMEFRAME_MODIFIERS: Record<Timeframe, {
  volatilityMult: number;
  trendSmooth: number;
  label: string;
}> = {
  today:  { volatilityMult: 1.0,  trendSmooth: 0,   label: "Today" },
  week:   { volatilityMult: 0.85, trendSmooth: 0.1,  label: "This Week" },
  month:  { volatilityMult: 0.70, trendSmooth: 0.2,  label: "This Month" },
  year:   { volatilityMult: 0.55, trendSmooth: 0.35, label: "This Year" },
};

function applyTimeframeSmoothing(score: number, smooth: number): number {
  // Smooth toward 50 (neutral) for longer timeframes
  return Math.round(score * (1 - smooth) + 50 * smooth);
}

// ── Build DiagnosticMetrics from pressure output ─────────────

function buildMetrics(
  pressure: FaultlinePressureOutput,
  timeframe: Timeframe
): Omit<DiagnosticReport, "timeframe" | "generatedAt" | "pressureIndex" | "regime" | "regimeLabel" | "trendDirection" | "actionBias" | "actionBiasScore" | "keyRiskDrivers" | "whatChanged" | "whyItMatters" | "aiInterpretation"> {
  const { vectors, overallPressure } = pressure;
  const mod = TIMEFRAME_MODIFIERS[timeframe];

  const liquidityRaw   = getVectorScore(vectors, "liquidity-stress");
  const creditRaw      = getVectorScore(vectors, "credit-contagion");
  const volatilityRaw  = getVectorScore(vectors, "volatility-regime");
  const macroRaw       = getVectorScore(vectors, "macro-sensitivity");
  const breadthRaw     = getVectorScore(vectors, "market-breadth");
  const aiRaw          = getVectorScore(vectors, "ai-bubble");

  const smooth = mod.trendSmooth;

  // Crash risk = blend of credit + liquidity + overall pressure
  const crashRawScore = applyTimeframeSmoothing(
    Math.round((creditRaw * 0.35 + liquidityRaw * 0.35 + overallPressure * 0.30)),
    smooth
  );

  // Bull continuation = inverted crash risk with breadth weight
  const bullRawScore = applyTimeframeSmoothing(
    Math.round(invertScore(overallPressure) * 0.50 + invertScore(creditRaw) * 0.25 + invertScore(breadthRaw) * 0.25),
    smooth
  );

  const volatilityScore = applyTimeframeSmoothing(
    Math.round(volatilityRaw * mod.volatilityMult),
    smooth
  );

  // Treasury yield pressure: proxy from macro sensitivity
  const treasuryScore = applyTimeframeSmoothing(
    Math.round(macroRaw * 0.7 + overallPressure * 0.3),
    smooth
  );

  const creditScore = applyTimeframeSmoothing(creditRaw, smooth);
  const liquidityScore = applyTimeframeSmoothing(liquidityRaw, smooth);
  const breadthScore = applyTimeframeSmoothing(breadthRaw, smooth);

  // Sector leadership: proxy from breadth + AI concentration
  const sectorScore = applyTimeframeSmoothing(
    Math.round(breadthRaw * 0.6 + aiRaw * 0.4),
    smooth
  );

  const aiScore = applyTimeframeSmoothing(aiRaw, smooth);

  // Stock signal: overall pressure inverted + breadth
  const stockSignalScore = applyTimeframeSmoothing(
    Math.round(invertScore(overallPressure) * 0.60 + invertScore(breadthRaw) * 0.40),
    smooth
  );

  return {
    crashRisk: {
      label: "Crash Risk Pressure",
      score: crashRawScore,
      level: scoreToLevel(crashRawScore),
      trend: getVectorTrend(vectors, "credit-contagion"),
      note: crashRawScore >= 65
        ? "Multiple stress vectors converging — downside risk elevated"
        : crashRawScore >= 45
        ? "Moderate stress present — monitor credit and liquidity conditions"
        : "Crash risk contained — no systemic convergence detected",
    },
    bullContinuation: {
      label: "Bull Continuation Pressure",
      score: bullRawScore,
      level: scoreToLevel(invertScore(bullRawScore)), // high score = favorable
      trend: getVectorTrend(vectors, "market-breadth"),
      note: bullRawScore >= 65
        ? "Conditions remain broadly constructive for risk assets"
        : bullRawScore >= 45
        ? "Mixed signals — selective exposure warranted"
        : "Bull continuation conditions are weakening",
    },
    volatility: {
      label: "Volatility Condition",
      score: volatilityScore,
      level: scoreToLevel(volatilityScore),
      trend: getVectorTrend(vectors, "volatility-regime"),
      note: volatilityScore >= 65
        ? "Volatility regime elevated — position sizing should reflect higher risk"
        : volatilityScore >= 45
        ? "Volatility rising — hedging costs increasing"
        : "Volatility contained — risk environment manageable",
    },
    treasuryYield: {
      label: "Treasury / Yield Pressure",
      score: treasuryScore,
      level: scoreToLevel(treasuryScore),
      trend: getVectorTrend(vectors, "macro-sensitivity"),
      note: treasuryScore >= 65
        ? "Yield pressure elevated — duration risk and equity multiples under stress"
        : treasuryScore >= 45
        ? "Yield environment mixed — rate-sensitive sectors face headwinds"
        : "Treasury conditions stable — no acute yield pressure detected",
    },
    creditRisk: {
      label: "Credit Risk Condition",
      score: creditScore,
      level: scoreToLevel(creditScore),
      trend: getVectorTrend(vectors, "credit-contagion"),
      note: creditScore >= 65
        ? "Credit spreads widening — risk-off signal for leveraged positions"
        : creditScore >= 45
        ? "Credit conditions tightening — monitor high-yield spreads"
        : "Credit markets stable — no contagion signals present",
    },
    liquidity: {
      label: "Liquidity Condition",
      score: liquidityScore,
      level: scoreToLevel(liquidityScore),
      trend: getVectorTrend(vectors, "liquidity-stress"),
      note: liquidityScore >= 65
        ? "Liquidity stress elevated — funding conditions deteriorating"
        : liquidityScore >= 45
        ? "Liquidity moderately constrained — watch SOFR and repo markets"
        : "Liquidity conditions adequate — no acute stress signals",
    },
    marketBreadth: {
      label: "Market Breadth Condition",
      score: breadthScore,
      level: scoreToLevel(breadthScore),
      trend: getVectorTrend(vectors, "market-breadth"),
      note: breadthScore >= 65
        ? "Breadth deteriorating — rally narrowing to fewer names"
        : breadthScore >= 45
        ? "Breadth mixed — participation uneven across sectors"
        : "Breadth healthy — broad participation in market advance",
    },
    sectorLeadership: {
      label: "Sector Leadership Condition",
      score: sectorScore,
      level: scoreToLevel(sectorScore),
      trend: getVectorTrend(vectors, "market-breadth"),
      note: sectorScore >= 65
        ? "Leadership narrowing — concentrated in defensive or mega-cap names"
        : sectorScore >= 45
        ? "Sector rotation underway — leadership shifting"
        : "Sector leadership broad — cyclicals and growth participating",
    },
    aiConcentration: {
      label: "AI / Mega-Cap Concentration Risk",
      score: aiScore,
      level: scoreToLevel(aiScore),
      trend: getVectorTrend(vectors, "ai-bubble"),
      note: aiScore >= 65
        ? "AI/mega-cap concentration elevated — index returns masking underlying weakness"
        : aiScore >= 45
        ? "Concentration risk building — monitor AI-linked valuations"
        : "Concentration risk manageable — market not overly dependent on single theme",
    },
    stockSignal: {
      label: "Stock Signal Condition",
      score: stockSignalScore,
      level: scoreToLevel(invertScore(stockSignalScore)),
      trend: getVectorTrend(vectors, "market-breadth"),
      note: stockSignalScore >= 65
        ? "Stock-level signals broadly constructive — trend following favored"
        : stockSignalScore >= 45
        ? "Stock signals mixed — selective approach required"
        : "Stock signals weakening — risk management priority",
    },
  };
}

// ── Derive trend direction ────────────────────────────────────

function deriveTrendDirection(
  pressure: FaultlinePressureOutput,
  timeframe: Timeframe
): DiagnosticReport["trendDirection"] {
  const p = pressure.overallPressure;
  const breadth = getVectorScore(pressure.vectors, "market-breadth");
  const credit  = getVectorScore(pressure.vectors, "credit-contagion");

  if (p >= 75 || credit >= 75) return "Deteriorating";
  if (p <= 25 && breadth <= 30) return "Bullish";
  if (p >= 55 || breadth >= 60) return "Bearish";
  if (timeframe === "year" && p < 45) return "Recovering";
  return "Sideways";
}

// ── Key risk drivers from alerts ─────────────────────────────

function deriveKeyRiskDrivers(pressure: FaultlinePressureOutput): string[] {
  const drivers: string[] = [];
  const { vectors, overallPressure } = pressure;

  // Pull from pressure alerts first
  for (const alert of pressure.alerts.slice(0, 3)) {
    drivers.push(alert.title);
  }

  // Supplement with top-scoring vectors if needed
  const sorted = [...vectors].sort((a, b) => b.score - a.score);
  for (const v of sorted) {
    if (drivers.length >= 5) break;
    const entry = `${v.label}: ${v.driver}`;
    if (!drivers.some(d => d.includes(v.label))) {
      drivers.push(entry);
    }
  }

  if (drivers.length === 0) {
    drivers.push(`FAULTLINE Pressure Index at ${overallPressure}/100`);
    drivers.push("No acute systemic stress signals detected");
  }

  return drivers.slice(0, 5);
}

function deriveWhatChanged(
  pressure: FaultlinePressureOutput,
  timeframe: Timeframe
): string[] {
  const changes: string[] = [];
  const { vectors } = pressure;

  const rising  = vectors.filter(v => v.trend === "rising").slice(0, 2);
  const falling = vectors.filter(v => v.trend === "falling").slice(0, 2);

  for (const v of rising) {
    changes.push(`${v.label} pressure rising — ${v.driver}`);
  }
  for (const v of falling) {
    changes.push(`${v.label} conditions improving — ${v.driver}`);
  }

  if (changes.length === 0) {
    changes.push("Conditions broadly stable — no major vector shifts detected");
  }

  const tfLabel = TIMEFRAME_MODIFIERS[timeframe].label;
  changes.push(`${tfLabel} composite pressure: ${pressure.overallPressure}/100`);

  return changes.slice(0, 4);
}

// ── LLM interpretation ────────────────────────────────────────

const DIAG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Max 20 entries (4 timeframes × 5 hours) — LRU evicts oldest
const diagnosticCache = new LRUCache<string, DiagnosticReport>(20, DIAG_CACHE_TTL_MS);

async function generateAIInterpretation(
  metrics: Omit<DiagnosticReport, "aiInterpretation" | "whyItMatters">,
  timeframe: Timeframe
): Promise<{ aiInterpretation: string; whyItMatters: string }> {
  const tfLabel = TIMEFRAME_MODIFIERS[timeframe].label;
  const pressure = metrics.pressureIndex;
  const regime = metrics.regimeLabel;
  const bias = metrics.actionBias;

  const systemPrompt = `You are FAULTLINE's institutional risk analysis engine. You interpret structured market-risk scores and produce clear, professional, non-hyped market commentary. Your tone is: institutional, serious, direct, and non-generic. You NEVER say "crash guaranteed", "buy now", "sell everything", or use hype language. You interpret data — you do not predict outcomes.`;

  const userPrompt = `Generate a FAULTLINE Diagnostic AI™ interpretation for the ${tfLabel} timeframe.

STRUCTURED SCORES (interpret these — do not invent data):
- FAULTLINE Pressure Index: ${pressure}/100
- Regime: ${regime}
- Action Bias: ${bias}
- Crash Risk: ${metrics.crashRisk.score}/100 (${metrics.crashRisk.level})
- Bull Continuation: ${metrics.bullContinuation.score}/100
- Volatility: ${metrics.volatility.score}/100 (${metrics.volatility.level})
- Treasury/Yield Pressure: ${metrics.treasuryYield.score}/100
- Credit Risk: ${metrics.creditRisk.score}/100 (${metrics.creditRisk.level})
- Liquidity: ${metrics.liquidity.score}/100
- Market Breadth: ${metrics.marketBreadth.score}/100
- Sector Leadership: ${metrics.sectorLeadership.score}/100
- AI/Mega-Cap Concentration: ${metrics.aiConcentration.score}/100
- Stock Signal Condition: ${metrics.stockSignal.score}/100
- Trend Direction: ${metrics.trendDirection}
- Key Risk Drivers: ${metrics.keyRiskDrivers.slice(0, 3).join("; ")}

Return JSON with exactly these two fields:
- "aiInterpretation": A 3-sentence institutional paragraph explaining what the scores mean for ${tfLabel.toLowerCase()}. Start with "FAULTLINE is currently reading ${regime}." Reference specific metrics. End with what this means for risk positioning.
- "whyItMatters": A 2-sentence paragraph explaining why these conditions matter for investors right now. Focus on practical implications, not predictions.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "faultline_diagnostic",
        strict: true,
        schema: {
          type: "object",
          properties: {
            aiInterpretation: { type: "string" },
            whyItMatters: { type: "string" },
          },
          required: ["aiInterpretation", "whyItMatters"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) {
    return {
      aiInterpretation: `FAULTLINE is currently reading ${regime}. The ${tfLabel.toLowerCase()} pressure index stands at ${pressure}/100, reflecting ${bias.toLowerCase()} conditions across the monitored risk vectors. Risk positioning should be calibrated accordingly.`,
      whyItMatters: `These conditions indicate that market risk is ${pressure >= 61 ? "elevated" : pressure >= 41 ? "moderate" : "contained"} on a ${tfLabel.toLowerCase()} basis. Investors should monitor the key risk drivers and adjust exposure to reflect the current regime.`,
    };
  }

  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  return {
    aiInterpretation: parsed.aiInterpretation ?? "",
    whyItMatters: parsed.whyItMatters ?? "",
  };
}

// ── Main export ───────────────────────────────────────────────

export async function getDiagnosticReport(
  timeframe: Timeframe,
  pressureData?: FaultlinePressureOutput
): Promise<DiagnosticReport> {
  const cacheKey = `${timeframe}:${new Date().toISOString().slice(0, 13)}`; // hourly cache
  const cached = diagnosticCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Use provided pressure data or fetch fresh
  const pressure = pressureData ?? await calculateFaultlinePressure();
  const mod = TIMEFRAME_MODIFIERS[timeframe];

  // Apply timeframe smoothing to overall pressure
  const smoothedPressure = applyTimeframeSmoothing(pressure.overallPressure, mod.trendSmooth);
  const regimeLabel = classifyRegimeLabel(smoothedPressure);
  const bias = pressureToActionBias(smoothedPressure);
  const biasScore = actionBiasScore(smoothedPressure);
  const trendDirection = deriveTrendDirection(pressure, timeframe);
  const keyRiskDrivers = deriveKeyRiskDrivers(pressure);
  const whatChanged = deriveWhatChanged(pressure, timeframe);
  const metrics = buildMetrics(pressure, timeframe);

  const partialReport = {
    timeframe,
    generatedAt: Date.now(),
    pressureIndex: smoothedPressure,
    regime: pressure.regime,
    regimeLabel,
    trendDirection,
    actionBias: bias,
    actionBiasScore: biasScore,
    keyRiskDrivers,
    whatChanged,
    ...metrics,
  };

  // Generate LLM interpretation
  const { aiInterpretation, whyItMatters } = await generateAIInterpretation(partialReport, timeframe);

  const report: DiagnosticReport = {
    ...partialReport,
    aiInterpretation,
    whyItMatters,
    cached: false,
  };

  diagnosticCache.set(cacheKey, report);
  return report;
}

export function clearDiagnosticCache(): void {
  diagnosticCache.clear();
}
