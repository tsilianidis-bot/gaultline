/**
 * Crypto Market Regime Engine
 * Thin adapter over the existing CryptoIntelligence engine that promotes
 * the BTC CyclePhase into a formal CryptoMarketRegime output.
 * Enriched with canonical-macro indicator breakdown. Historical and transition
 * claims are withheld until a calibrated, versioned evidence adapter exists.
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
  | "Early Recovery"
  | "UNAVAILABLE";

export type CryptoRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical" | "UNAVAILABLE";
export type CryptoRegimeTrend = "Improving" | "Stable" | "Deteriorating";
export type IndicatorSignal = "Bullish" | "Neutral" | "Bearish";

export interface RegimeIndicator {
  name:         string;
  reading:      string;
  signal:       IndicatorSignal;
  contribution: "High" | "Medium" | "Low";
  confidence:   number;  // 0–100
  score:        number;  // 0–100 (raw score)
  provenance:   "DERIVED_MODEL";
}

/** Required provenance for any future historical or calibrated transition claim. */
export interface CalibratedCryptoEvidence {
  sourceIds: string[];
  datasetVersion: string;
  modelVersion: string;
  observedPeriod: { start: string; end: string };
  asOf: string;
  calibrationStatus: "CALIBRATED" | "NOT_CALIBRATED";
}

export interface HistoricalContext {
  avgDurationWeeks:        number;
  previousOccurrence:      string;  // e.g. "2022–2023"
  nextRegimeProbabilities: Array<{ regime: string; probability: number }>;
  btcAvgReturn:            string;  // e.g. "+180% over 12 months"
  ethAvgReturn:            string;
  altcoinBehavior:         string;
  evidence:                CalibratedCryptoEvidence;
}

export interface TransitionProbability {
  regime:      string;
  probability: number;  // 0–100
  description: string;
  evidence:    CalibratedCryptoEvidence;
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
  /** Null until a versioned historical evidence adapter supplies calibrated provenance. */
  historicalContext:       HistoricalContext | null;
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
    "UNAVAILABLE":                       "UNAVAILABLE",
  };
  return map[phase] ?? "UNAVAILABLE";
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
    "UNAVAILABLE":                       "#64748B",
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
    "UNAVAILABLE":                       "UNAVAILABLE — canonical market state is not bound. No crypto regime is manufactured.",
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
    "Bull Market":                       `The canonical macro projection maps to bull-market conditions ${confPhrase}. It is a derived risk-appetite classification, not an observation of Bitcoin price or flows.`,
    "Expansion":                         `The canonical macro projection maps to early expansion conditions ${confPhrase}. It is macro-implied and does not use on-chain or institutional-flow inputs.`,
    "Late Bull / Euphoria":              `The canonical macro projection maps to late-cycle risk conditions ${confPhrase}. This derived model does not observe sentiment or parabolic price action.`,
    "Distribution":                      `The canonical macro projection maps to distribution-like risk conditions ${confPhrase}. It does not observe holder behavior or predict a correction.`,
    "Bear Market":                       `The canonical macro projection maps to bear-market risk conditions ${confPhrase}. It is a macro-derived classification rather than a price-structure observation.`,
    "Capitulation":                      `The canonical macro projection maps to capitulation-like risk conditions ${confPhrase}. It does not observe forced selling, fear, or a market bottom.`,
    "Bear Market → Accumulation Phase":  `The canonical macro projection maps to a base-forming risk configuration inside a broader bear-market structure ${confPhrase}. It does not establish Bitcoin price, holder, exchange-balance, funding, or ETF-flow observations.`,
    "Accumulation":                      `The canonical macro projection maps to accumulation-like risk conditions ${confPhrase}. It does not observe supply absorption or establish the timing of a new cycle.`,
    "Early Recovery":                    `The canonical macro projection maps to early-recovery risk conditions ${confPhrase}. It is not a Bitcoin-price observation or a forecast of a new bull market.`,
    "UNAVAILABLE":                       "Crypto regime is UNAVAILABLE because no canonical market state is bound. No cycle phase is manufactured.",
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
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Macro-implied trend strength (not BTC price)",
      reading:      btc.trendStrength.label,
      signal:       scoreToSignal(btc.trendStrength.score),
      contribution: contributionLevel(btc.trendStrength.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.trendStrength.score - 50))),
      score:        Math.round(btc.trendStrength.score),
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Macro risk-appetite proxy (not ETF flow)",
      reading:      btc.etfInstitutionalFlow.label,
      signal:       scoreToSignal(btc.etfInstitutionalFlow.score),
      contribution: contributionLevel(btc.etfInstitutionalFlow.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.etfInstitutionalFlow.score - 50))),
      score:        Math.round(btc.etfInstitutionalFlow.score),
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Macro dollar/rate proxy (not DXY)",
      reading:      btc.dollarPressure.label,
      signal:       btc.dollarPressure.direction === "weakening" ? "Bullish" : btc.dollarPressure.direction === "strengthening" ? "Bearish" : "Neutral",
      contribution: contributionLevel(btc.dollarPressure.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.dollarPressure.score - 50))),
      score:        Math.round(btc.dollarPressure.score),
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Yield / Rate Pressure",
      reading:      btc.yieldPressure.label,
      signal:       btc.yieldPressure.direction === "falling" ? "Bullish" : btc.yieldPressure.direction === "rising" ? "Bearish" : "Neutral",
      contribution: contributionLevel(btc.yieldPressure.score, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(btc.yieldPressure.score - 50))),
      score:        Math.round(btc.yieldPressure.score),
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Macro liquidity proxy (not stablecoin supply)",
      reading:      alt.stablecoinSignal.split(" — ")[0] ?? alt.stablecoinSignal,
      signal:       alt.riskScore < 45 ? "Bullish" : alt.riskScore > 60 ? "Bearish" : "Neutral",
      contribution: contributionLevel(100 - alt.riskScore, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(alt.riskScore - 50))),
      score:        Math.round(100 - alt.riskScore),
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Macro risk proxy (not BTC dominance)",
      reading:      alt.btcDominanceSignal.split(" — ")[0] ?? alt.btcDominanceSignal,
      signal:       alt.riskScore > 60 ? "Bearish" : alt.riskScore < 40 ? "Bullish" : "Neutral",
      contribution: contributionLevel(alt.riskScore, regime),
      confidence:   Math.round(Math.min(100, 50 + Math.abs(alt.riskScore - 50))),
      score:        Math.round(alt.riskScore),
      provenance:   "DERIVED_MODEL",
    },
    {
      name:         "Macro Risk Appetite",
      reading:      mac.overallMacroSignal,
      signal:       mac.overallMacroSignal === "Bullish" ? "Bullish" : mac.overallMacroSignal === "Bearish" ? "Bearish" : "Neutral",
      contribution: mac.overallMacroSignal !== "Neutral" ? "High" : "Low",
      confidence:   mac.overallMacroSignal !== "Neutral" ? 75 : 50,
      score:        mac.overallMacroSignal === "Bullish" ? 72 : mac.overallMacroSignal === "Bearish" ? 28 : 50,
      provenance:   "DERIVED_MODEL",
    },
  ];

  return indicators;
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
    "UNAVAILABLE": "UNAVAILABLE — canonical market state is not bound. Crypto regime, confirmation, and invalidation are withheld.",
  };
  return map[regime] ?? `Current regime: ${regime}. Monitor conditions closely.`;
}

// ── Public API ────────────────────────────────────────────────
export async function computeCryptoMarketRegime(suppliedCanonical?: import("../shared/canonicalIntelligenceState").CanonicalIntelligenceState | null): Promise<CryptoMarketRegime> {
  const { getAuthoritativeCanonicalIntelligenceState } = await import("./canonicalIntelligenceState");
  const canonical = suppliedCanonical !== undefined ? suppliedCanonical : await getAuthoritativeCanonicalIntelligenceState().catch(() => null);
  const cacheKey = `crypto-regime:${canonical?.stateId ?? "unavailable"}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.regime, cached: true };
  }

  const report = await getCryptoIntelligence(canonical);
  if (report.availability === "UNAVAILABLE") {
    const withheld: CryptoMarketRegime = {
      regime: "UNAVAILABLE",
      cyclePhase: "UNAVAILABLE",
      riskLevel: "UNAVAILABLE",
      trend: "Stable",
      confidence: 0,
      keyFactors: ["UNAVAILABLE — canonical market state is not bound."],
      strategy: strategyText("UNAVAILABLE"),
      explanation: explanationText("UNAVAILABLE", "UNAVAILABLE", 0),
      color: regimeColor("UNAVAILABLE"),
      accumulationAnalysis: null,
      indicators: [],
      historicalContext: null,
      transitionProbabilities: [],
      actionableInterpretation: "UNAVAILABLE — no CURRENT crypto regime is manufactured without a canonical bind.",
      fetchedAt: Date.now(),
      cached: false,
    };
    return withheld;
  }
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
    keyFactors.push(`Macro risk-appetite proxy (DERIVED_MODEL): ${btc.etfInstitutionalFlow.label} — ${btc.etfInstitutionalFlow.note}`);
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
    historicalContext:       null,
    transitionProbabilities: [],
    actionableInterpretation: buildActionableInterpretation(regime, conf, report),
    fetchedAt:               Date.now(),
    cached:                  false,
  };

  cache.set(cacheKey, { regime: result, fetchedAt: Date.now() });
  return result;
}

// Export the retained canonical-macro indicator adapter for focused tests.
export { buildIndicators };
