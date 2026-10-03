// ============================================================
// FAULTLINE — Chart Data Module
// Structured placeholder data ready for live API integration.
//
// API integration targets (future):
//   - FRED (Federal Reserve Economic Data): yields, CPI, unemployment
//   - Polygon.io: equity prices, volatility, options flow
//   - Alpha Vantage: macro indicators, forex, commodities
//   - TradingView Lightweight Charts: candlestick overlays
//   - FINRA TRACE: credit spread data
// ============================================================

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y';

export interface DataPoint {
  date: string;   // ISO date string — replace with API timestamp
  value: number;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  data: DataPoint[];
  unit: string;
  apiSource?: string;   // e.g. "FRED:T10Y2Y"
  apiEndpoint?: string; // e.g. "https://api.stlouisfed.org/fred/series/observations"
}

// ---- Deterministic seeded pseudo-random (no re-render flicker) ----
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ---- Systemic Pressure Timeline ----
// No stored pressure history is wired into this module, so the timeline is empty
// and the static snapshot is "Unavailable". Charts.tsx overrides the snapshot with
// the live engine score when the engine is live.
export function getSystemicPressureData(_tf: Timeframe): DataPoint[] {
  return [];
}

export interface SystemicPressureSnapshot {
  current: string;
  prior: string;
  delta: number | null;
  deltaLabel: string;
  trend: 'rising' | 'falling' | 'stable';
}

export function getSystemicPressureSnapshot(_tf: Timeframe): SystemicPressureSnapshot {
  return { current: 'Unavailable', prior: '—', delta: null, deltaLabel: 'Unavailable', trend: 'stable' };
}

// ---- Macro Chart Cards ----
// Each card has data for all 5 timeframes

export interface MacroChartCard {
  id: string;
  title: string;
  subtitle: string;
  unit: string;
  currentValue: string;
  changeLabel: string;
  changeDirection: 'up' | 'down' | 'flat';
  riskLevel: 'critical' | 'high' | 'elevated' | 'moderate' | 'low' | 'unavailable';
  color: string;
  interpretation: string;
  apiSource: string;
  series: Record<Timeframe, DataPoint[]>;
  // Optional secondary series for overlay
  secondarySeries?: Record<Timeframe, DataPoint[]>;
  secondaryLabel?: string;
  secondaryColor?: string;
}

// No live feed is connected to these cards. Their value, change, risk level and
// history are withheld ("Unavailable") rather than shown as fixed or seeded
// placeholder numbers. Live canonical engine values are shown on Now / Pressure.
const UNAVAILABLE_SERIES: Record<Timeframe, DataPoint[]> = { "1D": [], "1W": [], "1M": [], "3M": [], "1Y": [] };
const NO_FEED = "No live data feed is connected to this card.";

export const macroChartCards: MacroChartCard[] = [
  {
    id: 'yield-curve-stress',
    title: 'Yield Curve Stress',
    subtitle: '10Y–2Y Treasury Spread (bps)',
    unit: '',
    currentValue: 'Unavailable',
    changeLabel: 'Unavailable',
    changeDirection: 'flat',
    riskLevel: 'unavailable',
    color: '#6B7280',
    interpretation: 'The spread between 10-year and 2-year Treasury yields. Inversions have preceded most U.S. recessions with long and variable lead times; this is context, not a recession probability.',
    apiSource: NO_FEED,
    series: UNAVAILABLE_SERIES,
  },
  {
    id: 'credit-spread-stress',
    title: 'Credit Spread Stress',
    subtitle: 'HY OAS vs IG OAS (bps)',
    unit: '',
    currentValue: 'Unavailable',
    changeLabel: 'Unavailable',
    changeDirection: 'flat',
    riskLevel: 'unavailable',
    color: '#6B7280',
    interpretation: 'High-yield and investment-grade option-adjusted spreads. Widening spreads indicate rising compensation demanded for credit risk.',
    apiSource: NO_FEED,
    series: UNAVAILABLE_SERIES,
  },
  {
    id: 'volatility-pulse',
    title: 'Volatility Pulse',
    subtitle: 'Implied Volatility Index (VIX equiv.)',
    unit: '',
    currentValue: 'Unavailable',
    changeLabel: 'Unavailable',
    changeDirection: 'flat',
    riskLevel: 'unavailable',
    color: '#6B7280',
    interpretation: 'Equity implied volatility. Rising implied volatility indicates the options market is pricing larger moves.',
    apiSource: NO_FEED,
    series: UNAVAILABLE_SERIES,
  },
  {
    id: 'liquidity-pressure',
    title: 'Liquidity Pressure',
    subtitle: 'Fed Reserve Balance Sheet + Repo Stress',
    unit: '',
    currentValue: 'Unavailable',
    changeLabel: 'Unavailable',
    changeDirection: 'flat',
    riskLevel: 'unavailable',
    color: '#6B7280',
    interpretation: 'Federal Reserve balance sheet and funding-market conditions. Shrinking reserves and rising repo rates relative to policy rates indicate tighter liquidity.',
    apiSource: NO_FEED,
    series: UNAVAILABLE_SERIES,
  },
  {
    id: 'ai-bubble-index',
    title: 'AI Bubble / Speculation Index',
    subtitle: 'Mega-cap AI concentration',
    unit: '',
    currentValue: 'Unavailable',
    changeLabel: 'Unavailable',
    changeDirection: 'flat',
    riskLevel: 'unavailable',
    color: '#6B7280',
    interpretation: 'Concentration of index weight in mega-cap AI names. FAULTLINE uses a static AI-concentration baseline and does not ingest AI capital-expenditure data.',
    apiSource: NO_FEED,
    series: UNAVAILABLE_SERIES,
  },
  {
    id: 'treasury-debt-stress',
    title: 'Treasury / Debt Stress',
    subtitle: 'Auction demand + fiscal deficit pressure',
    unit: '',
    currentValue: 'Unavailable',
    changeLabel: 'Unavailable',
    changeDirection: 'flat',
    riskLevel: 'unavailable',
    color: '#6B7280',
    interpretation: 'Treasury auction demand and fiscal-deficit pressure on term premia.',
    apiSource: NO_FEED,
    series: UNAVAILABLE_SERIES,
  },
];

// ---- Historical Overlay Data ----
// All series indexed to 100 at start for comparison
// API target: Polygon.io historical equity data, FRED for macro

export interface HistoricalOverlayScenario {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  startYear: string;
  peakDrawdown: string;
  duration: string;
  description: string;
  data: DataPoint[];
}

function buildCrisisPath(
  seed: number,
  points: number,
  // shape: array of [progress_pct, value] control points
  shape: [number, number][]
): DataPoint[] {
  const rand = seededRand(seed);
  const now = new Date('2026-05-13');
  const data: DataPoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // Interpolate shape
    let v = 100;
    for (let j = 0; j < shape.length - 1; j++) {
      const [t0, v0] = shape[j];
      const [t1, v1] = shape[j + 1];
      if (t >= t0 && t <= t1) {
        const frac = (t - t0) / (t1 - t0);
        v = v0 + (v1 - v0) * frac;
        break;
      }
    }
    // Add noise
    v = v + (rand() - 0.5) * 3;
    const d = new Date(now);
    d.setDate(d.getDate() - (points - 1 - i) * 3);
    data.push({ date: d.toISOString().slice(0, 10), value: parseFloat(v.toFixed(2)) });
  }
  return data;
}

export const historicalOverlayScenarios: HistoricalOverlayScenario[] = [
  {
    id: 'dotcom',
    label: 'Dot-Com Bubble 2000',
    shortLabel: '2000',
    color: '#C084FC',
    startYear: '2000',
    peakDrawdown: '-78%',
    duration: '31 months',
    description: 'Nasdaq collapsed 78% as tech valuations disconnected from earnings. AI bubble shows similar concentration and capex-to-revenue divergence.',
    data: buildCrisisPath(301, 80, [
      [0, 100], [0.15, 118], [0.25, 108], [0.35, 88], [0.50, 62],
      [0.65, 42], [0.75, 32], [0.85, 28], [1.0, 35],
    ]),
  },
  {
    id: 'gfc',
    label: 'Credit Crisis 2007–09',
    shortLabel: '2008',
    color: '#FF2D55',
    startYear: '2007',
    peakDrawdown: '-57%',
    duration: '17 months',
    description: 'Credit bubble implosion triggered by subprime defaults cascading through leveraged bank balance sheets. CRE stress and regional bank exposure echo current conditions.',
    data: buildCrisisPath(302, 80, [
      [0, 100], [0.10, 105], [0.20, 95], [0.30, 82], [0.40, 68],
      [0.50, 52], [0.60, 43], [0.70, 50], [0.85, 58], [1.0, 72],
    ]),
  },
  {
    id: 'covid',
    label: 'COVID Shock 2020',
    shortLabel: '2020',
    color: '#00D4FF',
    startYear: '2020',
    peakDrawdown: '-34%',
    duration: '5 weeks',
    description: 'Fastest bear market in history. Exogenous shock triggering liquidity freeze. Fed intervention unprecedented — laid groundwork for current inflation regime.',
    data: buildCrisisPath(303, 80, [
      [0, 100], [0.08, 98], [0.15, 85], [0.20, 68], [0.25, 66],
      [0.35, 78], [0.50, 92], [0.65, 105], [0.80, 118], [1.0, 130],
    ]),
  },
  {
    id: 'inflation2022',
    label: '2022 Inflation/Rates Shock',
    shortLabel: '2022',
    color: '#FF9500',
    startYear: '2022',
    peakDrawdown: '-25%',
    duration: '12 months',
    description: 'Fastest Fed hiking cycle in 40 years crushed both equities and bonds simultaneously. Duration risk crystallized. Current re-acceleration risk threatens repeat.',
    data: buildCrisisPath(304, 80, [
      [0, 100], [0.10, 96], [0.20, 88], [0.30, 80], [0.40, 75],
      [0.50, 78], [0.60, 82], [0.70, 85], [0.85, 90], [1.0, 95],
    ]),
  },
];

// Current trajectory for overlay comparison
export const currentTrajectoryData: DataPoint[] = buildCrisisPath(401, 80, [
  [0, 100], [0.20, 104], [0.40, 108], [0.55, 112], [0.70, 109],
  [0.80, 113], [0.90, 116], [1.0, 115],
]);

// ---- Correlation / Risk Map ----
export interface CorrelationNode {
  id: string;
  label: string;
  value: number;       // current stress level 0–100
  color: string;
  x: number;           // layout position 0–100
  y: number;
}

export interface CorrelationEdge {
  from: string;
  to: string;
  correlation: number;  // -1 to 1
  stressed: boolean;    // true = correlation breakdown / stress contagion
}

export const correlationNodes: CorrelationNode[] = [
  { id: 'equities',   label: 'Equities',       value: 62, color: '#00D4FF', x: 50, y: 15 },
  { id: 'bonds',      label: 'Bonds',          value: 78, color: '#FF9500', x: 82, y: 40 },
  { id: 'volatility', label: 'Volatility',     value: 55, color: '#FFD700', x: 82, y: 70 },
  { id: 'credit',     label: 'Credit',         value: 71, color: '#FF9500', x: 50, y: 88 },
  { id: 'liquidity',  label: 'Liquidity',      value: 64, color: '#FFD700', x: 18, y: 70 },
  { id: 'dollar',     label: 'Dollar Strength',value: 58, color: '#00FF88', x: 18, y: 40 },
];

export const correlationEdges: CorrelationEdge[] = [
  { from: 'equities',   to: 'bonds',      correlation: -0.42, stressed: true  },
  { from: 'equities',   to: 'volatility', correlation: -0.85, stressed: false },
  { from: 'equities',   to: 'credit',     correlation:  0.68, stressed: true  },
  { from: 'equities',   to: 'liquidity',  correlation:  0.55, stressed: true  },
  { from: 'equities',   to: 'dollar',     correlation: -0.31, stressed: false },
  { from: 'bonds',      to: 'volatility', correlation:  0.22, stressed: false },
  { from: 'bonds',      to: 'credit',     correlation:  0.74, stressed: true  },
  { from: 'bonds',      to: 'liquidity',  correlation:  0.61, stressed: true  },
  { from: 'bonds',      to: 'dollar',     correlation:  0.48, stressed: false },
  { from: 'volatility', to: 'credit',     correlation:  0.79, stressed: true  },
  { from: 'volatility', to: 'liquidity',  correlation:  0.66, stressed: true  },
  { from: 'credit',     to: 'liquidity',  correlation:  0.88, stressed: true  },
  { from: 'liquidity',  to: 'dollar',     correlation: -0.52, stressed: false },
];
