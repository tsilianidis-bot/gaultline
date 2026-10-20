// ============================================================
// FAULTLINE — Pressure Engine  (server/pressure/engine.ts)
//
// Calculates the FAULTLINE PRESSURE INDEX (0–100) from live
// FRED macroeconomic data.  Each risk vector is scored 0–100
// and weighted into an overall composite.
//
// Design principles:
//  • Mirror the client-side engine vocabulary (same regimes,
//    same FRED series IDs) so the two systems stay coherent.
//  • All scoring functions are pure and independently testable.
//  • Extensible: add new vectors by pushing to VECTOR_CONFIGS.
// ============================================================

import { log } from "../logger";
import { fetchFredBulk } from "../fredClient";

// ── Server-level snapshot cache ───────────────────────────────
//
// Preserves the most recent verified (live) snapshot so that:
//  1. A FRED outage returns a clearly-labelled stale snapshot
//     rather than a fallback-only estimate.
//  2. The engine automatically returns to LIVE on the next
//     successful refresh — no page reload or redeployment needed.
//
let _lastLiveSnapshot: FaultlinePressureOutput | null = null;
let _lastLiveSnapshotAt: number | null = null;


// ── Types ────────────────────────────────────────────────────

export type PressureLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

/**
 * Data freshness status for a risk vector or output field.
 * - live: refreshed from a live or near-live external source
 * - delayed: sourced from a provider with known publication lag
 * - cached: served from server-side cache, not freshly fetched
 * - stale: cache is older than expected refresh window
 * - fallback: live source failed; using last known good value
 * - static: hardcoded constant or model estimate, not fetched
 * - unavailable: source is down and no fallback is available
 */
export type DataStatus = "live" | "delayed" | "cached" | "stale" | "fallback" | "static" | "unavailable";

export interface RiskVector {
  /** Machine-readable identifier */
  id: string;
  /** Display name */
  label: string;
  /** Short description of what this vector measures */
  description: string;
  /** Score 0–100 (higher = more stress) */
  score: number;
  /** Qualitative level derived from score */
  level: PressureLevel;
  /** Key driver sentence for the UI */
  driver: string;
  /** Direction of recent change */
  trend: "rising" | "falling" | "stable";
  /** Weight used in composite (0–1, all weights sum to 1) */
  weight: number;
  /** The raw FRED value(s) that drove this score */
  rawInputs: Record<string, number | null>;
  /** Data freshness status for this vector's inputs */
  dataStatus: DataStatus;
  /** Primary data source for this vector */
  source: string;
  /** If dataStatus is static/fallback/stale, explains why */
  fallbackReason?: string;
  /** FRED observation date behind each raw input (Phase 1 provenance) */
  observationDates?: Record<string, string | null>;
  /** Earliest observation behind this vector. Null when none was recorded. */
  observedAt?: string | null;
}

export interface HistoricalAnalog {
  year: number;
  label: string;
  similarity: number; // 0–100
  description: string;
}

export interface PressureAlert {
  severity: "critical" | "high" | "elevated" | "moderate";
  title: string;
  detail: string;
}

export interface FaultlinePressureOutput {
  /** Composite pressure index 0–100 */
  overallPressure: number;
  /** Regime code */
  regime: string;
  /** Qualitative level */
  level: PressureLevel;
  /** Individual risk vectors */
  vectors: RiskVector[];
  /** Top risk alerts derived from vectors */
  alerts: PressureAlert[];
  /** Best-matching historical analog */
  topAnalog: HistoricalAnalog;
  /** All analog matches */
  analogs: HistoricalAnalog[];
  /** ISO timestamp */
  timestamp: string;
  /** Whether live FRED data was used */
  dataSource: "live" | "fallback";
  /** ISO timestamp of the most recent data refresh */
  lastUpdated: string;
  /**
   * Change from the prior recorded reading (current overallPressure minus
   * the previous run's overallPressure). Null when no prior run exists.
   * Both values are on the canonical 0–100 scale.
   */
  priorPressure: number | null;
  /** Input verification / provenance (fail-closed loader). */
  verification?: PressureVerification;
}

// ── Helpers ──────────────────────────────────────────────────

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Linear interpolation: map input in [inMin, inMax] → [outMin, outMax] */
function linearMap(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const ratio = clamp((v - inMin) / (inMax - inMin), 0, 1);
  return outMin + ratio * (outMax - outMin);
}

/** Map a 0–100 pressure score to a PressureLevel */
function scoreToLevel(score: number): PressureLevel {
  if (score >= 80) return "Critical";
  if (score >= 65) return "High";
  if (score >= 45) return "Elevated";
  if (score >= 25) return "Moderate";
  return "Low";
}

// ── Individual vector scoring functions ──────────────────────
// Each function returns a score 0–100 and a driver string.

/**
 * LIQUIDITY STRESS
 * Inputs: HY credit spread (BAMLH0A0HYM2), SOFR (SOFR)
 * Logic: HY spread is the primary signal — wide spreads indicate
 *        credit markets are demanding a large risk premium, which
 *        historically precedes liquidity crises.
 */
function scoreLiquidityStress(
  hySpread: number | null,
  sofr: number | null
): { score: number; driver: string; trend: "rising" | "falling" | "stable" } {
  // HY spread: baseline ~300bps, crisis >700bps
  const hyScore = hySpread !== null
    ? linearMap(hySpread, 200, 800, 0, 100)
    : 40; // fallback moderate

  // SOFR: high rates tighten liquidity
  const sofrScore = sofr !== null
    ? linearMap(sofr, 2, 6, 0, 60)
    : 30;

  const score = Math.round(hyScore * 0.65 + sofrScore * 0.35);

  let driver = "Liquidity conditions within normal range";
  if (hySpread !== null) {
    if (hySpread > 600) driver = `HY spreads at ${hySpread.toFixed(0)}bps — severe credit stress`;
    else if (hySpread > 450) driver = `HY spreads elevated at ${hySpread.toFixed(0)}bps — tightening conditions`;
    else if (hySpread > 350) driver = `HY spreads widening at ${hySpread.toFixed(0)}bps — watch for contagion`;
    else driver = `HY spreads contained at ${hySpread.toFixed(0)}bps`;
  }

  const trend: "rising" | "falling" | "stable" =
    hySpread !== null && hySpread > 400 ? "rising" : "stable";

  return { score: clamp(score, 0, 100), driver, trend };
}

/**
 * CREDIT CONTAGION RISK
 * Inputs: HY spread, 10Y Treasury yield (DGS10), unemployment (UNRATE)
 * Logic: Credit contagion occurs when spreads widen while rates are
 *        elevated and labor markets soften — the classic pre-recession
 *        credit cycle deterioration.
 */
function scoreCreditContagion(
  hySpread: number | null,
  tsy10y: number | null,
  unemployment: number | null
): { score: number; driver: string; trend: "rising" | "falling" | "stable" } {
  const spreadScore = hySpread !== null ? linearMap(hySpread, 200, 700, 0, 80) : 35;
  const rateScore = tsy10y !== null ? linearMap(tsy10y, 2, 6, 0, 50) : 25;
  const laborScore = unemployment !== null ? linearMap(unemployment, 3.5, 7, 0, 60) : 25;

  const score = Math.round(spreadScore * 0.5 + rateScore * 0.25 + laborScore * 0.25);

  let driver = "Credit conditions stable";
  if (hySpread !== null && tsy10y !== null) {
    if (hySpread > 500 && tsy10y > 4.5) driver = `Dual pressure: HY ${hySpread.toFixed(0)}bps + 10Y at ${tsy10y.toFixed(2)}% — contagion risk elevated`;
    else if (hySpread > 400) driver = `Credit spreads widening at ${hySpread.toFixed(0)}bps — monitor for contagion`;
    else driver = `Credit spreads at ${hySpread.toFixed(0)}bps, rates at ${tsy10y.toFixed(2)}%`;
  }

  const trend: "rising" | "falling" | "stable" =
    hySpread !== null && hySpread > 380 ? "rising" : "stable";

  return { score: clamp(score, 0, 100), driver, trend };
}

/**
 * VOLATILITY REGIME
 * Inputs: 10Y yield (DGS10), yield curve spread (DGS10 - DGS2)
 * Logic: We use the yield curve as a volatility proxy — inverted
 *        curves historically precede equity volatility spikes and
 *        recessions.  Steep curves in rising-rate environments also
 *        signal term-premium uncertainty.
 */
function scoreVolatilityRegime(
  tsy10y: number | null,
  tsy2y: number | null
): { score: number; driver: string; trend: "rising" | "falling" | "stable" } {
  const spread = tsy10y !== null && tsy2y !== null ? tsy10y - tsy2y : null;

  // Inverted curve (spread < 0) → high stress; steep curve in high-rate env → moderate
  let spreadScore = 30; // neutral default
  if (spread !== null) {
    if (spread < -1.0) spreadScore = 90;       // deeply inverted
    else if (spread < -0.5) spreadScore = 75;  // inverted
    else if (spread < 0) spreadScore = 60;     // slightly inverted
    else if (spread < 0.5) spreadScore = 40;   // flat
    else spreadScore = 20;                      // normal / steep
  }

  // Rate level adds to vol risk
  const rateScore = tsy10y !== null ? linearMap(tsy10y, 2.5, 6, 0, 50) : 25;

  const score = Math.round(spreadScore * 0.6 + rateScore * 0.4);

  let driver = "Yield curve in normal range";
  if (spread !== null) {
    if (spread < -0.5) driver = `Yield curve inverted ${Math.abs(spread).toFixed(2)}% — recession signal active`;
    else if (spread < 0) driver = `Yield curve slightly inverted — late-cycle warning`;
    else if (spread < 0.5) driver = `Yield curve flat at ${spread.toFixed(2)}% — uncertainty elevated`;
    else driver = `Yield curve at ${spread.toFixed(2)}% — normal term premium`;
  }

  const trend: "rising" | "falling" | "stable" =
    spread !== null && spread < 0 ? "rising" : "stable";

  return { score: clamp(score, 0, 100), driver, trend };
}

/**
 * MACRO SENSITIVITY
 * Inputs: CPI YoY (CPIAUCSL), PPI YoY (PPIACO), Fed Funds (FEDFUNDS)
 * Logic: High inflation + high policy rates = macro headwinds for
 *        risk assets.  This vector captures the Fed's policy stance
 *        and its transmission to the real economy.
 */
function scoreMacroSensitivity(
  cpi: number | null,
  ppi: number | null,
  fedFunds: number | null
): { score: number; driver: string; trend: "rising" | "falling" | "stable" } {
  // CPI: target 2%, danger zone >5%
  const cpiScore = cpi !== null ? linearMap(cpi, 1.5, 7, 0, 80) : 40;
  // PPI: leading indicator of CPI pressure
  const ppiScore = ppi !== null ? linearMap(ppi, 0, 10, 0, 70) : 35;
  // Fed Funds: restrictive above 4%
  const rateScore = fedFunds !== null ? linearMap(fedFunds, 1, 6, 0, 80) : 40;

  const score = Math.round(cpiScore * 0.35 + ppiScore * 0.25 + rateScore * 0.4);

  let driver = "Inflation and rates within manageable range";
  if (cpi !== null && fedFunds !== null) {
    if (cpi > 5 && fedFunds > 4.5) driver = `Stagflation risk: CPI ${cpi.toFixed(1)}% + Fed Funds ${fedFunds.toFixed(2)}% — dual pressure`;
    else if (cpi > 4) driver = `Inflation elevated at ${cpi.toFixed(1)}% — Fed pivot timeline extended`;
    else if (fedFunds > 5) driver = `Restrictive policy: Fed Funds ${fedFunds.toFixed(2)}% — credit tightening`;
    else driver = `CPI ${cpi.toFixed(1)}%, Fed Funds ${fedFunds.toFixed(2)}% — moderate macro headwinds`;
  }

  const trend: "rising" | "falling" | "stable" =
    cpi !== null && cpi > 4 ? "rising" : "stable";

  return { score: clamp(score, 0, 100), driver, trend };
}

/**
 * MARKET BREADTH
 * Inputs: Unemployment (UNRATE), 10Y yield (DGS10)
 * Logic: Rising unemployment combined with elevated rates signals
 *        deteriorating breadth — fewer sectors and companies can
 *        sustain growth under these conditions.
 */
function scoreMarketBreadth(
  unemployment: number | null,
  tsy10y: number | null
): { score: number; driver: string; trend: "rising" | "falling" | "stable" } {
  // Unemployment level scoring; this is not the change-based Sahm Rule.
  const laborScore = unemployment !== null ? linearMap(unemployment, 3.5, 7, 0, 80) : 30;
  // High rates compress valuations and narrow breadth
  const rateScore = tsy10y !== null ? linearMap(tsy10y, 2, 6, 0, 60) : 25;

  const score = Math.round(laborScore * 0.6 + rateScore * 0.4);

  let driver = "Labor and rate conditions supportive";
  if (unemployment !== null) {
    if (unemployment > 5.5) driver = `Unemployment ${unemployment.toFixed(1)}% — unemployment above 5.5%, labor-market stress high`;
    else if (unemployment > 4.5) driver = `Unemployment rising at ${unemployment.toFixed(1)}% — labor market softening`;
    else driver = `Unemployment ${unemployment.toFixed(1)}% — labor market still supportive`;
  }

  const trend: "rising" | "falling" | "stable" =
    unemployment !== null && unemployment > 4.5 ? "rising" : "stable";

  return { score: clamp(score, 0, 100), driver, trend };
}

/**
 * AI / SPECULATIVE BUBBLE EXPOSURE
 * Inputs: No direct FRED series — derived from macro context
 * Logic: AI/tech concentration risk is estimated from rate environment
 *        (high rates deflate growth multiples) and credit conditions
 *        (tight credit hits speculative names first).
 *        Uses static AI concentration estimate (32.4% of S&P 500).
 */
function scoreAIBubble(
  tsy10y: number | null,
  hySpread: number | null
): { score: number; driver: string; trend: "rising" | "falling" | "stable" } {
  // Static AI concentration (top-7 mega-cap AI names ~32% of S&P 500)
  const concentrationScore = 65; // baseline elevated

  // High rates compress growth multiples
  const rateScore = tsy10y !== null ? linearMap(tsy10y, 2, 6, 0, 40) : 20;
  // Widening spreads hit speculative names
  const spreadScore = hySpread !== null ? linearMap(hySpread, 200, 600, 0, 30) : 15;

  const score = Math.round(concentrationScore * 0.5 + rateScore * 0.3 + spreadScore * 0.2);

  let driver = "Static AI-concentration baseline (reference value, not live)";
  if (tsy10y !== null) {
    if (tsy10y > 5) driver = `Static 32.4% AI-concentration baseline + 10Y at ${tsy10y.toFixed(2)}% compressing multiples`;
    else if (tsy10y > 4) driver = `Static 32.4% AI-concentration baseline — rate sensitivity elevated at ${tsy10y.toFixed(2)}%`;
    else driver = `Static 32.4% AI-concentration baseline (not live) — rates supportive`;
  }

  const trend: "rising" | "falling" | "stable" = "rising"; // secular trend

  return { score: clamp(score, 0, 100), driver, trend };
}

/**
 * Inputs available to check a stored sub-score. Unknown inputs are omitted.
 * Missing inputs are NOT replaced with the engine's fallback constants: those
 * constants are substitutes, not evidence of a floor.
 */
export interface StoredVectorInputs {
  hySpreadBps?: number | null;
  sofr?: number | null;
  tsy10y?: number | null;
  tsy2y?: number | null;
  unemployment?: number | null;
  cpiYoy?: number | null;
  ppiYoy?: number | null;
  fedFunds?: number | null;
}

export type StoredSubScoreKey = "liquidity" | "credit" | "volatility" | "macro" | "breadth" | "aiBubble";

export type StoredSubScoreStatus = "observed" | "missing" | "sentinel" | "unverifiable";

export interface StoredSubScoreAssessment {
  status: StoredSubScoreStatus;
  /** Present only when status is "observed". */
  value: number | null;
  reason: string;
}

function finiteInput(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Minimum Math.round over a continuous score range whose lower end is `minSum`. */
function roundedFloor(minSum: number): number {
  return Math.floor(minSum + 0.5);
}

/**
 * Classify a stored 0 only. A non-zero stored score is returned by the caller
 * unchanged; this recompute must not withhold it or replace it.
 */
function assessStoredZero(
  minSum: number,
  exactSum: number | null,
  evidence: string,
): StoredSubScoreAssessment {
  const exact = exactSum == null ? null : Math.round(exactSum);
  if (exact != null) {
    if (exact === 0) {
      return { status: "observed", value: 0, reason: `Stored 0 matches the recomputed floor. ${evidence}` };
    }
    return {
      status: "sentinel",
      value: null,
      reason: `Stored 0 is not the recomputed score ${exact}. ${evidence}`,
    };
  }
  const floor = roundedFloor(minSum);
  if (floor > 0) {
    return {
      status: "sentinel",
      value: null,
      reason: `Stored 0 is below the score these inputs can produce (at least ${floor}). ${evidence}`,
    };
  }
  return {
    status: "unverifiable",
    value: null,
    reason: `Stored 0 is inside the range these inputs allow, but the floor is not confirmed. Withheld as unverifiable. ${evidence}`,
  };
}

/**
 * Classify one stored sub-score from the inputs that are actually available.
 * The recompute classifies a stored 0 only: a genuine floor stays, a 0 the
 * inputs rule out is a sentinel, and a 0 the inputs cannot decide is
 * unverifiable. A stored non-zero is kept even when it differs from the
 * recompute. Null, undefined, and non-finite values are missing.
 */
export function assessStoredSubScore(
  key: StoredSubScoreKey,
  raw: number | null | undefined,
  inputs: StoredVectorInputs,
  evidence = "No confirming observation is available.",
): StoredSubScoreAssessment {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { status: "missing", value: null, reason: "No finite stored sub-score." };
  }
  if (raw !== 0) {
    return {
      status: "observed",
      value: raw,
      reason: `Stored ${raw} is kept. A fixture recompute classifies a stored 0 only and does not replace a non-zero score.`,
    };
  }
  const hy = finiteInput(inputs.hySpreadBps);
  const sofr = finiteInput(inputs.sofr);
  const tsy10 = finiteInput(inputs.tsy10y);
  const tsy2 = finiteInput(inputs.tsy2y);
  const unemployment = finiteInput(inputs.unemployment);
  const cpi = finiteInput(inputs.cpiYoy);
  const ppi = finiteInput(inputs.ppiYoy);
  const fedFunds = finiteInput(inputs.fedFunds);

  if (key === "liquidity") {
    const hyScore = hy == null ? null : linearMap(hy, 200, 800, 0, 100);
    const sofrScore = sofr == null ? null : linearMap(sofr, 2, 6, 0, 60);
    const exact = hyScore != null && sofrScore != null ? hyScore * 0.65 + sofrScore * 0.35 : null;
    const min = (hyScore ?? 0) * 0.65 + (sofrScore ?? 0) * 0.35;
    return assessStoredZero(min, exact, evidence);
  }
  if (key === "credit") {
    const spread = hy == null ? null : linearMap(hy, 200, 700, 0, 80);
    const rate = tsy10 == null ? null : linearMap(tsy10, 2, 6, 0, 50);
    const labor = unemployment == null ? null : linearMap(unemployment, 3.5, 7, 0, 60);
    const exact = spread != null && rate != null && labor != null ? spread * 0.5 + rate * 0.25 + labor * 0.25 : null;
    const min = (spread ?? 0) * 0.5 + (rate ?? 0) * 0.25 + (labor ?? 0) * 0.25;
    return assessStoredZero(min, exact, evidence);
  }
  if (key === "macro") {
    const cpiScore = cpi == null ? null : linearMap(cpi, 1.5, 7, 0, 80);
    const ppiScore = ppi == null ? null : linearMap(ppi, 0, 10, 0, 70);
    const rateScore = fedFunds == null ? null : linearMap(fedFunds, 1, 6, 0, 80);
    const exact = cpiScore != null && ppiScore != null && rateScore != null
      ? cpiScore * 0.35 + ppiScore * 0.25 + rateScore * 0.4
      : null;
    const min = (cpiScore ?? 0) * 0.35 + (ppiScore ?? 0) * 0.25 + (rateScore ?? 0) * 0.4;
    return assessStoredZero(min, exact, evidence);
  }
  if (key === "breadth") {
    const labor = unemployment == null ? null : linearMap(unemployment, 3.5, 7, 0, 80);
    const rate = tsy10 == null ? null : linearMap(tsy10, 2, 6, 0, 60);
    const exact = labor != null && rate != null ? labor * 0.6 + rate * 0.4 : null;
    const min = (labor ?? 0) * 0.6 + (rate ?? 0) * 0.4;
    return assessStoredZero(min, exact, evidence);
  }
  if (key === "volatility") {
    const spread = tsy10 != null && tsy2 != null ? tsy10 - tsy2 : null;
    let spreadExact: number | null = null;
    if (spread != null) {
      if (spread < -1) spreadExact = 90;
      else if (spread < -0.5) spreadExact = 75;
      else if (spread < 0) spreadExact = 60;
      else if (spread < 0.5) spreadExact = 40;
      else spreadExact = 20;
    }
    const rate = tsy10 == null ? null : linearMap(tsy10, 2.5, 6, 0, 50);
    const spreadMin = spreadExact ?? 20;
    const exact = spreadExact != null && rate != null ? spreadExact * 0.6 + rate * 0.4 : null;
    const min = spreadMin * 0.6 + (rate ?? 0) * 0.4;
    return assessStoredZero(min, exact, evidence);
  }
  const rate = tsy10 == null ? null : linearMap(tsy10, 2, 6, 0, 40);
  const spread = hy == null ? null : linearMap(hy, 200, 600, 0, 30);
  const exact = rate != null && spread != null ? 65 * 0.5 + rate * 0.3 + spread * 0.2 : null;
  const min = 65 * 0.5 + (rate ?? 0) * 0.3 + (spread ?? 0) * 0.2;
  return assessStoredZero(min, exact, evidence);
}

// ── Regime classification ─────────────────────────────────────

function classifyRegime(pressure: number): { regime: string; level: PressureLevel } {
  if (pressure >= 80) return { regime: "SYSTEMIC CRISIS", level: "Critical" };
  if (pressure >= 65) return { regime: "HIGH STRESS", level: "High" };
  if (pressure >= 45) return { regime: "ELEVATED RISK", level: "Elevated" };
  if (pressure >= 25) return { regime: "MODERATE RISK", level: "Moderate" };
  return { regime: "LOW RISK", level: "Low" };
}

// ── Historical analog matching ────────────────────────────────

function computeAnalogs(pressure: number, vectors: RiskVector[]): HistoricalAnalog[] {
  const liquidityScore = vectors.find(v => v.id === "liquidity-stress")?.score ?? 30;
  const creditScore = vectors.find(v => v.id === "credit-contagion")?.score ?? 30;
  const aiScore = vectors.find(v => v.id === "ai-bubble")?.score ?? 30;
  const macroScore = vectors.find(v => v.id === "macro-sensitivity")?.score ?? 30;

  // Each analog has a "fingerprint" — similarity is computed as inverse
  // of Euclidean distance from the current vector profile.
  const analogs: Array<{ year: number; label: string; description: string; fingerprint: number[] }> = [
    {
      year: 2000,
      label: "Dot-Com Bubble",
      description: "Tech concentration peaked, valuations extreme, Fed tightening cycle underway",
      fingerprint: [25, 30, 90, 55], // [liquidity, credit, ai, macro]
    },
    {
      year: 2008,
      label: "Global Financial Crisis",
      description: "Credit contagion from housing, liquidity freeze, systemic bank stress",
      fingerprint: [90, 95, 20, 60],
    },
    {
      year: 2020,
      label: "COVID Shock",
      description: "Sudden liquidity crisis, credit dislocation, rapid Fed response",
      fingerprint: [85, 80, 30, 40],
    },
    {
      year: 2022,
      label: "Rates Shock",
      description: "Fastest Fed tightening in 40 years, inflation surge, bond market selloff",
      fingerprint: [40, 45, 50, 90],
    },
    {
      year: 1998,
      label: "LTCM / Russia Crisis",
      description: "Liquidity crisis from leverage unwind, credit spreads spiked briefly",
      fingerprint: [70, 65, 20, 35],
    },
    {
      year: 1973,
      label: "1970s Stagflation",
      description: "Oil shock, high inflation, recession — macro sensitivity extreme",
      fingerprint: [50, 55, 10, 95],
    },
  ];

  const current = [liquidityScore, creditScore, aiScore, macroScore];

  return analogs
    .map(a => {
      // Euclidean distance normalized to 0–100 similarity
      const dist = Math.sqrt(
        a.fingerprint.reduce((sum, fp, i) => sum + Math.pow(fp - (current[i] ?? 30), 2), 0)
      );
      const maxDist = Math.sqrt(4 * 100 * 100); // max possible distance
      const similarity = Math.round((1 - dist / maxDist) * 100);
      return { year: a.year, label: a.label, description: a.description, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

// ── Alert generation ──────────────────────────────────────────

function generateAlerts(vectors: RiskVector[], overallPressure: number): PressureAlert[] {
  const alerts: PressureAlert[] = [];

  // Overall pressure alert
  if (overallPressure >= 75) {
    alerts.push({
      severity: "critical",
      title: "SYSTEMIC PRESSURE CRITICAL",
      detail: `FAULTLINE Pressure Index at ${overallPressure}/100 — multiple stress vectors converging`,
    });
  } else if (overallPressure >= 55) {
    alerts.push({
      severity: "high",
      title: "ELEVATED SYSTEMIC PRESSURE",
      detail: `Pressure Index at ${overallPressure}/100 — risk of cascade increasing`,
    });
  }

  // Per-vector alerts for high-scoring vectors
  for (const v of vectors) {
    if (v.score >= 75) {
      alerts.push({
        severity: "critical",
        title: `${v.label.toUpperCase()} — CRITICAL`,
        detail: v.driver,
      });
    } else if (v.score >= 60) {
      alerts.push({
        severity: "high",
        title: `${v.label.toUpperCase()} — HIGH`,
        detail: v.driver,
      });
    } else if (v.score >= 45) {
      alerts.push({
        severity: "elevated",
        title: `${v.label.toUpperCase()} — ELEVATED`,
        detail: v.driver,
      });
    }
  }

  return alerts.slice(0, 6); // cap at 6 alerts
}

// ── Main export ───────────────────────────────────────────────

// ── Phase 1 remediation (2026-10-13, founder-authorized) ────────
// Two narrowly scoped correctness repairs to the frozen v1 engine:
//   1. CPI/PPI YoY is computed from DATE-MATCHED observations
//      (month M vs the same month one year earlier), never by row
//      position, and invalid values (".", NaN, Infinity) can never
//      reach a vector score.
//   2. FRED loading FAILS CLOSED: every one of the 8 required inputs
//      must be present, finite, plausible and fresh before a new
//      reading is computed. Otherwise the last verified reading is
//      returned, labelled stale with its ORIGINAL timestamps, or the
//      engine throws PressureInputsUnavailableError. Hard-coded
//      constants are never substituted for missing data.
// The six vector formulas, weights, rounding and band cut-points
// above are unchanged (v1 methodology: docs/pressure/V1_METHODOLOGY.md).

export const PRESSURE_V1_METHODOLOGY_VERSION = "faultline-pressure-v1.0.1-integrity";

export class PressureInputsUnavailableError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Pressure Index withheld: required FRED inputs not verified (${problems.join("; ")})`);
    this.name = "PressureInputsUnavailableError";
    this.problems = problems;
  }
}

export type PressureInputId =
  | "hySpread" | "tsy10y" | "tsy2y" | "sofr" | "cpi" | "ppi" | "fedFunds" | "unemployment";

export interface PressureInputProvenance {
  inputId: PressureInputId;
  seriesId: string;
  value: number | null;
  /** FRED observation date of the value used (for YoY: the later month) */
  observationDate: string | null;
  /** For YoY inputs: the year-earlier observation date used as base */
  baseObservationDate?: string | null;
  status: "verified" | "missing" | "invalid" | "stale";
  detail?: string;
}

export interface PressureVerification {
  status: "verified" | "stale" | "unavailable";
  methodologyVersion: string;
  /** When the reported reading was actually computed */
  computedAt: string;
  inputs: PressureInputProvenance[];
  /** Why fresh data was rejected (empty when verified) */
  problems: string[];
}

type FredObs = { date: string; value: string };

/** Parse a FRED value string; returns null for ".", "", NaN, ±Infinity. */
export function parseFredValue(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const t = String(raw).trim();
  if (t === "" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Latest valid observation with its date (observations may be in any order). */
export function latestValidObservation(observations: FredObs[]): { value: number; date: string } | null {
  let best: { value: number; date: string } | null = null;
  for (const o of observations) {
    const v = parseFredValue(o?.value);
    if (v === null || typeof o.date !== "string") continue;
    if (!best || o.date > best.date) best = { value: v, date: o.date };
  }
  return best;
}

function minusOneYear(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  return `${String(y - 1).padStart(4, "0")}${isoDate.slice(4)}`;
}

/**
 * Date-matched year-over-year % change for a monthly index (CPIAUCSL, PPIACO).
 * Uses the most recent month M whose value AND the value for M minus one year
 * are both valid. Rounded to 2 dp exactly as v1 did. Returns null if none.
 */
export function dateMatchedYoY(observations: FredObs[]):
  { value: number; observationDate: string; baseObservationDate: string } | null {
  const byDate = new Map<string, number>();
  for (const o of observations ?? []) {
    const v = parseFredValue(o?.value);
    if (v !== null && v > 0 && typeof o.date === "string") byDate.set(o.date, v);
  }
  const dates = Array.from(byDate.keys()).sort().reverse();
  for (const d of dates) {
    const base = byDate.get(minusOneYear(d));
    if (base === undefined) continue;
    const latest = byDate.get(d)!;
    const value = parseFloat(((latest / base - 1) * 100).toFixed(2));
    if (!Number.isFinite(value)) continue;
    return { value, observationDate: d, baseObservationDate: minusOneYear(d) };
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Required inputs, plausibility ranges and maximum observation age (calendar days). */
const INPUT_RULES: Record<PressureInputId, { seriesId: string; min: number; max: number; maxAgeDays: number }> = {
  hySpread:     { seriesId: "BAMLH0A0HYM2", min: 50,  max: 3000, maxAgeDays: 10 },
  tsy10y:       { seriesId: "DGS10",        min: -2,  max: 25,   maxAgeDays: 10 },
  tsy2y:        { seriesId: "DGS2",         min: -2,  max: 25,   maxAgeDays: 10 },
  sofr:         { seriesId: "SOFR",         min: -2,  max: 25,   maxAgeDays: 10 },
  fedFunds:     { seriesId: "FEDFUNDS",     min: -2,  max: 25,   maxAgeDays: 100 },
  unemployment: { seriesId: "UNRATE",       min: 0,   max: 30,   maxAgeDays: 100 },
  cpi:          { seriesId: "CPIAUCSL",     min: -30, max: 50,   maxAgeDays: 130 },
  ppi:          { seriesId: "PPIACO",       min: -50, max: 80,   maxAgeDays: 130 },
};

export const PRESSURE_FRED_SERIES = [
  { id: "BAMLH0A0HYM2", limit: 10 },  // HY credit spread (daily; 10 rows absorbs holiday gaps)
  { id: "DGS10", limit: 10 },         // 10Y Treasury
  { id: "DGS2", limit: 10 },          // 2Y Treasury
  { id: "SOFR", limit: 10 },          // SOFR rate
  { id: "CPIAUCSL", limit: 15 },      // CPI (date-matched YoY needs M and M-12)
  { id: "PPIACO", limit: 15 },        // PPI
  { id: "FEDFUNDS", limit: 3 },       // Fed Funds
  { id: "UNRATE", limit: 3 },         // Unemployment
];

export type FredResultsLike = Record<string, { observations: FredObs[]; error?: string } | undefined>;

/**
 * Validate every required input. Pure: no I/O, `now` injected.
 * ok=true only when all 8 inputs are verified.
 */
export function resolveVerifiedInputs(results: FredResultsLike, now: Date = new Date()):
  { ok: boolean; inputs: Record<PressureInputId, number | null>; provenance: PressureInputProvenance[]; problems: string[] } {
  const provenance: PressureInputProvenance[] = [];
  const inputs = {} as Record<PressureInputId, number | null>;
  const problems: string[] = [];
  for (const [inputId, rule] of Object.entries(INPUT_RULES) as [PressureInputId, typeof INPUT_RULES[PressureInputId]][]) {
    const series = results?.[rule.seriesId];
    const obs = series && !series.error ? series.observations ?? [] : [];
    let value: number | null = null;
    let observationDate: string | null = null;
    let baseObservationDate: string | null | undefined;
    if (inputId === "cpi" || inputId === "ppi") {
      const yoy = dateMatchedYoY(obs);
      if (yoy) { value = yoy.value; observationDate = yoy.observationDate; baseObservationDate = yoy.baseObservationDate; }
      else baseObservationDate = null;
    } else {
      const latest = latestValidObservation(obs);
      if (latest) {
        // HY spread: FRED returns percent (e.g. 2.83 = 283bps) — convert to bps (unchanged v1 rule)
        value = inputId === "hySpread" ? (latest.value > 20 ? latest.value : latest.value * 100) : latest.value;
        observationDate = latest.date;
      }
    }
    let status: PressureInputProvenance["status"] = "verified";
    let detail: string | undefined;
    if (value === null || observationDate === null) {
      status = "missing";
      detail = series?.error ? `FRED error: ${series.error}` : "no valid observation";
    } else if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
      status = "invalid";
      detail = `value ${value} outside plausible range [${rule.min}, ${rule.max}]`;
    } else {
      const ageDays = (now.getTime() - Date.parse(`${observationDate}T00:00:00Z`)) / DAY_MS;
      if (!Number.isFinite(ageDays) || ageDays > rule.maxAgeDays) {
        status = "stale";
        detail = `observation ${observationDate} older than ${rule.maxAgeDays} days`;
      }
    }
    if (status !== "verified") problems.push(`${inputId} (${rule.seriesId}) ${status}: ${detail}`);
    inputs[inputId] = status === "verified" ? value : null;
    provenance.push({
      inputId, seriesId: rule.seriesId, value, observationDate,
      ...(baseObservationDate !== undefined ? { baseObservationDate } : {}),
      status, ...(detail ? { detail } : {}),
    });
  }
  return { ok: problems.length === 0, inputs, provenance, problems };
}

/** Max age at which a preserved verified reading may still be served (labelled stale). */
const MAX_PRESERVED_READING_MS = 7 * DAY_MS;

/**
 * Compute the v1 Pressure Index from a fully VERIFIED input set.
 * Pure (apart from `now`). The scoring below is the frozen v1 formula, unchanged.
 */
export function computePressureFromVerifiedInputs(
  verified: Record<PressureInputId, number | null>,
  provenance: PressureInputProvenance[],
  nowDate: Date = new Date(),
): FaultlinePressureOutput {
  for (const [k, v] of Object.entries(verified)) {
    if (v === null || !Number.isFinite(v)) throw new PressureInputsUnavailableError([`${k} not verified`]);
  }
  const dataSource = "live" as "live" | "fallback";
  const hy = verified.hySpread as number;
  const tsy10 = verified.tsy10y as number;
  const tsy2 = verified.tsy2y as number;
  const sofr = verified.sofr as number;
  const cpi = verified.cpi as number;
  const ppi = verified.ppi as number;
  const fedFunds = verified.fedFunds as number;
  const unemployment = verified.unemployment as number;

  // ── 3. Score each vector ───────────────────────────────────
  const liquidityResult = scoreLiquidityStress(hy, sofr);
  const creditResult = scoreCreditContagion(hy, tsy10, unemployment);
  const volatilityResult = scoreVolatilityRegime(tsy10, tsy2);
  const macroResult = scoreMacroSensitivity(cpi, ppi, fedFunds);
  const breadthResult = scoreMarketBreadth(unemployment, tsy10);
  const aiResult = scoreAIBubble(tsy10, hy);

  // ── 4. Build vector objects ────────────────────────────────
  // Frozen Champion V1 weights. The Systemic Regime Engine is an independent
  // statistical vote (see server/systemicRegime) and MUST NOT be added here
  // until a later validation-backed PR explicitly changes this table.
  const vectors: RiskVector[] = [
    {
      id: "liquidity-stress",
      label: "Liquidity Stress",
      description: "Credit market liquidity measured via HY spreads and short-term funding rates",
      score: liquidityResult.score,
      level: scoreToLevel(liquidityResult.score),
      driver: liquidityResult.driver,
      trend: liquidityResult.trend,
      weight: 0.20,
      rawInputs: { hySpread: hy, sofr },
      dataStatus: dataSource === "live" ? "live" as DataStatus : "fallback" as DataStatus,
      source: "FRED: BAMLH0A0HYM2 (HY Spread), SOFR",
      ...(dataSource === "fallback" ? { fallbackReason: "FRED data unavailable; using last known values" } : {}),
    },
    {
      id: "credit-contagion",
      label: "Credit Contagion Risk",
      description: "Risk of credit stress spreading across sectors via spread widening and rate pressure",
      score: creditResult.score,
      level: scoreToLevel(creditResult.score),
      driver: creditResult.driver,
      trend: creditResult.trend,
      weight: 0.20,
      rawInputs: { hySpread: hy, tsy10y: tsy10, unemployment },
      dataStatus: dataSource === "live" ? "live" as DataStatus : "fallback" as DataStatus,
      source: "FRED: BAMLH0A0HYM2, DGS10, UNRATE",
      ...(dataSource === "fallback" ? { fallbackReason: "FRED data unavailable; using last known values" } : {}),
    },
    {
      id: "volatility-regime",
      label: "Yield Curve (10Y–2Y) & 10Y Level",
      description: "10Y–2Y Treasury curve shape blended with the 10Y yield level. Does not read VIX or realized volatility.",
      score: volatilityResult.score,
      level: scoreToLevel(volatilityResult.score),
      driver: volatilityResult.driver,
      trend: volatilityResult.trend,
      weight: 0.15,
      rawInputs: { tsy10y: tsy10, tsy2y: tsy2 },
      dataStatus: dataSource === "live" ? "live" as DataStatus : "fallback" as DataStatus,
      source: "FRED: DGS10, DGS2",
      ...(dataSource === "fallback" ? { fallbackReason: "FRED data unavailable; using last known values" } : {}),
    },
    {
      id: "macro-sensitivity",
      label: "Macro Sensitivity",
      description: "Inflation and Fed policy stance creating headwinds for risk assets",
      score: macroResult.score,
      level: scoreToLevel(macroResult.score),
      driver: macroResult.driver,
      trend: macroResult.trend,
      weight: 0.20,
      rawInputs: { cpi, ppi, fedFunds },
      dataStatus: dataSource === "live" ? "delayed" as DataStatus : "fallback" as DataStatus,
      source: "FRED: CPIAUCSL, PPIACO, FEDFUNDS (monthly lag)",
      ...(dataSource === "fallback" ? { fallbackReason: "FRED data unavailable; using last known values" } : {}),
    },
    {
      id: "market-breadth",
      label: "Labor & Rates (Unemployment, 10Y)",
      description: "Unemployment rate blended with the 10Y Treasury yield. Not an advance/decline or market-participation breadth measure.",
      score: breadthResult.score,
      level: scoreToLevel(breadthResult.score),
      driver: breadthResult.driver,
      trend: breadthResult.trend,
      weight: 0.10,
      rawInputs: { unemployment, tsy10y: tsy10 },
      dataStatus: dataSource === "live" ? "delayed" as DataStatus : "fallback" as DataStatus,
      source: "FRED: UNRATE (monthly lag), DGS10",
      ...(dataSource === "fallback" ? { fallbackReason: "FRED data unavailable; using last known values" } : {}),
    },
    {
      id: "ai-bubble",
      label: "AI / Speculation (Static Baseline)",
      description: "Static reference value for AI mega-cap concentration (~32.4% of the S&P 500; not a live measurement), adjusted by the live 10Y yield and HY spread.",
      score: aiResult.score,
      level: scoreToLevel(aiResult.score),
      driver: aiResult.driver,
      trend: aiResult.trend,
      weight: 0.15,
      rawInputs: { tsy10y: tsy10, hySpread: hy },
      dataStatus: "static" as DataStatus,
      source: "Static model estimate (top-7 mega-cap AI concentration ~32% of S&P 500)",
      fallbackReason: "AI concentration baseline is a static model estimate. No live market-cap data source is currently wired. Score is adjusted dynamically by live FRED rate and spread inputs.",
    },
  ];

  // ── 5. Compute weighted composite ─────────────────────────
  const overallPressure = Math.round(
    vectors.reduce((sum, v) => sum + v.score * v.weight, 0)
  );

  // ── 6. Classify regime ─────────────────────────────────────
  const { regime, level } = classifyRegime(overallPressure);

  // ── 7. Compute analogs ─────────────────────────────────────
  const analogs = computeAnalogs(overallPressure, vectors);
  const topAnalog = analogs[0]!;

  // ── 8. Generate alerts ─────────────────────────────────────
  const alerts = generateAlerts(vectors, overallPressure);

  if (!Number.isFinite(overallPressure)) {
    throw new PressureInputsUnavailableError([`composite not finite (${overallPressure})`]);
  }
  const obsDates: Record<string, string | null> = Object.fromEntries(provenance.map(p => [p.inputId, p.observationDate]));
  for (const v of vectors) {
    if (!Number.isFinite(v.score)) throw new PressureInputsUnavailableError([`${v.id} score not finite`]);
    v.observationDates = Object.fromEntries(Object.keys(v.rawInputs).map(k => [k, obsDates[k] ?? null]));
    const observed = Object.values(v.observationDates)
      .map(date => typeof date === "string" ? Date.parse(`${date}T00:00:00.000Z`) : Number.NaN)
      .filter(time => Number.isFinite(time));
    v.observedAt = observed.length > 0 ? new Date(Math.min(...observed)).toISOString() : null;
  }

  const now = nowDate.toISOString();
  return {
    overallPressure,
    regime,
    level,
    vectors,
    alerts,
    topAnalog,
    analogs,
    timestamp: now,
    lastUpdated: now,
    dataSource,
    priorPressure: null, // set by caller after DB lookup
    verification: {
      status: "verified",
      methodologyVersion: PRESSURE_V1_METHODOLOGY_VERSION,
      computedAt: now,
      inputs: provenance,
      problems: [],
    },
  };
}

/** Label a preserved verified reading as stale WITHOUT re-dating it. */
export function markPreservedReadingStale(
  snapshot: FaultlinePressureOutput,
  freshProvenance: PressureInputProvenance[],
  problems: string[],
): FaultlinePressureOutput {
  const computedAt = snapshot.verification?.computedAt ?? snapshot.lastUpdated;
  const reason = `Fresh FRED inputs could not be verified (${problems.join("; ")}). Showing the last verified reading computed at ${computedAt}.`;
  return {
    ...snapshot,
    dataSource: "fallback",
    timestamp: snapshot.timestamp,
    lastUpdated: snapshot.lastUpdated,
    vectors: snapshot.vectors.map(v => v.dataStatus === "static"
      ? { ...v }
      : { ...v, dataStatus: "stale" as DataStatus, fallbackReason: reason }),
    verification: {
      status: "stale",
      methodologyVersion: PRESSURE_V1_METHODOLOGY_VERSION,
      computedAt,
      inputs: snapshot.verification?.inputs ?? [],
      problems: [...problems, ...freshProvenance.filter(p => p.status !== "verified").map(p => `fresh:${p.inputId}:${p.status}`)].filter((x, i, a) => a.indexOf(x) === i),
    },
  };
}

/**
 * Fetch live FRED data and compute the FAULTLINE Pressure Index (v1).
 * FAILS CLOSED: if any required input cannot be verified, returns the last
 * verified reading (stale-labelled, original timestamps, ≤7 days old) or throws
 * PressureInputsUnavailableError. Never substitutes constants.
 */
export async function calculateFaultlinePressure(): Promise<FaultlinePressureOutput> {
  let resolved: ReturnType<typeof resolveVerifiedInputs>;
  try {
    const bulk = await fetchFredBulk(PRESSURE_FRED_SERIES);
    resolved = resolveVerifiedInputs(bulk.results, new Date());
  } catch (err) {
    log.warn("[Pressure Engine] FRED fetch failed", { err: err as Error });
    resolved = { ok: false, inputs: {} as any, provenance: [], problems: [`FRED fetch failed: ${(err as Error)?.message ?? String(err)}`] };
  }

  if (resolved.ok) {
    const result = computePressureFromVerifiedInputs(resolved.inputs, resolved.provenance, new Date());
    log.info(`[Pressure Engine] All ${PRESSURE_FRED_SERIES.length} FRED inputs verified`);
    _lastLiveSnapshot = result;
    _lastLiveSnapshotAt = Date.now();
    // V3-H shadow persistence moved to the scheduled pipeline (Phase 2 #7):
    // computing a reading for a public request must not write to the DB.
    return result;
  }

  log.warn(`[Pressure Engine] Fail-closed: ${resolved.problems.join("; ")}`);
  if (_lastLiveSnapshot && _lastLiveSnapshotAt && Date.now() - _lastLiveSnapshotAt <= MAX_PRESERVED_READING_MS) {
    return markPreservedReadingStale(_lastLiveSnapshot, resolved.provenance, resolved.problems);
  }
  throw new PressureInputsUnavailableError(resolved.problems);
}

/** Test hook: reset the in-process verified snapshot. */
export function __resetPressureSnapshotForTests(): void {
  _lastLiveSnapshot = null;
  _lastLiveSnapshotAt = null;
}
