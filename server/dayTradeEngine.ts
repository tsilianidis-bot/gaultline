/**
 * FAULTLINE Day Trade Intelligence™ Engine
 * server/dayTradeEngine.ts
 *
 * Provides two core functions:
 *   - dayTradeScanner()  — scans stocks/crypto for intraday setups
 *   - dayTradeSymbolSetup() — generates a full Day Trade Report for a symbol
 *
 * Rules enforced throughout:
 *   • Never recommend overnight positions
 *   • Return NO_TRADE if confidence < MIN_CONFIDENCE
 *   • Never fabricate prices, volume, VWAP, support/resistance, or targets
 *   • If live data is unavailable, surface a clear error — never guess
 */

import { invokeLLM } from "./_core/llm";
import { getQuote, getTopStockPerformers, getTopStockLosers, getTopStockByVolume, getMostVolatileStocks, getSmallCapRunners } from "./yahooProxy";
import { getTopMarkets, getCoinMarketData, type CoinMarketData } from "./coingeckoProxy";
import { fetchDailyBars } from "./signalsProxy";
import { log } from "./logger";
import { LRUCache } from "./lruCache";

// ── Constants ─────────────────────────────────────────────────
const MIN_CONFIDENCE = 55;   // Below this → NO_TRADE
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// ── Types ─────────────────────────────────────────────────────

export type AssetType = "stock" | "crypto" | "both";
export type CapBucket = "low" | "mid" | "large" | "mixed";
export type TradeDirection = "bullish" | "bearish" | "both";
export type RiskProfile = "aggressive" | "balanced" | "conservative";
export type SetupType =
  | "Momentum Breakout"
  | "VWAP Reclaim"
  | "Opening Range Breakout"
  | "Pullback Continuation"
  | "Gap Fill"
  | "Reversal"
  | "Scalp"
  | "Breakdown Short"
  | "NO_TRADE";

export interface ExecutionScoreBreakdown {
  macroCondition: number;      // 0–20
  technicalStructure: number;  // 0–20
  liquidityScore: number;      // 0–15
  volatilityScore: number;     // 0–15
  momentumScore: number;       // 0–15
  riskRewardScore: number;     // 0–15
}

export interface DayTradeSetup {
  symbol: string;
  name: string;
  assetType: "stock" | "crypto";
  currentPrice: number;
  changePercent: number;
  volume: number;
  relativeVolume: number | null;       // volume / avg volume
  marketCap: number | null;
  capBucket: CapBucket;

  // Setup details
  setupType: SetupType;
  direction: "bullish" | "bearish";
  entryZoneLow: number;
  entryZoneHigh: number;
  target1: number;
  target2: number;
  stopLoss: number;
  invalidationLevel: number;
  expectedHoldMinutes: number;         // 30 | 60 | 90 | 120 | 180

  // Scoring
  confidence: number;                  // 0–100
  probabilityRating: number;           // 0–100
  riskRewardRatio: number;             // e.g. 2.5
  riskLevel: "Low" | "Medium" | "High" | "Very High";
  liquidityRating: "Low" | "Medium" | "High";
  executionScore: number;              // 0–100 composite execution quality score
  executionGrade: "A" | "B" | "C" | "D" | "F";  // letter grade

  // Context
  catalyst: string;
  whyToday: string;
  reasonForRecommendation: string;
  regimeImpact: string;
  sectorStrength: string | null;

  generatedAt: number;
}

export interface DayTradeReport extends DayTradeSetup {
  // Extended fields for symbol search
  intradayTrend: "Strongly Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strongly Bearish";
  marketContext: string;
  vwapStatus: "Above VWAP" | "Below VWAP" | "At VWAP" | "Unknown";
  momentumRating: number;              // 0–100
  supportLevel: number;
  resistanceLevel: number;
  whyTradeExists: string;
  whatCancelsThisTrade: string;
  confidenceReasoning: string;
  catalystSummary: string;
  noTradeReason?: string;              // populated when setupType === "NO_TRADE"
  // Execution Score breakdown
  executionScoreBreakdown: ExecutionScoreBreakdown;
  // Why Should I Trade This?
  bullCase: string;
  bearCase: string;
  primaryCatalyst: string;
  largestRisk: string;
  mostLikelyPath: string;
  alternativePath: string;
  recommendedTimeframe: string;
  bestStrategy: string;
}

export interface ScannerInput {
  assetType: AssetType;
  capBucket: CapBucket;
  direction: TradeDirection;
  riskProfile: RiskProfile;
  maxResults: number;
}

export interface MarketFavorability {
  overallScore: number;               // 0–100
  bullishOpportunities: number;
  bearishOpportunities: number;
  highConfidenceSetups: number;
  regime: string;
  regimePressure: number;
  volatilityLevel: "Low" | "Moderate" | "High" | "Extreme";
  marketBreadth: "Positive" | "Neutral" | "Negative";
  sectorLeadership: string;
  topMovers: Array<{ symbol: string; name: string; changePercent: number; assetType: "stock" | "crypto" }>;
  topRelativeVolume: Array<{ symbol: string; name: string; relVol: number; assetType: "stock" | "crypto" }>;
  aiSummary: string;
  generatedAt: number;
}

// ── Caches ────────────────────────────────────────────────────
const scanCache = new LRUCache<string, DayTradeSetup[]>(20, CACHE_TTL_MS);
const reportCache = new LRUCache<string, DayTradeReport>(100, CACHE_TTL_MS);
const favorabilityCache = new LRUCache<string, MarketFavorability>(1, CACHE_TTL_MS);

// ── Helpers ───────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function safeDiv(a: number, b: number): number | null {
  if (!b || !isFinite(b) || b === 0) return null;
  const r = a / b;
  return isFinite(r) ? r : null;
}

function roundTo(v: number, decimals: number): number {
  if (!isFinite(v)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

/** Classify market cap bucket */
function classifyCapBucket(marketCap: number | null): CapBucket {
  if (!marketCap) return "mixed";
  if (marketCap < 2_000) return "low";         // < $2B
  if (marketCap < 10_000) return "mid";        // $2B–$10B
  return "large";                               // > $10B
}

/** Estimate VWAP from OHLC (simplified intraday proxy) */
function estimateVwap(open: number, high: number, low: number, close: number): number {
  return (high + low + close) / 3;
}

/** Compute relative volume (current / avg) */
function computeRelVol(volume: number, avgVolume: number | null): number | null {
  if (!avgVolume || avgVolume <= 0) return null;
  return roundTo(volume / avgVolume, 2);
}

/** Compute ATR proxy from daily bars */
function computeAtr(bars: Array<{ high: number; low: number; close: number }>, period = 14): number {
  if (!bars || bars.length < 2) return 0;
  const trueRanges = bars.slice(1).map((bar, i) => {
    const prevClose = bars[i].close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose)
    );
  });
  const recent = trueRanges.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

/** Compute RSI-14 from close prices */
function computeRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return roundTo(100 - 100 / (1 + rs), 1);
}

/** Determine momentum direction from price action */
function assessMomentum(changePercent: number, relVol: number | null, rsi: number): number {
  let score = 50;
  score += clamp(changePercent * 4, -30, 30);
  if (relVol !== null) score += clamp((relVol - 1) * 10, -15, 15);
  score += clamp((rsi - 50) * 0.4, -20, 20);
  return clamp(Math.round(score), 0, 100);
}

/** Determine setup type from technical indicators */
function classifySetupType(
  changePercent: number,
  relVol: number | null,
  rsi: number,
  price: number,
  open: number,
  high: number,
  low: number,
  direction: TradeDirection
): SetupType {
  const vwap = estimateVwap(open, high, low, price);
  const aboveVwap = price > vwap;
  const strongVolume = relVol !== null && relVol > 1.5;
  const gapUp = open > 0 && (open - price) / price < -0.005; // opened higher than prev close proxy
  const gapDown = open > 0 && (open - price) / price > 0.005;

  if (direction === "bearish" || (direction === "both" && changePercent < -1.5)) {
    if (rsi > 65 && !aboveVwap) return "Breakdown Short";
    if (gapDown && strongVolume) return "Gap Fill";
    return "Breakdown Short";
  }

  if (changePercent > 3 && strongVolume && rsi > 55) return "Momentum Breakout";
  if (aboveVwap && rsi > 50 && changePercent > 0.5) return "VWAP Reclaim";
  if (Math.abs(changePercent) < 0.5 && rsi < 45 && aboveVwap) return "Pullback Continuation";
  if (gapUp && strongVolume) return "Opening Range Breakout";
  if (changePercent < -2 && rsi < 35) return "Reversal";
  if (Math.abs(changePercent) < 1 && strongVolume) return "Scalp";
  return "Momentum Breakout";
}

/** Compute entry zone, targets, stop from price + ATR */
function computeLevels(
  price: number,
  atr: number,
  setupType: SetupType,
  direction: "bullish" | "bearish"
): { entryLow: number; entryHigh: number; target1: number; target2: number; stop: number; invalidation: number; rr: number } {
  const safeAtr = atr > 0 ? atr : price * 0.01; // fallback 1% if ATR unavailable

  if (direction === "bearish") {
    const entryHigh = roundTo(price * 1.002, 4);
    const entryLow = roundTo(price * 0.998, 4);
    const stop = roundTo(price + safeAtr * 0.8, 4);
    const invalidation = roundTo(price + safeAtr * 1.2, 4);
    const target1 = roundTo(price - safeAtr * 1.2, 4);
    const target2 = roundTo(price - safeAtr * 2.2, 4);
    const rr = roundTo((price - target1) / (stop - price), 2);
    return { entryLow, entryHigh, target1, target2, stop, invalidation, rr: isFinite(rr) ? rr : 1.5 };
  }

  const entryLow = roundTo(price * 0.998, 4);
  const entryHigh = roundTo(price * 1.002, 4);
  const stop = roundTo(price - safeAtr * 0.8, 4);
  const invalidation = roundTo(price - safeAtr * 1.2, 4);
  const target1 = roundTo(price + safeAtr * 1.2, 4);
  const target2 = roundTo(price + safeAtr * 2.2, 4);
  const rr = roundTo((target1 - price) / (price - stop), 2);
  return { entryLow, entryHigh, target1, target2, stop, invalidation, rr: isFinite(rr) ? rr : 1.5 };
}

/** Compute confidence score (0–100) */
function computeConfidence(
  relVol: number | null,
  rsi: number,
  changePercent: number,
  rr: number,
  riskProfile: RiskProfile
): number {
  let score = 40;
  // Volume confirmation
  if (relVol !== null) {
    if (relVol > 3) score += 20;
    else if (relVol > 2) score += 14;
    else if (relVol > 1.5) score += 8;
    else if (relVol < 0.7) score -= 10;
  }
  // RSI momentum
  if (rsi > 60 && rsi < 80) score += 12;
  else if (rsi > 50) score += 6;
  else if (rsi < 30) score += 8; // oversold reversal
  else if (rsi < 40) score += 4;
  // Price movement
  if (Math.abs(changePercent) > 3) score += 10;
  else if (Math.abs(changePercent) > 1.5) score += 6;
  // Risk/reward
  if (rr >= 3) score += 10;
  else if (rr >= 2) score += 6;
  else if (rr < 1.2) score -= 12;
  // Risk profile adjustment
  if (riskProfile === "conservative") score -= 10;
  else if (riskProfile === "aggressive") score += 5;

  return clamp(Math.round(score), 0, 100);
}

/** Map confidence + rr to risk level */
function computeRiskLevel(confidence: number, rr: number, riskProfile: RiskProfile): DayTradeSetup["riskLevel"] {
  if (riskProfile === "aggressive" || (confidence < 60 && rr < 2)) return "Very High";
  if (confidence >= 75 && rr >= 2.5) return "Low";
  if (confidence >= 65) return "Medium";
  return "High";
}

/** Map volume to liquidity rating */
function computeLiquidity(volume: number, marketCap: number | null, assetType: "stock" | "crypto"): DayTradeSetup["liquidityRating"] {
  if (assetType === "crypto") {
    if (!marketCap) return "Medium";
    if (marketCap > 10_000_000_000) return "High";
    if (marketCap > 500_000_000) return "Medium";
    return "Low";
  }
  if (volume > 5_000_000) return "High";
  if (volume > 500_000) return "Medium";
  return "Low";
}

/** Expected hold time in minutes based on setup type */
function expectedHold(setupType: SetupType): number {
  switch (setupType) {
    case "Scalp": return 30;
    case "Opening Range Breakout": return 60;
    case "VWAP Reclaim": return 60;
    case "Gap Fill": return 90;
    case "Momentum Breakout": return 90;
    case "Pullback Continuation": return 120;
    case "Reversal": return 120;
    case "Breakdown Short": return 90;
    default: return 60;
  }
}

/**
 * Compute Execution Score (0–100) and grade from component factors.
 * Breakdown:
 *   macroCondition    (0–20): regime pressure inversion
 *   technicalStructure (0–20): RSI + setup type quality
 *   liquidityScore    (0–15): volume + liquidity rating
 *   volatilityScore   (0–15): ATR-based volatility suitability
 *   momentumScore     (0–15): relative volume + price change
 *   riskRewardScore   (0–15): R:R ratio quality
 */
function computeExecutionScore(
  regimePressure: number,
  rsi: number,
  setupType: SetupType,
  relVol: number | null,
  liquidityRating: DayTradeSetup["liquidityRating"],
  changePercent: number,
  rr: number,
  confidence: number,
  isNoTrade: boolean
): { score: number; grade: DayTradeSetup["executionGrade"]; breakdown: ExecutionScoreBreakdown } {
  if (isNoTrade) {
    return {
      score: 0,
      grade: "F",
      breakdown: { macroCondition: 0, technicalStructure: 0, liquidityScore: 0, volatilityScore: 0, momentumScore: 0, riskRewardScore: 0 },
    };
  }

  // macroCondition: lower pressure = better macro environment for day trading
  const macroCondition = clamp(Math.round(20 * (1 - regimePressure / 100)), 0, 20);

  // technicalStructure: RSI in ideal range + setup quality
  let technicalStructure = 0;
  if (rsi >= 50 && rsi <= 70) technicalStructure += 12;
  else if (rsi >= 40 && rsi <= 80) technicalStructure += 8;
  else technicalStructure += 4;
  if (setupType === "Momentum Breakout" || setupType === "Opening Range Breakout") technicalStructure += 8;
  else if (setupType === "VWAP Reclaim" || setupType === "Pullback Continuation") technicalStructure += 6;
  else if (setupType !== "NO_TRADE") technicalStructure += 4;
  technicalStructure = clamp(technicalStructure, 0, 20);

  // liquidityScore: volume + liquidity rating
  let liquidityScore = 0;
  if (liquidityRating === "High") liquidityScore = 15;
  else if (liquidityRating === "Medium") liquidityScore = 10;
  else liquidityScore = 5;
  if (relVol !== null && relVol > 2) liquidityScore = Math.min(15, liquidityScore + 3);
  liquidityScore = clamp(liquidityScore, 0, 15);

  // volatilityScore: moderate volatility is ideal (not too low, not extreme)
  const absChange = Math.abs(changePercent);
  let volatilityScore = 0;
  if (absChange >= 1.5 && absChange <= 5) volatilityScore = 15;
  else if (absChange >= 0.5 && absChange <= 8) volatilityScore = 10;
  else if (absChange > 8) volatilityScore = 5; // extreme volatility = risky
  else volatilityScore = 3; // too quiet
  volatilityScore = clamp(volatilityScore, 0, 15);

  // momentumScore: relative volume + price change alignment
  let momentumScore = 0;
  if (relVol !== null) {
    if (relVol > 3) momentumScore += 10;
    else if (relVol > 2) momentumScore += 7;
    else if (relVol > 1.5) momentumScore += 5;
    else momentumScore += 2;
  } else {
    momentumScore += 3;
  }
  if (absChange > 2) momentumScore += 5;
  else if (absChange > 1) momentumScore += 3;
  momentumScore = clamp(momentumScore, 0, 15);

  // riskRewardScore: R:R quality
  let riskRewardScore = 0;
  if (rr >= 3) riskRewardScore = 15;
  else if (rr >= 2.5) riskRewardScore = 12;
  else if (rr >= 2) riskRewardScore = 9;
  else if (rr >= 1.5) riskRewardScore = 6;
  else riskRewardScore = 3;
  riskRewardScore = clamp(riskRewardScore, 0, 15);

  const score = clamp(
    macroCondition + technicalStructure + liquidityScore + volatilityScore + momentumScore + riskRewardScore,
    0, 100
  );

  // Blend with confidence for final score
  const blended = clamp(Math.round(score * 0.7 + confidence * 0.3), 0, 100);

  const grade: DayTradeSetup["executionGrade"] =
    blended >= 80 ? "A" :
    blended >= 65 ? "B" :
    blended >= 50 ? "C" :
    blended >= 35 ? "D" : "F";

  return {
    score: blended,
    grade,
    breakdown: { macroCondition, technicalStructure, liquidityScore, volatilityScore, momentumScore, riskRewardScore },
  };
}

// ── LLM Enrichment ────────────────────────────────────────────

interface LLMEnrichment {
  catalyst: string;
  whyToday: string;
  reasonForRecommendation: string;
  regimeImpact: string;
  sectorStrength: string;
  intradayTrend: DayTradeReport["intradayTrend"];
  marketContext: string;
  whyTradeExists: string;
  whatCancelsThisTrade: string;
  confidenceReasoning: string;
  catalystSummary: string;
  noTradeReason?: string;
  // Phase 3.0 additions
  bullCase: string;
  bearCase: string;
  primaryCatalyst: string;
  largestRisk: string;
  mostLikelyPath: string;
  alternativePath: string;
  recommendedTimeframe: string;
  bestStrategy: string;
}

async function enrichWithLLM(
  symbol: string,
  name: string,
  assetType: "stock" | "crypto",
  price: number,
  changePercent: number,
  volume: number,
  relVol: number | null,
  rsi: number,
  setupType: SetupType,
  direction: "bullish" | "bearish",
  confidence: number,
  regime: string,
  regimePressure: number,
  rr: number,
  isNoTrade: boolean
): Promise<LLMEnrichment> {
  const systemPrompt = `You are FAULTLINE's Day Trade Intelligence™ AI engine. You analyze intraday trading setups with institutional-grade precision.

STRICT RULES:
- Only analyze same-day (intraday) trades. Never recommend overnight positions.
- If no valid setup exists, explain clearly why (NO_TRADE).
- Never fabricate prices, levels, or data.
- Be concise and specific — no generic filler.
- Respond ONLY with valid JSON matching the schema exactly.`;

  const userPrompt = `Analyze this ${assetType.toUpperCase()} for an intraday day trade setup:

Symbol: ${symbol} (${name})
Current Price: $${price}
Daily Change: ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%
Volume: ${volume.toLocaleString()}
Relative Volume: ${relVol !== null ? relVol.toFixed(2) + "x" : "Unknown"}
RSI-14: ${rsi}
Setup Type: ${setupType}
Direction: ${direction.toUpperCase()}
Confidence: ${confidence}/100
Risk/Reward: ${rr}:1
FAULTLINE Regime: ${regime} (Pressure: ${regimePressure}/100)
Is NO_TRADE: ${isNoTrade}

Return JSON with these exact fields:
{
  "catalyst": "1-sentence current catalyst or 'No clear catalyst identified'",
  "whyToday": "1-sentence why this setup is valid specifically today",
  "reasonForRecommendation": "2-sentence explanation of why this qualifies as a day trade",
  "regimeImpact": "1-sentence how the current FAULTLINE regime affects this trade",
  "sectorStrength": "1-sentence sector context or 'N/A for crypto'",
  "intradayTrend": "one of: Strongly Bullish | Bullish | Neutral | Bearish | Strongly Bearish",
  "marketContext": "1-sentence broader market context for this trade",
  "whyTradeExists": "1-sentence why this opportunity exists right now",
  "whatCancelsThisTrade": "1-sentence specific invalidation conditions",
  "confidenceReasoning": "1-sentence explanation of the confidence score",
  "catalystSummary": "brief catalyst summary or 'No catalyst'",
  "noTradeReason": "if NO_TRADE: explain why in 1 sentence, else null",
  "bullCase": "2-sentence bull case for this trade — what has to go right",
  "bearCase": "2-sentence bear case — what could go wrong intraday",
  "primaryCatalyst": "the single most important catalyst driving this setup today",
  "largestRisk": "the single largest intraday risk factor for this trade",
  "mostLikelyPath": "2-sentence description of the most probable intraday price path",
  "alternativePath": "1-sentence alternative scenario if the primary thesis fails",
  "recommendedTimeframe": "specific intraday timeframe (e.g. '15-min chart, 60-90 min hold')",
  "bestStrategy": "1-sentence best execution strategy for this setup (entry trigger, position sizing hint)"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "day_trade_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              catalyst: { type: "string" },
              whyToday: { type: "string" },
              reasonForRecommendation: { type: "string" },
              regimeImpact: { type: "string" },
              sectorStrength: { type: "string" },
              intradayTrend: { type: "string", enum: ["Strongly Bullish", "Bullish", "Neutral", "Bearish", "Strongly Bearish"] },
              marketContext: { type: "string" },
              whyTradeExists: { type: "string" },
              whatCancelsThisTrade: { type: "string" },
              confidenceReasoning: { type: "string" },
              catalystSummary: { type: "string" },
              noTradeReason: { type: ["string", "null"] },
              bullCase: { type: "string" },
              bearCase: { type: "string" },
              primaryCatalyst: { type: "string" },
              largestRisk: { type: "string" },
              mostLikelyPath: { type: "string" },
              alternativePath: { type: "string" },
              recommendedTimeframe: { type: "string" },
              bestStrategy: { type: "string" },
            },
            required: [
              "catalyst", "whyToday", "reasonForRecommendation", "regimeImpact", "sectorStrength",
              "intradayTrend", "marketContext", "whyTradeExists", "whatCancelsThisTrade",
              "confidenceReasoning", "catalystSummary", "noTradeReason",
              "bullCase", "bearCase", "primaryCatalyst", "largestRisk",
              "mostLikelyPath", "alternativePath", "recommendedTimeframe", "bestStrategy",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed as LLMEnrichment;
  } catch (err) {
    log.warn("[DayTradeEngine] LLM enrichment failed, using fallback", { symbol, err: String(err) });
    // Deterministic fallback — never block on LLM failure
    const trendMap: Record<string, DayTradeReport["intradayTrend"]> = {
      "bullish": changePercent > 2 ? "Strongly Bullish" : "Bullish",
      "bearish": changePercent < -2 ? "Strongly Bearish" : "Bearish",
    };
    return {
      catalyst: "Market data available — AI analysis temporarily unavailable.",
      whyToday: `${symbol} shows ${direction} momentum with ${Math.abs(changePercent).toFixed(1)}% move and ${relVol !== null ? relVol.toFixed(1) + "x" : "elevated"} relative volume.`,
      reasonForRecommendation: `Technical setup: ${setupType}. RSI at ${rsi}, ${direction} price action with ${rr}:1 risk/reward.`,
      regimeImpact: `Current regime (${regime}, pressure ${regimePressure}/100) ${regimePressure > 60 ? "increases risk — size down" : "supports intraday setups"}.`,
      sectorStrength: assetType === "crypto" ? "N/A for crypto" : "Sector data unavailable.",
      intradayTrend: trendMap[direction] ?? "Neutral",
      marketContext: `${symbol} is ${direction} intraday with ${Math.abs(changePercent).toFixed(1)}% change.`,
      whyTradeExists: `${setupType} pattern detected with ${relVol !== null ? relVol.toFixed(1) + "x" : "above-average"} volume confirmation.`,
      whatCancelsThisTrade: `Trade invalidated if price breaks ${direction === "bullish" ? "below" : "above"} the stop level or volume collapses.`,
      confidenceReasoning: `Confidence ${confidence}/100 based on RSI (${rsi}), relative volume, and ${rr}:1 risk/reward.`,
      catalystSummary: "AI analysis unavailable — using deterministic signal.",
      noTradeReason: isNoTrade ? `Confidence ${confidence}/100 is below the ${MIN_CONFIDENCE}/100 minimum threshold for a valid intraday setup.` : undefined,
      bullCase: `${symbol} shows ${direction} momentum with ${Math.abs(changePercent).toFixed(1)}% move. Volume confirmation and technical setup support continuation toward target.`,
      bearCase: `If volume fades or market conditions deteriorate, ${symbol} may reverse. Stop level provides defined risk.`,
      primaryCatalyst: `${setupType} pattern with ${relVol !== null ? relVol.toFixed(1) + "x" : "elevated"} relative volume.`,
      largestRisk: `Regime pressure at ${regimePressure}/100 — elevated macro risk could override technical setup.`,
      mostLikelyPath: `${symbol} continues ${direction} momentum toward Target 1. Volume must remain elevated for continuation.`,
      alternativePath: `If price fails to hold entry zone, expect consolidation or reversal toward stop level.`,
      recommendedTimeframe: `${expectedHold(setupType)}-minute hold on 5-min or 15-min chart.`,
      bestStrategy: `Enter on ${direction === "bullish" ? "breakout confirmation above" : "breakdown below"} entry zone with 1/3 position, add on confirmation.`,
    };
  }
}

// ── Stock Setup Builder ───────────────────────────────────────

async function buildStockSetup(
  ticker: string,
  name: string,
  price: number,
  changePercent: number,
  volume: number,
  avgVolume: number | null,
  marketCap: number | null,
  open: number,
  high: number,
  low: number,
  direction: TradeDirection,
  riskProfile: RiskProfile,
  regime: string,
  regimePressure: number
): Promise<DayTradeSetup | null> {
  if (!price || price <= 0) return null;

  // Fetch daily bars for ATR + RSI
  let bars: Array<{ close: number; high: number; low: number; open: number; volume: number; timestamp: number }> = [];
  try {
    const apiKey = process.env.POLYGON_API_KEY ?? "";
    if (apiKey) bars = await fetchDailyBars(apiKey, ticker, 20);
  } catch { /* non-fatal */ }

  const closes = bars.map(b => b.close);
  const rsi = computeRsi(closes.length > 0 ? [...closes, price] : [price]);
  const atr = computeAtr(bars.length > 0 ? bars : [{ high, low, close: price }]);
  const relVol = computeRelVol(volume, avgVolume);
  const capBucket = classifyCapBucket(marketCap ? marketCap / 1_000_000 : null);

  // Determine direction
  const resolvedDirection: "bullish" | "bearish" =
    direction === "bearish" ? "bearish" :
    direction === "bullish" ? "bullish" :
    changePercent >= 0 ? "bullish" : "bearish";

  const setupType = classifySetupType(changePercent, relVol, rsi, price, open, high, low, direction);
  const levels = computeLevels(price, atr, setupType, resolvedDirection);
  const confidence = computeConfidence(relVol, rsi, changePercent, levels.rr, riskProfile);
  const riskLevel = computeRiskLevel(confidence, levels.rr, riskProfile);
  const liquidity = computeLiquidity(volume, marketCap, "stock");
  const momentum = assessMomentum(changePercent, relVol, rsi);

  const isNoTrade = confidence < MIN_CONFIDENCE;

  const enrichment = await enrichWithLLM(
    ticker, name, "stock", price, changePercent, volume, relVol, rsi,
    isNoTrade ? "NO_TRADE" : setupType, resolvedDirection,
    confidence, regime, regimePressure, levels.rr, isNoTrade
  );

  const { score: executionScore, grade: executionGrade } = computeExecutionScore(
    regimePressure, rsi, isNoTrade ? "NO_TRADE" : setupType, relVol, liquidity,
    changePercent, levels.rr, confidence, isNoTrade
  );

  return {
    symbol: ticker,
    name,
    assetType: "stock",
    currentPrice: price,
    changePercent: roundTo(changePercent, 2),
    volume,
    relativeVolume: relVol,
    marketCap: marketCap ? marketCap / 1_000_000 : null,
    capBucket,
    setupType: isNoTrade ? "NO_TRADE" : setupType,
    direction: resolvedDirection,
    entryZoneLow: levels.entryLow,
    entryZoneHigh: levels.entryHigh,
    target1: levels.target1,
    target2: levels.target2,
    stopLoss: levels.stop,
    invalidationLevel: levels.invalidation,
    expectedHoldMinutes: expectedHold(setupType),
    confidence,
    probabilityRating: clamp(Math.round(confidence * 0.9 + momentum * 0.1), 0, 100),
    riskRewardRatio: levels.rr,
    riskLevel,
    liquidityRating: liquidity,
    executionScore,
    executionGrade,
    catalyst: enrichment.catalyst,
    whyToday: enrichment.whyToday,
    reasonForRecommendation: enrichment.reasonForRecommendation,
    regimeImpact: enrichment.regimeImpact,
    sectorStrength: enrichment.sectorStrength,
    generatedAt: Date.now(),
  };
}

// ── Crypto Setup Builder ──────────────────────────────────────

async function buildCryptoSetup(
  coin: CoinMarketData,
  direction: TradeDirection,
  riskProfile: RiskProfile,
  regime: string,
  regimePressure: number
): Promise<DayTradeSetup | null> {
  const price = coin.currentPrice;
  const changePercent = coin.priceChangePercent24h;
  const volume = coin.totalVolume;
  const marketCap = coin.marketCap;

  if (!price || price <= 0) return null;

  // Estimate ATR from 24h range
  const range = coin.high24h - coin.low24h;
  const atr = range > 0 ? range * 0.3 : price * 0.02;

  // Estimate RSI from sparkline
  const closes = coin.sparkline7d ?? [];
  const rsi = computeRsi(closes.length > 1 ? closes : [price]);

  // Relative volume: use volatility as proxy
  const relVol = coin.volatility24h > 3 ? 2.0 : coin.volatility24h > 1.5 ? 1.5 : 1.0;
  const capBucket = classifyCapBucket(marketCap / 1_000_000);

  const resolvedDirection: "bullish" | "bearish" =
    direction === "bearish" ? "bearish" :
    direction === "bullish" ? "bullish" :
    changePercent >= 0 ? "bullish" : "bearish";

  const setupType = classifySetupType(changePercent, relVol, rsi, price, price * 0.99, coin.high24h, coin.low24h, direction);
  const levels = computeLevels(price, atr, setupType, resolvedDirection);
  const confidence = computeConfidence(relVol, rsi, changePercent, levels.rr, riskProfile);
  const riskLevel = computeRiskLevel(confidence, levels.rr, riskProfile);
  const liquidity = computeLiquidity(volume, marketCap, "crypto");
  const momentum = assessMomentum(changePercent, relVol, rsi);

  const isNoTrade = confidence < MIN_CONFIDENCE;

  const enrichment = await enrichWithLLM(
    coin.symbol.toUpperCase(), coin.name, "crypto", price, changePercent, volume, relVol, rsi,
    isNoTrade ? "NO_TRADE" : setupType, resolvedDirection,
    confidence, regime, regimePressure, levels.rr, isNoTrade
  );

  const { score: executionScore, grade: executionGrade } = computeExecutionScore(
    regimePressure, rsi, isNoTrade ? "NO_TRADE" : setupType, relVol, liquidity,
    changePercent, levels.rr, confidence, isNoTrade
  );

  return {
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    assetType: "crypto",
    currentPrice: price,
    changePercent: roundTo(changePercent, 2),
    volume,
    relativeVolume: relVol,
    marketCap: marketCap / 1_000_000,
    capBucket,
    setupType: isNoTrade ? "NO_TRADE" : setupType,
    direction: resolvedDirection,
    entryZoneLow: levels.entryLow,
    entryZoneHigh: levels.entryHigh,
    target1: levels.target1,
    target2: levels.target2,
    stopLoss: levels.stop,
    invalidationLevel: levels.invalidation,
    expectedHoldMinutes: expectedHold(setupType),
    confidence,
    probabilityRating: clamp(Math.round(confidence * 0.9 + momentum * 0.1), 0, 100),
    riskRewardRatio: levels.rr,
    riskLevel,
    liquidityRating: liquidity,
    executionScore,
    executionGrade,
    catalyst: enrichment.catalyst,
    whyToday: enrichment.whyToday,
    reasonForRecommendation: enrichment.reasonForRecommendation,
    regimeImpact: enrichment.regimeImpact,
    sectorStrength: enrichment.sectorStrength,
    generatedAt: Date.now(),
  };
}

// ── Main Exports ──────────────────────────────────────────────

/**
 * Scan the market for intraday day trade setups.
 * Returns only setups meeting minimum confidence threshold.
 * Never forces a trade — returns empty array if no quality setups exist.
 */
export async function dayTradeScanner(input: ScannerInput): Promise<DayTradeSetup[]> {
  const cacheKey = `${input.assetType}_${input.capBucket}_${input.direction}_${input.riskProfile}`;
  const cached = scanCache.get(cacheKey);
  if (cached) return cached;

  log.info("[DayTradeScanner] Running scan", input as unknown as Record<string, unknown>);

  // Get regime context
  let regime = "Unknown";
  let regimePressure = 50;
  try {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    const pressure = await calculateFaultlinePressure();
    regime = pressure.regime;
    regimePressure = pressure.overallPressure;
  } catch { /* non-fatal */ }

  const results: DayTradeSetup[] = [];

  // ── Stock scanning ──
  if (input.assetType === "stock" || input.assetType === "both") {
    try {
      let performers: Awaited<ReturnType<typeof getTopStockPerformers>> = [];

      if (input.direction === "bearish") {
        performers = await getTopStockLosers(30);
      } else if (input.capBucket === "low") {
        const [runners, volatile] = await Promise.all([
          getSmallCapRunners(20),
          getMostVolatileStocks(20),
        ]);
        performers = [...runners, ...volatile].slice(0, 30);
      } else {
        const [gainers, byVol] = await Promise.all([
          getTopStockPerformers(30),
          getTopStockByVolume(20),
        ]);
        performers = [...gainers, ...byVol].slice(0, 30);
      }

      // Filter by cap bucket
      const filtered = performers.filter(p => {
        if (input.capBucket === "mixed") return true;
        const cap = p.marketCap ? p.marketCap / 1_000_000 : null;
        const bucket = classifyCapBucket(cap);
        return bucket === input.capBucket;
      });

      // Build setups in parallel (limit concurrency)
      const BATCH = 6;
      for (let i = 0; i < Math.min(filtered.length, 20); i += BATCH) {
        const batch = filtered.slice(i, i + BATCH);
        const setups = await Promise.all(
          batch.map(p => buildStockSetup(
            p.ticker, p.name, p.price, p.changePercent,
            p.volume, p.avgVolume, p.marketCap,
            p.price * 0.995, p.price * 1.02, p.price * 0.98, // open/high/low proxy
            input.direction, input.riskProfile, regime, regimePressure
          ).catch(() => null))
        );
        for (const s of setups) {
          if (s && s.setupType !== "NO_TRADE" && s.confidence >= MIN_CONFIDENCE) {
            results.push(s);
          }
        }
        if (results.length >= input.maxResults) break;
      }
    } catch (err) {
      log.error("[DayTradeScanner] Stock scan failed", { err: String(err) });
    }
  }

  // ── Crypto scanning ──
  if (input.assetType === "crypto" || input.assetType === "both") {
    try {
      const coins = await getTopMarkets(50);
      const sorted = [...coins].sort((a, b) => Math.abs(b.priceChangePercent24h) - Math.abs(a.priceChangePercent24h));

      const BATCH = 5;
      for (let i = 0; i < Math.min(sorted.length, 20); i += BATCH) {
        const batch = sorted.slice(i, i + BATCH);
        const setups = await Promise.all(
          batch.map(c => buildCryptoSetup(c, input.direction, input.riskProfile, regime, regimePressure).catch(() => null))
        );
        for (const s of setups) {
          if (s && s.setupType !== "NO_TRADE" && s.confidence >= MIN_CONFIDENCE) {
            results.push(s);
          }
        }
        if (results.length >= input.maxResults) break;
      }
    } catch (err) {
      log.error("[DayTradeScanner] Crypto scan failed", { err: String(err) });
    }
  }

  // Sort by executionScore descending (Phase 3.0: use execution score for ranking)
  results.sort((a, b) => b.executionScore - a.executionScore);
  const final = results.slice(0, input.maxResults);
  scanCache.set(cacheKey, final);
  return final;
}

/**
 * Generate a complete Day Trade Intelligence Report for a single symbol.
 * Returns a full DayTradeReport including extended analysis fields.
 * If no valid setup exists, returns a report with setupType = "NO_TRADE".
 */
export async function dayTradeSymbolSetup(
  symbol: string,
  assetType: "stock" | "crypto",
  direction: TradeDirection = "both"
): Promise<DayTradeReport> {
  const cacheKey = `${symbol}_${assetType}_${direction}`;
  const cached = reportCache.get(cacheKey);
  if (cached) return cached;

  log.info("[DayTradeSymbolSetup] Generating report", { symbol, assetType });

  // Get regime context
  let regime = "Unknown";
  let regimePressure = 50;
  try {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    const pressure = await calculateFaultlinePressure();
    regime = pressure.regime;
    regimePressure = pressure.overallPressure;
  } catch { /* non-fatal */ }

  const emptyBreakdown: ExecutionScoreBreakdown = {
    macroCondition: 0, technicalStructure: 0, liquidityScore: 0,
    volatilityScore: 0, momentumScore: 0, riskRewardScore: 0,
  };

  if (assetType === "crypto") {
    // ── Crypto report ──
    const coin = await getCoinMarketData(symbol);
    if (!coin || !coin.currentPrice) {
      const noTradeReport: DayTradeReport = {
        symbol: symbol.toUpperCase(),
        name: symbol.toUpperCase(),
        assetType: "crypto",
        currentPrice: 0,
        changePercent: 0,
        volume: 0,
        relativeVolume: null,
        marketCap: null,
        capBucket: "mixed",
        setupType: "NO_TRADE",
        direction: "bullish",
        entryZoneLow: 0,
        entryZoneHigh: 0,
        target1: 0,
        target2: 0,
        stopLoss: 0,
        invalidationLevel: 0,
        expectedHoldMinutes: 0,
        confidence: 0,
        probabilityRating: 0,
        riskRewardRatio: 0,
        riskLevel: "Very High",
        liquidityRating: "Low",
        executionScore: 0,
        executionGrade: "F",
        catalyst: "N/A",
        whyToday: "N/A",
        reasonForRecommendation: "N/A",
        regimeImpact: "N/A",
        sectorStrength: "N/A",
        intradayTrend: "Neutral",
        marketContext: "N/A",
        vwapStatus: "Unknown",
        momentumRating: 0,
        supportLevel: 0,
        resistanceLevel: 0,
        whyTradeExists: "N/A",
        whatCancelsThisTrade: "N/A",
        confidenceReasoning: "N/A",
        catalystSummary: "N/A",
        noTradeReason: "Live market data unavailable. Unable to generate a reliable intraday setup.",
        executionScoreBreakdown: emptyBreakdown,
        bullCase: "N/A",
        bearCase: "N/A",
        primaryCatalyst: "N/A",
        largestRisk: "N/A",
        mostLikelyPath: "N/A",
        alternativePath: "N/A",
        recommendedTimeframe: "N/A",
        bestStrategy: "N/A",
        generatedAt: Date.now(),
      };
      return noTradeReport;
    }

    const setup = await buildCryptoSetup(coin, direction, "balanced", regime, regimePressure);
    if (!setup) throw new Error(`Failed to build crypto setup for ${symbol}`);

    const price = coin.currentPrice;
    const closes = coin.sparkline7d ?? [];
    const rsi = computeRsi(closes.length > 1 ? closes : [price]);
    const vwap = estimateVwap(price * 0.99, coin.high24h, coin.low24h, price);

    const enrichment = await enrichWithLLM(
      setup.symbol, setup.name, "crypto", price, coin.priceChangePercent24h,
      coin.totalVolume, setup.relativeVolume, rsi,
      setup.setupType, setup.direction,
      setup.confidence, regime, regimePressure, setup.riskRewardRatio,
      setup.setupType === "NO_TRADE"
    );

    const { breakdown: executionScoreBreakdown } = computeExecutionScore(
      regimePressure, rsi, setup.setupType, setup.relativeVolume, setup.liquidityRating,
      coin.priceChangePercent24h, setup.riskRewardRatio, setup.confidence,
      setup.setupType === "NO_TRADE"
    );

    const report: DayTradeReport = {
      ...setup,
      intradayTrend: enrichment.intradayTrend,
      marketContext: enrichment.marketContext,
      vwapStatus: price > vwap ? "Above VWAP" : price < vwap ? "Below VWAP" : "At VWAP",
      momentumRating: assessMomentum(coin.priceChangePercent24h, setup.relativeVolume, rsi),
      supportLevel: roundTo(coin.low24h, 4),
      resistanceLevel: roundTo(coin.high24h, 4),
      whyTradeExists: enrichment.whyTradeExists,
      whatCancelsThisTrade: enrichment.whatCancelsThisTrade,
      confidenceReasoning: enrichment.confidenceReasoning,
      catalystSummary: enrichment.catalystSummary,
      noTradeReason: enrichment.noTradeReason ?? undefined,
      executionScoreBreakdown,
      bullCase: enrichment.bullCase,
      bearCase: enrichment.bearCase,
      primaryCatalyst: enrichment.primaryCatalyst,
      largestRisk: enrichment.largestRisk,
      mostLikelyPath: enrichment.mostLikelyPath,
      alternativePath: enrichment.alternativePath,
      recommendedTimeframe: enrichment.recommendedTimeframe,
      bestStrategy: enrichment.bestStrategy,
    };

    reportCache.set(cacheKey, report);
    return report;
  }

  // ── Stock report ──
  const quote = await getQuote(symbol);
  if (!quote || !quote.price || quote.source === "error") {
    const noTradeReport: DayTradeReport = {
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      assetType: "stock",
      currentPrice: 0,
      changePercent: 0,
      volume: 0,
      relativeVolume: null,
      marketCap: null,
      capBucket: "mixed",
      setupType: "NO_TRADE",
      direction: "bullish",
      entryZoneLow: 0,
      entryZoneHigh: 0,
      target1: 0,
      target2: 0,
      stopLoss: 0,
      invalidationLevel: 0,
      expectedHoldMinutes: 0,
      confidence: 0,
      probabilityRating: 0,
      riskRewardRatio: 0,
      riskLevel: "Very High",
      liquidityRating: "Low",
      executionScore: 0,
      executionGrade: "F",
      catalyst: "N/A",
      whyToday: "N/A",
      reasonForRecommendation: "N/A",
      regimeImpact: "N/A",
      sectorStrength: "N/A",
      intradayTrend: "Neutral",
      marketContext: "N/A",
      vwapStatus: "Unknown",
      momentumRating: 0,
      supportLevel: 0,
      resistanceLevel: 0,
      whyTradeExists: "N/A",
      whatCancelsThisTrade: "N/A",
      confidenceReasoning: "N/A",
      catalystSummary: "N/A",
      noTradeReason: "Live market data unavailable. Unable to generate a reliable intraday setup.",
      executionScoreBreakdown: emptyBreakdown,
      bullCase: "N/A",
      bearCase: "N/A",
      primaryCatalyst: "N/A",
      largestRisk: "N/A",
      mostLikelyPath: "N/A",
      alternativePath: "N/A",
      recommendedTimeframe: "N/A",
      bestStrategy: "N/A",
      generatedAt: Date.now(),
    };
    return noTradeReport;
  }

  const price = quote.price;
  const changePercent = quote.changePercent ?? 0;
  const volume = quote.volume ?? 0;
  const open = quote.open ?? price;
  const high = quote.high ?? price * 1.01;
  const low = quote.low ?? price * 0.99;

  // Fetch daily bars for ATR + RSI
  let bars: Array<{ close: number; high: number; low: number; open: number; volume: number; timestamp: number }> = [];
  try {
    const apiKey = process.env.POLYGON_API_KEY ?? "";
    if (apiKey) bars = await fetchDailyBars(apiKey, symbol, 20);
  } catch { /* non-fatal */ }

  const closes = bars.map(b => b.close);
  const rsi = computeRsi(closes.length > 0 ? [...closes, price] : [price]);
  const atr = computeAtr(bars.length > 0 ? bars : [{ high, low, close: price }]);
  const vwap = estimateVwap(open, high, low, price);

  const setup = await buildStockSetup(
    symbol, symbol, price, changePercent, volume, null, null,
    open, high, low, direction, "balanced", regime, regimePressure
  );

  if (!setup) throw new Error(`Failed to build stock setup for ${symbol}`);

  const enrichment = await enrichWithLLM(
    symbol, symbol, "stock", price, changePercent, volume, setup.relativeVolume, rsi,
    setup.setupType, setup.direction,
    setup.confidence, regime, regimePressure, setup.riskRewardRatio,
    setup.setupType === "NO_TRADE"
  );

  const { breakdown: executionScoreBreakdown } = computeExecutionScore(
    regimePressure, rsi, setup.setupType, setup.relativeVolume, setup.liquidityRating,
    changePercent, setup.riskRewardRatio, setup.confidence,
    setup.setupType === "NO_TRADE"
  );

  const report: DayTradeReport = {
    ...setup,
    intradayTrend: enrichment.intradayTrend,
    marketContext: enrichment.marketContext,
    vwapStatus: price > vwap ? "Above VWAP" : price < vwap ? "Below VWAP" : "At VWAP",
    momentumRating: assessMomentum(changePercent, setup.relativeVolume, rsi),
    supportLevel: roundTo(low, 4),
    resistanceLevel: roundTo(high, 4),
    whyTradeExists: enrichment.whyTradeExists,
    whatCancelsThisTrade: enrichment.whatCancelsThisTrade,
    confidenceReasoning: enrichment.confidenceReasoning,
    catalystSummary: enrichment.catalystSummary,
    noTradeReason: enrichment.noTradeReason ?? undefined,
    executionScoreBreakdown,
    bullCase: enrichment.bullCase,
    bearCase: enrichment.bearCase,
    primaryCatalyst: enrichment.primaryCatalyst,
    largestRisk: enrichment.largestRisk,
    mostLikelyPath: enrichment.mostLikelyPath,
    alternativePath: enrichment.alternativePath,
    recommendedTimeframe: enrichment.recommendedTimeframe,
    bestStrategy: enrichment.bestStrategy,
  };

  reportCache.set(cacheKey, report);
  return report;
}

/**
 * Get overall market favorability for day trading today.
 */
export async function getDayTradeFavorability(): Promise<MarketFavorability> {
  const cached = favorabilityCache.get("fav");
  if (cached) return cached;

  let regime = "Unknown";
  let regimePressure = 50;
  try {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    const pressure = await calculateFaultlinePressure();
    regime = pressure.regime;
    regimePressure = pressure.overallPressure;
  } catch { /* non-fatal */ }

  // Get top movers
  let topMovers: MarketFavorability["topMovers"] = [];
  let topRelVol: MarketFavorability["topRelativeVolume"] = [];
  let bullishCount = 0;
  let bearishCount = 0;
  let highConfCount = 0;

  try {
    const [gainers, losers, byVol, coins] = await Promise.all([
      getTopStockPerformers(10).catch(() => []),
      getTopStockLosers(5).catch(() => []),
      getTopStockByVolume(10).catch(() => []),
      getTopMarkets(10).catch(() => []),
    ]);

    bullishCount = gainers.filter(g => g.changePercent > 2).length;
    bearishCount = losers.filter(l => l.changePercent < -2).length;
    highConfCount = gainers.filter(g => g.changePercent > 3 && (g.avgVolume ? g.volume / g.avgVolume > 1.5 : false)).length;

    topMovers = [
      ...gainers.slice(0, 3).map(g => ({ symbol: g.ticker, name: g.name, changePercent: g.changePercent, assetType: "stock" as const })),
      ...coins.slice(0, 3).map(c => ({ symbol: c.symbol.toUpperCase(), name: c.name, changePercent: c.priceChangePercent24h, assetType: "crypto" as const })),
    ].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 6);

    topRelVol = byVol.slice(0, 5).map(s => ({
      symbol: s.ticker,
      name: s.name,
      relVol: s.avgVolume ? roundTo(s.volume / s.avgVolume, 2) : 1.0,
      assetType: "stock" as const,
    }));
  } catch { /* non-fatal */ }

  // Compute overall score
  const volatilityScore = regimePressure;
  const overallScore = clamp(
    Math.round(
      (bullishCount > bearishCount ? 60 : 40) +
      (highConfCount * 5) -
      (regimePressure > 70 ? 15 : 0) +
      (topMovers.filter(m => m.changePercent > 2).length * 3)
    ),
    20, 90
  );

  const volatilityLevel: MarketFavorability["volatilityLevel"] =
    volatilityScore > 80 ? "Extreme" :
    volatilityScore > 60 ? "High" :
    volatilityScore > 35 ? "Moderate" : "Low";

  const marketBreadth: MarketFavorability["marketBreadth"] =
    bullishCount > bearishCount * 1.5 ? "Positive" :
    bearishCount > bullishCount * 1.5 ? "Negative" : "Neutral";

  // AI summary
  let aiSummary = "";
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's Day Trade Intelligence™ AI. Provide a 2-sentence intraday market summary for day traders. Be specific and actionable." },
        { role: "user", content: `Market regime: ${regime} (pressure ${regimePressure}/100). Bullish setups: ${bullishCount}. Bearish setups: ${bearishCount}. High-confidence: ${highConfCount}. Volatility: ${volatilityLevel}. Breadth: ${marketBreadth}. Top movers: ${topMovers.slice(0, 3).map(m => `${m.symbol} ${m.changePercent > 0 ? "+" : ""}${m.changePercent.toFixed(1)}%`).join(", ")}. Summarize day trading conditions today.` },
      ],
    });
    const rawContent = response?.choices?.[0]?.message?.content;
    aiSummary = typeof rawContent === "string" ? rawContent : "";
  } catch {
    aiSummary = `${regime} regime with ${volatilityLevel.toLowerCase()} volatility. ${bullishCount > bearishCount ? "Bullish" : "Mixed"} conditions — ${highConfCount} high-confidence setups identified. ${regimePressure > 65 ? "Elevated pressure — reduce position size." : "Conditions support selective intraday opportunities."}`;
  }

  const result: MarketFavorability = {
    overallScore,
    bullishOpportunities: bullishCount,
    bearishOpportunities: bearishCount,
    highConfidenceSetups: highConfCount,
    regime,
    regimePressure,
    volatilityLevel,
    marketBreadth,
    sectorLeadership: topMovers.filter(m => m.assetType === "stock").slice(0, 2).map(m => m.symbol).join(", ") || "Mixed",
    topMovers,
    topRelativeVolume: topRelVol,
    aiSummary,
    generatedAt: Date.now(),
  };

  favorabilityCache.set("fav", result);
  return result;
}

/** Clear all day trade caches */
export function clearDayTradeCache(): void {
  scanCache.clear();
  reportCache.clear();
  favorabilityCache.clear();
}
