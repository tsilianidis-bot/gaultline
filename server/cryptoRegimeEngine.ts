/**
 * Crypto Market Regime Engine
 * Thin adapter over the existing CryptoIntelligence engine that promotes
 * the BTC CyclePhase into a formal CryptoMarketRegime output.
 * Enriched with indicator breakdown, historical context, and transition probabilities.
 */
import {
  getCryptoIntelligence,
  CyclePhase,
  AccumulationPhaseAnalysis,
  CryptoIntelligenceReport,
} from "./cryptoIntelligence";
import { LRUCache } from "./lruCache";

// ── Types ─────────────────────────────────────────────────────
export type CryptoRegimeLabel =
  | "Bull Market"
  | "Expansion"
  | "Late Bull / Euphoria"
  | "Distribution"
  | "Bear Market"
  | "Capitulation"
  | "Bear Market → Accumulation Phase"
  | "Accumulation"
  | "Early Recovery";

export type CryptoRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type CryptoRegimeTrend = "Improving" | "Stable" | "Deteriorating";
export type IndicatorSignal = "Bullish" | "Neutral" | "Bearish";

export interface RegimeIndicator {
  name:         string;
  reading:      string;
  signal:       IndicatorSignal;
  contribution: "High" | "Medium" | "Low";
  confidence:   number;  // 0–100
  score:        number;  // 0–100 (raw score)
}

export interface HistoricalContext {
  avgDurationWeeks:        number;
  previousOccurrence:      string;  // e.g. "2022–2023"
  nextRegimeProbabilities: Array<{ regime: string; probability: number }>;
  btcAvgReturn:            string;  // e.g. "+180% over 12 months"
  ethAvgReturn:            string;
  altcoinBehavior:         string;
}

export interface TransitionProbability {
  regime:      string;
  probability: number;  // 0–100
  description: string;
}

export interface CryptoMarketRegime {
  regime:                  CryptoRegimeLabel;
  cyclePhase:              CyclePhase;
  riskLevel:               CryptoRiskLevel;
  trend:                   CryptoRegimeTrend;
  confidence:              number;
  keyFactors:              string[];
  strategy:                string;
  explanation:             string;
  color:                   string;
  accumulationAnalysis:    AccumulationPhaseAnalysis | null;
  // Enriched fields
  indicators:              RegimeIndicator[];
  historicalContext:       HistoricalContext;
  transitionProbabilities: TransitionProbability[];
  actionableInterpretation: string;
  // Cross-market context (populated by crossMarketEngine)
  stockRegimeLabel?:       string;
  alignmentStatus?:        string;
  crossMarketInterpretation?: string;
  fetchedAt:               number;
  cached:                  boolean;
}

// ── Cache ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new LRUCache<string, { regime: CryptoMarketRegime; fetchedAt: number }>(4, CACHE_TTL_MS);

export function clearCryptoRegimeCache(): void { cache.clear(); }

// ── Helpers ───────────────────────────────────────────────────
function cyclePhaseToRegime(phase: CyclePhase): CryptoRegimeLabel {
  const map: Record<CyclePhase, CryptoRegimeLabel> = {
    "Early Bull":                       "Expansion",
    "Mid Bull":                         "Bull Market",
    "Late Bull / Euphoria":             "Late Bull / Euphoria",
    "Distribution":                     "Distribution",
    "Early Bear":                       "Bear Market",
    "Mid Bear":                         "Bear Market",
    "Capitulation":                     "Capitulation",
    "Bear Market → Accumulation Phase": "Bear Market → Accumulation Phase",
    "Accumulation":                     "Accumulation",
  };
  return map[phase] ?? "Bear Market";
}

function regimeColor(r: CryptoRegimeLabel): string {
  const map: Record<CryptoRegimeLabel, string> = {
    "Bull Market":                       "#00FF88",
    "Expansion":                         "#4ADE80",
    "Late Bull / Euphoria":              "#F59E0B",
    "Distribution":                      "#F97316",
    "Bear Market":                       "#EF4444",
    "Capitulation":                      "#DC2626",
    "Bear Market → Accumulation Phase":  "#8B5CF6",
    "Accumulation":                      "#38BDF8",
    "Early Recovery":                    "#34D399",
  };
  return map[r] ?? "#94A3B8";
}

function strategyText(r: CryptoRegimeLabel): string {
  const map: Record<CryptoRegimeLabel, string> = {
    "Bull Market":                       "Ride momentum. Overweight BTC and quality alts. Use trailing stops.",
    "Expansion":                         "Accumulate on dips. Favour BTC and ETH. Reduce stablecoin allocation.",
    "Late Bull / Euphoria":              "Take profits. Reduce alt exposure. Raise stablecoin reserves. Avoid FOMO entries.",
    "Distribution":                      "Shift to stablecoins. Reduce alt exposure significantly. Protect gains.",
    "Bear Market":                       "Capital preservation. Favour stablecoins and cash. Avoid catching falling knives.",
    "Capitulation":                      "Extreme caution. Potential final flush — watch for reversal signals before re-entry.",
    "Bear Market → Accumulation Phase":  "Capital preservation first. Selective BTC accumulation at support. Avoid aggressive risk until breakout confirmation.",
    "Accumulation":                      "Gradual accumulation. Dollar-cost average into BTC. Position for the next cycle.",
    "Early Recovery":                    "Selective re-entry. Favour BTC and ETH. Size small initially.",
  };
  return map[r] ?? "Monitor conditions closely.";
}

function riskLevelFromScore(riskScore: number): CryptoRiskLevel {
  if (riskScore >= 80) return "Critical";
  if (riskScore >= 65) return "High";
  if (riskScore >= 50) return "Elevated";
  if (riskScore >= 35) return "Moderate";
  return "Low";
}

function trendFromDirection(direction: "up" | "down" | "sideways", score: number): CryptoRegimeTrend {
  if (direction === "up" && score > 55) return "Improving";
  if (direction === "down" && score < 45) return "Deteriorating";
  return "Stable";
}

function explanationText(r: CryptoRegimeLabel, phase: CyclePhase, confidence: number): string {
  const confPhrase = confidence >= 75 ? "with high confidence"
    : confidence >= 55 ? "with moderate confidence"
    : "with low confidence";
  const descriptions: Record<CryptoRegimeLabel, string> = {
    "Bull Market":                       `Bitcoin is in a bull market ${confPhrase}. Strong price momentum, expanding liquidity, and positive macro conditions support continued upside.`,
    "Expansion":                         `Bitcoin is in an early bull expansion phase ${confPhrase}. The cycle is gaining momentum with improving on-chain metrics and growing institutional interest.`,
    "Late Bull / Euphoria":              `Bitcoin is in the late bull / euphoria phase ${confPhrase}. Extreme sentiment and parabolic price action signal elevated risk of a cycle top. Profit-taking is warranted.`,
    "Distribution":                      `Bitcoin is in a distribution phase ${confPhrase}. Long-term holders appear to be reducing exposure. This phase often precedes a more significant correction.`,
    "Bear Market":                       `Bitcoin is in a bear market ${confPhrase}. Price structure is broken, liquidity is contracting, and macro conditions are unfavourable. Capital preservation is the priority.`,
    "Capitulation":                      `Bitcoin is in a capitulation phase ${confPhrase}. Forced selling and extreme fear dominate. This is often the final stage of a bear market.`,
    "Bear Market → Accumulation Phase":  `Bitcoin appears to be in an accumulation phase inside a broader bear-market structure ${confPhrase}. Price may be forming a base, but a new bull cycle is not confirmed until price breaks major resistance with strong volume, improving liquidity, and sustained risk-on confirmation.`,
    "Accumulation":                      `Bitcoin is in an accumulation phase ${confPhrase}. Long-term holders are absorbing supply at depressed prices. This phase can last months before a new bull cycle begins.`,
    "Early Recovery":                    `Bitcoin is showing early recovery signals ${confPhrase}. Price action is improving from lows but a new bull market is not yet confirmed.`,
  };
  return descriptions[r] ?? `Bitcoin cycle phase: ${phase}. Confidence: ${confidence}%.`;
}

function scoreToSignal(score: number): IndicatorSignal {
  if (score >= 60) return "Bullish";
  if (score <= 40) return "Bearish";
  return "Neutral";
}

function contributionLevel(score: number, regime: CryptoRegimeLabel): "High" | "Medium" | "Low" {
  // Indicators that strongly diverge from neutral (50) contribute more
  const deviation = Math.abs(score - 50);
  if (deviation >= 25) return "High";
  if (deviation >= 12) return "Medium";
  return "Low";
}

// ── Indicator Breakdown ───────────────────────────────────────
function buildIndicators(report: CryptoIntelligenceReport, regime: CryptoRegimeLabel): RegimeIndicator[] {
  const btc = report.btcDashboard;
  const alt = report.altcoinRisk;
  const mac = report.macroCorrelation;

  const indicators: RegimeIndicator[] = [
    {
      name:         "Liquidity Conditions",
      reading:      btc.liquidityConditions.label,
      signal:       scoreToSignal(btc.liquidityConditions.score),
      contribution: contributionLevel(btc.liquidityConditions.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.liquidityConditions.score - 50))),
      score:        Math.round(btc.liquidityConditions.score),
    },
    {
      name:         "Price Trend Strength",
      reading:      btc.trendStrength.label,
      signal:       scoreToSignal(btc.trendStrength.score),
      contribution: contributionLevel(btc.trendStrength.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.trendStrength.score - 50))),
      score:        Math.round(btc.trendStrength.score),
    },
    {
      name:         "ETF / Institutional Flow",
      reading:      btc.etfInstitutionalFlow.label,
      signal:       scoreToSignal(btc.etfInstitutionalFlow.score),
      contribution: contributionLevel(btc.etfInstitutionalFlow.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.etfInstitutionalFlow.score - 50))),
      score:        Math.round(btc.etfInstitutionalFlow.score),
    },
    {
      name:         "Dollar Pressure (DXY)",
      reading:      btc.dollarPressure.label,
      signal:       btc.dollarPressure.direction === "weakening" ? "Bullish" : btc.dollarPressure.direction === "strengthening" ? "Bearish" : "Neutral",
      contribution: contributionLevel(btc.dollarPressure.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.dollarPressure.score - 50))),
      score:        Math.round(btc.dollarPressure.score),
    },
    {
      name:         "Yield / Rate Pressure",
      reading:      btc.yieldPressure.label,
      signal:       btc.yieldPressure.direction === "falling" ? "Bullish" : btc.yieldPressure.direction === "rising" ? "Bearish" : "Neutral",
      contribution: contributionLevel(btc.yieldPressure.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.yieldPressure.score - 50))),
      score:        Math.round(btc.yieldPressure.score),
    },
    {
      name:         "Stablecoin Supply",
      reading:      alt.stablecoinSignal.split(" — ")[0] ?? alt.stablecoinSignal,
      signal:       alt.riskScore < 45 ? "Bullish" : alt.riskScore > 60 ? "Bearish" : "Neutral",
      contribution: contributionLevel(100 - alt.riskScore, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(alt.riskScore - 50))),
      score:        Math.round(100 - alt.riskScore),
    },
    {
      name:         "BTC Dominance",
      reading:      alt.btcDominanceSignal.split(" — ")[0] ?? alt.btcDominanceSignal,
      signal:       alt.riskScore > 60 ? "Bearish" : alt.riskScore < 40 ? "Bullish" : "Neutral",
      contribution: contributionLevel(alt.riskScore, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(alt.riskScore - 50))),
      score:        Math.round(alt.riskScore),
    },
    {
      name:         "Macro Risk Appetite",
      reading:      mac.overallMacroSignal,
      signal:       mac.overallMacroSignal === "Bullish" ? "Bullish" : mac.overallMacroSignal === "Bearish" ? "Bearish" : "Neutral",
      contribution: mac.overallMacroSignal !== "Neutral" ? "High" : "Low",
      confidence:   mac.overallMacroSignal !== "Neutral" ? 75 : 50,
      score:        mac.overallMacroSignal === "Bullish" ? 72 : mac.overallMacroSignal === "Bearish" ? 28 : 50,
    },
  ];

  return indicators;
}

// ── Historical Context ────────────────────────────────────────
function buildHistoricalContext(regime: CryptoRegimeLabel): HistoricalContext {
  const map: Record<CryptoRegimeLabel, HistoricalContext> = {
    "Bull Market": {
      avgDurationWeeks: 52,
      previousOccurrence: "2023–2024",
      nextRegimeProbabilities: [
        { regime: "Late Bull / Euphoria", probability: 55 },
        { regime: "Distribution", probability: 30 },
        { regime: "Consolidation", probability: 15 },
      ],
      btcAvgReturn: "+180% over 12 months",
      ethAvgReturn: "+240% over 12 months",
      altcoinBehavior: "Altcoins outperform BTC in the mid-to-late phase. Small caps can return 5–20x.",
    },
    "Expansion": {
      avgDurationWeeks: 26,
      previousOccurrence: "2023 Q1",
      nextRegimeProbabilities: [
        { regime: "Bull Market", probability: 60 },
        { regime: "Consolidation", probability: 25 },
        { regime: "Distribution", probability: 15 },
      ],
      btcAvgReturn: "+80% over 6 months",
      ethAvgReturn: "+110% over 6 months",
      altcoinBehavior: "Selective altcoin participation begins. Quality L1/L2 tokens lead early.",
    },
    "Late Bull / Euphoria": {
      avgDurationWeeks: 8,
      previousOccurrence: "Late 2021",
      nextRegimeProbabilities: [
        { regime: "Distribution", probability: 65 },
        { regime: "Bear Market", probability: 25 },
        { regime: "Bull Market", probability: 10 },
      ],
      btcAvgReturn: "+40% short-term, then -60% over 12 months",
      ethAvgReturn: "+60% short-term, then -70% over 12 months",
      altcoinBehavior: "Extreme altcoin speculation. Many alts peak and crash 80–95% from highs.",
    },
    "Distribution": {
      avgDurationWeeks: 12,
      previousOccurrence: "2022 Q1",
      nextRegimeProbabilities: [
        { regime: "Bear Market", probability: 70 },
        { regime: "Capitulation", probability: 20 },
        { regime: "Consolidation", probability: 10 },
      ],
      btcAvgReturn: "-30% to -50% over 6 months",
      ethAvgReturn: "-40% to -60% over 6 months",
      altcoinBehavior: "Altcoins underperform BTC significantly. Liquidity dries up rapidly.",
    },
    "Bear Market": {
      avgDurationWeeks: 52,
      previousOccurrence: "2022–2023",
      nextRegimeProbabilities: [
        { regime: "Capitulation", probability: 35 },
        { regime: "Bear Market → Accumulation Phase", probability: 40 },
        { regime: "Accumulation", probability: 25 },
      ],
      btcAvgReturn: "-50% to -80% peak-to-trough",
      ethAvgReturn: "-60% to -85% peak-to-trough",
      altcoinBehavior: "Most altcoins lose 80–95% of value. Only BTC and ETH maintain relative strength.",
    },
    "Capitulation": {
      avgDurationWeeks: 4,
      previousOccurrence: "June 2022",
      nextRegimeProbabilities: [
        { regime: "Bear Market → Accumulation Phase", probability: 55 },
        { regime: "Accumulation", probability: 35 },
        { regime: "Bear Market", probability: 10 },
      ],
      btcAvgReturn: "-20% to -40% short-term, then +60% over 12 months",
      ethAvgReturn: "-25% to -45% short-term, then +80% over 12 months",
      altcoinBehavior: "Forced liquidations across altcoins. Historically a long-term buying opportunity.",
    },
    "Bear Market → Accumulation Phase": {
      avgDurationWeeks: 24,
      previousOccurrence: "2022–2023",
      nextRegimeProbabilities: [
        { regime: "Accumulation", probability: 50 },
        { regime: "Early Recovery", probability: 30 },
        { regime: "Bear Market", probability: 20 },
      ],
      btcAvgReturn: "+60% to +120% over 12 months (if confirmed)",
      ethAvgReturn: "+80% to +150% over 12 months (if confirmed)",
      altcoinBehavior: "Altcoins remain depressed. BTC dominance stays elevated. Selective accumulation only.",
    },
    "Accumulation": {
      avgDurationWeeks: 20,
      previousOccurrence: "2019, 2023",
      nextRegimeProbabilities: [
        { regime: "Early Recovery", probability: 55 },
        { regime: "Expansion", probability: 30 },
        { regime: "Bear Market", probability: 15 },
      ],
      btcAvgReturn: "+100% to +200% over 12–18 months",
      ethAvgReturn: "+120% to +250% over 12–18 months",
      altcoinBehavior: "Altcoins begin to recover selectively. Quality projects with strong fundamentals lead.",
    },
    "Early Recovery": {
      avgDurationWeeks: 12,
      previousOccurrence: "Early 2023",
      nextRegimeProbabilities: [
        { regime: "Expansion", probability: 60 },
        { regime: "Bull Market", probability: 25 },
        { regime: "Accumulation", probability: 15 },
      ],
      btcAvgReturn: "+50% to +100% over 6 months",
      ethAvgReturn: "+70% to +130% over 6 months",
      altcoinBehavior: "Altcoins begin to participate. BTC dominance starts declining. Selective exposure warranted.",
    },
  };
  return map[regime] ?? {
    avgDurationWeeks: 16,
    previousOccurrence: "Unknown",
    nextRegimeProbabilities: [{ regime: "Transition", probability: 100 }],
    btcAvgReturn: "Insufficient historical data",
    ethAvgReturn: "Insufficient historical data",
    altcoinBehavior: "Monitor conditions closely.",
  };
}

// ── Transition Probabilities ──────────────────────────────────
function buildTransitionProbabilities(regime: CryptoRegimeLabel, confidence: number): TransitionProbability[] {
  const ctx = buildHistoricalContext(regime);
  const stayProb = Math.round(Math.min(80, confidence * 0.7));
  const remaining = 100 - stayProb;

  const transitions: TransitionProbability[] = [
    {
      regime: `Remain in ${regime}`,
      probability: stayProb,
      description: `Current regime signals remain intact. Confidence: ${confidence}%.`,
    },
  ];

  const next = ctx.nextRegimeProbabilities;
  const total = next.reduce((s, n) => s + n.probability, 0);
  for (const n of next) {
    transitions.push({
      regime: n.regime,
      probability: Math.round((n.probability / total) * remaining),
      description: buildTransitionDescription(regime, n.regime),
    });
  }

  return transitions;
}

function buildTransitionDescription(from: CryptoRegimeLabel, to: string): string {
  if (to.includes("Bull") || to === "Expansion" || to === "Early Recovery") {
    return "Requires: price breakout above resistance, improving liquidity, and risk-on macro confirmation.";
  }
  if (to.includes("Bear") || to === "Capitulation" || to === "Distribution") {
    return "Triggered by: price breakdown below support, liquidity contraction, or macro risk-off shift.";
  }
  if (to.includes("Accumulation")) {
    return "Signals: stabilising price action, declining exchange balances, and long-term holder accumulation resuming.";
  }
  return "Transition depends on macro conditions and on-chain signals.";
}

// ── Actionable Interpretation ─────────────────────────────────
function buildActionableInterpretation(regime: CryptoRegimeLabel, confidence: number, report: CryptoIntelligenceReport): string {
  const confText = confidence >= 75 ? "High-conviction" : confidence >= 55 ? "Moderate-conviction" : "Low-conviction";
  const mac = report.macroCorrelation;
  const alt = report.altcoinRisk;

  const map: Record<CryptoRegimeLabel, string> = {
    "Bull Market": `${confText} bull market signal. Bitcoin is in a confirmed uptrend with expanding liquidity and positive macro conditions. Overweight BTC and quality alts. Use momentum as your guide. ${mac.overallMacroSignal === "Bullish" ? "Macro conditions are supportive." : "Monitor macro for signs of deterioration."}`,
    "Expansion": `${confText} early bull expansion. The cycle is gaining momentum but is not yet in full bull mode. Accumulate BTC and ETH on dips. Reduce stablecoin allocation gradually. ${alt.altcoinSeasonProbability > 50 ? "Altcoin season probability is elevated — selective exposure may be warranted." : "Maintain BTC/ETH focus for now."}`,
    "Late Bull / Euphoria": `${confText} euphoria signal. This is historically the highest-risk phase of the bull cycle. Take profits systematically. Raise stablecoin reserves. Avoid FOMO entries. The risk of a cycle top is elevated.`,
    "Distribution": `${confText} distribution signal. Long-term holders appear to be reducing exposure. Shift to stablecoins. Reduce altcoin exposure significantly. Protect gains from the bull cycle.`,
    "Bear Market": `${confText} bear market signal. Capital preservation is the primary objective. Favour stablecoins and cash. Avoid catching falling knives. ${mac.overallMacroSignal === "Bearish" ? "Macro conditions are deteriorating — heightened caution is warranted." : "Monitor macro for signs of stabilisation."}`,
    "Capitulation": `${confText} capitulation signal. Extreme fear and forced selling dominate. While this often marks a long-term bottom, timing is extremely difficult. Avoid aggressive positioning. Wait for volume confirmation and stabilising price action before re-entry.`,
    "Bear Market → Accumulation Phase": `${confText} accumulation signal inside a bear structure. Crypto remains in an accumulation regime. Historically, this phase favors gradual accumulation of high-quality assets rather than aggressive momentum trading. A new bull cycle is not confirmed — position sizing should reflect that uncertainty. Selective BTC accumulation at support is appropriate for long-term holders.`,
    "Accumulation": `${confText} accumulation signal. Long-term holders are absorbing supply at depressed prices. Dollar-cost averaging into BTC may be appropriate for investors with long time horizons. Avoid broad altcoin exposure until macro conditions improve and price confirms a new trend.`,
    "Early Recovery": `${confText} early recovery signal. Price action is improving from lows but a new bull market is not yet confirmed. Selective re-entry into BTC and ETH is appropriate. Size positions conservatively and wait for confirmation before adding broad risk.`,
  };
  return map[regime] ?? `Current regime: ${regime}. Monitor conditions closely.`;
}

// ── Public API ────────────────────────────────────────────────
export async function computeCryptoMarketRegime(): Promise<CryptoMarketRegime> {
  const cacheKey = "crypto-regime";
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.regime, cached: true };
  }

  const report = await getCryptoIntelligence();
  const btc     = report.btcDashboard;
  const phase   = btc.marketCyclePhase.phase;
  const conf    = btc.marketCyclePhase.confidence;
  const regime  = cyclePhaseToRegime(phase);
  const trend   = trendFromDirection(btc.trendStrength.direction, btc.trendStrength.score);
  const riskLevel = riskLevelFromScore(report.altcoinRisk.riskScore);

  const keyFactors: string[] = [];
  keyFactors.push(`Trend: ${btc.trendStrength.label} — ${btc.trendStrength.note}`);
  keyFactors.push(`Liquidity: ${btc.liquidityConditions.label} — ${btc.liquidityConditions.note}`);
  if (btc.etfInstitutionalFlow.direction !== "neutral") {
    keyFactors.push(`Institutional flow: ${btc.etfInstitutionalFlow.label} — ${btc.etfInstitutionalFlow.note}`);
  }
  if (report.macroCorrelation.overallMacroSignal !== "Neutral") {
    keyFactors.push(`Macro signal: ${report.macroCorrelation.overallMacroSignal} — ${report.macroCorrelation.correlationSummary.split(".")[0]}`);
  }
  if (btc.accumulationAnalysis?.keyEvidence?.length) {
    keyFactors.push(...btc.accumulationAnalysis.keyEvidence.slice(0, 2));
  }

  const result: CryptoMarketRegime = {
    regime,
    cyclePhase:              phase,
    riskLevel,
    trend,
    confidence:              conf,
    keyFactors,
    strategy:                strategyText(regime),
    explanation:             explanationText(regime, phase, conf),
    color:                   regimeColor(regime),
    accumulationAnalysis:    btc.accumulationAnalysis ?? null,
    indicators:              buildIndicators(report, regime),
    historicalContext:       buildHistoricalContext(regime),
    transitionProbabilities: buildTransitionProbabilities(regime, conf),
    actionableInterpretation: buildActionableInterpretation(regime, conf, report),
    fetchedAt:               Date.now(),
    cached:                  false,
  };

  cache.set(cacheKey, { regime: result, fetchedAt: Date.now() });
  return result;
}

// Export helpers for testing
export { buildHistoricalContext, buildTransitionProbabilities, buildIndicators };
