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

// ── Types ────────────────────────────────────────────────────

export type PressureLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

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
}

// ── FRED data shape returned by the bulk endpoint ────────────

export interface FredBulkResult {
  results: Record<string, {
    observations: { date: string; value: string }[];
    cached: boolean;
    error?: string;
  }>;
  timestamp: string;
}

// ── Helpers ──────────────────────────────────────────────────

/** Extract the most recent valid (non-"." ) numeric observation */
function latestValid(observations: { date: string; value: string }[]): number | null {
  for (const obs of observations) {
    if (obs.value !== "." && obs.value !== "") {
      const n = parseFloat(obs.value);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

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
  // Unemployment: Sahm Rule triggers around 4.5%+
  const laborScore = unemployment !== null ? linearMap(unemployment, 3.5, 7, 0, 80) : 30;
  // High rates compress valuations and narrow breadth
  const rateScore = tsy10y !== null ? linearMap(tsy10y, 2, 6, 0, 60) : 25;

  const score = Math.round(laborScore * 0.6 + rateScore * 0.4);

  let driver = "Broad market conditions supportive";
  if (unemployment !== null) {
    if (unemployment > 5.5) driver = `Unemployment ${unemployment.toFixed(1)}% — Sahm Rule triggered, breadth deteriorating`;
    else if (unemployment > 4.5) driver = `Unemployment rising at ${unemployment.toFixed(1)}% — breadth narrowing`;
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

  let driver = "AI/tech concentration at elevated levels";
  if (tsy10y !== null) {
    if (tsy10y > 5) driver = `AI bubble risk high: 32.4% S&P concentration + 10Y at ${tsy10y.toFixed(2)}% compressing multiples`;
    else if (tsy10y > 4) driver = `AI/mega-cap concentration 32.4% — rate sensitivity elevated at ${tsy10y.toFixed(2)}%`;
    else driver = `AI concentration 32.4% of S&P 500 — bubble dynamics present but rates supportive`;
  }

  const trend: "rising" | "falling" | "stable" = "rising"; // secular trend

  return { score: clamp(score, 0, 100), driver, trend };
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

/**
 * Fetch live FRED data and compute the FAULTLINE Pressure Index.
 * Falls back to baseline values if FRED is unavailable.
 */
export async function calculateFaultlinePressure(
  fredBaseUrl = "http://localhost:3000"
): Promise<FaultlinePressureOutput> {
  // ── 1. Fetch FRED data ─────────────────────────────────────
  const FRED_SERIES = [
    { id: "BAMLH0A0HYM2", limit: 2 },  // HY credit spread
    { id: "DGS10", limit: 2 },          // 10Y Treasury
    { id: "DGS2", limit: 2 },           // 2Y Treasury
    { id: "SOFR", limit: 2 },           // SOFR rate
    { id: "CPIAUCSL", limit: 14 },      // CPI (need 12 months for YoY)
    { id: "PPIACO", limit: 14 },        // PPI
    { id: "FEDFUNDS", limit: 2 },       // Fed Funds
    { id: "UNRATE", limit: 2 },         // Unemployment
  ];

  let rawFred: Record<string, number | null> = {};
  let dataSource: "live" | "fallback" = "fallback";

  try {
    const res = await fetch(`${fredBaseUrl}/api/fred/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series: FRED_SERIES }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const bulk = await res.json() as FredBulkResult;
      const r = bulk.results;

      // HY spread: FRED returns as a decimal (e.g. 2.83 = 283bps) — convert to bps
      const hyRaw = latestValid(r["BAMLH0A0HYM2"]?.observations ?? []);
      rawFred["hySpread"] = hyRaw !== null ? (hyRaw > 20 ? hyRaw : hyRaw * 100) : null;
      rawFred["tsy10y"] = latestValid(r["DGS10"]?.observations ?? []);
      rawFred["tsy2y"] = latestValid(r["DGS2"]?.observations ?? []);
      rawFred["sofr"] = latestValid(r["SOFR"]?.observations ?? []);
      rawFred["fedFunds"] = latestValid(r["FEDFUNDS"]?.observations ?? []);
      rawFred["unemployment"] = latestValid(r["UNRATE"]?.observations ?? []);

      // CPI YoY: compare latest vs 12 months ago
      const cpiObs = r["CPIAUCSL"]?.observations ?? [];
      const cpiLatest = latestValid(cpiObs);
      const cpiYear = cpiObs.length >= 13 ? parseFloat(cpiObs[12]?.value ?? ".") : null;
      rawFred["cpi"] = cpiLatest !== null && cpiYear !== null && cpiYear !== 0
        ? parseFloat(((cpiLatest / cpiYear - 1) * 100).toFixed(2))
        : null;

      // PPI YoY
      const ppiObs = r["PPIACO"]?.observations ?? [];
      const ppiLatest = latestValid(ppiObs);
      const ppiYear = ppiObs.length >= 13 ? parseFloat(ppiObs[12]?.value ?? ".") : null;
      rawFred["ppi"] = ppiLatest !== null && ppiYear !== null && ppiYear !== 0
        ? parseFloat(((ppiLatest / ppiYear - 1) * 100).toFixed(2))
        : null;

      dataSource = "live";
    }
  } catch (err) {
    console.warn("[Pressure Engine] FRED fetch failed, using fallback values:", err);
  }

  // ── 2. Apply fallback values if FRED unavailable ───────────
  const hy = rawFred["hySpread"] ?? 283;       // bps — recent actual
  const tsy10 = rawFred["tsy10y"] ?? 4.61;
  const tsy2 = rawFred["tsy2y"] ?? 4.07;
  const sofr = rawFred["sofr"] ?? 3.53;
  const cpi = rawFred["cpi"] ?? 3.4;
  const ppi = rawFred["ppi"] ?? 2.8;
  const fedFunds = rawFred["fedFunds"] ?? 5.25;
  const unemployment = rawFred["unemployment"] ?? 4.1;

  // ── 3. Score each vector ───────────────────────────────────
  const liquidityResult = scoreLiquidityStress(hy, sofr);
  const creditResult = scoreCreditContagion(hy, tsy10, unemployment);
  const volatilityResult = scoreVolatilityRegime(tsy10, tsy2);
  const macroResult = scoreMacroSensitivity(cpi, ppi, fedFunds);
  const breadthResult = scoreMarketBreadth(unemployment, tsy10);
  const aiResult = scoreAIBubble(tsy10, hy);

  // ── 4. Build vector objects ────────────────────────────────
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
    },
    {
      id: "volatility-regime",
      label: "Volatility Regime",
      description: "Yield curve shape and rate level as a proxy for macro volatility and recession risk",
      score: volatilityResult.score,
      level: scoreToLevel(volatilityResult.score),
      driver: volatilityResult.driver,
      trend: volatilityResult.trend,
      weight: 0.15,
      rawInputs: { tsy10y: tsy10, tsy2y: tsy2 },
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
    },
    {
      id: "market-breadth",
      label: "Market Breadth",
      description: "Labor market health and rate environment as indicators of broad market participation",
      score: breadthResult.score,
      level: scoreToLevel(breadthResult.score),
      driver: breadthResult.driver,
      trend: breadthResult.trend,
      weight: 0.10,
      rawInputs: { unemployment, tsy10y: tsy10 },
    },
    {
      id: "ai-bubble",
      label: "AI / Speculative Bubble",
      description: "AI mega-cap concentration and speculative excess in growth assets",
      score: aiResult.score,
      level: scoreToLevel(aiResult.score),
      driver: aiResult.driver,
      trend: aiResult.trend,
      weight: 0.15,
      rawInputs: { tsy10y: tsy10, hySpread: hy },
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

  return {
    overallPressure,
    regime,
    level,
    vectors,
    alerts,
    topAnalog,
    analogs,
    timestamp: new Date().toISOString(),
    dataSource,
  };
}
