// ============================================================
// FAULTLINE — Reactive Intelligence Engine
// Single source of truth for all derived scores, regime,
// probability, narrative, and analog similarity.
//
// Architecture:
//   RawIndicators  →  computeEngine()  →  EngineOutput
//
// All pages consume EngineOutput via useFaultlineEngine().
// Changing any RawIndicator propagates through the entire system.
//
// Live API integration: replace RawIndicators with fetched values
// from FRED, Polygon.io, Alpha Vantage, etc.
// ============================================================

// ── Raw indicator inputs (replace with live API values) ──────
export interface RawIndicators {
  // Rates
  yield10Y: number;           // e.g. 4.68
  yield30Y: number;           // e.g. 4.91
  yieldCurveSpread: number;   // 10Y-2Y bps, e.g. -42

  // Credit
  hySpread: number;           // HY OAS bps, e.g. 342
  igSpread: number;           // IG OAS bps, e.g. 95

  // Inflation / Fed
  cpi: number;                // e.g. 3.4
  ppi: number;                // e.g. 2.8
  fedFundsRate: number;       // e.g. 5.25

  // Speculation / AI Bubble
  aiConcentration: number;    // % of S&P 500, e.g. 32.4
  aiCapexGrowth: number;      // YoY %, e.g. 42

  // Sovereign / Debt
  auctionBidCover: number;    // e.g. 2.31
  debtToGdpPct: number;       // e.g. 123

  // Liquidity / Banking
  bankLiquidityStress: number; // 0-10 composite, e.g. 6.8
  fedBalanceSheet: number;     // $T, e.g. 7.4

  // Real Economy
  unemployment: number;        // %, e.g. 4.1
  consumerDelinquencies: number; // %, e.g. 3.1
  creStress: number;           // 0-10, e.g. 7.2

  // Volatility
  vix: number;                 // e.g. 22.4
}

// ── Default baseline (current conditions) ────────────────────
export const DEFAULT_INDICATORS: RawIndicators = {
  yield10Y: 4.68,
  yield30Y: 4.91,
  yieldCurveSpread: -42,
  hySpread: 342,
  igSpread: 95,
  cpi: 3.4,
  ppi: 2.8,
  fedFundsRate: 5.25,
  aiConcentration: 32.4,
  aiCapexGrowth: 42,
  auctionBidCover: 2.31,
  debtToGdpPct: 123,
  bankLiquidityStress: 6.8,
  fedBalanceSheet: 7.4,
  unemployment: 4.1,
  consumerDelinquencies: 3.1,
  creStress: 7.2,
  vix: 22.4,
};

// ── Engine output ─────────────────────────────────────────────
export interface DomainScore {
  id: string;
  label: string;
  score: number;       // 0–10
  delta: number;       // vs baseline
  riskLevel: 'critical' | 'high' | 'elevated' | 'moderate' | 'low';
  description: string;
  drivers: string[];   // top contributing factors
  /** Data freshness: live = FRED-sourced, delayed = FRED with lag, static = model estimate, fallback = last known value */
  dataStatus?: 'live' | 'delayed' | 'static' | 'fallback' | 'unavailable';
  /** Human-readable explanation when dataStatus is not live */
  fallbackReason?: string;
  /** Data source identifier e.g. FRED, Polygon, static-model */
  source?: string;
}

export interface RegimeOutput {
  label: string;
  sublabel: string;
  color: string;
  code: 'CRITICAL_SYSTEMIC' | 'LATE_CYCLE_FRAGILITY' | 'ELEVATED_STRESS' | 'MODERATE_RISK' | 'LOW_RISK';
  description: string;
}

export interface ProbabilityOutput {
  bullProbability: number;
  crashProbability: number;
  softLandingProbability: number;
  stagflationProbability: number;
  recessionProbability: number;
}

export interface AnalogSimilarity {
  id: string;
  era: string;
  year: string;
  similarity: number;   // 0–100
  matchReasons: string[];
}

export interface NarrativeOutput {
  regimeAssessment: string;
  summary: string;
  keyRisks: string[];
}

export interface EngineOutput {
  overall: DomainScore;
  domains: DomainScore[];
  regime: RegimeOutput;
  probability: ProbabilityOutput;
  analogs: AnalogSimilarity[];
  narrative: NarrativeOutput;
  tickerValues: { label: string; value: string; direction: 'up' | 'down' | 'flat' }[];
  alertPressure: { treasury: number; credit: number; aiRisk: number; liquidity: number };
}

// ── Scoring helpers ───────────────────────────────────────────
function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v));
}

function toRiskLevel(score: number): DomainScore['riskLevel'] {
  if (score >= 8.5) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 5.0) return 'elevated';
  if (score >= 3.0) return 'moderate';
  return 'low';
}

// ── Domain scoring functions ──────────────────────────────────

function scoreTreasuryDebt(ind: RawIndicators): DomainScore {
  // Inputs: yield curve inversion depth, auction demand, debt/GDP, 30Y yield
  const inversionScore = ind.yieldCurveSpread < 0
    ? clamp(Math.abs(ind.yieldCurveSpread) / 20)  // -200bps = 10
    : 0;
  const auctionScore = clamp((3.0 - ind.auctionBidCover) * 5);  // 2.0x = 5, 1.8x = 6
  const debtScore = clamp((ind.debtToGdpPct - 80) / 14);        // 80% = 0, 220% = 10
  const yieldScore = clamp((ind.yield30Y - 2.5) / 0.5);         // 2.5% = 0, 7.5% = 10

  const score = clamp(inversionScore * 0.30 + auctionScore * 0.35 + debtScore * 0.15 + yieldScore * 0.20);
  const drivers: string[] = [];
  if (inversionScore > 3) drivers.push(`Yield curve ${ind.yieldCurveSpread}bps inverted`);
  if (auctionScore > 4) drivers.push(`Auction bid-cover ${ind.auctionBidCover.toFixed(2)}x — weak demand`);
  if (debtScore > 3) drivers.push(`Debt/GDP at ${ind.debtToGdpPct}%`);
  if (yieldScore > 5) drivers.push(`30Y yield ${ind.yield30Y.toFixed(2)}% — fiscal premium rising`);

  return {
    id: 'treasury-debt', label: 'Treasury/Debt Stress', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 7.8).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'Auction demand, yield curve inversion, and fiscal deficit pressure composite.',
    drivers,
  };
}

function scoreInflationFed(ind: RawIndicators): DomainScore {
  const cpiScore = clamp((ind.cpi - 1.5) / 0.7);          // 1.5% = 0, 8.5% = 10
  const ppiScore = clamp((ind.ppi - 1.0) / 0.8);          // 1.0% = 0, 9.0% = 10
  const rateScore = clamp((ind.fedFundsRate - 1.0) / 0.5); // 1% = 0, 6% = 10
  // Policy error: high rates + rising unemployment = trapped Fed
  const policyErrorScore = clamp((ind.fedFundsRate - 2.0) * 0.8 + ind.unemployment * 0.4);

  const score = clamp(cpiScore * 0.30 + ppiScore * 0.20 + rateScore * 0.25 + policyErrorScore * 0.25);
  const drivers: string[] = [];
  if (cpiScore > 3) drivers.push(`CPI ${ind.cpi.toFixed(1)}% — above 2% target`);
  if (ppiScore > 3) drivers.push(`PPI ${ind.ppi.toFixed(1)}% — pipeline pressure`);
  if (rateScore > 5) drivers.push(`Fed Funds ${ind.fedFundsRate.toFixed(2)}% — restrictive`);
  if (policyErrorScore > 5) drivers.push('Policy error risk: stagflation trap');

  return {
    id: 'inflation-fed', label: 'Inflation/Fed Pressure', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 6.9).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'CPI/PPI re-acceleration risk and Fed policy error probability composite.',
    drivers,
  };
}

function scoreCreditMarket(ind: RawIndicators): DomainScore {
  const hyScore = clamp((ind.hySpread - 150) / 55);   // 150bps = 0, 700bps = 10
  const igScore = clamp((ind.igSpread - 50) / 25);    // 50bps = 0, 300bps = 10
  const creScore = ind.creStress;                      // already 0-10
  const delinqScore = clamp((ind.consumerDelinquencies - 1.0) / 0.5); // 1% = 0, 6% = 10

  const score = clamp(hyScore * 0.35 + igScore * 0.20 + creScore * 0.25 + delinqScore * 0.20);
  const drivers: string[] = [];
  if (hyScore > 3) drivers.push(`HY spreads ${ind.hySpread}bps — widening`);
  if (igScore > 3) drivers.push(`IG spreads ${ind.igSpread}bps — stress migrating`);
  if (creScore > 5) drivers.push(`CRE stress ${ind.creStress.toFixed(1)}/10 — cascade risk`);
  if (delinqScore > 4) drivers.push(`Consumer delinquencies ${ind.consumerDelinquencies.toFixed(1)}%`);

  return {
    id: 'credit-stress', label: 'Credit Market Stress', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 7.1).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'HY/IG spreads, CRE stress, and consumer delinquency composite.',
    drivers,
  };
}

function scoreAIBubble(ind: RawIndicators): DomainScore {
  const concScore = clamp((ind.aiConcentration - 15) / 2.5);  // 15% = 0, 40% = 10
  const capexScore = clamp((ind.aiCapexGrowth - 5) / 9.5);    // 5% = 0, 100% = 10
  // Valuation stretch proxy: concentration × capex growth
  const stretchScore = clamp((concScore + capexScore) / 2);

  const score = clamp(concScore * 0.45 + capexScore * 0.30 + stretchScore * 0.25);
  const drivers: string[] = [];
  if (concScore > 5) drivers.push(`AI/mega-cap S&P concentration ${ind.aiConcentration.toFixed(1)}%`);
  if (capexScore > 4) drivers.push(`Hyperscaler capex +${ind.aiCapexGrowth}% YoY`);
  if (stretchScore > 6) drivers.push('Monetization gap widening — capex exceeds revenue growth');

  return {
    id: 'ai-bubble', label: 'AI Bubble / Speculation', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 8.6).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'AI/mega-cap concentration, capex growth, and monetization gap composite.',
    drivers,
    dataStatus: 'static',
    fallbackReason: 'AI concentration baseline is a static model estimate. No live market-cap data source is currently wired. Score is adjusted dynamically by live FRED rate and spread inputs.',
    source: 'static-model',
  };
}

function scoreLiquidity(ind: RawIndicators): DomainScore {
  const bankScore = ind.bankLiquidityStress;                     // already 0-10
  const balanceSheetScore = clamp((9.5 - ind.fedBalanceSheet) / 0.25); // 9.5T = 0, 7T = 10
  const vixScore = clamp((ind.vix - 10) / 5);                   // 10 = 0, 60 = 10
  const unemployScore = clamp((ind.unemployment - 3.0) / 0.35); // 3% = 0, 6.5% = 10

  const score = clamp(bankScore * 0.35 + balanceSheetScore * 0.25 + vixScore * 0.20 + unemployScore * 0.20);
  const drivers: string[] = [];
  if (bankScore > 5) drivers.push(`Bank liquidity stress ${ind.bankLiquidityStress.toFixed(1)}/10`);
  if (balanceSheetScore > 3) drivers.push(`Fed balance sheet $${ind.fedBalanceSheet.toFixed(1)}T — QT ongoing`);
  if (vixScore > 3) drivers.push(`VIX ${ind.vix.toFixed(1)} — volatility elevated`);
  if (unemployScore > 3) drivers.push(`Unemployment ${ind.unemployment.toFixed(1)}% — rising`);

  return {
    id: 'liquidity', label: 'Liquidity Conditions', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 6.4).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'Bank liquidity, Fed balance sheet, volatility, and labor market composite.',
    drivers,
  };
}

function scoreRecession(ind: RawIndicators): DomainScore {
  // Sahm Rule proxy: unemployment rate of change
  const sahmScore = clamp((ind.unemployment - 3.5) / 0.35);
  const yieldInversionScore = ind.yieldCurveSpread < 0 ? clamp(Math.abs(ind.yieldCurveSpread) / 25) : 0;
  const creditScore = clamp((ind.hySpread - 200) / 60);
  const consumerScore = clamp((ind.consumerDelinquencies - 1.5) / 0.5);

  const score = clamp(sahmScore * 0.30 + yieldInversionScore * 0.30 + creditScore * 0.20 + consumerScore * 0.20);
  const drivers: string[] = [];
  if (sahmScore > 3) drivers.push(`Unemployment ${ind.unemployment.toFixed(1)}% — Sahm Rule approaching`);
  if (yieldInversionScore > 3) drivers.push('Yield curve inversion — historical recession precursor');
  if (creditScore > 3) drivers.push('Credit spreads widening — growth slowdown signal');

  return {
    id: 'recession', label: 'Recession Risk', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 6.2).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'Sahm Rule proxy, yield curve, credit spreads, and consumer stress composite.',
    drivers,
  };
}

function scoreBanking(ind: RawIndicators): DomainScore {
  const liquidityScore = ind.bankLiquidityStress;
  const creScore = ind.creStress;
  const delinqScore = clamp((ind.consumerDelinquencies - 1.0) / 0.5);
  const spreadScore = clamp((ind.hySpread - 200) / 60);

  const score = clamp(liquidityScore * 0.40 + creScore * 0.30 + delinqScore * 0.15 + spreadScore * 0.15);
  const drivers: string[] = [];
  if (liquidityScore > 5) drivers.push(`Bank liquidity stress ${ind.bankLiquidityStress.toFixed(1)}/10`);
  if (creScore > 5) drivers.push(`CRE exposure ${ind.creStress.toFixed(1)}/10 — regional bank risk`);

  return {
    id: 'banking', label: 'Banking System Stress', score: parseFloat(score.toFixed(2)),
    delta: parseFloat((score - 7.9).toFixed(2)),
    riskLevel: toRiskLevel(score),
    description: 'Regional bank liquidity, CRE exposure, and credit quality composite.',
    drivers,
  };
}

// ── Overall composite ─────────────────────────────────────────
function computeOverall(domains: DomainScore[]): DomainScore {
  const weights: Record<string, number> = {
    'treasury-debt': 0.18,
    'inflation-fed': 0.14,
    'credit-stress': 0.18,
    'ai-bubble': 0.16,
    'liquidity': 0.14,
    'recession': 0.10,
    'banking': 0.10,
  };
  const score = domains.reduce((acc, d) => acc + d.score * (weights[d.id] ?? 0.1), 0);
  const clamped = clamp(score);
  return {
    id: 'overall', label: 'Overall Systemic Risk',
    score: parseFloat(clamped.toFixed(2)),
    delta: parseFloat((clamped - 7.4).toFixed(2)),
    riskLevel: toRiskLevel(clamped),
    description: 'Weighted composite of all systemic stress dimensions.',
    drivers: domains.filter(d => d.score >= 7.0).map(d => `${d.label}: ${d.score.toFixed(1)}`),
  };
}

// ── Regime classifier ─────────────────────────────────────────
function classifyRegime(overall: number, domains: DomainScore[]): RegimeOutput {
  const aiScore = domains.find(d => d.id === 'ai-bubble')?.score ?? 0;
  const creditScore = domains.find(d => d.id === 'credit-stress')?.score ?? 0;
  const liquidityScore = domains.find(d => d.id === 'liquidity')?.score ?? 0;
  const recessionScore = domains.find(d => d.id === 'recession')?.score ?? 0;
  const inflationScore = domains.find(d => d.id === 'inflation-fed')?.score ?? 0;

  if (overall >= 8.5) {
    return {
      code: 'CRITICAL_SYSTEMIC', label: 'CRITICAL SYSTEMIC STRESS',
      sublabel: 'Imminent Systemic Event Risk',
      color: '#FF2D55',
      description: 'Multiple fault lines simultaneously critical. Systemic event probability very high.',
    };
  }
  if (overall >= 7.0) {
    // Differentiate sub-regime by dominant driver
    if (aiScore >= 8.5 && creditScore < 7.0) {
      return {
        code: 'LATE_CYCLE_FRAGILITY', label: 'AI BUBBLE FRAGILITY',
        sublabel: 'Speculation-Driven Late Cycle',
        color: '#FF2D55',
        description: 'AI/mega-cap concentration at historic extremes. Monetization gap widening. Dot-com analog elevated.',
      };
    }
    if (creditScore >= 8.0 && liquidityScore >= 7.0) {
      return {
        code: 'LATE_CYCLE_FRAGILITY', label: 'CREDIT CRUNCH RISK',
        sublabel: 'Liquidity & Credit Deterioration',
        color: '#FF2D55',
        description: 'Credit spreads and liquidity deteriorating simultaneously. 2007 analog elevated.',
      };
    }
    if (inflationScore >= 7.5 && recessionScore >= 6.5) {
      return {
        code: 'LATE_CYCLE_FRAGILITY', label: 'STAGFLATION TRAP',
        sublabel: 'Fed Policy Error Risk',
        color: '#FF9500',
        description: 'Inflation re-accelerating while growth slows. Fed trapped. 1970s analog elevated.',
      };
    }
    return {
      code: 'LATE_CYCLE_FRAGILITY', label: 'LATE-CYCLE FRAGILITY',
      sublabel: 'Elevated Systemic Stress',
      color: '#FF9500',
      description: 'Multiple fault lines converging. Credit, AI speculation, sovereign debt, and liquidity deterioration.',
    };
  }
  if (overall >= 5.0) {
    return {
      code: 'ELEVATED_STRESS', label: 'ELEVATED STRESS',
      sublabel: 'Watchful — Risk Rising',
      color: '#FFD700',
      description: 'Risk indicators elevated but not critical. Monitor for acceleration.',
    };
  }
  if (overall >= 3.0) {
    return {
      code: 'MODERATE_RISK', label: 'MODERATE RISK',
      sublabel: 'Contained — Vigilance Required',
      color: '#00D4FF',
      description: 'Systemic risk contained. Some stress pockets remain. Normal late-cycle conditions.',
    };
  }
  return {
    code: 'LOW_RISK', label: 'LOW RISK',
    sublabel: 'Stable — Benign Conditions',
    color: '#00FF88',
    description: 'All major indicators within normal ranges. No systemic stress detected.',
  };
}

// ── Probability engine ────────────────────────────────────────
function computeProbabilities(overall: number, domains: DomainScore[]): ProbabilityOutput {
  const aiScore = domains.find(d => d.id === 'ai-bubble')?.score ?? 0;
  const creditScore = domains.find(d => d.id === 'credit-stress')?.score ?? 0;
  const inflationScore = domains.find(d => d.id === 'inflation-fed')?.score ?? 0;
  const recessionScore = domains.find(d => d.id === 'recession')?.score ?? 0;
  const liquidityScore = domains.find(d => d.id === 'liquidity')?.score ?? 0;

  // Crash probability: driven by overall + credit + liquidity
  const crashRaw = clamp((overall * 0.40 + creditScore * 0.25 + liquidityScore * 0.20 + aiScore * 0.15) / 10 * 100, 0, 95);
  // Stagflation: driven by inflation + recession + high rates
  const stagflationRaw = clamp((inflationScore * 0.50 + recessionScore * 0.30 + (overall - 3) * 0.20) / 10 * 100, 0, 80);
  // Recession: driven by recession score + credit
  const recessionRaw = clamp((recessionScore * 0.60 + creditScore * 0.25 + liquidityScore * 0.15) / 10 * 100, 0, 90);
  // Soft landing: inversely correlated with overall risk
  const softLandingRaw = clamp(Math.max(0, 100 - overall * 12 - creditScore * 3), 0, 60);
  // Bull: inversely correlated with crash
  const bullRaw = clamp(100 - crashRaw - softLandingRaw * 0.3, 5, 50);

  // Normalize crash + bull to sum to 100 for the main bar
  const total = crashRaw + bullRaw;
  const crash = Math.round((crashRaw / total) * 100);
  const bull = 100 - crash;

  return {
    bullProbability: bull,
    crashProbability: crash,
    softLandingProbability: Math.round(softLandingRaw),
    stagflationProbability: Math.round(stagflationRaw),
    recessionProbability: Math.round(recessionRaw),
  };
}

// ── Historical analog similarity ──────────────────────────────
function computeAnalogSimilarity(ind: RawIndicators, domains: DomainScore[]): AnalogSimilarity[] {
  const aiScore = domains.find(d => d.id === 'ai-bubble')?.score ?? 0;
  const creditScore = domains.find(d => d.id === 'credit-stress')?.score ?? 0;
  const liquidityScore = domains.find(d => d.id === 'liquidity')?.score ?? 0;
  const inflationScore = domains.find(d => d.id === 'inflation-fed')?.score ?? 0;
  const recessionScore = domains.find(d => d.id === 'recession')?.score ?? 0;
  const treasuryScore = domains.find(d => d.id === 'treasury-debt')?.score ?? 0;

  // Dot-Com 2000: high speculation, high concentration, low credit stress
  const dotcomSim = clamp(
    aiScore * 0.45 +
    (ind.aiConcentration > 25 ? 3.0 : 0) +
    (creditScore < 6 ? 1.5 : 0) +
    (ind.vix > 20 ? 1.0 : 0)
  ) / 10 * 100;

  // GFC 2007: high credit stress, high liquidity stress, CRE stress
  const gfcSim = clamp(
    creditScore * 0.40 +
    liquidityScore * 0.25 +
    ind.creStress * 0.20 +
    (ind.hySpread > 300 ? 1.5 : 0)
  ) / 10 * 100;

  // COVID 2020: high volatility, sudden liquidity freeze, low prior warning
  const covidSim = clamp(
    (ind.vix - 15) * 0.5 +
    liquidityScore * 0.30 +
    (recessionScore > 5 ? 2.0 : 0)
  ) / 10 * 100;

  // 2022 Inflation/Rates: high inflation, rising rates, duration risk
  const inflationSim = clamp(
    inflationScore * 0.45 +
    treasuryScore * 0.30 +
    (ind.fedFundsRate > 4.0 ? 2.0 : 0)
  ) / 10 * 100;

  // 1970s Stagflation: high inflation + rising unemployment
  const stagflationSim = clamp(
    inflationScore * 0.40 +
    (ind.unemployment > 4.0 ? 2.5 : 0) +
    (ind.cpi > 4.0 ? 2.0 : 0)
  ) / 10 * 100;

  // Normalize to 0–100 range with realistic caps
  const normalize = (v: number, cap: number) => Math.round(Math.min(cap, Math.max(5, v)));

  const analogs: AnalogSimilarity[] = [
    {
      id: 'dotcom', era: 'Dot-Com Bubble', year: '2000',
      similarity: normalize(dotcomSim, 92),
      matchReasons: [
        `AI/mega-cap concentration ${ind.aiConcentration.toFixed(1)}% — exceeds 2000 peak`,
        `Speculation index ${aiScore.toFixed(1)}/10`,
        aiScore > 8 ? 'Monetization gap widening — capex vs revenue divergence' : 'Capex growth elevated',
      ].filter(Boolean),
    },
    {
      id: 'gfc', era: 'Credit Crisis', year: '2007–09',
      similarity: normalize(gfcSim, 88),
      matchReasons: [
        `HY spreads ${ind.hySpread}bps — widening`,
        `CRE stress ${ind.creStress.toFixed(1)}/10 — regional bank exposure`,
        creditScore > 7 ? 'Credit contagion pathway open' : 'Credit stress building',
      ].filter(Boolean),
    },
    {
      id: 'covid', era: 'COVID Shock', year: '2020',
      similarity: normalize(covidSim, 75),
      matchReasons: [
        `VIX ${ind.vix.toFixed(1)} — volatility elevated`,
        liquidityScore > 6 ? 'Liquidity conditions deteriorating' : 'Liquidity monitoring',
        recessionScore > 5 ? 'Recession risk rising' : 'Growth slowing',
      ].filter(Boolean),
    },
    {
      id: 'inflation2022', era: 'Inflation/Rates Shock', year: '2022',
      similarity: normalize(inflationSim, 85),
      matchReasons: [
        `CPI ${ind.cpi.toFixed(1)}% — above target`,
        `Fed Funds ${ind.fedFundsRate.toFixed(2)}% — restrictive`,
        treasuryScore > 6 ? 'Duration risk elevated' : 'Rate sensitivity high',
      ].filter(Boolean),
    },
    {
      id: 'stagflation1970', era: '1970s Stagflation', year: '1973–82',
      similarity: normalize(stagflationSim, 70),
      matchReasons: [
        `CPI ${ind.cpi.toFixed(1)}% — persistent above target`,
        `Unemployment ${ind.unemployment.toFixed(1)}% — rising`,
        inflationScore > 6 ? 'Fed trapped between inflation and growth' : 'Policy dilemma emerging',
      ].filter(Boolean),
    },
  ].sort((a, b) => b.similarity - a.similarity);

  return analogs;
}

// ── Narrative generator ───────────────────────────────────────
function generateNarrative(
  overall: DomainScore,
  domains: DomainScore[],
  regime: RegimeOutput,
  prob: ProbabilityOutput,
  analogs: AnalogSimilarity[]
): NarrativeOutput {
  const topAnalog = analogs[0];
  const criticalDomains = domains.filter(d => d.score >= 8.0);
  const highDomains = domains.filter(d => d.score >= 7.0 && d.score < 8.0);

  const domainSummary = criticalDomains.length > 0
    ? `Critical stress in ${criticalDomains.map(d => d.label).join(' and ')}.`
    : highDomains.length > 0
    ? `Elevated stress across ${highDomains.map(d => d.label).join(', ')}.`
    : 'All major stress indicators within moderate range.';

  const summary = [
    `Systemic risk composite at ${overall.score.toFixed(1)}/10 — ${overall.riskLevel.toUpperCase()} regime.`,
    domainSummary,
    `Crash/bear probability at ${prob.crashProbability}%, recession risk at ${prob.recessionProbability}%.`,
    `Highest historical analog match: ${topAnalog.era} ${topAnalog.year} at ${topAnalog.similarity}% similarity.`,
    regime.description,
  ].join(' ');

  const keyRisks = [...domains]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(d => `${d.label} (${d.score.toFixed(1)}/10): ${d.drivers[0] ?? d.description}`);

  return {
    regimeAssessment: `${regime.label} — ${regime.sublabel.toUpperCase()}`,
    summary,
    keyRisks,
  };
}

// ── Ticker values ─────────────────────────────────────────────
function buildTicker(ind: RawIndicators, overall: DomainScore): EngineOutput['tickerValues'] {
  return [
    { label: '10Y', value: `${ind.yield10Y.toFixed(2)}%`, direction: ind.yield10Y > 4.5 ? 'up' : 'down' },
    { label: 'HY SPREAD', value: `${ind.hySpread}bps`, direction: ind.hySpread > 300 ? 'up' : 'down' },
    { label: 'CPI', value: `${ind.cpi.toFixed(1)}%`, direction: ind.cpi > 3.0 ? 'up' : 'down' },
    { label: 'FED FUNDS', value: `${ind.fedFundsRate.toFixed(2)}%`, direction: 'flat' },
    { label: 'AI CONC.', value: `${ind.aiConcentration.toFixed(1)}%`, direction: 'up' },
    { label: 'SYSTEMIC RISK', value: `${overall.score.toFixed(1)}/10`, direction: overall.delta > 0 ? 'up' : 'down' },
    { label: 'CRE STRESS', value: `${ind.creStress.toFixed(1)}/10`, direction: 'up' },
    { label: 'VIX', value: ind.vix.toFixed(1), direction: ind.vix > 20 ? 'up' : 'down' },
    { label: 'RECESSION RISK', value: `${Math.round((ind.unemployment - 3.5) / 0.35 * 10)}%`, direction: 'up' },
    { label: 'YIELD CURVE', value: `${ind.yieldCurveSpread}bps`, direction: ind.yieldCurveSpread < 0 ? 'down' : 'up' },
  ];
}

// ── Alert pressure gauges ─────────────────────────────────────
function buildAlertPressure(domains: DomainScore[]): EngineOutput['alertPressure'] {
  return {
    treasury: Math.round((domains.find(d => d.id === 'treasury-debt')?.score ?? 0) * 10),
    credit: Math.round((domains.find(d => d.id === 'credit-stress')?.score ?? 0) * 10),
    aiRisk: Math.round((domains.find(d => d.id === 'ai-bubble')?.score ?? 0) * 10),
    liquidity: Math.round((domains.find(d => d.id === 'liquidity')?.score ?? 0) * 10),
  };
}

// ── Main compute function ─────────────────────────────────────
export function computeEngine(ind: RawIndicators): EngineOutput {
  const treasury = scoreTreasuryDebt(ind);
  const inflation = scoreInflationFed(ind);
  const credit = scoreCreditMarket(ind);
  const aiBubble = scoreAIBubble(ind);
  const liquidity = scoreLiquidity(ind);
  const recession = scoreRecession(ind);
  const banking = scoreBanking(ind);

  const domains = [treasury, inflation, credit, aiBubble, liquidity, recession, banking];
  const overall = computeOverall(domains);
  const regime = classifyRegime(overall.score, domains);
  const probability = computeProbabilities(overall.score, domains);
  const analogs = computeAnalogSimilarity(ind, domains);
  const narrative = generateNarrative(overall, domains, regime, probability, analogs);
  const tickerValues = buildTicker(ind, overall);
  const alertPressure = buildAlertPressure(domains);

  return { overall, domains, regime, probability, analogs, narrative, tickerValues, alertPressure };
}
