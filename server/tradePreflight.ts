// ============================================================
// FAULTLINE — Trade Preflight Simulator  (server/tradePreflight.ts)
//
// Stress-tests a user's intended market move against the current
// FAULTLINE pressure regime and returns a probability-weighted
// risk/favorability reading.
//
// Design:
//  • Deterministic scoring from engine vectors (no randomness)
//  • Timeframe smoothing mirrors diagnosticAI.ts patterns
//  • LLM explanation is optional (graceful fallback)
//  • All output fields are always present (no undefined)
// ============================================================

import { calculateFaultlinePressure, type FaultlinePressureOutput, type RiskVector } from "./pressure/engine";
import { invokeLLM } from "./_core/llm";
import { log } from "./logger";

// ── Types ────────────────────────────────────────────────────

export type MoveType =
  | "buy_add_risk"
  | "hold"
  | "trim"
  | "sell"
  | "hedge"
  | "raise_cash"
  | "rotate_sectors"
  | "buy_specific_ticker"
  | "increase_crypto"
  | "reduce_crypto";

export type SimulatorTimeframe = "today" | "this_week" | "one_three_months" | "six_twelve_months";

export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";
export type ConfidenceLevel = "Low" | "Moderate" | "High";
export type MarketStatus = "Cleared" | "Caution" | "Defensive";

export type ThesisType =
  | "momentum"
  | "breakout"
  | "mean_reversion"
  | "long_term"
  | "value"
  | "ai_theme"
  | "crypto_cycle"
  | "sector_rotation"
  | "other";

export type VerdictType = "APPROVED" | "CAUTION" | "WAIT" | "DEFENSIVE" | "HIGH_CONVICTION";

export interface TradeSimulationInput {
  moveType: MoveType;
  timeframe: SimulatorTimeframe;
  ticker?: string;
  thesisType?: ThesisType;
}

export interface ThreatBoardItem {
  category: string;
  threat: string;
  severity: "low" | "moderate" | "elevated" | "critical";
  hiddenPressure?: string;
}

export interface MarketConditionSnapshot {
  marketStatus: MarketStatus;
  pressureIndex: number;
  regime: string;
  regimeLevel: string;
  bullProbability: number;
  crashProbability: number;
  liquidityCondition: string;
  creditStress: string;
  volatilityCondition: string;
  fedPressure: string;
  recessionPressure: string;
  aiSpeculationPressure: string;
  breadthConfirmation: string;
  threatBoard: ThreatBoardItem[];
}

// ── New output types ─────────────────────────────────────────

export interface DecisionVerdict {
  verdict: VerdictType;
  confidence: number;   // 0–100
  reason: string;
}

export interface OutcomeScenario {
  label: "Bull Case" | "Base Case" | "Bear Case";
  probability: number;       // 0–100 %
  expectedReturn: number;    // signed %, e.g. +18 or -10
}

export interface OutcomeSimulator {
  scenarios: [OutcomeScenario, OutcomeScenario, OutcomeScenario];
  weightedOutcome: number;   // probability-weighted expected return
}

export type EntryGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C";

export interface EntryQualityCategory {
  category: string;
  grade: EntryGrade;
  note: string;
}

export interface EntryQuality {
  categories: EntryQualityCategory[];
  overallGrade: EntryGrade;
}

export interface PositionSizingTier {
  label: "Conservative" | "Standard" | "Aggressive";
  allocation: number;   // % of portfolio
  rationale: string;
}

export interface PositionSizing {
  tiers: [PositionSizingTier, PositionSizingTier, PositionSizingTier];
  guidance: string;
}

export interface HistoricalAnalog {
  label: string;
  similarity: number;   // 0–100
  period: string;
  outcome: string;
}

export interface ThesisStressTest {
  thesisType: ThesisType;
  thesisLabel: string;
  coreDependency: string;
  failurePoints: string[];
}

export interface TradeSimulationOutput {
  marketStatus: MarketStatus;
  moveType: MoveType;
  moveLabel: string;
  timeframe: SimulatorTimeframe;
  timeframeLabel: string;
  ticker?: string;
  thesisType?: ThesisType;
  marketCondition: MarketConditionSnapshot;
  moveFavorabilityScore: number;       // 0–100
  favorableSetupProbability: number;   // 0–100 %
  adversePressureProbability: number;  // 0–100 %
  riskLevel: RiskLevel;
  confidenceLevel: ConfidenceLevel;
  actionBias: string;
  bestVersionOfMove: string;
  avoidAreas: string[];
  invalidationTriggers: string[];
  greenLights: string[];
  redFlags: string[];
  watchNext: string[];
  // ── New fields ───────────────────────────────────────────
  verdict: DecisionVerdict;
  outcomeSimulator: OutcomeSimulator;
  entryQuality: EntryQuality;
  positionSizing: PositionSizing;
  historicalAnalogs: HistoricalAnalog[];
  thesisStressTest: ThesisStressTest;
  explanation: string;
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────

export const MOVE_LABELS: Record<MoveType, string> = {
  buy_add_risk: "Buy / Add Risk",
  hold: "Hold",
  trim: "Trim",
  sell: "Sell",
  hedge: "Hedge",
  raise_cash: "Raise Cash",
  rotate_sectors: "Rotate Sectors",
  buy_specific_ticker: "Buy a Specific Ticker",
  increase_crypto: "Increase Crypto Exposure",
  reduce_crypto: "Reduce Crypto Exposure",
};

export const TIMEFRAME_LABELS: Record<SimulatorTimeframe, string> = {
  today: "Today",
  this_week: "This Week",
  one_three_months: "1–3 Months",
  six_twelve_months: "6–12 Months",
};

const THESIS_LABELS: Record<ThesisType, string> = {
  momentum: "Momentum",
  breakout: "Breakout",
  mean_reversion: "Mean Reversion",
  long_term: "Long-Term Investment",
  value: "Value",
  ai_theme: "AI Theme",
  crypto_cycle: "Crypto Cycle",
  sector_rotation: "Sector Rotation",
  other: "Other",
};

// Timeframe smoothing: longer horizons smooth toward neutral (50)
const TIMEFRAME_SMOOTH: Record<SimulatorTimeframe, number> = {
  today: 0,
  this_week: 0.10,
  one_three_months: 0.22,
  six_twelve_months: 0.38,
};

// ── Helpers ──────────────────────────────────────────────────

function getVectorScore(vectors: RiskVector[], id: string): number {
  return vectors.find(v => v.id === id)?.score ?? 40;
}

function invertScore(score: number): number {
  return 100 - score;
}

function smooth(score: number, factor: number): number {
  return Math.round(score * (1 - factor) + 50 * factor);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function levelLabel(score: number): string {
  if (score >= 75) return "Critical";
  if (score >= 55) return "Elevated";
  if (score >= 35) return "Moderate";
  return "Low";
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "Extreme";
  if (score >= 55) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function toConfidenceLevel(pressure: FaultlinePressureOutput): ConfidenceLevel {
  if (pressure.dataSource === "fallback") return "Low";
  const p = pressure.overallPressure;
  if (p >= 80 || p <= 10) return "Moderate";
  return "High";
}

// Grade from 0–100 score
function scoreToGrade(score: number): EntryGrade {
  if (score >= 90) return "A+";
  if (score >= 82) return "A";
  if (score >= 75) return "A-";
  if (score >= 68) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "B-";
  return "C";
}

// ── Market Condition Snapshot ─────────────────────────────────

function computeMarketStatus(pressure: FaultlinePressureOutput): MarketStatus {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const liquidityScore = getVectorScore(pressure.vectors, "liquidity-stress");
  if (p >= 60 || creditScore >= 60 || liquidityScore >= 60) return "Defensive";
  if (p >= 40 || creditScore >= 40 || liquidityScore >= 40) return "Caution";
  return "Cleared";
}

function buildThreatBoard(pressure: FaultlinePressureOutput): ThreatBoardItem[] {
  const threats: ThreatBoardItem[] = [];
  const { vectors, overallPressure } = pressure;

  const liquidityScore  = getVectorScore(vectors, "liquidity-stress");
  const creditScore     = getVectorScore(vectors, "credit-contagion");
  const volatilityScore = getVectorScore(vectors, "volatility-regime");
  const macroScore      = getVectorScore(vectors, "macro-sensitivity");
  const breadthScore    = getVectorScore(vectors, "market-breadth");
  const aiScore         = getVectorScore(vectors, "ai-bubble");

  threats.push({
    category: "Volatility",
    threat: "VIX breakout above 30",
    severity: volatilityScore >= 65 ? "critical" : volatilityScore >= 45 ? "elevated" : volatilityScore >= 25 ? "moderate" : "low",
    hiddenPressure: volatilityScore >= 45 ? "Volatility regime elevated — options pricing in tail risk" : undefined,
  });

  threats.push({
    category: "Credit",
    threat: "Credit spreads widening — HY contagion risk",
    severity: creditScore >= 65 ? "critical" : creditScore >= 45 ? "elevated" : creditScore >= 25 ? "moderate" : "low",
    hiddenPressure: creditScore >= 45 ? "HY spreads tightening window closing — leveraged names at risk" : undefined,
  });

  threats.push({
    category: "Breadth",
    threat: "Market breadth rollover — advance/decline deterioration",
    severity: breadthScore >= 65 ? "critical" : breadthScore >= 45 ? "elevated" : breadthScore >= 25 ? "moderate" : "low",
    hiddenPressure: breadthScore >= 45 ? "Rally narrowing to fewer names — index masking underlying weakness" : undefined,
  });

  threats.push({
    category: "Rates",
    threat: "Treasury yield shock — 10Y moves >50bps in a week",
    severity: macroScore >= 65 ? "critical" : macroScore >= 45 ? "elevated" : macroScore >= 25 ? "moderate" : "low",
    hiddenPressure: macroScore >= 45 ? "Duration risk elevated — rate-sensitive multiples under pressure" : undefined,
  });

  threats.push({
    category: "Liquidity",
    threat: "Liquidity deterioration — SOFR / repo market stress",
    severity: liquidityScore >= 65 ? "critical" : liquidityScore >= 45 ? "elevated" : liquidityScore >= 25 ? "moderate" : "low",
    hiddenPressure: liquidityScore >= 45 ? "Funding conditions tightening — watch overnight repo and SOFR" : undefined,
  });

  threats.push({
    category: "Speculation",
    threat: "AI/speculation pressure spike — mega-cap concentration risk",
    severity: aiScore >= 65 ? "critical" : aiScore >= 45 ? "elevated" : aiScore >= 25 ? "moderate" : "low",
    hiddenPressure: aiScore >= 45 ? "Index returns masking underlying weakness in non-AI names" : undefined,
  });

  const recessionScore = Math.round(creditScore * 0.35 + breadthScore * 0.35 + overallPressure * 0.30);
  threats.push({
    category: "Macro",
    threat: "Recession probability increase — leading indicators deteriorating",
    severity: recessionScore >= 65 ? "critical" : recessionScore >= 45 ? "elevated" : recessionScore >= 25 ? "moderate" : "low",
    hiddenPressure: recessionScore >= 45 ? "Composite leading indicators softening — watch PMI and yield curve" : undefined,
  });

  if (overallPressure >= 50) {
    threats.push({
      category: "Systemic",
      threat: `FAULTLINE Pressure Index at ${overallPressure}/100 — systemic stress building`,
      severity: overallPressure >= 65 ? "critical" : overallPressure >= 50 ? "elevated" : "moderate",
      hiddenPressure: "Multiple vectors converging — review position sizing and stop levels",
    });
  }

  const severityOrder: Record<string, number> = { critical: 0, elevated: 1, moderate: 2, low: 3 };
  return threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function buildMarketCondition(pressure: FaultlinePressureOutput): MarketConditionSnapshot {
  const { overallPressure, regime, level, vectors } = pressure;

  const liquidityScore  = getVectorScore(vectors, "liquidity-stress");
  const creditScore     = getVectorScore(vectors, "credit-contagion");
  const volatilityScore = getVectorScore(vectors, "volatility-regime");
  const macroScore      = getVectorScore(vectors, "macro-sensitivity");
  const breadthScore    = getVectorScore(vectors, "market-breadth");
  const aiScore         = getVectorScore(vectors, "ai-bubble");

  const bullProbability  = clamp(Math.round(invertScore(overallPressure) * 0.80 + invertScore(creditScore) * 0.20), 5, 95);
  const crashProbability = clamp(Math.round(overallPressure * 0.60 + creditScore * 0.40) / 2, 5, 95);
  const fedPressureScore = macroScore;
  const recessionScore   = Math.round(creditScore * 0.35 + breadthScore * 0.35 + overallPressure * 0.30);

  return {
    marketStatus: computeMarketStatus(pressure),
    pressureIndex: overallPressure,
    regime,
    regimeLevel: level,
    bullProbability,
    crashProbability,
    liquidityCondition: levelLabel(liquidityScore),
    creditStress: levelLabel(creditScore),
    volatilityCondition: levelLabel(volatilityScore),
    fedPressure: levelLabel(fedPressureScore),
    recessionPressure: levelLabel(recessionScore),
    aiSpeculationPressure: levelLabel(aiScore),
    breadthConfirmation: breadthScore <= 40 ? "Broad" : breadthScore <= 60 ? "Narrowing" : "Deteriorating",
    threatBoard: buildThreatBoard(pressure),
  };
}

// ── Move Favorability Scoring ─────────────────────────────────

function computeFavorabilityScore(
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  timeframe: SimulatorTimeframe
): { favorability: number; favorable: number; adverse: number } {
  const p = pressure.overallPressure;
  const smoothFactor = TIMEFRAME_SMOOTH[timeframe];

  const liquidityScore  = getVectorScore(pressure.vectors, "liquidity-stress");
  const creditScore     = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore    = getVectorScore(pressure.vectors, "market-breadth");
  const aiScore         = getVectorScore(pressure.vectors, "ai-bubble");
  const macroScore      = getVectorScore(pressure.vectors, "macro-sensitivity");

  let rawFavorability: number;

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      rawFavorability = Math.round(
        invertScore(p) * 0.40 +
        invertScore(creditScore) * 0.25 +
        invertScore(liquidityScore) * 0.20 +
        invertScore(breadthScore) * 0.15
      );
      break;

    case "hold": {
      const extremeness = Math.abs(p - 50) / 50;
      rawFavorability = Math.round(70 - extremeness * 30);
      break;
    }

    case "trim":
      rawFavorability = Math.round(
        p * 0.35 +
        creditScore * 0.25 +
        volatilityScore * 0.20 +
        breadthScore * 0.20
      );
      break;

    case "sell":
      rawFavorability = Math.round(
        p * 0.40 +
        creditScore * 0.30 +
        liquidityScore * 0.15 +
        breadthScore * 0.15
      );
      break;

    case "hedge":
      rawFavorability = Math.round(
        volatilityScore * 0.40 +
        p * 0.30 +
        creditScore * 0.20 +
        liquidityScore * 0.10
      );
      break;

    case "raise_cash":
      rawFavorability = Math.round(
        p * 0.35 +
        breadthScore * 0.25 +
        creditScore * 0.25 +
        liquidityScore * 0.15
      );
      break;

    case "rotate_sectors": {
      const rotationWindow = Math.max(0, 100 - Math.abs(breadthScore - 55) * 2);
      rawFavorability = Math.round(
        rotationWindow * 0.40 +
        invertScore(p) * 0.30 +
        invertScore(volatilityScore) * 0.30
      );
      break;
    }

    case "increase_crypto":
      rawFavorability = Math.round(
        invertScore(p) * 0.35 +
        invertScore(creditScore) * 0.30 +
        invertScore(aiScore) * 0.20 +
        invertScore(macroScore) * 0.15
      );
      break;

    case "reduce_crypto":
      rawFavorability = Math.round(
        p * 0.30 +
        aiScore * 0.35 +
        creditScore * 0.20 +
        volatilityScore * 0.15
      );
      break;

    default:
      rawFavorability = 50;
  }

  const favorability = clamp(smooth(rawFavorability, smoothFactor), 0, 100);
  const favorable = clamp(Math.round(favorability * 0.85 + 10), 5, 95);
  const adverseRaw = clamp(100 - favorable + Math.round(p * 0.10), 5, 95);
  const adverse = Math.min(adverseRaw, 100 - favorable);

  return { favorability, favorable, adverse };
}

// ── Green Lights ──────────────────────────────────────────────

function computeGreenLights(
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  ticker?: string,
  timeframe?: SimulatorTimeframe
): string[] {
  const lights: string[] = [];
  const p = pressure.overallPressure;
  const liquidityScore  = getVectorScore(pressure.vectors, "liquidity-stress");
  const creditScore     = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore    = getVectorScore(pressure.vectors, "market-breadth");
  const aiScore         = getVectorScore(pressure.vectors, "ai-bubble");
  const tickerRef = ticker ? ` for ${ticker.toUpperCase()}` : "";
  const tfRef = timeframe ? ` over the ${TIMEFRAME_LABELS[timeframe].toLowerCase()} timeframe` : "";

  if (p < 40) lights.push(`FAULTLINE Pressure Index at ${p}/100 — systemic risk contained${tickerRef ? `, supporting ${ticker!.toUpperCase()} exposure` : ""}`);
  if (liquidityScore < 35) lights.push(`Liquidity conditions healthy — credit markets functioning normally${tfRef}`);
  if (creditScore < 35) lights.push(`Credit spreads contained — no contagion signals present${tickerRef}`);
  if (breadthScore < 40) lights.push("Market breadth broad — wide participation in advance");
  if (volatilityScore < 35) lights.push("Volatility regime low — risk environment manageable");
  if (pressure.dataSource === "live") lights.push("Live FRED data active — readings reflect current conditions");

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      if (p < 45) lights.push(`Macro regime supports risk-on positioning${tickerRef}${tfRef}`);
      if (breadthScore < 45) lights.push("Broad market participation — not a narrow-leadership rally");
      if (creditScore < 40) lights.push(`Credit market stability supports equity risk-taking${tickerRef}`);
      break;
    case "hold":
      if (p < 55) lights.push("No acute systemic trigger requiring defensive action");
      if (creditScore < 50) lights.push("Credit conditions not signaling forced selling");
      break;
    case "trim":
    case "sell":
      if (p > 55) lights.push(`Elevated pressure (${p}/100) supports reducing exposure${tickerRef}`);
      if (creditScore > 50) lights.push("Credit stress rising — defensive posture historically rewarded");
      if (breadthScore > 55) lights.push("Breadth deteriorating — fewer names sustaining the advance");
      break;
    case "hedge":
      if (volatilityScore > 45) lights.push("Volatility regime elevated — hedging cost justified by risk");
      if (p > 50) lights.push("Systemic pressure rising — asymmetric hedge payoff favorable");
      break;
    case "raise_cash":
      if (p > 50) lights.push("Pressure regime supports cash as a risk-adjusted position");
      if (liquidityScore > 45) lights.push("Liquidity stress building — cash preserves optionality");
      break;
    case "rotate_sectors":
      if (breadthScore > 40 && breadthScore < 70) lights.push("Sector divergence creating rotation opportunities");
      if (p < 65) lights.push("Systemic risk not at crisis levels — rotation feasible");
      break;
    case "increase_crypto":
      if (p < 40) lights.push(`Low macro pressure supports speculative allocation${tickerRef}`);
      if (aiScore < 55) lights.push("AI/speculation pressure not at extreme levels");
      break;
    case "reduce_crypto":
      if (aiScore > 55) lights.push("AI/speculation pressure elevated — crypto risk premium rising");
      if (p > 50) lights.push("Macro pressure rising — speculative assets historically underperform");
      break;
  }

  return lights.slice(0, 5);
}

// ── Red Flags ─────────────────────────────────────────────────

function computeRedFlags(
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  ticker?: string,
  timeframe?: SimulatorTimeframe
): string[] {
  const flags: string[] = [];
  const p = pressure.overallPressure;
  const liquidityScore  = getVectorScore(pressure.vectors, "liquidity-stress");
  const creditScore     = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore    = getVectorScore(pressure.vectors, "market-breadth");
  const aiScore         = getVectorScore(pressure.vectors, "ai-bubble");
  const macroScore      = getVectorScore(pressure.vectors, "macro-sensitivity");
  const tickerRef = ticker ? ` for ${ticker.toUpperCase()}` : "";
  const tfRef = timeframe ? ` over the ${TIMEFRAME_LABELS[timeframe].toLowerCase()} timeframe` : "";

  if (p >= 65) flags.push(`FAULTLINE Pressure Index at ${p}/100 — systemic stress elevated${tickerRef}`);
  if (liquidityScore >= 55) flags.push(`Liquidity stress rising — funding conditions tightening${tfRef}`);
  if (creditScore >= 55) flags.push(`Credit spreads widening — risk-off signal for leveraged names${tickerRef}`);
  if (volatilityScore >= 60) flags.push("Volatility regime elevated — position sizing risk increased");
  if (pressure.dataSource === "fallback") flags.push("Live data unavailable — readings based on fallback estimates");

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      if (p >= 55) flags.push(`Macro regime does not support aggressive risk-on positioning${tickerRef}`);
      if (creditScore >= 50) flags.push(`Credit stress present — leveraged and growth names at risk${tickerRef}`);
      if (breadthScore >= 55) flags.push("Breadth narrowing — rally concentrated in fewer names");
      if (aiScore >= 65) flags.push("AI/mega-cap concentration extreme — index-level risk elevated");
      break;
    case "hold":
      if (p >= 65) flags.push("Elevated pressure — holding without a stop plan carries tail risk");
      if (creditScore >= 60) flags.push("Credit deterioration may accelerate — review position sizing");
      break;
    case "trim":
    case "sell":
      if (p < 35) flags.push("Low pressure environment — selling into strength may be premature");
      if (breadthScore < 35) flags.push("Broad market healthy — selling may mean missing continuation");
      break;
    case "hedge":
      if (p < 35) flags.push("Low pressure environment — hedging cost may not be justified");
      if (volatilityScore < 35) flags.push("Volatility contained — hedge premiums may be expensive relative to risk");
      break;
    case "raise_cash":
      if (p < 35) flags.push("Low pressure environment — cash drag may underperform staying invested");
      break;
    case "rotate_sectors":
      if (p >= 70) flags.push("Crisis-level pressure — sector correlations converge, reducing rotation benefit");
      if (volatilityScore >= 65) flags.push("High volatility — rotation timing risk elevated");
      break;
    case "increase_crypto":
      if (p >= 55) flags.push(`Elevated macro pressure — crypto historically amplifies drawdowns${tickerRef}`);
      if (aiScore >= 65) flags.push("AI/speculation pressure extreme — crypto risk premium at cycle highs");
      if (macroScore >= 55) flags.push("Restrictive macro environment — speculative assets face headwinds");
      break;
    case "reduce_crypto":
      if (p < 35) flags.push("Low pressure environment — reducing crypto may miss upside");
      break;
  }

  return flags.slice(0, 5);
}

// ── Invalidation Triggers ─────────────────────────────────────

function computeInvalidationTriggers(
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  ticker?: string
): string[] {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const liquidityScore = getVectorScore(pressure.vectors, "liquidity-stress");
  const tickerRef = ticker ? ` for ${ticker.toUpperCase()}` : "";

  const triggers: string[] = [
    "VIX breakout above 30 — volatility regime shift",
    "Credit spreads (HY) widening above 500bps — contagion signal",
    "Market breadth rollover — advance/decline line deteriorating",
    "Treasury yield shock — 10Y moves >50bps in a week",
    "FAULTLINE Pressure Index rises above 65/100",
  ];

  if (liquidityScore < 50) triggers.push("Liquidity deterioration — SOFR or repo market stress emerging");
  if (p < 60) triggers.push("AI/speculation pressure spike — mega-cap concentration risk escalating");
  if (creditScore < 60) triggers.push("Recession probability increase — leading indicators deteriorating");

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      triggers.push(`Earnings guidance cuts in key sectors — fundamental deterioration${tickerRef}`);
      triggers.push("Fed hawkish surprise — rate path repricing");
      break;
    case "sell":
    case "trim":
      triggers.push("Unexpected positive macro data — pressure reversal");
      triggers.push("Fed pivot signal — liquidity conditions improving");
      break;
    case "hedge":
      triggers.push("Volatility compression — VIX drops below 15, hedge cost increases");
      break;
    case "increase_crypto":
      triggers.push(`Regulatory action or exchange failure — crypto-specific systemic risk${tickerRef}`);
      triggers.push("Bitcoin dominance breakdown — altcoin contagion risk");
      break;
    case "rotate_sectors":
      triggers.push("Sector correlation spike — all sectors moving together (crisis mode)");
      break;
    default:
      break;
  }

  return triggers.slice(0, 7);
}

// ── Watch Next ────────────────────────────────────────────────

function computeWatchNext(
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  ticker?: string
): string[] {
  const tickerRef = ticker ? ` (${ticker.toUpperCase()}-specific)` : "";
  const watches: string[] = [
    "FAULTLINE Pressure Index — daily composite reading",
    "HY credit spread (BAMLH0A0HYM2) — leading risk-off indicator",
    "10Y Treasury yield — rate environment and duration risk",
    "VIX — volatility regime and market fear gauge",
  ];

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      watches.push(`S&P 500 advance/decline line — breadth confirmation${tickerRef}`);
      watches.push("Fed Funds futures — rate path expectations");
      break;
    case "sell":
    case "trim":
      watches.push("SOFR rate — short-term funding stress");
      watches.push("Investment grade vs HY spread differential");
      break;
    case "hedge":
      watches.push("SKEW index — tail risk pricing in options market");
      watches.push("Put/call ratio — sentiment and positioning extremes");
      break;
    case "increase_crypto":
    case "reduce_crypto":
      watches.push(`Bitcoin dominance — crypto risk appetite indicator${tickerRef}`);
      watches.push("Stablecoin market cap — on-chain liquidity signal");
      break;
    case "rotate_sectors":
      watches.push("Sector relative strength — XLF, XLK, XLE, XLV rotations");
      watches.push("Defensive vs cyclical ratio — risk appetite signal");
      break;
    default:
      watches.push("Unemployment rate (UNRATE) — labor market health");
      watches.push("CPI YoY — inflation trajectory and Fed response");
      break;
  }

  return watches.slice(0, 6);
}

// ── Action Bias ───────────────────────────────────────────────

function computeActionBias(
  moveType: MoveType,
  favorability: number,
  pressure: FaultlinePressureOutput,
  ticker?: string,
  timeframe?: SimulatorTimeframe
): string {
  const p = pressure.overallPressure;
  const tickerRef = ticker ? ` a ${ticker.toUpperCase()} position` : " this position";
  const tfRef = timeframe ? ` over the ${TIMEFRAME_LABELS[timeframe].toLowerCase()} timeframe` : "";

  if (favorability >= 70) {
    switch (moveType) {
      case "buy_add_risk": return `Conditions support selective risk-on positioning${tfRef}. Prioritize quality names with strong balance sheets and regime alignment.`;
      case "buy_specific_ticker": return `Macro regime is constructive for${tickerRef}${tfRef}. Confirm ticker-level technicals align with regime before entry.`;
      case "hold": return `Current regime supports holding${tickerRef}${tfRef}. No systemic trigger requiring defensive action.`;
      case "trim": return `Regime supports reducing${tickerRef} at current levels${tfRef}. Consider staged trimming to preserve optionality.`;
      case "sell": return `Defensive posture is well-supported by current pressure readings. Systematic exit of${tickerRef}${tfRef} over 2–3 sessions reduces slippage risk.`;
      case "hedge": return `Hedging conditions are favorable${tfRef}. Tail protection is cost-effective relative to current volatility regime.`;
      case "raise_cash": return `Raising cash is well-aligned with current regime${tfRef}. Cash preserves optionality for re-entry at better risk-adjusted levels.`;
      case "rotate_sectors": return `Sector rotation conditions are favorable${tfRef}. Defensive and quality sectors are outperforming in this regime.`;
      case "increase_crypto": return `Macro conditions support speculative allocation${tickerRef}${tfRef}. Size appropriately given crypto's volatility amplification.`;
      case "reduce_crypto": return `Reducing${tickerRef} is well-supported${tfRef}. Macro headwinds historically compress speculative asset premiums.`;
    }
  }

  if (favorability >= 45) {
    switch (moveType) {
      case "buy_add_risk": return `Mixed regime — selective exposure only${tfRef}. Avoid overextended names and concentrate in quality with defensive characteristics.`;
      case "buy_specific_ticker": return `${ticker ? ticker.toUpperCase() + "-specific" : "Ticker-specific"} opportunity may exist, but macro regime is mixed${tfRef}. Staged entry with defined stop-loss recommended.`;
      case "hold": return `Hold with active monitoring${tfRef}. Regime is transitional — review stop levels and position sizing.`;
      case "trim": return `Partial trim is reasonable given current conditions${tfRef}. Maintain core position but reduce tail risk exposure.`;
      case "sell": return `Selling into mixed conditions carries opportunity cost risk${tfRef}. Consider staged reduction rather than full exit.`;
      case "hedge": return `Partial hedge is warranted${tfRef}. Full hedge may be premature — monitor for regime confirmation.`;
      case "raise_cash": return `Modest cash raise is prudent${tfRef}. Avoid full de-risking — regime does not yet confirm systemic deterioration.`;
      case "rotate_sectors": return `Rotation is feasible but timing is uncertain${tfRef}. Focus on relative strength within sectors rather than wholesale rotation.`;
      case "increase_crypto": return `${ticker ? ticker.toUpperCase() + " allocation" : "Crypto allocation"} increase carries elevated risk in current regime${tfRef}. Small position sizing recommended.`;
      case "reduce_crypto": return `Partial${tickerRef} reduction is reasonable${tfRef}. Full exit may be premature if macro conditions stabilize.`;
    }
  }

  switch (moveType) {
    case "buy_add_risk": return `Current regime is not supportive of adding risk${tfRef}. Wait for pressure to normalize before increasing exposure.`;
    case "buy_specific_ticker": return `Macro headwinds are significant${tfRef}. ${ticker ? ticker.toUpperCase() + " thesis" : "Ticker-specific thesis"} must be very strong to overcome regime pressure.`;
    case "hold": return `Holding${tickerRef} in this regime requires active risk management${tfRef}. Review stop-loss levels and consider partial reduction.`;
    case "trim": return `Trimming${tickerRef} in a low-pressure environment may be premature${tfRef}. Ensure thesis has changed before reducing.`;
    case "sell": return `Selling${tickerRef} into low-pressure conditions carries high opportunity cost${tfRef}. Confirm fundamental deterioration before exiting.`;
    case "hedge": return `Hedging in low-volatility conditions is expensive${tfRef}. Consider lighter hedge or wait for better entry.`;
    case "raise_cash": return `Cash drag is significant in low-pressure environments${tfRef}. Maintain invested posture unless specific risk identified.`;
    case "rotate_sectors": return `Low-pressure regime favors staying in current sector leaders${tfRef}. Rotation may underperform in this environment.`;
    case "increase_crypto": return `Macro regime does not support${tickerRef} increase${tfRef}. Wait for pressure to normalize.`;
    case "reduce_crypto": return `Reducing${tickerRef} in a supportive macro environment may miss upside${tfRef}. Ensure conviction is high before reducing.`;
  }

  return `Monitor conditions before acting${tfRef}. Current regime is transitional.`;
}

// ── Best Version of Move ──────────────────────────────────────

function computeBestVersion(
  moveType: MoveType,
  favorability: number,
  pressure: FaultlinePressureOutput
): string {
  const p = pressure.overallPressure;

  switch (moveType) {
    case "buy_add_risk":
      if (favorability >= 60) return "Staged entry over 3–5 sessions into quality names with strong free cash flow, low debt, and positive earnings revisions. Avoid highly leveraged or speculative names.";
      return "If buying, limit to 25–50% of intended position size. Focus on defensive quality — consumer staples, healthcare, or dividend payers with low beta.";
    case "buy_specific_ticker":
      if (favorability >= 60) return "Full position entry is supportable. Confirm technical setup (above key moving averages, volume confirmation). Set stop-loss at 7–10% below entry.";
      return "Starter position only (25–33% of target size). Wait for price confirmation before adding. Define invalidation level before entry.";
    case "hold":
      if (p < 50) return "Hold with standard position sizing. Review stop-loss levels quarterly. No action required unless thesis changes.";
      return "Hold with tighter stops. Reduce position size if risk tolerance is exceeded. Set clear exit criteria before conditions deteriorate further.";
    case "trim":
      if (favorability >= 60) return "Trim 20–30% of position at current levels. Retain core exposure for potential continuation. Re-evaluate in 2–4 weeks.";
      return "Trim 10–15% as a precautionary measure. Avoid full exit unless fundamental thesis has broken down.";
    case "sell":
      if (favorability >= 60) return "Systematic exit over 2–3 sessions to minimize market impact. Prioritize highest-risk, most-leveraged positions first.";
      return "Partial exit only. Sell the most vulnerable positions (high beta, leveraged, speculative) while retaining quality core holdings.";
    case "hedge":
      if (favorability >= 60) return "Buy put spreads on index (SPY/QQQ) for 30–60 day protection. Size hedge to cover 50–75% of equity exposure. Avoid over-hedging.";
      return "Light tail hedge only — 1–2% of portfolio in protective puts. Focus on cheap out-of-the-money options for asymmetric payoff.";
    case "raise_cash":
      if (favorability >= 60) return "Move 15–25% of portfolio to cash or short-term Treasuries. Maintain dry powder for re-entry at better risk-adjusted levels.";
      return "Modest cash raise of 5–10%. Avoid full de-risking — maintain core positions in quality names.";
    case "rotate_sectors":
      if (favorability >= 60) return "Rotate from high-beta cyclicals (tech, consumer discretionary) into defensive sectors (utilities, healthcare, consumer staples). Maintain sector diversification.";
      return "Modest tilt toward quality and defensives. Avoid wholesale rotation — maintain exposure to current sector leaders.";
    case "increase_crypto":
      if (favorability >= 60) return "Add to Bitcoin and Ethereum as core crypto positions. Limit speculative altcoin exposure to 10–15% of crypto allocation. Use dollar-cost averaging over 2–4 weeks.";
      return "Starter position only — 1–2% of total portfolio. Bitcoin only for regime-aligned crypto exposure. No altcoin allocation in current conditions.";
    case "reduce_crypto":
      if (favorability >= 60) return "Reduce crypto allocation by 30–50%. Prioritize exiting speculative altcoins and maintaining only Bitcoin/Ethereum core positions.";
      return "Trim 15–20% of crypto exposure. Focus on reducing highest-risk altcoin positions while maintaining core Bitcoin/Ethereum allocation.";
  }

  return "Proceed with caution and reduced position sizing relative to your normal approach.";
}

// ── Avoid Areas ───────────────────────────────────────────────

function computeAvoidAreas(
  moveType: MoveType,
  pressure: FaultlinePressureOutput
): string[] {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const aiScore = getVectorScore(pressure.vectors, "ai-bubble");
  const avoids: string[] = [];

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      avoids.push("Highly leveraged companies with debt-to-equity above 3x");
      avoids.push("Unprofitable growth names trading at extreme revenue multiples");
      if (aiScore >= 55) avoids.push("Overextended AI/mega-cap names at all-time highs with stretched valuations");
      if (creditScore >= 50) avoids.push("High-yield and leveraged loan exposure during credit stress");
      avoids.push("Small-cap speculative names with limited liquidity");
      break;
    case "trim":
    case "sell":
      avoids.push("Panic selling of quality positions with intact fundamentals");
      avoids.push("Selling into extreme volatility spikes — wait for stabilization");
      avoids.push("Exiting positions with upcoming catalysts that could reverse the move");
      break;
    case "hedge":
      avoids.push("Over-hedging — more than 100% portfolio coverage creates net short exposure");
      avoids.push("Buying volatility at extreme highs (VIX > 35) — premium is expensive");
      avoids.push("Single-stock puts without index hedge — idiosyncratic risk not systemic");
      break;
    case "raise_cash":
      avoids.push("Full de-risking — 100% cash misses potential upside if regime stabilizes");
      avoids.push("Holding cash in low-yield accounts — use short-term Treasuries or money market");
      break;
    case "rotate_sectors":
      avoids.push("Rotating into sectors with deteriorating fundamentals just because they are 'cheap'");
      avoids.push("Chasing recent sector momentum without regime alignment");
      if (p >= 60) avoids.push("Sector rotation during crisis-level pressure — correlations converge");
      break;
    case "increase_crypto":
      avoids.push("Speculative altcoins with no fundamental use case or liquidity");
      avoids.push("Leveraged crypto positions — volatility amplification is extreme");
      avoids.push("Exchanges or protocols with unaudited smart contracts");
      break;
    case "reduce_crypto":
      avoids.push("Selling at extreme lows during capitulation — wait for stabilization");
      avoids.push("Exiting Bitcoin/Ethereum core positions unless macro thesis has fundamentally changed");
      break;
    default:
      avoids.push("Acting on short-term noise rather than regime-level signals");
      avoids.push("Overconcentration in any single sector or theme");
      break;
  }

  return avoids.slice(0, 4);
}

// ── NEW: Decision Verdict ─────────────────────────────────────

function computeVerdict(
  favorability: number,
  pressure: FaultlinePressureOutput,
  moveType: MoveType,
  timeframe: SimulatorTimeframe,
  ticker?: string
): DecisionVerdict {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const threatBoard = buildThreatBoard(pressure);
  const highThreats = threatBoard.filter(t => t.severity === "critical" || t.severity === "elevated").length;
  const bullProb = clamp(Math.round(invertScore(p) * 0.80 + invertScore(creditScore) * 0.20), 5, 95);
  const tickerRef = ticker ? ` for ${ticker.toUpperCase()}` : "";
  const tfRef = ` over the ${TIMEFRAME_LABELS[timeframe].toLowerCase()} timeframe`;

  let verdict: VerdictType;
  let confidence: number;
  let reason: string;

  // Determine verdict from composite signals
  if (favorability >= 78 && highThreats <= 1 && p <= 35) {
    verdict = "HIGH_CONVICTION";
    confidence = clamp(Math.round(favorability * 0.7 + bullProb * 0.3), 75, 97);
    reason = `Regime conditions are strongly aligned with this move${tickerRef}${tfRef}. Threat levels are contained, pressure is low, and bull probability is elevated. Risk/reward is highly favorable.`;
  } else if (favorability >= 62 && highThreats <= 2 && p <= 55) {
    verdict = "APPROVED";
    confidence = clamp(Math.round(favorability * 0.65 + bullProb * 0.35), 60, 88);
    reason = `Current regime supports targeted risk-taking${tickerRef}${tfRef}. Threat levels remain contained. Risk/reward is favorable with manageable downside.`;
  } else if (favorability >= 48 && highThreats <= 3) {
    verdict = "CAUTION";
    confidence = clamp(Math.round(favorability * 0.60 + (100 - p) * 0.40), 45, 72);
    reason = `Mixed signals present${tickerRef}${tfRef}. Some conditions support the move, but elevated threats require careful position sizing and defined stop-loss levels.`;
  } else if (p >= 60 || highThreats >= 4) {
    verdict = "DEFENSIVE";
    confidence = clamp(Math.round((100 - favorability) * 0.55 + p * 0.45), 55, 85);
    reason = `Systemic pressure is elevated${tickerRef}${tfRef}. Multiple threat vectors are active. Defensive positioning is recommended until conditions normalize.`;
  } else {
    verdict = "WAIT";
    confidence = clamp(Math.round(50 + Math.abs(favorability - 50) * 0.4), 40, 70);
    reason = `Conditions are transitional${tickerRef}${tfRef}. Insufficient confirmation from key indicators. Waiting for clearer regime signals reduces execution risk.`;
  }

  return { verdict, confidence, reason };
}

// ── NEW: Position Outcome Simulator ──────────────────────────

function computeOutcomeSimulator(
  moveType: MoveType,
  favorability: number,
  pressure: FaultlinePressureOutput,
  timeframe: SimulatorTimeframe,
  ticker?: string
): OutcomeSimulator {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const isCrypto = moveType === "increase_crypto" || moveType === "reduce_crypto" || (ticker && ["BTC", "ETH", "SOL", "DOGE", "XRP"].includes(ticker.toUpperCase()));
  const isDefensive = moveType === "sell" || moveType === "raise_cash" || moveType === "hedge";

  // Volatility multiplier: crypto and high-vol regimes get wider outcomes
  const volMult = isCrypto ? 2.2 : (volatilityScore >= 55 ? 1.5 : 1.0);

  // Base returns calibrated to move type and regime
  let bullReturn: number, baseReturn: number, bearReturn: number;

  if (isDefensive) {
    // Defensive moves: bull case is "avoided loss", bear case is "opportunity cost"
    bullReturn = clamp(Math.round((p * 0.20 + creditScore * 0.10) * volMult), 5, 30);
    baseReturn = clamp(Math.round((p * 0.10 + 3) * volMult), 2, 15);
    bearReturn = -clamp(Math.round((100 - p) * 0.12 * volMult), 2, 18);
  } else {
    // Risk-on moves
    bullReturn = clamp(Math.round((favorability * 0.22 + 5) * volMult), 6, isCrypto ? 60 : 28);
    baseReturn = clamp(Math.round((favorability * 0.08 + 1) * volMult), 1, isCrypto ? 20 : 12);
    bearReturn = -clamp(Math.round(((100 - favorability) * 0.14 + 3) * volMult), 4, isCrypto ? 40 : 20);
  }

  // Timeframe scaling: longer timeframes get wider outcomes
  const tfScale: Record<SimulatorTimeframe, number> = { today: 0.4, this_week: 0.7, one_three_months: 1.0, six_twelve_months: 1.6 };
  const scale = tfScale[timeframe];
  bullReturn = Math.round(bullReturn * scale);
  baseReturn = Math.round(baseReturn * scale);
  bearReturn = Math.round(bearReturn * scale);

  // Ensure minimum separation
  bullReturn = Math.max(bullReturn, baseReturn + 3);
  bearReturn = Math.min(bearReturn, baseReturn - 3);

  // Probabilities derived from favorability and pressure
  const bullProb = clamp(Math.round(favorability * 0.55 + (100 - p) * 0.15 + 5), 15, 65);
  const bearProb = clamp(Math.round((100 - favorability) * 0.30 + p * 0.15 + 5), 10, 50);
  const baseProb = clamp(100 - bullProb - bearProb, 15, 55);

  // Weighted outcome
  const weightedOutcome = Math.round(
    (bullProb / 100) * bullReturn +
    (baseProb / 100) * baseReturn +
    (bearProb / 100) * bearReturn
  );

  return {
    scenarios: [
      { label: "Bull Case", probability: bullProb, expectedReturn: bullReturn },
      { label: "Base Case", probability: baseProb, expectedReturn: baseReturn },
      { label: "Bear Case", probability: bearProb, expectedReturn: bearReturn },
    ],
    weightedOutcome,
  };
}

// ── NEW: Entry Quality Grade ──────────────────────────────────

function computeEntryQuality(
  moveType: MoveType,
  favorability: number,
  pressure: FaultlinePressureOutput,
  timeframe: SimulatorTimeframe
): EntryQuality {
  const p = pressure.overallPressure;
  const liquidityScore  = getVectorScore(pressure.vectors, "liquidity-stress");
  const creditScore     = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore    = getVectorScore(pressure.vectors, "market-breadth");
  const macroScore      = getVectorScore(pressure.vectors, "macro-sensitivity");
  const isRiskOn = ["buy_add_risk", "buy_specific_ticker", "increase_crypto"].includes(moveType);

  // Market Environment: how well does the macro regime support this move?
  const envScore = isRiskOn ? invertScore(p) : p;
  const envGrade = scoreToGrade(envScore);
  const envNote = isRiskOn
    ? (envScore >= 65 ? "Macro regime is constructive for risk-taking" : envScore >= 50 ? "Mixed macro signals — selective positioning only" : "Macro headwinds present — regime not supportive")
    : (envScore >= 65 ? "Elevated pressure supports defensive positioning" : "Low pressure reduces urgency for defensive action");

  // Momentum: breadth and trend confirmation
  const momentumScore = isRiskOn ? invertScore(breadthScore) : breadthScore;
  const momentumGrade = scoreToGrade(momentumScore);
  const momentumNote = isRiskOn
    ? (momentumScore >= 65 ? "Broad participation — momentum is constructive" : momentumScore >= 50 ? "Narrowing breadth — momentum is mixed" : "Breadth deteriorating — momentum headwinds")
    : (momentumScore >= 65 ? "Breadth deteriorating — supports defensive action" : "Broad market — momentum not yet confirming defensive thesis");

  // Liquidity: funding conditions
  const liqScore = isRiskOn ? invertScore(liquidityScore) : liquidityScore;
  const liqGrade = scoreToGrade(liqScore);
  const liqNote = isRiskOn
    ? (liqScore >= 65 ? "Liquidity conditions healthy — supports entry" : liqScore >= 50 ? "Liquidity tightening — monitor funding conditions" : "Liquidity stress present — execution risk elevated")
    : (liqScore >= 65 ? "Liquidity stress supports defensive positioning" : "Liquidity conditions healthy — defensive urgency lower");

  // Risk/Reward: favorability-derived
  const rrScore = favorability;
  const rrGrade = scoreToGrade(rrScore);
  const rrNote = rrScore >= 70 ? "Risk/reward is favorable in current regime" : rrScore >= 50 ? "Risk/reward is mixed — size accordingly" : "Risk/reward is unfavorable — consider waiting";

  // Macro Alignment: credit and macro sensitivity
  const macroAlignScore = isRiskOn ? Math.round(invertScore(creditScore) * 0.6 + invertScore(macroScore) * 0.4) : Math.round(creditScore * 0.6 + macroScore * 0.4);
  const macroAlignGrade = scoreToGrade(macroAlignScore);
  const macroAlignNote = isRiskOn
    ? (macroAlignScore >= 65 ? "Credit and macro conditions aligned with move" : "Credit or macro misalignment — monitor closely")
    : (macroAlignScore >= 65 ? "Credit stress confirms defensive thesis" : "Credit and macro not yet confirming defensive thesis");

  // Timing: timeframe vs regime phase
  const tfBonus: Record<SimulatorTimeframe, number> = { today: -5, this_week: 0, one_three_months: 8, six_twelve_months: 5 };
  const timingScore = clamp(favorability + tfBonus[timeframe], 0, 100);
  const timingGrade = scoreToGrade(timingScore);
  const timingNote = timeframe === "today" ? "Intraday timing carries elevated execution risk" :
    timeframe === "this_week" ? "Short-term timing is regime-dependent" :
    timeframe === "one_three_months" ? "Tactical timeframe aligns well with regime signals" :
    "Strategic timeframe smooths short-term noise";

  // Overall: weighted average of all category scores
  const overallScore = Math.round(
    envScore * 0.20 +
    momentumScore * 0.15 +
    liqScore * 0.15 +
    rrScore * 0.25 +
    macroAlignScore * 0.15 +
    timingScore * 0.10
  );
  const overallGrade = scoreToGrade(overallScore);

  return {
    categories: [
      { category: "Market Environment", grade: envGrade, note: envNote },
      { category: "Momentum", grade: momentumGrade, note: momentumNote },
      { category: "Liquidity", grade: liqGrade, note: liqNote },
      { category: "Risk/Reward", grade: rrGrade, note: rrNote },
      { category: "Macro Alignment", grade: macroAlignGrade, note: macroAlignNote },
      { category: "Timing", grade: timingGrade, note: timingNote },
    ],
    overallGrade,
  };
}

// ── NEW: Position Sizing ──────────────────────────────────────

function computePositionSizing(
  moveType: MoveType,
  favorability: number,
  pressure: FaultlinePressureOutput
): PositionSizing {
  const p = pressure.overallPressure;
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const threatBoard = buildThreatBoard(pressure);
  const highThreats = threatBoard.filter(t => t.severity === "critical" || t.severity === "elevated").length;

  // Base sizing from favorability
  const baseConservative = clamp(Math.round(favorability * 0.025), 1, 4);
  const baseStandard     = clamp(Math.round(favorability * 0.06), 2, 8);
  const baseAggressive   = clamp(Math.round(favorability * 0.12), 3, 15);

  // Pressure penalty: high pressure reduces sizing
  const pressurePenalty = p >= 65 ? 0.6 : p >= 45 ? 0.8 : 1.0;

  // Volatility penalty
  const volPenalty = volatilityScore >= 65 ? 0.7 : volatilityScore >= 45 ? 0.85 : 1.0;

  // Threat penalty
  const threatPenalty = highThreats >= 4 ? 0.6 : highThreats >= 2 ? 0.8 : 1.0;

  const multiplier = pressurePenalty * volPenalty * threatPenalty;

  const conservative = Math.max(1, Math.round(baseConservative * multiplier));
  const standard     = Math.max(2, Math.round(baseStandard * multiplier));
  const aggressive   = Math.max(3, Math.round(baseAggressive * multiplier));

  const guidance = p >= 60
    ? "Elevated systemic pressure warrants reduced position sizing across all tiers. Prioritize capital preservation over return maximization in this regime."
    : p >= 40
    ? "Mixed regime conditions suggest standard sizing with active stop-loss management. Avoid maximum allocation until regime confirms direction."
    : "Low pressure environment supports standard to aggressive sizing for high-conviction setups. Maintain diversification across positions.";

  return {
    tiers: [
      {
        label: "Conservative",
        allocation: conservative,
        rationale: `Minimal exposure${p >= 55 ? " — elevated pressure warrants caution" : " — suitable for uncertain or transitional regimes"}`,
      },
      {
        label: "Standard",
        allocation: standard,
        rationale: `Balanced exposure${favorability >= 60 ? " — regime supports this sizing level" : " — sized for mixed conditions with active risk management"}`,
      },
      {
        label: "Aggressive",
        allocation: aggressive,
        rationale: `Maximum exposure${favorability >= 70 && p <= 40 ? " — high-conviction setup in low-pressure regime" : " — only appropriate with strong conviction and defined stop-loss"}`,
      },
    ],
    guidance,
  };
}

// ── NEW: Historical Analogs ───────────────────────────────────

function computeHistoricalAnalogs(
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  timeframe: SimulatorTimeframe,
  ticker?: string
): HistoricalAnalog[] {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore = getVectorScore(pressure.vectors, "market-breadth");
  const isCrypto = moveType === "increase_crypto" || moveType === "reduce_crypto" || (ticker && ["BTC", "ETH", "SOL", "DOGE", "XRP"].includes(ticker.toUpperCase()));
  const isDefensive = moveType === "sell" || moveType === "raise_cash" || moveType === "hedge" || moveType === "reduce_crypto";

  const analogs: HistoricalAnalog[] = [];

  if (isCrypto) {
    if (p <= 40 && creditScore <= 40) {
      analogs.push({ label: "October 2023 BTC Breakout", similarity: clamp(Math.round(85 - p * 0.3), 65, 92), period: "Oct 2023", outcome: "BTC advanced +27% over the following 60 days as macro pressure remained contained and institutional inflows accelerated." });
      analogs.push({ label: "Post-COVID Liquidity Surge", similarity: clamp(Math.round(78 - p * 0.2), 58, 85), period: "Nov 2020–Feb 2021", outcome: "Crypto markets surged +180% over 90 days as Fed liquidity flooded risk assets and BTC broke all-time highs." });
      analogs.push({ label: "March 2019 Recovery Rally", similarity: clamp(Math.round(72 - p * 0.25), 52, 80), period: "Mar–Jun 2019", outcome: "BTC rallied +150% over 3 months as macro conditions stabilized and institutional interest returned." });
    } else if (p >= 55) {
      analogs.push({ label: "May 2022 Crypto Deleveraging", similarity: clamp(Math.round(70 + p * 0.15), 65, 90), period: "May–Jun 2022", outcome: "BTC fell -40% over 6 weeks as macro pressure spiked and credit conditions tightened sharply." });
      analogs.push({ label: "November 2022 FTX Collapse", similarity: clamp(Math.round(65 + creditScore * 0.15), 60, 85), period: "Nov 2022", outcome: "Crypto markets fell -25% in 2 weeks as systemic contagion spread from exchange failure to broader market." });
      analogs.push({ label: "Q4 2018 Crypto Winter", similarity: clamp(Math.round(60 + breadthScore * 0.12), 55, 80), period: "Oct–Dec 2018", outcome: "BTC declined -45% over 90 days as macro headwinds and regulatory uncertainty weighed on speculative assets." });
    } else {
      analogs.push({ label: "Q1 2024 ETF Approval Rally", similarity: clamp(Math.round(75 - Math.abs(p - 40) * 0.5), 60, 85), period: "Jan–Mar 2024", outcome: "BTC advanced +65% over 60 days following spot ETF approval, with macro conditions in a transitional phase." });
      analogs.push({ label: "September 2023 Consolidation", similarity: clamp(Math.round(70 - Math.abs(p - 45) * 0.4), 58, 80), period: "Sep–Oct 2023", outcome: "BTC traded sideways for 6 weeks before breaking out, rewarding patient accumulation." });
      analogs.push({ label: "August 2021 Recovery", similarity: clamp(Math.round(65 - Math.abs(p - 42) * 0.3), 55, 78), period: "Aug–Oct 2021", outcome: "BTC recovered +80% from mid-year lows as macro conditions stabilized and institutional demand returned." });
    }
  } else if (isDefensive) {
    if (p >= 55) {
      analogs.push({ label: "Q4 2018 Fed Tightening Cycle", similarity: clamp(Math.round(80 + p * 0.08), 68, 92), period: "Oct–Dec 2018", outcome: "S&P 500 fell -20% as Fed continued hiking into deteriorating conditions. Defensive positioning preserved capital." });
      analogs.push({ label: "February 2020 Pre-COVID Sell-off", similarity: clamp(Math.round(75 + creditScore * 0.08), 62, 88), period: "Feb–Mar 2020", outcome: "Markets fell -34% in 5 weeks. Early defensive action at first pressure signals proved highly effective." });
      analogs.push({ label: "Q3 2022 Inflation Shock", similarity: clamp(Math.round(70 + volatilityScore * 0.08), 58, 85), period: "Jul–Oct 2022", outcome: "S&P 500 fell -25% as inflation and rate shock materialized. Cash and hedges outperformed significantly." });
    } else {
      analogs.push({ label: "August 2015 China Shock", similarity: clamp(Math.round(72 - p * 0.2), 58, 82), period: "Aug 2015", outcome: "S&P 500 fell -12% over 2 weeks before recovering. Partial defensive positioning reduced drawdown." });
      analogs.push({ label: "October 2023 Rate Spike", similarity: clamp(Math.round(68 - p * 0.15), 55, 78), period: "Aug–Oct 2023", outcome: "10Y yield spiked to 5%, causing a -10% equity correction. Hedges and cash provided meaningful protection." });
      analogs.push({ label: "Q1 2016 Oil Shock", similarity: clamp(Math.round(65 - p * 0.12), 52, 75), period: "Jan–Feb 2016", outcome: "S&P 500 fell -13% before recovering. Defensive positioning during elevated pressure was rewarded." });
    }
  } else {
    // Risk-on / buy scenarios
    if (p <= 40 && creditScore <= 40) {
      analogs.push({ label: "Q4 2023 Soft Landing Rally", similarity: clamp(Math.round(85 - p * 0.3), 68, 93), period: "Oct–Dec 2023", outcome: "S&P 500 advanced +15% in Q4 2023 as inflation cooled and Fed signaled pivot. Risk-on positioning was highly rewarded." });
      analogs.push({ label: "Post-COVID Recovery 2020", similarity: clamp(Math.round(80 - p * 0.25), 62, 88), period: "Apr–Dec 2020", outcome: "S&P 500 recovered +70% from March 2020 lows as liquidity surge and fiscal stimulus drove broad market advance." });
      analogs.push({ label: "2019 Fed Pivot Rally", similarity: clamp(Math.round(75 - p * 0.2), 58, 85), period: "Jan–Jul 2019", outcome: "S&P 500 advanced +20% as Fed pivoted from hiking to cutting. Low pressure and improving breadth confirmed the move." });
    } else if (p >= 55) {
      analogs.push({ label: "2022 Bear Market Rally", similarity: clamp(Math.round(68 + p * 0.08), 60, 82), period: "Jun–Aug 2022", outcome: "S&P 500 rallied +17% before resuming decline. Risk-on positioning in elevated pressure required tight stops." });
      analogs.push({ label: "Q3 2023 Tactical Bounce", similarity: clamp(Math.round(65 + creditScore * 0.06), 55, 78), period: "Jun–Jul 2023", outcome: "S&P 500 advanced +8% in a short window. Selective risk-taking with defined exits outperformed passive holding." });
      analogs.push({ label: "October 2022 Capitulation Rally", similarity: clamp(Math.round(62 + volatilityScore * 0.05), 52, 75), period: "Oct 2022", outcome: "S&P 500 rallied +14% from October lows. Staged entry with tight risk management captured the move." });
    } else {
      analogs.push({ label: "Q2 2023 AI-Led Rally", similarity: clamp(Math.round(78 - Math.abs(p - 40) * 0.4), 62, 88), period: "Apr–Jul 2023", outcome: "S&P 500 advanced +12% as AI theme drove mega-cap outperformance. Selective positioning in quality names outperformed." });
      analogs.push({ label: "November 2023 Breakout", similarity: clamp(Math.round(73 - Math.abs(p - 38) * 0.35), 58, 83), period: "Nov 2023", outcome: "S&P 500 advanced +9% as macro conditions improved. Broad-based advance rewarded diversified risk-on positioning." });
      analogs.push({ label: "Q1 2024 Momentum Continuation", similarity: clamp(Math.round(68 - Math.abs(p - 35) * 0.3), 55, 80), period: "Jan–Mar 2024", outcome: "S&P 500 advanced +10% continuing 2023 momentum. Quality and growth names led, with breadth gradually improving." });
    }
  }

  return analogs.slice(0, 3);
}

// ── NEW: Thesis Stress Test ───────────────────────────────────

function computeThesisStressTest(
  thesisType: ThesisType,
  moveType: MoveType,
  pressure: FaultlinePressureOutput,
  ticker?: string
): ThesisStressTest {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const liquidityScore = getVectorScore(pressure.vectors, "liquidity-stress");
  const macroScore = getVectorScore(pressure.vectors, "macro-sensitivity");
  const tickerRef = ticker ? ` ${ticker.toUpperCase()}` : "";

  const thesisLabel = THESIS_LABELS[thesisType];

  const stressMap: Record<ThesisType, { coreDependency: string; failurePoints: string[] }> = {
    momentum: {
      coreDependency: `Your${tickerRef} momentum thesis depends on continuation of the current trend and broad market participation.`,
      failurePoints: [
        "VIX spikes above 25 — momentum strategies historically underperform in high-volatility regimes",
        "Market breadth deteriorates — narrow leadership signals momentum exhaustion",
        "Fed hawkish surprise — rate repricing disrupts momentum factor",
        "Earnings miss in key sector — fundamental catalyst breaks trend",
        `FAULTLINE Pressure Index rises above ${Math.min(p + 15, 75)}/100 — systemic pressure reverses momentum`,
      ],
    },
    breakout: {
      coreDependency: `Your${tickerRef} breakout thesis depends on sustained volume confirmation and macro conditions that support the breakout level holding.`,
      failurePoints: [
        "False breakout — price returns below breakout level within 3 sessions",
        "Volume fails to confirm — breakout without institutional participation is suspect",
        "Credit spreads widen — risk-off environment causes breakout failure",
        "Macro data disappoints — fundamental backdrop undermines technical setup",
        "Sector rotation away from breakout area — relative strength deteriorates",
      ],
    },
    mean_reversion: {
      coreDependency: `Your${tickerRef} mean reversion thesis depends on the current deviation being temporary and macro conditions not confirming a structural trend change.`,
      failurePoints: [
        "Regime shift — what looks like mean reversion may be a new structural trend",
        "Credit deterioration accelerates — fundamental thesis breaks down",
        `Liquidity stress rises above ${Math.min(liquidityScore + 20, 80)}/100 — forced selling extends the move beyond mean`,
        "Earnings revision cycle turns negative — fundamental anchor shifts",
        "Macro data confirms trend continuation — reversion thesis invalidated",
      ],
    },
    long_term: {
      coreDependency: `Your${tickerRef} long-term investment thesis depends on macro conditions normalizing and the fundamental thesis remaining intact over a multi-year horizon.`,
      failurePoints: [
        "Structural regime change — secular shift in inflation, rates, or growth invalidates long-term thesis",
        `FAULTLINE Pressure Index sustains above 65/100 for 3+ months — systemic stress becomes structural`,
        "Fundamental thesis deterioration — earnings power, competitive position, or balance sheet weakens",
        "Regulatory or geopolitical shock — external risk invalidates core assumption",
        "Liquidity crisis — forced selling creates permanent capital impairment",
      ],
    },
    value: {
      coreDependency: `Your${tickerRef} value thesis depends on the market recognizing the mispricing and macro conditions not creating a value trap.`,
      failurePoints: [
        "Value trap — cheap for fundamental reasons that persist or worsen",
        "Credit conditions tighten — value names with leverage face refinancing risk",
        "Macro deterioration extends — earnings power declines faster than valuation",
        "Sector headwinds intensify — structural decline masks apparent value",
        "Catalyst timeline extends — value realization takes longer than expected, capital tied up",
      ],
    },
    ai_theme: {
      coreDependency: `Your${tickerRef} AI theme thesis depends on continued AI capex spending, earnings delivery from AI-exposed names, and macro conditions supporting growth multiples.`,
      failurePoints: [
        "AI capex cycle turns — hyperscaler spending cuts signal theme exhaustion",
        "AI concentration risk materializes — index-level drawdown from mega-cap selloff",
        "Rate shock — growth multiples compress as discount rate rises",
        "Earnings disappointment — AI revenue monetization slower than priced in",
        "Regulatory action — antitrust or data privacy restrictions limit AI expansion",
      ],
    },
    crypto_cycle: {
      coreDependency: `Your${tickerRef} crypto cycle thesis depends on the current cycle phase continuing, macro liquidity remaining supportive, and no systemic crypto-specific risk events.`,
      failurePoints: [
        "Macro liquidity tightens — crypto historically amplifies macro drawdowns by 2–3x",
        "Regulatory action — exchange closure, stablecoin ban, or ETF rejection",
        "Exchange or protocol failure — systemic contagion (FTX-type event)",
        "Bitcoin dominance breakdown — altcoin contagion spreads to core holdings",
        "Cycle phase misidentification — what appears to be early cycle may be late cycle",
      ],
    },
    sector_rotation: {
      coreDependency: `Your sector rotation thesis depends on the identified sector divergence persisting and macro conditions supporting the rotation target.`,
      failurePoints: [
        "Crisis-level pressure — sector correlations converge to 1.0, eliminating rotation benefit",
        "Macro regime shift — rotation target sector faces unexpected headwinds",
        "Timing error — rotation too early or too late relative to cycle phase",
        "Liquidity shock — forced selling hits all sectors simultaneously",
        "Fed policy surprise — rate-sensitive sectors reprice across the board",
      ],
    },
    other: {
      coreDependency: `Your thesis depends on the specific conditions and assumptions underlying your trade idea remaining intact.`,
      failurePoints: [
        "Macro regime deterioration — systemic pressure undermines position-specific thesis",
        "Credit conditions tighten — risk appetite reduces across asset classes",
        "Volatility spike — position sizing and stop-loss levels tested",
        "Liquidity deterioration — execution risk increases, spreads widen",
        "Unexpected macro data — Fed, inflation, or growth data invalidates key assumption",
      ],
    },
  };

  const { coreDependency, failurePoints } = stressMap[thesisType];

  // Add regime-specific failure point
  const regimeFailure = p >= 55
    ? `Current FAULTLINE Pressure Index (${p}/100) is already elevated — your thesis has less margin for error than in a low-pressure regime`
    : creditScore >= 50
    ? `Credit stress (${levelLabel(creditScore)}) is present — credit-sensitive assumptions in your thesis are at higher risk`
    : macroScore >= 55
    ? `Macro sensitivity is elevated — rate and inflation assumptions in your thesis face headwinds`
    : null;

  const allFailurePoints = regimeFailure
    ? [regimeFailure, ...failurePoints].slice(0, 5)
    : failurePoints.slice(0, 5);

  return {
    thesisType,
    thesisLabel,
    coreDependency,
    failurePoints: allFailurePoints,
  };
}

// ── LLM Explanation ───────────────────────────────────────────

async function generateExplanation(
  input: TradeSimulationInput,
  output: Omit<TradeSimulationOutput, "explanation">,
  pressure: FaultlinePressureOutput
): Promise<string> {
  const moveLabel = MOVE_LABELS[input.moveType];
  const tfLabel = TIMEFRAME_LABELS[input.timeframe];
  const tickerNote = input.ticker ? ` for ${input.ticker.toUpperCase()}` : "";
  const verdictLabel = output.verdict.verdict.replace("_", " ");

  const prompt = `You are FAULTLINE, an institutional-grade macroeconomic risk intelligence system.

A user wants to simulate the move: "${moveLabel}"${tickerNote} over the timeframe: "${tfLabel}".

Current market conditions:
- FAULTLINE Pressure Index: ${output.marketCondition.pressureIndex}/100 (${output.marketCondition.regimeLevel})
- Regime: ${output.marketCondition.regime}
- Bull Probability: ${output.marketCondition.bullProbability}%
- Crash Probability: ${output.marketCondition.crashProbability}%
- Liquidity: ${output.marketCondition.liquidityCondition}
- Credit Stress: ${output.marketCondition.creditStress}
- Volatility: ${output.marketCondition.volatilityCondition}
- Breadth: ${output.marketCondition.breadthConfirmation}

Simulation result:
- VERDICT: ${verdictLabel} (Confidence: ${output.verdict.confidence}%)
- Move Favorability Score: ${output.moveFavorabilityScore}/100
- Favorable Setup Probability: ${output.favorableSetupProbability}%
- Adverse Pressure Probability: ${output.adversePressureProbability}%
- Risk Level: ${output.riskLevel}
- Entry Quality Overall Grade: ${output.entryQuality.overallGrade}
- Expected Weighted Outcome: ${output.outcomeSimulator.weightedOutcome > 0 ? "+" : ""}${output.outcomeSimulator.weightedOutcome}%

Write a concise 3-4 sentence institutional-grade explanation of this simulation result.
- Reference the specific move${tickerNote} and timeframe explicitly
- Explain why the current market regime supports or challenges this specific move
- Reference specific pressure vectors (liquidity, credit, volatility, breadth) that are most relevant
- Conclude with a probability-weighted recommendation referencing the verdict
- Do NOT use phrases like "guaranteed", "certain", "will definitely", or "I recommend"
- Frame as market-regime simulation and probability-weighted setup reading
- Tone: authoritative, analytical, institutional — like a senior risk manager briefing a portfolio committee
- Keep it under 100 words`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE, an institutional macroeconomic risk intelligence system. Provide concise, authoritative market-regime analysis. Never give personalized financial advice or guaranteed predictions." },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 20) {
      return content.trim();
    }
  } catch (err) {
    log.warn("[Trade Preflight] LLM explanation failed, using fallback", { err: err as Error });
  }

  const direction = output.moveFavorabilityScore >= 60 ? "supports" : output.moveFavorabilityScore >= 40 ? "partially supports" : "challenges";
  const tickerStr = input.ticker ? ` a ${input.ticker.toUpperCase()} position` : ` the "${moveLabel}" move`;
  return `Current market regime ${direction}${tickerStr} over the ${tfLabel.toLowerCase()} timeframe. ` +
    `The FAULTLINE Pressure Index at ${output.marketCondition.pressureIndex}/100 with ${output.marketCondition.creditStress.toLowerCase()} credit stress and ` +
    `${output.marketCondition.liquidityCondition.toLowerCase()} liquidity conditions yields a ${output.moveFavorabilityScore}/100 favorability score and a verdict of ${verdictLabel}. ` +
    `Favorable setup probability is ${output.favorableSetupProbability}% with ${output.adversePressureProbability}% adverse pressure probability. ` +
    `This is a market-regime simulation — not personalized financial advice or a guaranteed prediction.`;
}

// ── Main Entry Point ──────────────────────────────────────────

// Exported for testing: accepts an optional pre-computed pressure object
export async function runTradePreflightSimulation(
  input: TradeSimulationInput,
  _pressureOverride?: any
): Promise<TradeSimulationOutput> {
  const pressure = _pressureOverride ?? await calculateFaultlinePressure();

  const marketCondition = buildMarketCondition(pressure);
  const { favorability, favorable, adverse } = computeFavorabilityScore(
    input.moveType,
    pressure,
    input.timeframe
  );

  const riskLevel = toRiskLevel(100 - favorability + Math.round(pressure.overallPressure * 0.20));
  const confidenceLevel = toConfidenceLevel(pressure);

  const actionBias = computeActionBias(input.moveType, favorability, pressure, input.ticker, input.timeframe);
  const bestVersionOfMove = computeBestVersion(input.moveType, favorability, pressure);
  const avoidAreas = computeAvoidAreas(input.moveType, pressure);
  const invalidationTriggers = computeInvalidationTriggers(input.moveType, pressure, input.ticker);
  const greenLights = computeGreenLights(input.moveType, pressure, input.ticker, input.timeframe);
  const redFlags = computeRedFlags(input.moveType, pressure, input.ticker, input.timeframe);
  const watchNext = computeWatchNext(input.moveType, pressure, input.ticker);

  // New enhanced fields
  const verdict = computeVerdict(favorability, pressure, input.moveType, input.timeframe, input.ticker);
  const outcomeSimulator = computeOutcomeSimulator(input.moveType, favorability, pressure, input.timeframe, input.ticker);
  const entryQuality = computeEntryQuality(input.moveType, favorability, pressure, input.timeframe);
  const positionSizing = computePositionSizing(input.moveType, favorability, pressure);
  const historicalAnalogs = computeHistoricalAnalogs(input.moveType, pressure, input.timeframe, input.ticker);
  const thesisStressTest = computeThesisStressTest(
    input.thesisType ?? "other",
    input.moveType,
    pressure,
    input.ticker
  );

  const partial: Omit<TradeSimulationOutput, "explanation"> = {
    marketStatus: marketCondition.marketStatus,
    moveType: input.moveType,
    moveLabel: MOVE_LABELS[input.moveType],
    timeframe: input.timeframe,
    timeframeLabel: TIMEFRAME_LABELS[input.timeframe],
    ticker: input.ticker,
    thesisType: input.thesisType,
    marketCondition,
    moveFavorabilityScore: favorability,
    favorableSetupProbability: favorable,
    adversePressureProbability: adverse,
    riskLevel,
    confidenceLevel,
    actionBias,
    bestVersionOfMove,
    avoidAreas,
    invalidationTriggers,
    greenLights,
    redFlags,
    watchNext,
    verdict,
    outcomeSimulator,
    entryQuality,
    positionSizing,
    historicalAnalogs,
    thesisStressTest,
    generatedAt: new Date().toISOString(),
  };

  const explanation = await generateExplanation(input, partial, pressure);

  return { ...partial, explanation };
}
