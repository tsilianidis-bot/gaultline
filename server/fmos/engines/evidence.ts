// ============================================================
// FMOS Engine 6 — Evidence Engine
// (server/fmos/engines/evidence.ts)
//
// Organizes all market intelligence into evidence families.
// Applies diminishing returns when multiple signals in the
// same family agree (to prevent over-counting correlated data).
//
// Evidence Families:
//   1. macro       — FRED macro indicators
//   2. liquidity   — Funding/credit conditions
//   3. technical   — Price/volume/momentum signals
//   4. fundamental — Earnings/valuation/insider activity
//   5. sentiment   — Social/news/options sentiment
//   6. cross_asset — Bonds/commodities/FX
//   7. geopolitical — Geopolitical risk signals
//   8. news        — Breaking news/events
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//   - FMOSMacroData (from Data Acquisition Engine)
//
// Output: FMOSEvidenceOutput
// ============================================================

import { clamp, scoreToRisk } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type { FMOSMacroData } from "./dataAcquisition";
import type {
  FMOSEvidenceOutput,
  FMOSEvidenceFamily,
  FMOSEvidenceItem,
  EvidenceSignal,
} from "../types";

// ── Helper ────────────────────────────────────────────────────

function getVec(pressure: FaultlinePressureOutput, id: string, fallback = 30): number {
  return pressure.vectors.find(v => v.id === id)?.score ?? fallback;
}

// ── Signal Classification ─────────────────────────────────────

function scoreToSignal(score: number, inverted = false): EvidenceSignal {
  // For most vectors: high score = bearish (more stress)
  // inverted=true: high score = bullish
  const effectiveScore = inverted ? 100 - score : score;
  if (effectiveScore >= 65) return "bearish";
  if (effectiveScore >= 45) return "mixed";
  if (effectiveScore >= 30) return "neutral";
  return "bullish";
}

// ── Diminishing Returns ───────────────────────────────────────

/**
 * Apply diminishing returns when multiple items in the same family
 * have the same signal direction.
 * The 1st item contributes 100%, 2nd 70%, 3rd 50%, 4th+ 35%.
 */
function applyDiminishingReturns(items: FMOSEvidenceItem[]): FMOSEvidenceItem[] {
  const weights = [1.0, 0.70, 0.50, 0.35];
  const bullish = items.filter(i => i.signal === "bullish");
  const bearish = items.filter(i => i.signal === "bearish");
  const neutral = items.filter(i => i.signal === "neutral" || i.signal === "mixed");

  const applyWeights = (group: FMOSEvidenceItem[]) =>
    group.map((item, idx) => ({
      ...item,
      effectiveWeight: weights[Math.min(idx, weights.length - 1)] ?? 0.35,
      isCorrelated: idx > 0,
    }));

  return [
    ...applyWeights(bullish),
    ...applyWeights(bearish),
    ...applyWeights(neutral),
  ];
}

// ── Family Aggregation ────────────────────────────────────────

function aggregateFamily(items: FMOSEvidenceItem[]): {
  signal: EvidenceSignal;
  strength: number;
} {
  if (items.length === 0) return { signal: "neutral", strength: 0 };

  const weighted = applyDiminishingReturns(items);
  let bullScore = 0;
  let bearScore = 0;
  let totalWeight = 0;

  for (const item of weighted) {
    const w = item.effectiveWeight ?? 1.0;
    totalWeight += w;
    if (item.signal === "bullish") bullScore += item.strength * w;
    else if (item.signal === "bearish") bearScore += item.strength * w;
  }

  if (totalWeight === 0) return { signal: "neutral", strength: 0 };

  const netBull = bullScore / totalWeight;
  const netBear = bearScore / totalWeight;
  const strength = clamp(Math.round(Math.max(netBull, netBear)));

  if (netBear > netBull + 10) return { signal: "bearish", strength };
  if (netBull > netBear + 10) return { signal: "bullish", strength };
  if (Math.abs(netBull - netBear) <= 10 && strength > 30) return { signal: "mixed", strength };
  return { signal: "neutral", strength };
}

// ── Evidence Family Builders ──────────────────────────────────

function buildMacroFamily(
  pressure: FaultlinePressureOutput,
  macro: FMOSMacroData
): FMOSEvidenceFamily {
  const macroScore = getVec(pressure, "macro-sensitivity");
  const items: FMOSEvidenceItem[] = [];

  // Inflation
  if (macro.cpiYoY !== null) {
    const inflationStress = clamp(Math.round((macro.cpiYoY - 2) * 15));
    items.push({
      name: "CPI Inflation",
      family: "macro",
      signal: scoreToSignal(inflationStress),
      strength: inflationStress,
      description: `CPI YoY at ${macro.cpiYoY.toFixed(1)}% — ${macro.cpiYoY > 4 ? "above target, Fed hawkish" : macro.cpiYoY > 2.5 ? "elevated but declining" : "near target"}`,
      source: "FRED",
    });
  }

  // Unemployment
  if (macro.unemployment !== null) {
    const unempStress = clamp(Math.round((macro.unemployment - 3.5) * 20));
    items.push({
      name: "Unemployment Rate",
      family: "macro",
      signal: scoreToSignal(unempStress),
      strength: Math.max(unempStress, 0),
      description: `Unemployment at ${macro.unemployment.toFixed(1)}% — ${macro.unemployment > 5 ? "rising, recession signal" : macro.unemployment < 4 ? "near full employment" : "moderate"}`,
      source: "FRED",
    });
  }

  // Yield curve
  if (macro.yieldCurveSpread !== null) {
    const curveStress = clamp(Math.round((-macro.yieldCurveSpread - 0) / 2));
    items.push({
      name: "Yield Curve (10Y-2Y)",
      family: "macro",
      signal: macro.yieldCurveSpread < -50 ? "bearish" : macro.yieldCurveSpread > 0 ? "bullish" : "mixed",
      strength: curveStress,
      description: `Yield curve at ${macro.yieldCurveSpread > 0 ? "+" : ""}${macro.yieldCurveSpread}bps — ${macro.yieldCurveSpread < -50 ? "deeply inverted, recession warning" : macro.yieldCurveSpread < 0 ? "inverted" : "normal"}`,
      source: "FRED",
    });
  }

  // Fed Funds
  if (macro.fedFunds !== null) {
    const rateStress = clamp(Math.round((macro.fedFunds - 2) * 10));
    items.push({
      name: "Fed Funds Rate",
      family: "macro",
      signal: macro.fedFunds > 5 ? "bearish" : macro.fedFunds < 2 ? "bullish" : "neutral",
      strength: rateStress,
      description: `Fed Funds at ${macro.fedFunds.toFixed(2)}% — ${macro.fedFunds > 5 ? "restrictive, tightening pressure" : macro.fedFunds < 2 ? "accommodative" : "neutral"}`,
      source: "FRED",
    });
  }

  const { signal, strength } = aggregateFamily(items);
  return {
    name: "macro",
    label: "Macroeconomic",
    signal,
    strength,
    items,
    available: items.length > 0,
  };
}

function buildLiquidityFamily(
  pressure: FaultlinePressureOutput,
  macro: FMOSMacroData
): FMOSEvidenceFamily {
  const liquidityScore = getVec(pressure, "liquidity-stress");
  const creditScore = getVec(pressure, "credit-contagion");
  const items: FMOSEvidenceItem[] = [];

  // HY Credit Spread
  if (macro.hySpreadBps !== null) {
    const spreadStress = clamp(Math.round((macro.hySpreadBps - 200) / 6));
    items.push({
      name: "HY Credit Spread",
      family: "liquidity",
      signal: scoreToSignal(spreadStress),
      strength: spreadStress,
      description: `HY spread at ${Math.round(macro.hySpreadBps)}bps — ${macro.hySpreadBps > 500 ? "crisis level" : macro.hySpreadBps > 350 ? "elevated stress" : macro.hySpreadBps > 250 ? "moderate" : "benign"}`,
      source: "FRED",
    });
  }

  // Liquidity vector
  items.push({
    name: "Funding Liquidity",
    family: "liquidity",
    signal: scoreToSignal(liquidityScore),
    strength: liquidityScore,
    description: `Funding liquidity stress at ${liquidityScore}/100 — ${scoreToRisk(liquidityScore)} risk`,
    source: "FAULTLINE Engine",
  });

  // Credit contagion vector
  items.push({
    name: "Credit Contagion Risk",
    family: "liquidity",
    signal: scoreToSignal(creditScore),
    strength: creditScore,
    description: `Credit contagion risk at ${creditScore}/100 — ${scoreToRisk(creditScore)} risk`,
    source: "FAULTLINE Engine",
  });

  const { signal, strength } = aggregateFamily(items);
  return {
    name: "liquidity",
    label: "Liquidity & Credit",
    signal,
    strength,
    items,
    available: true,
  };
}

function buildTechnicalFamily(
  pressure: FaultlinePressureOutput
): FMOSEvidenceFamily {
  const volatilityScore = getVec(pressure, "volatility-regime");
  const p = pressure.overallPressure;
  const items: FMOSEvidenceItem[] = [];

  // Volatility regime
  items.push({
    name: "Volatility Regime",
    family: "technical",
    signal: scoreToSignal(volatilityScore),
    strength: volatilityScore,
    description: `Volatility regime score ${volatilityScore}/100 — ${volatilityScore > 65 ? "high vol, elevated risk" : volatilityScore < 30 ? "low vol, complacency risk" : "moderate vol"}`,
    source: "FAULTLINE Engine",
  });

  // Overall pressure as technical signal
  items.push({
    name: "FAULTLINE Pressure Index",
    family: "technical",
    signal: scoreToSignal(p),
    strength: p,
    description: `Systemic pressure at ${p}/100 — composite of all risk vectors`,
    source: "FAULTLINE Engine",
  });

  const { signal, strength } = aggregateFamily(items);
  return {
    name: "technical",
    label: "Technical",
    signal,
    strength,
    items,
    available: true,
  };
}

function buildFundamentalFamily(
  pressure: FaultlinePressureOutput
): FMOSEvidenceFamily {
  const aiScore = getVec(pressure, "ai-bubble");
  const macroScore = getVec(pressure, "macro-sensitivity");
  const items: FMOSEvidenceItem[] = [];

  // AI/Valuation concentration
  items.push({
    name: "Valuation / AI Concentration",
    family: "fundamental",
    signal: scoreToSignal(aiScore),
    strength: aiScore,
    description: `AI/tech valuation concentration at ${aiScore}/100 — ${aiScore > 65 ? "extreme concentration, bubble risk" : aiScore > 45 ? "elevated but manageable" : "healthy diversification"}`,
    source: "FAULTLINE Engine",
  });

  // Macro sensitivity (earnings proxy)
  items.push({
    name: "Earnings Sensitivity",
    family: "fundamental",
    signal: scoreToSignal(macroScore),
    strength: macroScore,
    description: `Macro/earnings sensitivity at ${macroScore}/100 — ${macroScore > 60 ? "high sensitivity to macro deterioration" : macroScore < 30 ? "earnings resilient" : "moderate sensitivity"}`,
    source: "FAULTLINE Engine",
  });

  const { signal, strength } = aggregateFamily(items);
  return {
    name: "fundamental",
    label: "Fundamental",
    signal,
    strength,
    items,
    available: true,
  };
}

function buildSentimentFamily(
  pressure: FaultlinePressureOutput
): FMOSEvidenceFamily {
  const p = pressure.overallPressure;
  const volatilityScore = getVec(pressure, "volatility-regime");
  const items: FMOSEvidenceItem[] = [];

  // Derived sentiment from pressure and volatility
  const sentimentScore = clamp(Math.round(p * 0.6 + volatilityScore * 0.4));
  items.push({
    name: "Market Sentiment",
    family: "sentiment",
    signal: scoreToSignal(sentimentScore),
    strength: sentimentScore,
    description: `Derived sentiment score ${sentimentScore}/100 — ${sentimentScore > 65 ? "fear dominant, capitulation risk" : sentimentScore < 30 ? "greed dominant, complacency risk" : "neutral sentiment"}`,
    source: "FAULTLINE Engine",
  });

  const { signal, strength } = aggregateFamily(items);
  return {
    name: "sentiment",
    label: "Sentiment",
    signal,
    strength,
    items,
    available: true,
  };
}

function buildCrossAssetFamily(
  pressure: FaultlinePressureOutput,
  macro: FMOSMacroData
): FMOSEvidenceFamily {
  const items: FMOSEvidenceItem[] = [];

  // Yield curve as cross-asset signal
  if (macro.yieldCurveSpread !== null) {
    const curveStress = clamp(Math.round((-macro.yieldCurveSpread) / 2));
    items.push({
      name: "Treasury Yield Curve",
      family: "cross_asset",
      signal: macro.yieldCurveSpread < -50 ? "bearish" : macro.yieldCurveSpread > 50 ? "bullish" : "neutral",
      strength: curveStress,
      description: `10Y-2Y spread at ${macro.yieldCurveSpread > 0 ? "+" : ""}${macro.yieldCurveSpread}bps`,
      source: "FRED",
    });
  }

  // SOFR as funding cost signal
  if (macro.sofr !== null) {
    const sofrStress = clamp(Math.round((macro.sofr - 2) * 12));
    items.push({
      name: "SOFR (Funding Cost)",
      family: "cross_asset",
      signal: macro.sofr > 5 ? "bearish" : macro.sofr < 2 ? "bullish" : "neutral",
      strength: sofrStress,
      description: `SOFR at ${macro.sofr.toFixed(2)}% — ${macro.sofr > 5 ? "elevated funding costs" : "moderate funding costs"}`,
      source: "FRED",
    });
  }

  const { signal, strength } = aggregateFamily(items);
  return {
    name: "cross_asset",
    label: "Cross-Asset",
    signal,
    strength,
    items,
    available: items.length > 0,
  };
}

// ── Contradiction Detection ───────────────────────────────────

function detectContradictions(families: FMOSEvidenceFamily[]): string[] {
  const contradictions: string[] = [];
  const available = families.filter(f => f.available && f.strength > 20);

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const a = available[i]!;
      const b = available[j]!;
      if (
        ((a.signal === "bullish" && b.signal === "bearish") ||
         (a.signal === "bearish" && b.signal === "bullish")) &&
        a.strength > 40 && b.strength > 40
      ) {
        contradictions.push(
          `${a.label} (${a.signal}) contradicts ${b.label} (${b.signal})`
        );
      }
    }
  }

  return contradictions.slice(0, 3);
}

// ── Main Evidence Engine Function ─────────────────────────────

/**
 * Organize all market intelligence into evidence families.
 *
 * @param pressure - Output from calculateFaultlinePressure()
 * @param macro    - Output from fetchMacroData()
 */
export function computeEvidence(
  pressure: FaultlinePressureOutput,
  macro: FMOSMacroData
): FMOSEvidenceOutput {
  const families: FMOSEvidenceFamily[] = [
    buildMacroFamily(pressure, macro),
    buildLiquidityFamily(pressure, macro),
    buildTechnicalFamily(pressure),
    buildFundamentalFamily(pressure),
    buildSentimentFamily(pressure),
    buildCrossAssetFamily(pressure, macro),
  ];

  const available = families.filter(f => f.available);
  const bullishFamilies = available.filter(f => f.signal === "bullish").length;
  const bearishFamilies = available.filter(f => f.signal === "bearish").length;

  // Overall signal
  let overallSignal: EvidenceSignal;
  if (bearishFamilies > bullishFamilies + 1) overallSignal = "bearish";
  else if (bullishFamilies > bearishFamilies + 1) overallSignal = "bullish";
  else if (bearishFamilies > 0 && bullishFamilies > 0) overallSignal = "mixed";
  else overallSignal = "neutral";

  // Overall strength (average of available families)
  const overallStrength = available.length > 0
    ? clamp(Math.round(available.reduce((s, f) => s + f.strength, 0) / available.length))
    : 0;

  // Diversity score: how many independent families agree
  const dominantSignalCount = Math.max(bullishFamilies, bearishFamilies);
  const diversityScore = clamp(Math.round((dominantSignalCount / Math.max(available.length, 1)) * 100));

  const contradictions = detectContradictions(families);

  const missingData: string[] = [];
  if (!macro.hySpreadBps) missingData.push("HY credit spread data unavailable");
  if (!macro.cpiYoY) missingData.push("CPI inflation data unavailable");

  return {
    families,
    bullishFamilies,
    bearishFamilies,
    overallStrength,
    overallSignal,
    diversityScore,
    contradictions,
    missingData,
  };
}
