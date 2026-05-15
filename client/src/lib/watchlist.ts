/* ============================================================
   FAULTLINE — Watchlist Data Layer
   Types, indicator catalog, localStorage persistence,
   and threshold breach evaluation logic.
   ============================================================ */

export type AlertCondition = 'above' | 'below';
export type AlertSeverity = 'critical' | 'high' | 'moderate';

export interface WatchlistItem {
  id: string;
  indicatorKey: string;       // maps to IndicatorDef.key
  thresholdValue: number;
  condition: AlertCondition;  // 'above' | 'below'
  severity: AlertSeverity;
  label?: string;             // optional custom label override
  note?: string;              // optional user note
  createdAt: number;
  lastBreached?: number;      // timestamp of last breach
  breachCount: number;
}

export interface IndicatorDef {
  key: string;
  label: string;
  sublabel: string;
  unit: string;
  category: 'rates' | 'credit' | 'inflation' | 'speculation' | 'liquidity' | 'economy' | 'score';
  color: string;
  description: string;
  defaultThreshold: number;
  defaultCondition: AlertCondition;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  // API source for future live data wiring
  apiSource?: string;
  stressLevel: number;        // value at which this is "stressed"
  normalRange: [number, number];
}

// ── Complete indicator catalog ────────────────────────────────
export const INDICATOR_CATALOG: IndicatorDef[] = [
  // ── Domain Risk Scores ──────────────────────────────────────
  {
    key: 'score_overall',
    label: 'Overall Systemic Risk',
    sublabel: 'Composite Score',
    unit: '/10',
    category: 'score',
    color: '#00D4FF',
    description: 'Composite of all 7 domain risk scores. The primary FAULTLINE signal.',
    defaultThreshold: 7.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    stressLevel: 7.0,
    normalRange: [2, 5],
  },
  {
    key: 'score_credit',
    label: 'Credit Risk Score',
    sublabel: 'Domain Score',
    unit: '/10',
    category: 'score',
    color: '#FF9500',
    description: 'Credit market stress composite: HY spreads, CRE, bank liquidity.',
    defaultThreshold: 7.5,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    stressLevel: 7.0,
    normalRange: [2, 5],
  },
  {
    key: 'score_ai',
    label: 'AI Bubble Score',
    sublabel: 'Speculation Domain',
    unit: '/10',
    category: 'score',
    color: '#C084FC',
    description: 'AI/mega-cap concentration and speculation index.',
    defaultThreshold: 8.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    stressLevel: 7.5,
    normalRange: [2, 5],
  },
  {
    key: 'score_treasury',
    label: 'Treasury Stress Score',
    sublabel: 'Fiscal Domain',
    unit: '/10',
    category: 'score',
    color: '#FFD700',
    description: 'Sovereign debt, auction demand, and fiscal trajectory.',
    defaultThreshold: 7.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    stressLevel: 7.0,
    normalRange: [2, 5],
  },
  {
    key: 'score_recession',
    label: 'Recession Risk Score',
    sublabel: 'Economic Domain',
    unit: '/10',
    category: 'score',
    color: '#FF2D55',
    description: 'Yield curve, unemployment, and leading indicator composite.',
    defaultThreshold: 7.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    stressLevel: 7.0,
    normalRange: [2, 5],
  },

  // ── Rates ───────────────────────────────────────────────────
  {
    key: 'yield10Y',
    label: '10Y Treasury Yield',
    sublabel: 'DGS10',
    unit: '%',
    category: 'rates',
    color: '#00D4FF',
    description: 'Benchmark rate. Rising yields compress valuations and increase debt service costs.',
    defaultThreshold: 5.0,
    defaultCondition: 'above',
    min: 0.5, max: 8.0, step: 0.05,
    format: (v) => v.toFixed(2) + '%',
    apiSource: 'FRED/DGS10',
    stressLevel: 5.5,
    normalRange: [3.5, 4.5],
  },
  {
    key: 'yield30Y',
    label: '30Y Treasury Yield',
    sublabel: 'DGS30',
    unit: '%',
    category: 'rates',
    color: '#00D4FF',
    description: 'Long-end rate. Steepening signals fiscal concern and term premium re-emergence.',
    defaultThreshold: 5.5,
    defaultCondition: 'above',
    min: 0.5, max: 8.0, step: 0.05,
    format: (v) => v.toFixed(2) + '%',
    apiSource: 'FRED/DGS30',
    stressLevel: 5.5,
    normalRange: [3.8, 4.8],
  },
  {
    key: 'yieldCurveSpread',
    label: 'Yield Curve (10Y–2Y)',
    sublabel: 'T10Y2Y',
    unit: 'bps',
    category: 'rates',
    color: '#FF2D55',
    description: 'Inversion historically precedes recession by 12–18 months.',
    defaultThreshold: -150,
    defaultCondition: 'below',
    min: -300, max: 200, step: 5,
    format: (v) => (v >= 0 ? '+' : '') + Math.round(v) + 'bps',
    apiSource: 'FRED/T10Y2Y',
    stressLevel: -150,
    normalRange: [0, 100],
  },
  {
    key: 'fedFundsRate',
    label: 'Fed Funds / SOFR',
    sublabel: 'SOFR',
    unit: '%',
    category: 'rates',
    color: '#00FF88',
    description: 'Policy rate. Higher for longer compresses growth and stresses leveraged balance sheets.',
    defaultThreshold: 6.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.25,
    format: (v) => v.toFixed(2) + '%',
    apiSource: 'FRED/SOFR',
    stressLevel: 6.5,
    normalRange: [2, 4],
  },

  // ── Credit ──────────────────────────────────────────────────
  {
    key: 'hySpread',
    label: 'HY Credit Spread',
    sublabel: 'BAMLH0A0HYM2',
    unit: 'bps',
    category: 'credit',
    color: '#FF9500',
    description: 'High-yield spreads are the primary real-time credit stress signal.',
    defaultThreshold: 500,
    defaultCondition: 'above',
    min: 100, max: 1200, step: 10,
    format: (v) => Math.round(v) + 'bps',
    apiSource: 'FRED/BAMLH0A0HYM2',
    stressLevel: 500,
    normalRange: [250, 400],
  },
  {
    key: 'bankLiquidityStress',
    label: 'Bank Liquidity Stress',
    sublabel: 'NFCI proxy',
    unit: '/10',
    category: 'liquidity',
    color: '#FF9500',
    description: 'Bank stress triggers credit contraction and systemic contagion risk.',
    defaultThreshold: 8.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    apiSource: 'FRED/NFCI',
    stressLevel: 8.0,
    normalRange: [3, 6],
  },
  {
    key: 'creStress',
    label: 'CRE Stress Index',
    sublabel: 'CRE composite',
    unit: '/10',
    category: 'credit',
    color: '#FF2D55',
    description: 'Commercial real estate distress cascades through regional banks and CMBS.',
    defaultThreshold: 8.5,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    format: (v) => v.toFixed(1),
    stressLevel: 8.5,
    normalRange: [3, 6],
  },

  // ── Inflation ───────────────────────────────────────────────
  {
    key: 'cpi',
    label: 'CPI Inflation',
    sublabel: 'CPIAUCSL YoY',
    unit: '%',
    category: 'inflation',
    color: '#FFD700',
    description: 'Re-acceleration above 4% traps the Fed between inflation and recession.',
    defaultThreshold: 4.0,
    defaultCondition: 'above',
    min: 0, max: 15, step: 0.1,
    format: (v) => v.toFixed(1) + '%',
    apiSource: 'FRED/CPIAUCSL',
    stressLevel: 5.0,
    normalRange: [1.5, 3.0],
  },
  {
    key: 'ppi',
    label: 'PPI Inflation',
    sublabel: 'PPIACO YoY',
    unit: '%',
    category: 'inflation',
    color: '#FFD700',
    description: 'Producer prices lead CPI. Re-acceleration signals pipeline inflation pressure.',
    defaultThreshold: 4.5,
    defaultCondition: 'above',
    min: 0, max: 20, step: 0.1,
    format: (v) => v.toFixed(1) + '%',
    apiSource: 'FRED/PPIACO',
    stressLevel: 5.0,
    normalRange: [1.5, 3.5],
  },

  // ── Speculation ─────────────────────────────────────────────
  {
    key: 'aiConcentration',
    label: 'AI/Mega-Cap Concentration',
    sublabel: 'Top-7 S&P weight',
    unit: '%',
    category: 'speculation',
    color: '#C084FC',
    description: 'Extreme concentration creates single-point-of-failure systemic fragility.',
    defaultThreshold: 38,
    defaultCondition: 'above',
    min: 10, max: 50, step: 0.5,
    format: (v) => v.toFixed(1) + '%',
    stressLevel: 40,
    normalRange: [15, 30],
  },
  {
    key: 'vix',
    label: 'VIX Volatility',
    sublabel: 'CBOE VIX',
    unit: '',
    category: 'liquidity',
    color: '#C084FC',
    description: 'Elevated VIX signals fear, margin calls, and forced deleveraging cascades.',
    defaultThreshold: 35,
    defaultCondition: 'above',
    min: 8, max: 90, step: 1,
    format: (v) => v.toFixed(1),
    stressLevel: 35,
    normalRange: [12, 25],
  },

  // ── Economy ─────────────────────────────────────────────────
  {
    key: 'unemployment',
    label: 'Unemployment Rate',
    sublabel: 'UNRATE',
    unit: '%',
    category: 'economy',
    color: '#00FF88',
    description: 'Rising unemployment triggers Sahm Rule recession signal above 0.5pp increase.',
    defaultThreshold: 5.5,
    defaultCondition: 'above',
    min: 2.0, max: 12.0, step: 0.1,
    format: (v) => v.toFixed(1) + '%',
    apiSource: 'FRED/UNRATE',
    stressLevel: 6.0,
    normalRange: [3.5, 5.0],
  },
];

export const INDICATOR_MAP = Object.fromEntries(INDICATOR_CATALOG.map(d => [d.key, d]));

// ── Persistence ───────────────────────────────────────────────
const STORAGE_KEY = 'faultline_watchlist_v1';

export function loadWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWatchlist();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultWatchlist();
  } catch {
    return getDefaultWatchlist();
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function getDefaultWatchlist(): WatchlistItem[] {
  const now = Date.now();
  return [
    {
      id: 'default-1',
      indicatorKey: 'score_overall',
      thresholdValue: 7.0,
      condition: 'above',
      severity: 'critical',
      note: 'Systemic risk entering high-stress territory',
      createdAt: now,
      breachCount: 0,
    },
    {
      id: 'default-2',
      indicatorKey: 'hySpread',
      thresholdValue: 500,
      condition: 'above',
      severity: 'high',
      note: 'Credit crunch threshold — 2008 analog',
      createdAt: now,
      breachCount: 0,
    },
    {
      id: 'default-3',
      indicatorKey: 'yieldCurveSpread',
      thresholdValue: -200,
      condition: 'below',
      severity: 'high',
      note: 'Deep inversion — recession probability >80%',
      createdAt: now,
      breachCount: 0,
    },
    {
      id: 'default-4',
      indicatorKey: 'vix',
      thresholdValue: 35,
      condition: 'above',
      severity: 'moderate',
      note: 'Panic threshold — forced deleveraging risk',
      createdAt: now,
      breachCount: 0,
    },
  ];
}

// ── Breach evaluation ─────────────────────────────────────────
export function evaluateBreach(item: WatchlistItem, currentValue: number): boolean {
  if (item.condition === 'above') return currentValue > item.thresholdValue;
  return currentValue < item.thresholdValue;
}

export function getBreachDistance(item: WatchlistItem, currentValue: number, def: IndicatorDef): number {
  // Returns 0–1: how close we are to the threshold (1 = breached)
  const range = def.max - def.min;
  if (range === 0) return 0;
  const dist = Math.abs(currentValue - item.thresholdValue) / range;
  return Math.max(0, Math.min(1, 1 - dist * 3));
}

export function nanoid8(): string {
  return Math.random().toString(36).slice(2, 10);
}
