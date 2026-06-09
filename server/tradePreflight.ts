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

export interface TradeSimulationInput {
  moveType: MoveType;
  timeframe: SimulatorTimeframe;
  ticker?: string;
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

export interface TradeSimulationOutput {
  marketStatus: MarketStatus;
  moveType: MoveType;
  moveLabel: string;
  timeframe: SimulatorTimeframe;
  timeframeLabel: string;
  ticker?: string;
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
  explanation: string;
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────

const MOVE_LABELS: Record<MoveType, string> = {
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

const TIMEFRAME_LABELS: Record<SimulatorTimeframe, string> = {
  today: "Today",
  this_week: "This Week",
  one_three_months: "1–3 Months",
  six_twelve_months: "6–12 Months",
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
  // Higher confidence when data is live and pressure is not in extreme territory
  if (pressure.dataSource === "fallback") return "Low";
  const p = pressure.overallPressure;
  if (p >= 80 || p <= 10) return "Moderate"; // extreme readings are less predictable
  return "High";
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

  // VIX / Volatility
  threats.push({
    category: "Volatility",
    threat: "VIX breakout above 30",
    severity: volatilityScore >= 65 ? "critical" : volatilityScore >= 45 ? "elevated" : volatilityScore >= 25 ? "moderate" : "low",
    hiddenPressure: volatilityScore >= 45 ? "Volatility regime elevated — options pricing in tail risk" : undefined,
  });

  // Credit spreads
  threats.push({
    category: "Credit",
    threat: "Credit spreads widening — HY contagion risk",
    severity: creditScore >= 65 ? "critical" : creditScore >= 45 ? "elevated" : creditScore >= 25 ? "moderate" : "low",
    hiddenPressure: creditScore >= 45 ? "HY spreads tightening window closing — leveraged names at risk" : undefined,
  });

  // Breadth rollover
  threats.push({
    category: "Breadth",
    threat: "Market breadth rollover — advance/decline deterioration",
    severity: breadthScore >= 65 ? "critical" : breadthScore >= 45 ? "elevated" : breadthScore >= 25 ? "moderate" : "low",
    hiddenPressure: breadthScore >= 45 ? "Rally narrowing to fewer names — index masking underlying weakness" : undefined,
  });

  // Treasury yield shock
  threats.push({
    category: "Rates",
    threat: "Treasury yield shock — 10Y moves >50bps in a week",
    severity: macroScore >= 65 ? "critical" : macroScore >= 45 ? "elevated" : macroScore >= 25 ? "moderate" : "low",
    hiddenPressure: macroScore >= 45 ? "Duration risk elevated — rate-sensitive multiples under pressure" : undefined,
  });

  // Liquidity deterioration
  threats.push({
    category: "Liquidity",
    threat: "Liquidity deterioration — SOFR / repo market stress",
    severity: liquidityScore >= 65 ? "critical" : liquidityScore >= 45 ? "elevated" : liquidityScore >= 25 ? "moderate" : "low",
    hiddenPressure: liquidityScore >= 45 ? "Funding conditions tightening — watch overnight repo and SOFR" : undefined,
  });

  // AI / Speculation
  threats.push({
    category: "Speculation",
    threat: "AI/speculation pressure spike — mega-cap concentration risk",
    severity: aiScore >= 65 ? "critical" : aiScore >= 45 ? "elevated" : aiScore >= 25 ? "moderate" : "low",
    hiddenPressure: aiScore >= 45 ? "Index returns masking underlying weakness in non-AI names" : undefined,
  });

  // Recession probability
  const recessionScore = Math.round(creditScore * 0.35 + breadthScore * 0.35 + overallPressure * 0.30);
  threats.push({
    category: "Macro",
    threat: "Recession probability increase — leading indicators deteriorating",
    severity: recessionScore >= 65 ? "critical" : recessionScore >= 45 ? "elevated" : recessionScore >= 25 ? "moderate" : "low",
    hiddenPressure: recessionScore >= 45 ? "Composite leading indicators softening — watch PMI and yield curve" : undefined,
  });

  // Overall pressure
  if (overallPressure >= 50) {
    threats.push({
      category: "Systemic",
      threat: `FAULTLINE Pressure Index at ${overallPressure}/100 — systemic stress building`,
      severity: overallPressure >= 65 ? "critical" : overallPressure >= 50 ? "elevated" : "moderate",
      hiddenPressure: "Multiple vectors converging — review position sizing and stop levels",
    });
  }

  // Sort by severity (critical first)
  const severityOrder: Record<string, number> = { critical: 0, elevated: 1, moderate: 2, low: 3 };
  return threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function buildMarketCondition(pressure: FaultlinePressureOutput): MarketConditionSnapshot {
  const { overallPressure, regime, level, vectors } = pressure;

  const liquidityScore = getVectorScore(vectors, "liquidity-stress");
  const creditScore    = getVectorScore(vectors, "credit-contagion");
  const volatilityScore = getVectorScore(vectors, "volatility-regime");
  const macroScore     = getVectorScore(vectors, "macro-sensitivity");
  const breadthScore   = getVectorScore(vectors, "market-breadth");
  const aiScore        = getVectorScore(vectors, "ai-bubble");

  // Bull/crash probabilities derived from pressure (mirrors dashboard)
  const bullProbability  = clamp(Math.round(invertScore(overallPressure) * 0.80 + invertScore(creditScore) * 0.20), 5, 95);
  const crashProbability = clamp(Math.round(overallPressure * 0.60 + creditScore * 0.40) / 2, 5, 95);

  // Fed pressure: proxy from macro sensitivity
  const fedPressureScore = macroScore;

  // Recession pressure: blend of credit + breadth + overall
  const recessionScore = Math.round(creditScore * 0.35 + breadthScore * 0.35 + overallPressure * 0.30);

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
//
// Each move type has a "natural alignment" with market conditions.
// Risk-adding moves are penalized by high pressure; defensive moves
// are rewarded by high pressure.

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

  // Base favorability: how well does this move align with current pressure?
  let rawFavorability: number;

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      // Favorable when pressure is low, breadth is healthy, credit stable
      rawFavorability = Math.round(
        invertScore(p) * 0.40 +
        invertScore(creditScore) * 0.25 +
        invertScore(liquidityScore) * 0.20 +
        invertScore(breadthScore) * 0.15
      );
      break;

    case "hold":
      // Hold is neutral — slightly penalized in extremes (both very high and very low pressure)
      {
        const extremeness = Math.abs(p - 50) / 50; // 0 = neutral, 1 = extreme
        rawFavorability = Math.round(70 - extremeness * 30);
      }
      break;

    case "trim":
      // Trim is moderately favorable in elevated pressure
      rawFavorability = Math.round(
        p * 0.35 +
        creditScore * 0.25 +
        volatilityScore * 0.20 +
        breadthScore * 0.20
      );
      break;

    case "sell":
      // Sell is most favorable in high pressure, credit stress, deteriorating breadth
      rawFavorability = Math.round(
        p * 0.40 +
        creditScore * 0.30 +
        liquidityScore * 0.15 +
        breadthScore * 0.15
      );
      break;

    case "hedge":
      // Hedge is favorable when volatility is elevated and pressure is rising
      rawFavorability = Math.round(
        volatilityScore * 0.40 +
        p * 0.30 +
        creditScore * 0.20 +
        liquidityScore * 0.10
      );
      break;

    case "raise_cash":
      // Raising cash is favorable when pressure is elevated and breadth deteriorating
      rawFavorability = Math.round(
        p * 0.35 +
        breadthScore * 0.25 +
        creditScore * 0.25 +
        liquidityScore * 0.15
      );
      break;

    case "rotate_sectors":
      // Rotation is favorable when breadth is narrowing but not collapsing
      {
        const rotationWindow = Math.max(0, 100 - Math.abs(breadthScore - 55) * 2);
        rawFavorability = Math.round(
          rotationWindow * 0.40 +
          invertScore(p) * 0.30 +
          invertScore(volatilityScore) * 0.30
        );
      }
      break;

    case "increase_crypto":
      // Crypto is most favorable in low pressure + low credit stress + low AI bubble risk
      rawFavorability = Math.round(
        invertScore(p) * 0.35 +
        invertScore(creditScore) * 0.30 +
        invertScore(aiScore) * 0.20 +
        invertScore(macroScore) * 0.15
      );
      break;

    case "reduce_crypto":
      // Reducing crypto is favorable in high pressure, high AI bubble, high credit stress
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

  // Apply timeframe smoothing
  const favorability = clamp(smooth(rawFavorability, smoothFactor), 0, 100);

  // Favorable setup probability: how often does this setup historically work?
  const favorable = clamp(Math.round(favorability * 0.85 + 10), 5, 95);

  // Adverse pressure probability: inverse, capped so favorable + adverse <= 100
  const adverseRaw = clamp(100 - favorable + Math.round(p * 0.10), 5, 95);
  const adverse = Math.min(adverseRaw, 100 - favorable);

  return { favorability, favorable, adverse };
}

// ── Green Lights ──────────────────────────────────────────────

function computeGreenLights(
  moveType: MoveType,
  pressure: FaultlinePressureOutput
): string[] {
  const lights: string[] = [];
  const p = pressure.overallPressure;
  const liquidityScore  = getVectorScore(pressure.vectors, "liquidity-stress");
  const creditScore     = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore    = getVectorScore(pressure.vectors, "market-breadth");
  const aiScore         = getVectorScore(pressure.vectors, "ai-bubble");

  // Universal green lights
  if (p < 40) lights.push(`FAULTLINE Pressure Index at ${p}/100 — systemic risk contained`);
  if (liquidityScore < 35) lights.push("Liquidity conditions healthy — credit markets functioning normally");
  if (creditScore < 35) lights.push("Credit spreads contained — no contagion signals present");
  if (breadthScore < 40) lights.push("Market breadth broad — wide participation in advance");
  if (volatilityScore < 35) lights.push("Volatility regime low — risk environment manageable");
  if (pressure.dataSource === "live") lights.push("Live FRED data active — readings reflect current conditions");

  // Move-specific green lights
  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      if (p < 45) lights.push("Macro regime supports risk-on positioning");
      if (breadthScore < 45) lights.push("Broad market participation — not a narrow-leadership rally");
      if (creditScore < 40) lights.push("Credit market stability supports equity risk-taking");
      break;

    case "hold":
      if (p < 55) lights.push("No acute systemic trigger requiring defensive action");
      if (creditScore < 50) lights.push("Credit conditions not signaling forced selling");
      break;

    case "trim":
    case "sell":
      if (p > 55) lights.push(`Elevated pressure (${p}/100) supports reducing exposure`);
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
      if (p < 40) lights.push("Low macro pressure supports speculative allocation");
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
  pressure: FaultlinePressureOutput
): string[] {
  const flags: string[] = [];
  const p = pressure.overallPressure;
  const liquidityScore  = getVectorScore(pressure.vectors, "liquidity-stress");
  const creditScore     = getVectorScore(pressure.vectors, "credit-contagion");
  const volatilityScore = getVectorScore(pressure.vectors, "volatility-regime");
  const breadthScore    = getVectorScore(pressure.vectors, "market-breadth");
  const aiScore         = getVectorScore(pressure.vectors, "ai-bubble");
  const macroScore      = getVectorScore(pressure.vectors, "macro-sensitivity");

  // Universal red flags
  if (p >= 65) flags.push(`FAULTLINE Pressure Index at ${p}/100 — systemic stress elevated`);
  if (liquidityScore >= 55) flags.push("Liquidity stress rising — funding conditions tightening");
  if (creditScore >= 55) flags.push("Credit spreads widening — risk-off signal for leveraged names");
  if (volatilityScore >= 60) flags.push("Volatility regime elevated — position sizing risk increased");
  if (pressure.dataSource === "fallback") flags.push("Live data unavailable — readings based on fallback estimates");

  // Move-specific red flags
  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      if (p >= 55) flags.push("Macro regime does not support aggressive risk-on positioning");
      if (creditScore >= 50) flags.push("Credit stress present — leveraged and growth names at risk");
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
      if (p >= 55) flags.push("Elevated macro pressure — crypto historically amplifies drawdowns");
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
  pressure: FaultlinePressureOutput
): string[] {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");
  const liquidityScore = getVectorScore(pressure.vectors, "liquidity-stress");

  // Universal triggers always present
  const triggers: string[] = [
    "VIX breakout above 30 — volatility regime shift",
    "Credit spreads (HY) widening above 500bps — contagion signal",
    "Market breadth rollover — advance/decline line deteriorating",
    "Treasury yield shock — 10Y moves >50bps in a week",
    "FAULTLINE Pressure Index rises above 65/100",
  ];

  // Conditional triggers based on current conditions
  if (liquidityScore < 50) {
    triggers.push("Liquidity deterioration — SOFR or repo market stress emerging");
  }
  if (p < 60) {
    triggers.push("AI/speculation pressure spike — mega-cap concentration risk escalating");
  }
  if (creditScore < 60) {
    triggers.push("Recession probability increase — leading indicators deteriorating");
  }

  // Move-specific triggers
  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      triggers.push("Earnings guidance cuts in key sectors — fundamental deterioration");
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
      triggers.push("Regulatory action or exchange failure — crypto-specific systemic risk");
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
  pressure: FaultlinePressureOutput
): string[] {
  const watches: string[] = [
    "FAULTLINE Pressure Index — daily composite reading",
    "HY credit spread (BAMLH0A0HYM2) — leading risk-off indicator",
    "10Y Treasury yield — rate environment and duration risk",
    "VIX — volatility regime and market fear gauge",
  ];

  switch (moveType) {
    case "buy_add_risk":
    case "buy_specific_ticker":
      watches.push("S&P 500 advance/decline line — breadth confirmation");
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
      watches.push("Bitcoin dominance — crypto risk appetite indicator");
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
  pressure: FaultlinePressureOutput
): string {
  const p = pressure.overallPressure;
  const creditScore = getVectorScore(pressure.vectors, "credit-contagion");

  if (favorability >= 70) {
    switch (moveType) {
      case "buy_add_risk": return "Conditions support selective risk-on positioning. Prioritize quality names with strong balance sheets and regime alignment.";
      case "buy_specific_ticker": return "Macro regime is constructive for targeted equity exposure. Confirm ticker-level technicals align with regime.";
      case "hold": return "Current regime supports holding core positions. No systemic trigger requiring defensive action.";
      case "trim": return "Regime supports reducing exposure at current levels. Consider staged trimming to preserve optionality.";
      case "sell": return "Defensive posture is well-supported by current pressure readings. Systematic exit over 2–3 sessions reduces slippage risk.";
      case "hedge": return "Hedging conditions are favorable. Tail protection is cost-effective relative to current volatility regime.";
      case "raise_cash": return "Raising cash is well-aligned with current regime. Cash preserves optionality for re-entry at better risk-adjusted levels.";
      case "rotate_sectors": return "Sector rotation conditions are favorable. Defensive and quality sectors are outperforming in this regime.";
      case "increase_crypto": return "Macro conditions support speculative allocation. Size appropriately given crypto's volatility amplification.";
      case "reduce_crypto": return "Reducing crypto exposure is well-supported. Macro headwinds historically compress speculative asset premiums.";
    }
  }

  if (favorability >= 45) {
    switch (moveType) {
      case "buy_add_risk": return "Mixed regime — selective exposure only. Avoid overextended names and concentrate in quality with defensive characteristics.";
      case "buy_specific_ticker": return "Ticker-specific opportunity may exist, but macro regime is mixed. Staged entry with defined stop-loss recommended.";
      case "hold": return "Hold with active monitoring. Regime is transitional — review stop levels and position sizing.";
      case "trim": return "Partial trim is reasonable given current conditions. Maintain core position but reduce tail risk exposure.";
      case "sell": return "Selling into mixed conditions carries opportunity cost risk. Consider staged reduction rather than full exit.";
      case "hedge": return "Partial hedge is warranted. Full hedge may be premature — monitor for regime confirmation.";
      case "raise_cash": return "Modest cash raise is prudent. Avoid full de-risking — regime does not yet confirm systemic deterioration.";
      case "rotate_sectors": return "Rotation is feasible but timing is uncertain. Focus on relative strength within sectors rather than wholesale rotation.";
      case "increase_crypto": return "Crypto allocation increase carries elevated risk in current regime. Small position sizing recommended.";
      case "reduce_crypto": return "Partial crypto reduction is reasonable. Full exit may be premature if macro conditions stabilize.";
    }
  }

  // Low favorability
  switch (moveType) {
    case "buy_add_risk": return "Current regime is not supportive of adding risk. Wait for pressure to normalize before increasing exposure.";
    case "buy_specific_ticker": return "Macro headwinds are significant. Ticker-specific thesis must be very strong to overcome regime pressure.";
    case "hold": return "Holding in this regime requires active risk management. Review stop-loss levels and consider partial reduction.";
    case "trim": return "Trimming in a low-pressure environment may be premature. Ensure thesis has changed before reducing.";
    case "sell": return "Selling into low-pressure conditions carries high opportunity cost. Confirm fundamental deterioration before exiting.";
    case "hedge": return "Hedging in low-volatility conditions is expensive. Consider lighter hedge or wait for better entry.";
    case "raise_cash": return "Cash drag is significant in low-pressure environments. Maintain invested posture unless specific risk identified.";
    case "rotate_sectors": return "Low-pressure regime favors staying in current sector leaders. Rotation may underperform in this environment.";
    case "increase_crypto": return "Macro regime does not support speculative allocation increase. Wait for pressure to normalize.";
    case "reduce_crypto": return "Reducing crypto in a supportive macro environment may miss upside. Ensure conviction is high before reducing.";
  }

  return "Monitor conditions before acting. Current regime is transitional.";
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

// ── LLM Explanation ───────────────────────────────────────────

async function generateExplanation(
  input: TradeSimulationInput,
  output: Omit<TradeSimulationOutput, "explanation">,
  pressure: FaultlinePressureOutput
): Promise<string> {
  const moveLabel = MOVE_LABELS[input.moveType];
  const tfLabel = TIMEFRAME_LABELS[input.timeframe];
  const tickerNote = input.ticker ? ` for ${input.ticker.toUpperCase()}` : "";

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
- Move Favorability Score: ${output.moveFavorabilityScore}/100
- Favorable Setup Probability: ${output.favorableSetupProbability}%
- Adverse Pressure Probability: ${output.adversePressureProbability}%
- Risk Level: ${output.riskLevel}
- Confidence Level: ${output.confidenceLevel}
- Action Bias: ${output.actionBias}

Write a concise 3-4 sentence institutional-grade explanation of this simulation result. 
- Explain why the current market regime supports or challenges this specific move
- Reference specific pressure vectors (liquidity, credit, volatility, breadth) that are most relevant
- Conclude with a probability-weighted recommendation
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

  // Deterministic fallback
  const direction = output.moveFavorabilityScore >= 60 ? "supports" : output.moveFavorabilityScore >= 40 ? "partially supports" : "challenges";
  return `Current market regime ${direction} the "${moveLabel}" move over the ${tfLabel.toLowerCase()} timeframe. ` +
    `The FAULTLINE Pressure Index at ${output.marketCondition.pressureIndex}/100 with ${output.marketCondition.creditStress.toLowerCase()} credit stress and ` +
    `${output.marketCondition.liquidityCondition.toLowerCase()} liquidity conditions yields a ${output.moveFavorabilityScore}/100 favorability score. ` +
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

  const actionBias = computeActionBias(input.moveType, favorability, pressure);
  const bestVersionOfMove = computeBestVersion(input.moveType, favorability, pressure);
  const avoidAreas = computeAvoidAreas(input.moveType, pressure);
  const invalidationTriggers = computeInvalidationTriggers(input.moveType, pressure);
  const greenLights = computeGreenLights(input.moveType, pressure);
  const redFlags = computeRedFlags(input.moveType, pressure);
  const watchNext = computeWatchNext(input.moveType, pressure);

  const partial: Omit<TradeSimulationOutput, "explanation"> = {
    marketStatus: marketCondition.marketStatus,
    moveType: input.moveType,
    moveLabel: MOVE_LABELS[input.moveType],
    timeframe: input.timeframe,
    timeframeLabel: TIMEFRAME_LABELS[input.timeframe],
    ticker: input.ticker,
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
    generatedAt: new Date().toISOString(),
  };

  const explanation = await generateExplanation(input, partial, pressure);

  return { ...partial, explanation };
}
