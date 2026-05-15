// ============================================================
// FAULTLINE — AI Signal Classifier
//
// Uses the built-in LLM to classify any ticker with FAULTLINE
// signal labels, regime fit analysis, and "Why This Signal?"
// explanations. Runs server-side only — API key never exposed.
// ============================================================
import { invokeLLM } from "./_core/llm";
import type { TickerProfile } from "./signalsProxy";

// ── Types ─────────────────────────────────────────────────────
export type FaultlineSignal =
  | "Momentum Breakout"
  | "AI Bubble Exposure"
  | "Speculative Acceleration"
  | "Liquidity Sensitive"
  | "Debt Stress Risk"
  | "Recession Defensive"
  | "Macro Beneficiary"
  | "Macro Vulnerable"
  | "Rate Sensitive"
  | "Short Squeeze Candidate"
  | "Volume Surge"
  | "Earnings Catalyst"
  | "Neutral / Watch";

export interface ClassificationResult {
  ticker: string;
  signals: FaultlineSignal[];           // 1–3 primary signal labels
  primarySignal: FaultlineSignal;       // Most important label
  bullishFactors: string[];             // 2–4 bullish observations
  bearishFactors: string[];             // 2–4 bearish observations
  whyThisSignal: string;               // 2–3 sentence explanation
  regimeFit: number;                   // 0–10 score for current regime
  regimeFitLabel: string;              // "Strong Fit" | "Moderate Fit" | "Poor Fit" | "Headwind"
  aiExposure: "High" | "Medium" | "Low" | "None";
  debtRisk: "High" | "Medium" | "Low" | "None";
  recessionSensitivity: "High" | "Medium" | "Low";
  liquidityRisk: "High" | "Medium" | "Low" | "None";
  momentumScore: number;               // 0–100 relative strength estimate
  volatilityLabel: "Very High" | "High" | "Moderate" | "Low";
  macroSensitivity: string;            // brief macro sensitivity description
  cached?: boolean;
}

export interface RegimeContext {
  label: string;       // e.g. "MODERATE RISK"
  score: number;       // 0–10
  description?: string;
}

// ── In-memory classification cache ───────────────────────────
interface ClassCacheEntry {
  result: ClassificationResult;
  fetchedAt: number;
  regimeLabel: string;
}

const classCache = new Map<string, ClassCacheEntry>();
const CLASS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Regime-aware system prompt ────────────────────────────────
function buildSystemPrompt(regime: RegimeContext): string {
  return `You are FAULTLINE, a macroeconomic risk intelligence system. Your role is to classify stocks with precise, regime-aware signal labels based on current macro conditions.

CURRENT MACRO REGIME: ${regime.label} (Score: ${regime.score.toFixed(1)}/10)
${regime.description ? `REGIME CONTEXT: ${regime.description}` : ""}

AVAILABLE SIGNAL LABELS (choose 1–3 most relevant):
- "Momentum Breakout": Strong price momentum, high relative strength, trending above key levels
- "AI Bubble Exposure": High sensitivity to AI/tech valuation cycle, significant AI revenue or capex dependency  
- "Speculative Acceleration": High beta, speculative positioning, momentum-driven with elevated risk
- "Liquidity Sensitive": Small/mid-cap, high debt, dependent on cheap credit conditions
- "Debt Stress Risk": Elevated leverage, refinancing risk, interest coverage concerns
- "Recession Defensive": Low cyclicality, stable cash flows, dividend safety, consumer staples/healthcare/utilities
- "Macro Beneficiary": Positioned to benefit from current macro regime (energy in inflation, gold in uncertainty)
- "Macro Vulnerable": Exposed to current macro headwinds (rate-sensitive in rising rate environment)
- "Rate Sensitive": Business model or valuation highly sensitive to interest rate changes
- "Short Squeeze Candidate": High short interest, potential for short squeeze on positive catalyst
- "Volume Surge": Unusual volume activity suggesting institutional accumulation or distribution
- "Earnings Catalyst": Near-term earnings event with significant price move potential
- "Neutral / Watch": No strong directional signal; monitoring for regime shift

REGIME-AWARE CLASSIFICATION RULES:
${getRegimeRules(regime.label)}

Respond with a JSON object matching the exact schema provided. Be precise, analytical, and grounded in macro reality.`;
}

function getRegimeRules(regimeLabel: string): string {
  const label = regimeLabel.toUpperCase();

  if (label.includes("AI") || label.includes("MELT")) {
    return `- AI/tech stocks: emphasize "AI Bubble Exposure" and "Momentum Breakout" labels
- High-momentum names: strong "Speculative Acceleration" signal
- Defensive names: "Macro Vulnerable" due to rotation risk
- Regime fit: AI/momentum stocks score 8–10, defensives score 2–4`;
  }
  if (label.includes("LIQUIDITY") || label.includes("CREDIT")) {
    return `- High-debt, small-cap, speculative: emphasize "Debt Stress Risk" and "Liquidity Sensitive"
- Regional banks, CRE-exposed: "Macro Vulnerable" with high regime risk
- Quality large-caps: "Recession Defensive" or "Macro Beneficiary"
- Regime fit: quality/defensive stocks score 7–10, leveraged names score 1–3`;
  }
  if (label.includes("INFLATION") || label.includes("INFLATIONARY")) {
    return `- Energy, commodities, pricing-power companies: "Macro Beneficiary"
- Rate-sensitive sectors (utilities, REITs, long-duration growth): "Rate Sensitive" + "Macro Vulnerable"
- Gold, commodities ETFs: "Macro Beneficiary" + "Recession Defensive"
- Regime fit: commodity/energy stocks score 8–10, rate-sensitive score 2–4`;
  }
  if (label.includes("RECESSION") || label.includes("DETERIORATION")) {
    return `- Consumer staples, healthcare, utilities: "Recession Defensive" + "Macro Beneficiary"
- Cyclicals, discretionary, industrials: "Macro Vulnerable"
- Leveraged companies: "Debt Stress Risk" elevated
- Regime fit: defensives score 8–10, cyclicals score 1–4`;
  }
  // Default moderate risk
  return `- Evaluate each stock on its own fundamentals and momentum
- Balanced regime: both momentum and defensive names can score moderately
- Focus on stock-specific signals over macro tailwinds/headwinds
- Regime fit: strong momentum stocks score 6–8, weak fundamentals score 3–5`;
}

// ── Main classifier function ──────────────────────────────────
export async function classifyTicker(
  profile: TickerProfile,
  regime: RegimeContext
): Promise<ClassificationResult> {
  const cacheKey = `${profile.ticker}:${regime.label}`;
  const cached = classCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CLASS_CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  const userPrompt = buildUserPrompt(profile, regime);

  const schema = {
    type: "object",
    properties: {
      signals: {
        type: "array",
        items: { type: "string" },
        description: "1–3 FAULTLINE signal labels from the allowed list",
      },
      primarySignal: { type: "string", description: "The single most important signal label" },
      bullishFactors: {
        type: "array",
        items: { type: "string" },
        description: "2–4 specific bullish observations about this stock",
      },
      bearishFactors: {
        type: "array",
        items: { type: "string" },
        description: "2–4 specific bearish observations or risks",
      },
      whyThisSignal: {
        type: "string",
        description: "2–3 sentence explanation of why this signal label applies, referencing the current macro regime",
      },
      regimeFit: {
        type: "number",
        description: "0–10 score for how well this stock fits the current macro regime",
      },
      regimeFitLabel: {
        type: "string",
        enum: ["Strong Fit", "Moderate Fit", "Poor Fit", "Headwind"],
      },
      aiExposure: { type: "string", enum: ["High", "Medium", "Low", "None"] },
      debtRisk: { type: "string", enum: ["High", "Medium", "Low", "None"] },
      recessionSensitivity: { type: "string", enum: ["High", "Medium", "Low"] },
      liquidityRisk: { type: "string", enum: ["High", "Medium", "Low", "None"] },
      momentumScore: {
        type: "number",
        description: "0–100 relative strength estimate based on available data",
      },
      volatilityLabel: {
        type: "string",
        enum: ["Very High", "High", "Moderate", "Low"],
      },
      macroSensitivity: {
        type: "string",
        description: "Brief 1-sentence description of how this stock responds to macro conditions",
      },
    },
    required: [
      "signals", "primarySignal", "bullishFactors", "bearishFactors",
      "whyThisSignal", "regimeFit", "regimeFitLabel", "aiExposure",
      "debtRisk", "recessionSensitivity", "liquidityRisk",
      "momentumScore", "volatilityLabel", "macroSensitivity",
    ],
    additionalProperties: false,
  };

  const response = await invokeLLM({
    messages: [
      { role: "system", content: buildSystemPrompt(regime) },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "faultline_classification",
        strict: true,
        schema,
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned empty response");

  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as ClassificationResult;

  // Validate and sanitize
  const result: ClassificationResult = {
    ticker: profile.ticker,
    signals: (parsed.signals ?? ["Neutral / Watch"]).slice(0, 3) as FaultlineSignal[],
    primarySignal: (parsed.primarySignal ?? "Neutral / Watch") as FaultlineSignal,
    bullishFactors: (parsed.bullishFactors ?? []).slice(0, 4),
    bearishFactors: (parsed.bearishFactors ?? []).slice(0, 4),
    whyThisSignal: parsed.whyThisSignal ?? "",
    regimeFit: Math.max(0, Math.min(10, parsed.regimeFit ?? 5)),
    regimeFitLabel: parsed.regimeFitLabel ?? "Moderate Fit",
    aiExposure: parsed.aiExposure ?? "None",
    debtRisk: parsed.debtRisk ?? "None",
    recessionSensitivity: parsed.recessionSensitivity ?? "Medium",
    liquidityRisk: parsed.liquidityRisk ?? "None",
    momentumScore: Math.max(0, Math.min(100, parsed.momentumScore ?? 50)),
    volatilityLabel: parsed.volatilityLabel ?? "Moderate",
    macroSensitivity: parsed.macroSensitivity ?? "",
    cached: false,
  };

  classCache.set(cacheKey, { result, fetchedAt: Date.now(), regimeLabel: regime.label });
  return result;
}

function buildUserPrompt(profile: TickerProfile, regime: RegimeContext): string {
  const mktCapStr = profile.marketCap
    ? profile.marketCap >= 1000
      ? `$${(profile.marketCap / 1000).toFixed(1)}T`
      : `$${profile.marketCap.toFixed(0)}B`
    : "Unknown";

  const sparklineTrend = profile.sparkline.length >= 2
    ? (() => {
        const first = profile.sparkline[0];
        const last = profile.sparkline[profile.sparkline.length - 1];
        const trend = last - first;
        return trend > 2 ? "Strong uptrend (5-day)" : trend > 0 ? "Mild uptrend (5-day)" : trend > -2 ? "Mild downtrend (5-day)" : "Strong downtrend (5-day)";
      })()
    : "Insufficient data";

  return `Classify the following stock for FAULTLINE signal labeling.

TICKER: ${profile.ticker}
COMPANY: ${profile.name}
SECTOR: ${profile.sector ?? "Unknown"}
MARKET CAP: ${mktCapStr}

PRICE DATA (${profile.tradeDate}):
- Close: $${profile.price.toFixed(2)}
- Open: $${profile.open.toFixed(2)}
- High: $${profile.high.toFixed(2)}
- Low: $${profile.low.toFixed(2)}
- Daily Change: ${profile.changePercent > 0 ? "+" : ""}${profile.changePercent.toFixed(2)}%
- Volume: ${profile.volumeMillions.toFixed(1)}M shares
- 5-Day Trend: ${sparklineTrend}

COMPANY DESCRIPTION (if available):
${profile.description ? profile.description.slice(0, 500) : "Not available"}

CURRENT MACRO REGIME: ${regime.label} (${regime.score.toFixed(1)}/10)

Based on this data and the current macro regime, provide your FAULTLINE classification.`;
}

/** Clear the classification cache */
export function clearClassCache(): void {
  classCache.clear();
}

/** Get cache stats */
export function getClassCacheStats(): { size: number; entries: string[] } {
  return {
    size: classCache.size,
    entries: Array.from(classCache.keys()),
  };
}
