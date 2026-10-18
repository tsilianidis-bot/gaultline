// ============================================================
// FMOS Engine 2 — Market DNA Engine
// (server/fmos/engines/marketDNA.ts)
//
// Determines the long-term structural market environment.
// This is the "big picture" context that frames all other
// engine outputs.
//
// Unlike the Regime Engine (which classifies current pressure),
// the Market DNA Engine identifies the multi-month structural
// cycle: Recovery, Expansion, Late Cycle, Bubble, etc.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//   - FMOSMacroData (from Data Acquisition Engine)
//
// Output: FMOSMarketDNA
// ============================================================

import { clamp } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import { hasVerifiedFmosMacroInputs, type FMOSMacroData } from "./dataAcquisition";
import type { FMOSMarketDNA, MarketDNARegime } from "../types";

// ── DNA Classification Logic ──────────────────────────────────

interface DNACandidate {
  regime: MarketDNARegime;
  score: number;
  characteristics: string[];
  portfolioImplications: string[];
  historicalFrequency: number; // % of time markets spend in this regime
  typicalTransitionTriggers: string[];
  estimatedDuration: string;
}

const REQUIRED_PRESSURE_VECTOR_IDS = [
  "liquidity-stress",
  "credit-contagion",
  "volatility-regime",
  "macro-sensitivity",
  "market-breadth",
  "ai-bubble",
] as const;

function hasCompletePressureInputs(pressure: FaultlinePressureOutput): boolean {
  return Number.isFinite(pressure.overallPressure)
    && pressure.overallPressure >= 0
    && pressure.overallPressure <= 100
    && typeof pressure.regime === "string"
    && pressure.regime.length > 0
    && REQUIRED_PRESSURE_VECTOR_IDS.every(id => {
      const vector = pressure.vectors.find(candidate => candidate.id === id);
      return vector !== undefined
        && vector.dataStatus !== "unavailable"
        && Number.isFinite(vector.score)
        && vector.score >= 0
        && vector.score <= 100;
    });
}

function unavailableMarketDNA(reason: string): FMOSMarketDNA {
  return {
    available: false,
    unavailableReason: reason,
    currentDNA: null,
    confidence: null,
    historicalFrequency: null,
    characteristics: [],
    portfolioImplications: [],
    estimatedDuration: null,
    typicalTransitionTriggers: [],
  };
}

/**
 * Score each possible DNA regime based on current conditions.
 * Returns all candidates sorted by score (highest = most likely).
 */
function scoreDNACandidates(
  pressure: FaultlinePressureOutput,
  macro: FMOSMacroData
): DNACandidate[] {
  const p = pressure.overallPressure;
  const getVec = (id: typeof REQUIRED_PRESSURE_VECTOR_IDS[number]): number => {
    const vector = pressure.vectors.find(candidate => candidate.id === id);
    if (!vector || !Number.isFinite(vector.score)) {
      throw new Error(`Required canonical pressure vector unavailable: ${id}`);
    }
    return vector.score;
  };

  const liquidityScore = getVec("liquidity-stress");
  const creditScore = getVec("credit-contagion");
  const aiScore = getVec("ai-bubble");
  const macroScore = getVec("macro-sensitivity");
  const volatilityScore = getVec("volatility-regime");

  // computeMarketDNA gates this function with hasVerifiedFmosMacroInputs.
  // Assertions preserve that requirement; they do not introduce defaults.
  const cpi = macro.cpiYoY!;
  const unemployment = macro.unemployment!;
  const yieldCurve = macro.yieldCurveSpread!;
  const fedFunds = macro.fedFunds!;

  const candidates: DNACandidate[] = [
    {
      regime: "Recovery",
      score: clamp(
        Math.round(
          (p < 40 ? 30 : 0) +
          (unemployment > 5 ? 20 : 0) +
          (liquidityScore < 40 ? 20 : 0) +
          (yieldCurve > 0 ? 15 : 0) +
          (cpi < 3 ? 15 : 0)
        )
      ),
      characteristics: [
        "Unemployment declining from cycle highs",
        "Credit conditions improving",
        "Earnings recovering from trough",
        "Risk appetite returning gradually",
        "Yield curve normalizing",
      ],
      portfolioImplications: [
        "Cyclicals and small caps outperform",
        "Credit spreads compressing — high yield attractive",
        "Financials benefit from improving credit quality",
        "Avoid defensive positioning — recovery rewards risk",
      ],
      historicalFrequency: 15,
      typicalTransitionTriggers: ["Fed tightening cycle begins", "Inflation reaccelerates"],
      estimatedDuration: "12–24 months",
    },
    {
      regime: "Expansion",
      score: clamp(
        Math.round(
          (p >= 20 && p <= 45 ? 35 : 0) +
          (unemployment < 4.5 ? 20 : 0) +
          (cpi >= 2 && cpi <= 4 ? 20 : 0) +
          (liquidityScore < 50 ? 15 : 0) +
          (yieldCurve > -50 ? 10 : 0)
        )
      ),
      characteristics: [
        "GDP growth above trend",
        "Corporate earnings expanding",
        "Employment near full capacity",
        "Moderate inflation",
        "Credit conditions benign",
      ],
      portfolioImplications: [
        "Broad equity exposure rewarded",
        "Growth and quality names lead",
        "Moderate duration in fixed income",
        "Diversification across sectors",
      ],
      historicalFrequency: 35,
      typicalTransitionTriggers: ["Fed overtightening", "Inflation shock", "External shock"],
      estimatedDuration: "24–60 months",
    },
    {
      regime: "Late Cycle",
      score: clamp(
        Math.round(
          (p >= 40 && p <= 65 ? 30 : 0) +
          (unemployment < 4 ? 15 : 0) +
          (cpi > 3 ? 20 : 0) +
          (yieldCurve < 0 ? 20 : 0) +
          (fedFunds > 4 ? 15 : 0)
        )
      ),
      characteristics: [
        "Fed tightening cycle underway or complete",
        "Yield curve flat or inverted",
        "Inflation above target",
        "Credit spreads beginning to widen",
        "Earnings growth decelerating",
      ],
      portfolioImplications: [
        "Reduce duration risk",
        "Rotate toward quality and defensives",
        "Increase cash allocation",
        "Commodities and energy may outperform",
      ],
      historicalFrequency: 20,
      typicalTransitionTriggers: ["Credit event", "Earnings recession", "Liquidity shock"],
      estimatedDuration: "6–18 months",
    },
    {
      regime: "Bubble",
      score: clamp(
        Math.round(
          (aiScore > 65 ? 40 : 0) +
          (p < 45 ? 15 : 0) +
          (volatilityScore < 30 ? 20 : 0) +
          (cpi < 4 ? 10 : 0) +
          (liquidityScore < 40 ? 15 : 0)
        )
      ),
      characteristics: [
        "Valuations at historical extremes",
        "Narrow market leadership (concentration risk)",
        "Speculative activity elevated",
        "Low volatility masking underlying risk",
        "AI/tech concentration at cycle highs",
      ],
      portfolioImplications: [
        "Concentration risk requires active management",
        "Tail hedges warranted",
        "Avoid momentum chasing",
        "Quality over growth at extremes",
      ],
      historicalFrequency: 8,
      typicalTransitionTriggers: ["Valuation mean reversion", "Liquidity withdrawal", "Catalyst event"],
      estimatedDuration: "6–24 months",
    },
    {
      regime: "Correction",
      score: clamp(
        Math.round(
          (p >= 45 && p <= 65 ? 25 : 0) +
          (volatilityScore > 50 ? 25 : 0) +
          (creditScore >= 40 && creditScore <= 65 ? 20 : 0) +
          (liquidityScore >= 40 && liquidityScore <= 65 ? 20 : 0) +
          (yieldCurve < -50 ? 10 : 0)
        )
      ),
      characteristics: [
        "Equity markets in 10–20% drawdown",
        "Volatility elevated but not extreme",
        "Credit spreads widening moderately",
        "Sentiment deteriorating",
        "Breadth narrowing",
      ],
      portfolioImplications: [
        "Defensive positioning reduces drawdown",
        "Selective buying on weakness in quality names",
        "Increase cash buffer",
        "Avoid catching falling knives",
      ],
      historicalFrequency: 12,
      typicalTransitionTriggers: ["Fed pivot", "Earnings stabilization", "Valuation reset"],
      estimatedDuration: "2–6 months",
    },
    {
      regime: "Bear Market",
      score: clamp(
        Math.round(
          (p >= 65 ? 35 : 0) +
          (creditScore > 65 ? 25 : 0) +
          (liquidityScore > 65 ? 20 : 0) +
          (volatilityScore > 65 ? 20 : 0)
        )
      ),
      characteristics: [
        "Equity markets in 20%+ drawdown",
        "Credit conditions severely tightened",
        "Liquidity stress elevated",
        "Recession risk rising",
        "Earnings in contraction",
      ],
      portfolioImplications: [
        "Capital preservation is primary objective",
        "Treasuries and gold as safe havens",
        "Significant cash allocation",
        "Avoid leverage and illiquid assets",
      ],
      historicalFrequency: 10,
      typicalTransitionTriggers: ["Policy intervention", "Valuation capitulation", "Economic stabilization"],
      estimatedDuration: "6–24 months",
    },
    {
      regime: "Recession",
      score: clamp(
        Math.round(
          (p >= 70 ? 30 : 0) +
          (unemployment > 5 ? 25 : 0) +
          (cpi < 2 ? 15 : 0) +
          (creditScore > 70 ? 20 : 0) +
          (yieldCurve < -100 ? 10 : 0)
        )
      ),
      characteristics: [
        "GDP contracting for 2+ quarters",
        "Unemployment rising",
        "Corporate earnings in deep contraction",
        "Credit markets severely stressed",
        "Consumer spending declining",
      ],
      portfolioImplications: [
        "Maximum defensive positioning",
        "Long-duration Treasuries outperform",
        "Avoid cyclicals and financials",
        "Cash is king",
      ],
      historicalFrequency: 8,
      typicalTransitionTriggers: ["Fiscal stimulus", "Fed easing cycle", "Inventory cycle bottom"],
      estimatedDuration: "6–18 months",
    },
    {
      regime: "Stagflation",
      score: clamp(
        Math.round(
          (cpi > 5 ? 35 : 0) +
          (unemployment > 5 ? 20 : 0) +
          (macroScore > 60 ? 25 : 0) +
          (yieldCurve < 0 ? 10 : 0) +
          (p >= 55 ? 10 : 0)
        )
      ),
      characteristics: [
        "High inflation with stagnant growth",
        "Fed in impossible position",
        "Real wages declining",
        "Commodity prices elevated",
        "Policy effectiveness limited",
      ],
      portfolioImplications: [
        "Commodities and real assets outperform",
        "TIPS and inflation-linked bonds",
        "Avoid long-duration fixed income",
        "Energy and materials sectors favored",
      ],
      historicalFrequency: 5,
      typicalTransitionTriggers: ["Supply shock resolution", "Demand destruction", "Policy normalization"],
      estimatedDuration: "12–36 months",
    },
    {
      regime: "Disinflation",
      score: clamp(
        Math.round(
          (cpi > 2 && cpi < 4 && macroScore < 40 ? 30 : 0) +
          (p < 45 ? 20 : 0) +
          (creditScore < 40 ? 20 : 0) +
          (yieldCurve > -30 ? 15 : 0) +
          (unemployment < 5 ? 15 : 0)
        )
      ),
      characteristics: [
        "Inflation declining toward target",
        "Fed easing or on hold",
        "Growth moderating but positive",
        "Credit conditions improving",
        "Risk assets recovering",
      ],
      portfolioImplications: [
        "Duration extension rewarded",
        "Growth stocks benefit from lower rates",
        "Broad equity participation",
        "Credit spreads compressing",
      ],
      historicalFrequency: 15,
      typicalTransitionTriggers: ["Inflation re-acceleration", "Growth shock", "External event"],
      estimatedDuration: "12–24 months",
    },
    {
      regime: "Liquidity Expansion",
      score: clamp(
        Math.round(
          (liquidityScore < 30 ? 35 : 0) +
          (creditScore < 30 ? 25 : 0) +
          (p < 35 ? 20 : 0) +
          (volatilityScore < 30 ? 20 : 0)
        )
      ),
      characteristics: [
        "Central bank accommodation",
        "Credit spreads at cycle lows",
        "Risk appetite elevated",
        "Asset prices broadly rising",
        "Leverage increasing",
      ],
      portfolioImplications: [
        "Risk-on positioning rewarded",
        "High yield and credit outperform",
        "Equities broadly rising",
        "Volatility selling strategies work",
      ],
      historicalFrequency: 12,
      typicalTransitionTriggers: ["Policy normalization", "Inflation shock", "Credit event"],
      estimatedDuration: "12–36 months",
    },
    {
      regime: "Liquidity Contraction",
      score: clamp(
        Math.round(
          (liquidityScore > 60 ? 35 : 0) +
          (creditScore > 55 ? 25 : 0) +
          (fedFunds > 5 ? 20 : 0) +
          (yieldCurve < -50 ? 20 : 0)
        )
      ),
      characteristics: [
        "Quantitative tightening underway",
        "Credit conditions tightening",
        "Yield curve inverted",
        "Risk appetite declining",
        "Leverage unwinding",
      ],
      portfolioImplications: [
        "Reduce risk exposure",
        "Short duration in fixed income",
        "Quality over growth",
        "Increase cash and defensive assets",
      ],
      historicalFrequency: 10,
      typicalTransitionTriggers: ["Fed pivot", "Credit event forces policy response", "Recession"],
      estimatedDuration: "6–18 months",
    },
  ];

  return candidates.sort((a, b) => b.score - a.score);
}

// ── Main DNA Engine Function ──────────────────────────────────

/**
 * Determine the current Market DNA (long-term structural environment).
 *
 * @param pressure - Output from calculateFaultlinePressure()
 * @param macro    - Output from fetchMacroData()
 */
export function computeMarketDNA(
  pressure: FaultlinePressureOutput,
  macro: FMOSMacroData
): FMOSMarketDNA {
  if (!hasVerifiedFmosMacroInputs(macro)) {
    return unavailableMarketDNA(macro.unavailableReason ?? "Complete verified FRED macro inputs are required for Market DNA");
  }
  if (!hasCompletePressureInputs(pressure)) {
    return unavailableMarketDNA("Complete canonical Pressure inputs are required for Market DNA");
  }

  const candidates = scoreDNACandidates(pressure, macro);
  const top = candidates[0]!;
  const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);

  // Confidence: how dominant is the top candidate vs alternatives?
  const confidence = totalScore > 0
    ? clamp(Math.round((top.score / totalScore) * 200))
    : 40;

  return {
    available: true,
    unavailableReason: null,
    currentDNA: top.regime,
    confidence: null,
    historicalFrequency: null,
    characteristics: [
      `DERIVED model classification: ${top.regime}; canonical Pressure ${pressure.overallPressure}/100.`,
      `Verified FRED inputs: CPI YoY ${macro.cpiYoY}%, unemployment ${macro.unemployment}%, Fed Funds ${macro.fedFunds}%.`,
      `Verified Treasury-curve calculation: ${macro.yieldCurveSpread} basis points. Reference dates are retained separately; no publication time is invented.`,
    ],
    portfolioImplications: top.portfolioImplications.map(text => `MODEL_ASSUMPTION — ${text}`),
    estimatedDuration: null,
    typicalTransitionTriggers: [],
  };
}
