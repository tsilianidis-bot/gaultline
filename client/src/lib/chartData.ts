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

function buildSeries(
  seed: number,
  points: number,
  base: number,
  drift: number,       // positive = trending up
  volatility: number,
  intervalDays: number
): DataPoint[] {
  const rand = seededRand(seed);
  const now = new Date('2026-05-13');
  const data: DataPoint[] = [];
  let v = base;
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * intervalDays);
    v = v + drift + (rand() - 0.48) * volatility;
    v = Math.max(base * 0.3, v); // floor
    data.push({ date: d.toISOString().slice(0, 10), value: parseFloat(v.toFixed(3)) });
  }
  return data;
}

// ---- Timeframe configs ----
const TF: Record<Timeframe, { points: number; intervalDays: number; label: string }> = {
  '1D':  { points: 24,  intervalDays: 0,    label: 'Intraday (hourly)' },
  '1W':  { points: 7,   intervalDays: 1,    label: '7 days' },
  '1M':  { points: 30,  intervalDays: 1,    label: '30 days' },
  '3M':  { points: 90,  intervalDays: 1,    label: '90 days' },
  '1Y':  { points: 52,  intervalDays: 7,    label: '52 weeks' },
};

// ---- Systemic Pressure Timeline ----
// API target: composite of FRED indicators + proprietary scoring
export function getSystemicPressureData(tf: Timeframe): DataPoint[] {
  const cfg = TF[tf];
  // Score trends upward toward current 7.4
  return buildSeries(42, cfg.points, 5.8, 0.03, 0.18, cfg.intervalDays || 1);
}

export interface SystemicPressureSnapshot {
  current: number;
  prior: number;
  delta: number;
  deltaLabel: string;
  trend: 'rising' | 'falling' | 'stable';
}

export function getSystemicPressureSnapshot(tf: Timeframe): SystemicPressureSnapshot {
  const data = getSystemicPressureData(tf);
  const current = 7.4;
  const prior = data[Math.max(0, data.length - 2)]?.value ?? 7.1;
  const delta = parseFloat((current - prior).toFixed(2));
  return {
    current,
    prior: parseFloat(prior.toFixed(2)),
    delta,
    deltaLabel: `${delta >= 0 ? '+' : ''}${delta}`,
    trend: delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'stable',
  };
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
  riskLevel: 'critical' | 'high' | 'elevated' | 'moderate' | 'low';
  color: string;
  interpretation: string;
  apiSource: string;
  series: Record<Timeframe, DataPoint[]>;
  // Optional secondary series for overlay
  secondarySeries?: Record<Timeframe, DataPoint[]>;
  secondaryLabel?: string;
  secondaryColor?: string;
}

export const macroChartCards: MacroChartCard[] = [
  {
    id: 'yield-curve-stress',
    title: 'Yield Curve Stress',
    subtitle: '10Y–2Y Treasury Spread (bps)',
    unit: 'bps',
    currentValue: '-42',
    changeLabel: '+8bps',
    changeDirection: 'up',
    riskLevel: 'high',
    color: '#FF9500',
    interpretation: 'Persistent inversion signals recession risk. Spread narrowing from -108bps low but still inverted. Historical: every recession since 1955 preceded by inversion.',
    apiSource: 'FRED: T10Y2Y — https://fred.stlouisfed.org/series/T10Y2Y',
    series: {
      '1D': buildSeries(101, 24, -42, 0.1, 1.2, 1),
      '1W': buildSeries(101, 7, -50, 1.2, 2.5, 1),
      '1M': buildSeries(101, 30, -65, 0.8, 3.0, 1),
      '3M': buildSeries(101, 90, -90, 0.5, 3.5, 1),
      '1Y': buildSeries(101, 52, -108, 1.2, 4.0, 7),
    },
    secondarySeries: {
      '1D': buildSeries(201, 24, 4.68, 0.001, 0.012, 1),
      '1W': buildSeries(201, 7, 4.55, 0.018, 0.025, 1),
      '1M': buildSeries(201, 30, 4.40, 0.009, 0.018, 1),
      '3M': buildSeries(201, 90, 4.20, 0.005, 0.015, 1),
      '1Y': buildSeries(201, 52, 3.90, 0.015, 0.020, 7),
    },
    secondaryLabel: '10Y Yield %',
    secondaryColor: '#00D4FF',
  },
  {
    id: 'credit-spread-stress',
    title: 'Credit Spread Stress',
    subtitle: 'HY OAS vs IG OAS (bps)',
    unit: 'bps',
    currentValue: '342',
    changeLabel: '+18bps',
    changeDirection: 'up',
    riskLevel: 'high',
    color: '#FF9500',
    interpretation: 'HY spreads at 342bps — widening from 2023 lows of 290bps. IG spreads also moving. Credit stress migrating from CRE into broader corporate sector.',
    apiSource: 'FRED: BAMLH0A0HYM2 (HY), BAMLC0A0CM (IG)',
    series: {
      '1D': buildSeries(102, 24, 342, 0.5, 3.0, 1),
      '1W': buildSeries(102, 7, 325, 2.5, 5.0, 1),
      '1M': buildSeries(102, 30, 310, 1.1, 6.0, 1),
      '3M': buildSeries(102, 90, 295, 0.5, 7.0, 1),
      '1Y': buildSeries(102, 52, 280, 1.5, 8.0, 7),
    },
    secondarySeries: {
      '1D': buildSeries(202, 24, 95, 0.1, 0.8, 1),
      '1W': buildSeries(202, 7, 91, 0.6, 1.2, 1),
      '1M': buildSeries(202, 30, 88, 0.25, 1.5, 1),
      '3M': buildSeries(202, 90, 82, 0.14, 1.8, 1),
      '1Y': buildSeries(202, 52, 78, 0.4, 2.0, 7),
    },
    secondaryLabel: 'IG Spread',
    secondaryColor: '#00D4FF',
  },
  {
    id: 'volatility-pulse',
    title: 'Volatility Pulse',
    subtitle: 'Implied Volatility Index (VIX equiv.)',
    unit: '',
    currentValue: '22.4',
    changeLabel: '+3.1',
    changeDirection: 'up',
    riskLevel: 'elevated',
    color: '#FFD700',
    interpretation: 'VIX rising from complacency lows. Options market pricing increasing tail risk. Skew elevated — put demand surging. Fear index approaching "elevated stress" threshold of 25.',
    apiSource: 'CBOE VIX via Polygon.io: /v2/aggs/ticker/VIX',
    series: {
      '1D': buildSeries(103, 24, 22.4, 0.05, 0.8, 1),
      '1W': buildSeries(103, 7, 20.1, 0.33, 1.2, 1),
      '1M': buildSeries(103, 30, 17.8, 0.16, 1.5, 1),
      '3M': buildSeries(103, 90, 15.2, 0.08, 1.8, 1),
      '1Y': buildSeries(103, 52, 13.5, 0.18, 2.2, 7),
    },
  },
  {
    id: 'liquidity-pressure',
    title: 'Liquidity Pressure',
    subtitle: 'Fed Reserve Balance Sheet + Repo Stress',
    unit: '$T',
    currentValue: '7.4',
    changeLabel: '-$180B',
    changeDirection: 'down',
    riskLevel: 'elevated',
    color: '#FFD700',
    interpretation: 'Fed balance sheet QT reducing system reserves. Overnight repo rates spiking above Fed Funds. SOFR-OIS spread widening — early liquidity stress signal. Reserve scarcity approaching critical threshold.',
    apiSource: 'FRED: WALCL (Fed Balance Sheet), SOFR via NY Fed',
    series: {
      '1D': buildSeries(104, 24, 7.4, -0.001, 0.02, 1),
      '1W': buildSeries(104, 7, 7.58, -0.025, 0.04, 1),
      '1M': buildSeries(104, 30, 7.80, -0.014, 0.05, 1),
      '3M': buildSeries(104, 90, 8.10, -0.008, 0.06, 1),
      '1Y': buildSeries(104, 52, 8.90, -0.030, 0.08, 7),
    },
  },
  {
    id: 'ai-bubble-index',
    title: 'AI Bubble / Speculation Index',
    subtitle: 'Mega-cap AI concentration + capex divergence',
    unit: '/10',
    currentValue: '8.6',
    changeLabel: '+0.7',
    changeDirection: 'up',
    riskLevel: 'critical',
    color: '#FF2D55',
    interpretation: 'Composite of AI/mega-cap S&P concentration (32.4%), hyperscaler capex growth (42% YoY), AI startup valuations, and earnings-to-capex divergence. Exceeds 2000 Dot-com peak on most dimensions.',
    apiSource: 'Proprietary composite — Polygon.io equity data + Alpha Vantage fundamentals',
    series: {
      '1D': buildSeries(105, 24, 8.6, 0.002, 0.04, 1),
      '1W': buildSeries(105, 7, 8.3, 0.04, 0.08, 1),
      '1M': buildSeries(105, 30, 7.8, 0.027, 0.10, 1),
      '3M': buildSeries(105, 90, 6.9, 0.019, 0.12, 1),
      '1Y': buildSeries(105, 52, 5.2, 0.065, 0.15, 7),
    },
  },
  {
    id: 'treasury-debt-stress',
    title: 'Treasury / Debt Stress',
    subtitle: 'Auction demand + fiscal deficit pressure',
    unit: '/10',
    currentValue: '7.8',
    changeLabel: '+0.4',
    changeDirection: 'up',
    riskLevel: 'high',
    color: '#FF9500',
    interpretation: 'Composite of Treasury auction bid-to-cover ratios, foreign demand share, deficit-to-GDP trajectory, and term premium. Auction demand at 2019 lows. $1.8T annual deficit at 6.5% of GDP — unsustainable at current rates.',
    apiSource: 'FRED: GFDEGDQ188S (Debt/GDP), TreasuryDirect auction data',
    series: {
      '1D': buildSeries(106, 24, 7.8, 0.002, 0.05, 1),
      '1W': buildSeries(106, 7, 7.5, 0.04, 0.09, 1),
      '1M': buildSeries(106, 30, 7.1, 0.024, 0.11, 1),
      '3M': buildSeries(106, 90, 6.5, 0.014, 0.13, 1),
      '1Y': buildSeries(106, 52, 5.8, 0.040, 0.16, 7),
    },
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
