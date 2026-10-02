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
  /**
   * Schema marker stored inside the item (same faultline_watchlist_v1 value):
   * 100 = this score_overall threshold is on the canonical 0–100 scale.
   * Absent = written by a pre-/100 bundle (0–10 scale).
   */
  overallScale?: 100;
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
  /**
   * Display only. Stored thresholds stay on the def's own min/max/step scale
   * (localStorage / API / DB unchanged); the UI shows value × displayFactor and
   * the slider moves in displayStep units on that display scale.
   */
  displayFactor?: number;
  displayStep?: number;
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
    sublabel: 'Canonical Pressure Index',
    // Same 0–100 scale as NOW, Pressure and the header strip (was 0–10).
    unit: '/100',
    category: 'score',
    color: '#00D4FF',
    description: 'The canonical FAULTLINE Pressure Index (0–100), the same score shown on NOW and the Pressure Engine.',
    defaultThreshold: 70,
    defaultCondition: 'above',
    min: 0, max: 100, step: 1,
    format: (v) => v.toFixed(0),
    stressLevel: 70,
    normalRange: [20, 50],
  },
  {
    key: 'score_credit',
    label: 'Credit Risk Score',
    sublabel: 'Domain Score',
    unit: '/100',
    category: 'score',
    color: '#FF9500',
    description: 'Credit market stress composite: HY spreads, CRE, bank liquidity.',
    defaultThreshold: 7.5,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    // Stored 0–10 (unchanged); shown on the 0–100 display scale.
    format: (v) => (v * 10).toFixed(0),
    displayFactor: 10, displayStep: 10,
    stressLevel: 7.0,
    normalRange: [2, 5],
  },
  {
    key: 'score_ai',
    label: 'AI Bubble Score',
    sublabel: 'Speculation Domain',
    unit: '/100',
    category: 'score',
    color: '#C084FC',
    description: 'AI/mega-cap concentration and speculation index.',
    defaultThreshold: 8.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    // Stored 0–10 (unchanged); shown on the 0–100 display scale.
    format: (v) => (v * 10).toFixed(0),
    displayFactor: 10, displayStep: 10,
    stressLevel: 7.5,
    normalRange: [2, 5],
  },
  {
    key: 'score_treasury',
    label: 'Treasury Stress Score',
    sublabel: 'Fiscal Domain',
    unit: '/100',
    category: 'score',
    color: '#FFD700',
    description: 'Sovereign debt, auction demand, and fiscal trajectory.',
    defaultThreshold: 7.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    // Stored 0–10 (unchanged); shown on the 0–100 display scale.
    format: (v) => (v * 10).toFixed(0),
    displayFactor: 10, displayStep: 10,
    stressLevel: 7.0,
    normalRange: [2, 5],
  },
  {
    key: 'score_recession',
    label: 'Recession Risk Score',
    sublabel: 'Economic Domain',
    unit: '/100',
    category: 'score',
    color: '#FF2D55',
    description: 'Yield curve, unemployment, and leading indicator composite.',
    defaultThreshold: 7.0,
    defaultCondition: 'above',
    min: 0, max: 10, step: 0.1,
    // Stored 0–10 (unchanged); shown on the 0–100 display scale.
    format: (v) => (v * 10).toFixed(0),
    displayFactor: 10, displayStep: 10,
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
    description: 'High-yield spreads are the primary regularly refreshed credit stress signal.',
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
    unit: 'index 0–10',
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
    unit: 'index 0–10',
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
export const WATCHLIST_STORAGE_KEY = STORAGE_KEY;
/** Fallback for a missing / invalid 'above' score_overall threshold (the stress level). */
export const OVERALL_DEFAULT_THRESHOLD = 70;
/** Fallback for a missing / invalid 'below' threshold: bottom of the normal range, so it doesn't fire at a normal reading. */
export const OVERALL_DEFAULT_BELOW_THRESHOLD = 20;
/**
 * Flag key written only by the pre-release 96c3256 build of this PR. When it is
 * '100', unmarked items were already converted to /100 by that build and must not
 * be scaled again. It is removed after the first successful load.
 */
export const LEGACY_OVERALL_SCALE_KEY = 'faultline_watchlist_overall_scale';

/** Direction-aware fallback: never 'below 70', which would breach at a normal 33. */
export function overallFallbackThreshold(condition: unknown): number {
  // evaluateBreach treats anything other than 'above' as 'below'.
  return condition === 'above' ? OVERALL_DEFAULT_THRESHOLD : OVERALL_DEFAULT_BELOW_THRESHOLD;
}

/** 0 is a legitimate threshold (the edit dialog's minimum); negatives / non-finite are not. */
function validOverallThreshold(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Normalize one stored item to the canonical 0–100 overall-score scale.
 * The scale marker lives on the item itself, so every read and write path
 * agrees without a separate flag key:
 *  - overallScale === 100 → already /100; kept.
 *  - unmarked, finite, 0–10 → old 0–10 value; ×10 exactly once.
 *  - unmarked and > 10 → already /100; kept as is.
 *  - null / NaN / non-number / negative → direction-aware fallback
 *    (above → 70, below → 20). Never null.
 * The result is always marked, so normalizing again is a no-op (idempotent).
 * `alreadyScaled` (legacy 96c3256 flag present) keeps unmarked values unscaled.
 */
export function normalizeOverallItem(item: WatchlistItem, alreadyScaled = false): WatchlistItem {
  if (item.indicatorKey !== 'score_overall') return item;
  const v = item.thresholdValue as unknown;
  let thresholdValue: number;
  if (!validOverallThreshold(v)) thresholdValue = overallFallbackThreshold(item.condition);
  else if (item.overallScale === 100 || alreadyScaled || v > 10) thresholdValue = v;
  else thresholdValue = Math.round(v * 100) / 10;
  return { ...item, thresholdValue, overallScale: 100 };
}

/** Pure migration of a stored list (idempotent). */
export function migrateOverallScale(items: WatchlistItem[], alreadyScaled = false): WatchlistItem[] {
  return items
    .filter((item): item is WatchlistItem => !!item && typeof item === 'object' && typeof (item as WatchlistItem).indicatorKey === 'string')
    .map(item => normalizeOverallItem(item, alreadyScaled));
}

/** Items written by this bundle are /100: mark them (invalid → direction-aware fallback), never ×10. */
function markForSave(items: WatchlistItem[]): WatchlistItem[] {
  return items.map(item => item.indicatorKey === 'score_overall'
    ? { ...item, thresholdValue: validOverallThreshold(item.thresholdValue) ? item.thresholdValue : overallFallbackThreshold(item.condition), overallScale: 100 as const }
    : item);
}

function readLegacyScaleFlag(): boolean {
  try { return localStorage.getItem(LEGACY_OVERALL_SCALE_KEY) === '100'; } catch { return false; }
}

function removeLegacyScaleFlag(): void {
  try { localStorage.removeItem(LEGACY_OVERALL_SCALE_KEY); } catch { /* unavailable */ }
}

function writeItems(items: WatchlistItem[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    // Storage full or unavailable — fail silently
    return false;
  }
}

export function loadWatchlist(): WatchlistItem[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: defaults (already /100, marked); nothing to persist.
    return getDefaultWatchlist();
  }
  let parsed: unknown = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!Array.isArray(parsed)) {
    // No key, corrupt JSON or wrong shape: store marked /100 defaults so no
    // later load (e.g. AppLayout) can mistake them for 0–10 values.
    const defaults = getDefaultWatchlist();
    if (writeItems(defaults)) removeLegacyScaleFlag();
    return defaults;
  }
  const next = migrateOverallScale(parsed as WatchlistItem[], readLegacyScaleFlag());
  // Remove the legacy flag only once the marked list is persisted, so a failed
  // write can't cause a second ×10 on the next load.
  if (JSON.stringify(next) === raw || writeItems(next)) removeLegacyScaleFlag();
  return next;
}

export function saveWatchlist(items: WatchlistItem[]): void {
  writeItems(markForSave(items));
}

export function getDefaultWatchlist(): WatchlistItem[] {
  const now = Date.now();
  return [
    {
      id: 'default-1',
      indicatorKey: 'score_overall',
      thresholdValue: OVERALL_DEFAULT_THRESHOLD,
      overallScale: 100,
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

// ── Threshold slider (display scale ↔ stored scale) ───────────
export interface ThresholdSlider {
  min: number; max: number; step: number;
  /** stored value → slider position */
  toDisplay: (stored: number) => number;
  /** slider position → stored value (what is saved) */
  toStored: (display: number) => number;
}

export function thresholdSlider(def: Pick<IndicatorDef, 'min' | 'max' | 'step' | 'displayFactor' | 'displayStep'> | undefined): ThresholdSlider {
  if (!def) return { min: 0, max: 10, step: 0.1, toDisplay: v => v, toStored: v => v };
  const f = def.displayFactor ?? 1;
  return {
    min: def.min * f,
    max: def.max * f,
    step: def.displayStep ?? def.step * f,
    toDisplay: v => Math.round(v * f * 1000) / 1000,
    toStored: v => Math.round((v / f) * 1000) / 1000,
  };
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
