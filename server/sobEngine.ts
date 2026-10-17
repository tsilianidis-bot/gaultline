/**
 * S.O.B.™ Engine — Signals of Breakdown
 *
 * Computes the S.O.B. level from existing FRED + regime data.
 * NOT a crash prediction system — measures accumulation of stress
 * across independent pillars.
 *
 * Pillars:
 *   1. Credit Stress      — HY credit spread (bps)
 *   2. Yield Curve        — inversion depth
 *   3. Breadth            — no input wired → always UNAVAILABLE
 *   4. Liquidity          — Fed funds rate vs neutral
 *   5. Momentum           — no SPY trend input wired → always UNAVAILABLE
 *   6. Volatility         — VIX level
 *
 * Fail-closed: a pillar whose required input is missing is UNAVAILABLE (never
 * active, never "normal", never a regime/pressure proxy). "Clear" is shown only
 * when every pillar has valid data; otherwise "Insufficient data".
 *
 * Level:
 *   0   = No active signals     → "Clear" (COMPLETE coverage only)
 *   1   = 1 pillar active       → "Awareness"
 *   2–3 = 2–3 pillars active    → "Evolving"
 *   4–5 = 4–5 pillars active    → "Elevated"
 *   6   = All pillars active    → "Critical"
 */

export interface SOBPillar {
  id: string;
  name: string;
  /** True only when this pillar's required input was present and crossed its threshold. */
  active: boolean;
  /**
   * False when the pillar's required input is missing (null/undefined/non-finite)
   * or the pillar has no real input at all. An unavailable pillar is never
   * active and never counts as "normal" — it is UNAVAILABLE.
   */
  available: boolean;
  value: string;
  description: string;
  severity: "low" | "medium" | "high";
}

/** Coverage of the six pillars: COMPLETE = every pillar had valid input. */
export type SOBCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";

export interface SOBResult {
  level: number;           // 0–6, count of ACTIVE pillars (only pillars with valid data can be active)
  label: string;           // "Clear" (COMPLETE coverage only) | "Insufficient data" | "Awareness" | "Evolving" | "Elevated" | "Critical"
  color: string;           // hex
  trend: "rising" | "stable" | "falling";
  confidence: number;      // 0–100
  pillars: SOBPillar[];
  /** COMPLETE only when every pillar has valid input; "Clear" is never shown otherwise. */
  coverage: SOBCoverage;
  availablePillarCount: number;
  unavailablePillars: string[];
  explanation: string;
  whatChanged: string;
  whatToWatchNext: string;
  generatedAt: number;
}

export interface SOBInput {
  /** FRED indicators — pass the output from the FRED proxy */
  fredIndicators?: Record<string, number | null>;
  /** Current regime label */
  regime?: string;
  /** Current pressure index (0–100) */
  pressureIndex?: number;
  /** Yield spread (10Y minus 2Y, percent), negative = inverted */
  yieldSpread?: number | null;
  /** Fed funds rate (percent) */
  fedFundsRate?: number | null;
  /** VIX level */
  vix?: number | null;
  /** Credit spread (HY OAS, basis points) */
  creditSpread?: number | null;
}

const LEVEL_LABELS = ["Clear", "Awareness", "Evolving", "Evolving", "Elevated", "Elevated", "Critical"];
const LEVEL_COLORS = ["#4B5563", "#00D4FF", "#F59E0B", "#FF8C00", "#FF2D55", "#FF2D55", "#8B0000"];
export const SOB_INSUFFICIENT_LABEL = "Insufficient data";
const UNAVAILABLE_COLOR = "#6B7280";
export const SOB_UNAVAILABLE_VALUE = "UNAVAILABLE";

const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

function unavailablePillar(id: string, name: string, reason: string): SOBPillar {
  return { id, name, active: false, available: false, value: SOB_UNAVAILABLE_VALUE, description: reason, severity: "low" };
}

export function computeSOB(input: SOBInput): SOBResult {
  const {
    pressureIndex = 30,
    yieldSpread = null,
    fedFundsRate = null,
    vix = null,
    creditSpread = null,
  } = input;

  const pillars: SOBPillar[] = [];

  // ── Pillar 1: Credit Stress ──────────────────────────────────────────────
  // Required input: HY credit spread (bps). No pressure-index proxy.
  if (valid(creditSpread)) {
    const creditActive = creditSpread > 450;
    pillars.push({
      id: "credit",
      name: "Credit Stress",
      active: creditActive,
      available: true,
      value: `${creditSpread.toFixed(0)} bps`,
      description: creditActive
        ? "Credit spreads are elevated, indicating lenders are demanding higher compensation for risk."
        : "Credit spreads are within normal range. No significant stress in lending conditions.",
      severity: creditActive ? (creditSpread > 600 ? "high" : "medium") : "low",
    });
  } else {
    pillars.push(unavailablePillar("credit", "Credit Stress", "HY credit spread data is unavailable, so this pillar cannot be assessed."));
  }

  // ── Pillar 2: Yield Curve ────────────────────────────────────────────────
  // Required input: 10Y-2Y spread (percent).
  if (valid(yieldSpread)) {
    const yieldActive = yieldSpread < -0.25;
    pillars.push({
      id: "yield-curve",
      name: "Yield Curve",
      active: yieldActive,
      available: true,
      value: `${yieldSpread >= 0 ? "+" : ""}${yieldSpread.toFixed(2)}%`,
      description: yieldActive
        ? `The yield curve is inverted (10Y-2Y = ${yieldSpread.toFixed(2)}%). Historically, sustained inversion precedes economic slowdowns.`
        : "The yield curve is not inverted. This pillar is not contributing to S.O.B.",
      severity: yieldActive ? (yieldSpread < -0.75 ? "high" : "medium") : "low",
    });
  } else {
    pillars.push(unavailablePillar("yield-curve", "Yield Curve", "10Y-2Y spread data is unavailable, so this pillar cannot be assessed."));
  }

  // ── Pillar 3: Breadth Deterioration ─────────────────────────────────────
  // No advance/decline or %-above-200DMA input exists in FAULTLINE, so breadth
  // is always UNAVAILABLE (never inferred from regime or pressure).
  pillars.push(unavailablePillar("breadth", "Breadth Deterioration", "No market-breadth input (advance/decline or % above 200-day MA) is available, so this pillar cannot be assessed."));

  // ── Pillar 4: Liquidity Tightening ───────────────────────────────────────
  // Required input: Fed funds rate (percent).
  if (valid(fedFundsRate)) {
    const liquidityActive = fedFundsRate > 4.5;
    pillars.push({
      id: "liquidity",
      name: "Liquidity Tightening",
      active: liquidityActive,
      available: true,
      value: `Fed Funds: ${fedFundsRate.toFixed(2)}%`,
      description: liquidityActive
        ? `The Fed Funds rate at ${fedFundsRate.toFixed(2)}% is in restrictive territory, reducing the flow of money through financial markets.`
        : "Monetary conditions are not significantly restrictive. Liquidity is flowing normally.",
      severity: liquidityActive ? (fedFundsRate > 5.25 ? "high" : "medium") : "low",
    });
  } else {
    pillars.push(unavailablePillar("liquidity", "Liquidity Tightening", "Fed funds data is unavailable, so this pillar cannot be assessed."));
  }

  // ── Pillar 5: Momentum Breakdown ─────────────────────────────────────────
  // Requires an SPY trend input, which is not wired; never inferred from the
  // regime label or pressure index.
  pillars.push(unavailablePillar("momentum", "Momentum Breakdown", "No price-momentum (SPY trend) input is available, so this pillar cannot be assessed."));

  // ── Pillar 6: Volatility Expansion ───────────────────────────────────────
  // Required input: VIX level. No pressure-index proxy.
  if (valid(vix)) {
    const volActive = vix > 25;
    pillars.push({
      id: "volatility",
      name: "Volatility Expansion",
      active: volActive,
      available: true,
      value: `VIX ${vix.toFixed(1)}`,
      description: volActive
        ? `Volatility is elevated (VIX ${vix.toFixed(1)}). High volatility indicates uncertainty and can amplify both gains and losses.`
        : "Volatility is within normal range. Markets are not showing signs of fear or panic.",
      severity: volActive ? (vix > 35 ? "high" : "medium") : "low",
    });
  } else {
    pillars.push(unavailablePillar("volatility", "Volatility Expansion", "VIX data is unavailable, so this pillar cannot be assessed."));
  }

  // ── Coverage + level ─────────────────────────────────────────────────────
  const availablePillars = pillars.filter(p => p.available);
  const unavailablePillars = pillars.filter(p => !p.available).map(p => p.name);
  const coverage: SOBCoverage =
    availablePillars.length === pillars.length ? "COMPLETE" : availablePillars.length === 0 ? "UNAVAILABLE" : "PARTIAL";
  const activePillars = pillars.filter(p => p.active);
  const level = activePillars.length;
  // "Clear" requires every pillar to have valid data. With missing pillars and
  // no active signal, the honest answer is "Insufficient data", not Clear.
  const insufficient = level === 0 && coverage !== "COMPLETE";
  const label = insufficient ? SOB_INSUFFICIENT_LABEL : (LEVEL_LABELS[level] ?? "Critical");
  const color = insufficient ? UNAVAILABLE_COLOR : (LEVEL_COLORS[level] ?? "#8B0000");

  // Confidence: higher when more data is available
  const dataPoints = [creditSpread, yieldSpread, fedFundsRate, vix].filter(valid).length;
  const confidence = Math.round(50 + (dataPoints / 4) * 40 + (level > 0 ? 5 : 0));

  // Trend: proxy from pressure index direction
  const trend: SOBResult["trend"] = pressureIndex > 60 ? "rising" : pressureIndex < 35 ? "falling" : "stable";

  const coverageNote = coverage === "COMPLETE"
    ? ""
    : ` Only ${availablePillars.length} of ${pillars.length} pillars have data; unavailable: ${unavailablePillars.join(", ")}.`;

  const explanations: Record<string, string> = {
    Clear: "No S.O.B. pillars are currently active, and every pillar has current data: credit, yield curve, breadth, liquidity, momentum, and volatility are all within normal parameters.",
    [SOB_INSUFFICIENT_LABEL]: `No assessed S.O.B. pillar is active, but S.O.B. cannot be called Clear.${coverageNote}`,
    Awareness: `One S.O.B. pillar is active (${activePillars[0]?.name ?? ""}). This is an awareness signal — conditions warrant monitoring but do not indicate elevated stress.${coverageNote}`,
    Evolving: `${level} S.O.B. pillars are active: ${activePillars.map(p => p.name).join(", ")}. Conditions are evolving. Multiple independent stress signals are present simultaneously, which historically precedes increased market volatility.${coverageNote}`,
    Elevated: `${level} S.O.B. pillars are active: ${activePillars.map(p => p.name).join(", ")}. Stress is elevated across multiple market dimensions. This level of simultaneous signal activation warrants heightened awareness.${coverageNote}`,
    Critical: "All 6 S.O.B. pillars are active. This represents the highest level of measured market stress across credit, yield curve, breadth, liquidity, momentum, and volatility. Conditions are historically consistent with significant market stress.",
  };

  const explanation = explanations[label] ?? explanations.Evolving;

  const whatChanged = level === 0
    ? (insufficient
        ? "No assessed pillar has activated. Pillars without data are UNAVAILABLE and are not counted as normal."
        : "No new signals have activated. Market conditions remain within normal parameters.")
    : `${activePillars.filter(p => p.severity === "high").length > 0 ? "High-severity signals are active: " + activePillars.filter(p => p.severity === "high").map(p => p.name).join(", ") + ". " : ""}The most recently activated pillar is ${activePillars[activePillars.length - 1]?.name ?? "unknown"}.`;

  const watchNextMap: Record<string, string> = {
    Clear: "Monitor credit spreads and the yield curve for early signs of stress developing.",
    [SOB_INSUFFICIENT_LABEL]: "S.O.B. becomes assessable once every pillar has data. Meanwhile, monitor the available pillars for activation.",
    Awareness: `Watch the ${activePillars[0]?.name ?? "active"} pillar for escalation. If a second pillar activates, the S.O.B. level will rise to Evolving.`,
    Evolving: "Monitor whether additional pillars activate. Watch for credit spread widening, VIX expansion, or further breadth deterioration as potential escalation signals.",
    Elevated: "Watch for resolution in the most severe active pillars. Credit spread tightening and VIX normalization are typically the first signs of stress reduction.",
    Critical: "Monitor for any signs of policy response (Fed pivot, fiscal stimulus) or credit market stabilization that could begin reducing active pillars.",
  };

  const whatToWatchNext = watchNextMap[label] ?? watchNextMap.Evolving;

  return {
    level,
    label,
    color,
    trend,
    confidence,
    pillars,
    coverage,
    availablePillarCount: availablePillars.length,
    unavailablePillars,
    explanation,
    whatChanged,
    whatToWatchNext,
    generatedAt: Date.now(),
  };
}
