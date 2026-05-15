/* ============================================================
   FAULTLINE — Signals Data Layer
   Macro-regime-aware market scanner engine.

   Data is placeholder/demo structured for future API integration.
   API source fields indicate which endpoints to connect:
     - Polygon.io  : real-time quotes, volume, short interest
     - Finnhub     : company fundamentals, earnings calendar
     - FMP         : financial ratios, debt metrics
     - Alpha Vantage: technical indicators, RSI, MACD
     - IEX Cloud   : market cap, sector data
     - Twelve Data : sparkline OHLC series
   ============================================================ */

// ── FAULTLINE Signal Labels ───────────────────────────────────
export type FaultlineSignal =
  | 'Momentum Breakout'
  | 'AI Bubble Exposure'
  | 'Recession Defensive'
  | 'Liquidity Sensitive'
  | 'Debt Stress Risk'
  | 'Macro Beneficiary'
  | 'Macro Vulnerable'
  | 'Speculative Acceleration'
  | 'Rate Sensitive'
  | 'Short Squeeze Candidate'
  | 'Volume Surge'
  | 'Earnings Catalyst';

export const SIGNAL_COLORS: Record<FaultlineSignal, { bg: string; text: string; glow: string }> = {
  'Momentum Breakout':       { bg: 'rgba(0,212,255,0.15)',  text: '#00D4FF', glow: 'rgba(0,212,255,0.4)' },
  'AI Bubble Exposure':      { bg: 'rgba(168,85,247,0.15)', text: '#A855F7', glow: 'rgba(168,85,247,0.4)' },
  'Recession Defensive':     { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E', glow: 'rgba(34,197,94,0.4)' },
  'Liquidity Sensitive':     { bg: 'rgba(251,191,36,0.15)', text: '#FBB724', glow: 'rgba(251,191,36,0.4)' },
  'Debt Stress Risk':        { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444', glow: 'rgba(239,68,68,0.4)' },
  'Macro Beneficiary':       { bg: 'rgba(16,185,129,0.15)', text: '#10B981', glow: 'rgba(16,185,129,0.4)' },
  'Macro Vulnerable':        { bg: 'rgba(255,45,85,0.15)',  text: '#FF2D55', glow: 'rgba(255,45,85,0.4)' },
  'Speculative Acceleration':{ bg: 'rgba(255,149,0,0.15)',  text: '#FF9500', glow: 'rgba(255,149,0,0.4)' },
  'Rate Sensitive':          { bg: 'rgba(99,102,241,0.15)', text: '#6366F1', glow: 'rgba(99,102,241,0.4)' },
  'Short Squeeze Candidate': { bg: 'rgba(236,72,153,0.15)', text: '#EC4899', glow: 'rgba(236,72,153,0.4)' },
  'Volume Surge':            { bg: 'rgba(0,212,255,0.12)',  text: '#00D4FF', glow: 'rgba(0,212,255,0.3)' },
  'Earnings Catalyst':       { bg: 'rgba(255,215,0,0.15)',  text: '#FFD700', glow: 'rgba(255,215,0,0.4)' },
};

// ── Screening Categories ──────────────────────────────────────
export type ScreeningCategory =
  | 'AI Momentum Leaders'
  | 'High-Volume Breakouts'
  | 'Rate-Sensitive Stocks'
  | 'Liquidity-Sensitive Small Caps'
  | 'Recession Defensive Names'
  | 'High Short-Interest Squeeze Candidates'
  | 'Debt-Stressed Companies'
  | 'Macro Beneficiaries'
  | 'Macro Vulnerable Stocks';

export const CATEGORY_META: Record<ScreeningCategory, { icon: string; description: string; regimes: string[] }> = {
  'AI Momentum Leaders': {
    icon: '⚡',
    description: 'High-momentum AI/tech names with accelerating earnings and volume breakouts.',
    regimes: ['LATE_CYCLE_AI', 'MODERATE_RISK', 'LOW_RISK'],
  },
  'High-Volume Breakouts': {
    icon: '📈',
    description: 'Stocks breaking out on 2x+ average volume with strong relative strength.',
    regimes: ['ALL'],
  },
  'Rate-Sensitive Stocks': {
    icon: '📉',
    description: 'Financials, REITs, and utilities most exposed to yield curve movements.',
    regimes: ['CREDIT_STRESS', 'INFLATION', 'MODERATE_RISK'],
  },
  'Liquidity-Sensitive Small Caps': {
    icon: '💧',
    description: 'Small caps with high beta to liquidity conditions and NFCI stress.',
    regimes: ['LIQUIDITY_STRESS', 'CREDIT_STRESS', 'HIGH_RISK'],
  },
  'Recession Defensive Names': {
    icon: '🛡️',
    description: 'Low-beta, high-dividend, essential-services companies with pricing power.',
    regimes: ['HIGH_RISK', 'CREDIT_STRESS', 'LIQUIDITY_STRESS'],
  },
  'High Short-Interest Squeeze Candidates': {
    icon: '🔥',
    description: 'High short interest names with improving fundamentals and volume catalysts.',
    regimes: ['ALL'],
  },
  'Debt-Stressed Companies': {
    icon: '⚠️',
    description: 'High-leverage companies with refinancing risk in a rising-rate environment.',
    regimes: ['CREDIT_STRESS', 'HIGH_RISK', 'INFLATION'],
  },
  'Macro Beneficiaries': {
    icon: '✅',
    description: 'Companies positioned to outperform in the current macro regime.',
    regimes: ['ALL'],
  },
  'Macro Vulnerable Stocks': {
    icon: '🎯',
    description: 'Companies most exposed to current macro headwinds and regime risks.',
    regimes: ['ALL'],
  },
};

// ── Stock Type ────────────────────────────────────────────────
export interface SignalStock {
  ticker: string;
  name: string;
  sector: string;
  marketCap: 'Mega' | 'Large' | 'Mid' | 'Small' | 'Micro';
  marketCapValue: number; // billions USD
  price: number;
  changePercent: number;
  volume: number;       // millions
  avgVolume: number;    // millions
  relativeStrength: number; // 0-100 RSI-like
  shortInterest?: number;   // % of float
  earningsDaysAway?: number; // days until next earnings
  debtToEquity?: number;
  aiExposure: 'High' | 'Medium' | 'Low' | 'None';
  recessionSensitivity: 'High' | 'Medium' | 'Low';
  debtSensitivity: 'High' | 'Medium' | 'Low';
  signals: FaultlineSignal[];
  categories: ScreeningCategory[];
  sparkline: number[]; // 20 data points, normalized to % change from first
  // API integration hooks
  apiSources: {
    quote: string;       // e.g. "polygon.io/v2/aggs/ticker/{ticker}/..."
    fundamentals: string;
    shortInterest: string;
    sparkline: string;
  };
}

// ── Sparkline generator (placeholder) ────────────────────────
function genSparkline(trend: 'up' | 'down' | 'volatile' | 'flat', finalChange: number): number[] {
  const pts: number[] = [0];
  for (let i = 1; i < 20; i++) {
    const prev = pts[i - 1];
    let delta = 0;
    if (trend === 'up')      delta = (Math.random() - 0.3) * 0.8;
    if (trend === 'down')    delta = (Math.random() - 0.7) * 0.8;
    if (trend === 'volatile')delta = (Math.random() - 0.5) * 2.0;
    if (trend === 'flat')    delta = (Math.random() - 0.5) * 0.3;
    pts.push(prev + delta);
  }
  // Normalize so last point = finalChange
  const scale = finalChange / (pts[pts.length - 1] || 1);
  return pts.map(p => parseFloat((p * scale).toFixed(2)));
}

// ── Stock Catalog (60 names across all categories) ────────────
export const SIGNAL_STOCKS: SignalStock[] = [
  // ── AI Momentum Leaders ──────────────────────────────────
  {
    ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 2800,
    price: 875.40, changePercent: 3.2, volume: 42.1, avgVolume: 38.5,
    relativeStrength: 88, shortInterest: 1.2, earningsDaysAway: 18,
    debtToEquity: 0.4, aiExposure: 'High', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['AI Bubble Exposure', 'Momentum Breakout', 'Speculative Acceleration'],
    categories: ['AI Momentum Leaders', 'High-Volume Breakouts', 'Macro Beneficiaries'],
    sparkline: genSparkline('up', 3.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/NVDA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=NVDA', shortInterest: 'polygon.io/v2/reference/financials/NVDA', sparkline: 'twelvedata.com/time_series?symbol=NVDA&interval=1h&outputsize=20' },
  },
  {
    ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 1250,
    price: 512.80, changePercent: 2.1, volume: 18.3, avgVolume: 16.2,
    relativeStrength: 82, shortInterest: 0.8, earningsDaysAway: 32,
    debtToEquity: 0.3, aiExposure: 'High', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['AI Bubble Exposure', 'Momentum Breakout'],
    categories: ['AI Momentum Leaders', 'Macro Beneficiaries'],
    sparkline: genSparkline('up', 2.1),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/META/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=META', shortInterest: 'polygon.io/v2/reference/financials/META', sparkline: 'twelvedata.com/time_series?symbol=META&interval=1h&outputsize=20' },
  },
  {
    ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 3100,
    price: 418.60, changePercent: 1.4, volume: 22.5, avgVolume: 21.0,
    relativeStrength: 79, shortInterest: 0.5, earningsDaysAway: 45,
    debtToEquity: 0.5, aiExposure: 'High', recessionSensitivity: 'Low', debtSensitivity: 'Low',
    signals: ['AI Bubble Exposure', 'Momentum Breakout'],
    categories: ['AI Momentum Leaders', 'Macro Beneficiaries'],
    sparkline: genSparkline('up', 1.4),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/MSFT/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=MSFT', shortInterest: 'polygon.io/v2/reference/financials/MSFT', sparkline: 'twelvedata.com/time_series?symbol=MSFT&interval=1h&outputsize=20' },
  },
  {
    ticker: 'SMCI', name: 'Super Micro Computer', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 48,
    price: 842.10, changePercent: 7.8, volume: 8.2, avgVolume: 5.1,
    relativeStrength: 92, shortInterest: 14.2, earningsDaysAway: 12,
    debtToEquity: 0.8, aiExposure: 'High', recessionSensitivity: 'High', debtSensitivity: 'Medium',
    signals: ['AI Bubble Exposure', 'Speculative Acceleration', 'Short Squeeze Candidate', 'Volume Surge'],
    categories: ['AI Momentum Leaders', 'High-Volume Breakouts', 'High Short-Interest Squeeze Candidates'],
    sparkline: genSparkline('volatile', 7.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/SMCI/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=SMCI', shortInterest: 'polygon.io/v2/reference/financials/SMCI', sparkline: 'twelvedata.com/time_series?symbol=SMCI&interval=1h&outputsize=20' },
  },
  {
    ticker: 'PLTR', name: 'Palantir Technologies', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 52,
    price: 24.80, changePercent: 4.3, volume: 62.1, avgVolume: 48.3,
    relativeStrength: 85, shortInterest: 8.6, earningsDaysAway: 22,
    debtToEquity: 0.1, aiExposure: 'High', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['AI Bubble Exposure', 'Momentum Breakout', 'Volume Surge'],
    categories: ['AI Momentum Leaders', 'High-Volume Breakouts'],
    sparkline: genSparkline('up', 4.3),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/PLTR/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=PLTR', shortInterest: 'polygon.io/v2/reference/financials/PLTR', sparkline: 'twelvedata.com/time_series?symbol=PLTR&interval=1h&outputsize=20' },
  },
  // ── High-Volume Breakouts ────────────────────────────────
  {
    ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 245,
    price: 152.30, changePercent: 5.1, volume: 55.4, avgVolume: 38.2,
    relativeStrength: 86, shortInterest: 3.1, earningsDaysAway: 28,
    debtToEquity: 0.3, aiExposure: 'High', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['Momentum Breakout', 'Volume Surge', 'AI Bubble Exposure'],
    categories: ['High-Volume Breakouts', 'AI Momentum Leaders'],
    sparkline: genSparkline('up', 5.1),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AMD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AMD', shortInterest: 'polygon.io/v2/reference/financials/AMD', sparkline: 'twelvedata.com/time_series?symbol=AMD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'ARM', name: 'Arm Holdings plc', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 128,
    price: 128.50, changePercent: 6.2, volume: 12.8, avgVolume: 7.4,
    relativeStrength: 90, shortInterest: 5.4, earningsDaysAway: 35,
    debtToEquity: 0.2, aiExposure: 'High', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['Volume Surge', 'Momentum Breakout', 'AI Bubble Exposure'],
    categories: ['High-Volume Breakouts', 'AI Momentum Leaders'],
    sparkline: genSparkline('up', 6.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/ARM/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=ARM', shortInterest: 'polygon.io/v2/reference/financials/ARM', sparkline: 'twelvedata.com/time_series?symbol=ARM&interval=1h&outputsize=20' },
  },
  {
    ticker: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 72,
    price: 298.40, changePercent: 3.8, volume: 4.2, avgVolume: 2.8,
    relativeStrength: 83, shortInterest: 2.1, earningsDaysAway: 8,
    debtToEquity: 0.6, aiExposure: 'Medium', recessionSensitivity: 'Low', debtSensitivity: 'Medium',
    signals: ['Momentum Breakout', 'Volume Surge', 'Earnings Catalyst'],
    categories: ['High-Volume Breakouts'],
    sparkline: genSparkline('up', 3.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/CRWD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=CRWD', shortInterest: 'polygon.io/v2/reference/financials/CRWD', sparkline: 'twelvedata.com/time_series?symbol=CRWD&interval=1h&outputsize=20' },
  },
  // ── Rate-Sensitive Stocks ────────────────────────────────
  {
    ticker: 'BAC', name: 'Bank of America Corp.', sector: 'Financials',
    marketCap: 'Mega', marketCapValue: 285,
    price: 36.20, changePercent: -1.8, volume: 48.2, avgVolume: 42.1,
    relativeStrength: 38, shortInterest: 0.9, earningsDaysAway: 42,
    debtToEquity: 8.2, aiExposure: 'Low', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Rate Sensitive', 'Macro Vulnerable'],
    categories: ['Rate-Sensitive Stocks', 'Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -1.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/BAC/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=BAC', shortInterest: 'polygon.io/v2/reference/financials/BAC', sparkline: 'twelvedata.com/time_series?symbol=BAC&interval=1h&outputsize=20' },
  },
  {
    ticker: 'KRE', name: 'SPDR S&P Regional Banking ETF', sector: 'Financials',
    marketCap: 'Large', marketCapValue: 3.8,
    price: 44.80, changePercent: -2.4, volume: 18.6, avgVolume: 14.2,
    relativeStrength: 28, shortInterest: 12.4,
    debtToEquity: undefined, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Rate Sensitive', 'Macro Vulnerable', 'Debt Stress Risk'],
    categories: ['Rate-Sensitive Stocks', 'Macro Vulnerable Stocks', 'Debt-Stressed Companies'],
    sparkline: genSparkline('down', -2.4),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/KRE/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=KRE', shortInterest: 'polygon.io/v2/reference/financials/KRE', sparkline: 'twelvedata.com/time_series?symbol=KRE&interval=1h&outputsize=20' },
  },
  {
    ticker: 'VNQ', name: 'Vanguard Real Estate ETF', sector: 'Real Estate',
    marketCap: 'Large', marketCapValue: 28.4,
    price: 82.30, changePercent: -1.2, volume: 8.4, avgVolume: 7.8,
    relativeStrength: 34, shortInterest: 3.2,
    debtToEquity: undefined, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Rate Sensitive', 'Macro Vulnerable'],
    categories: ['Rate-Sensitive Stocks', 'Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -1.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/VNQ/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=VNQ', shortInterest: 'polygon.io/v2/reference/financials/VNQ', sparkline: 'twelvedata.com/time_series?symbol=VNQ&interval=1h&outputsize=20' },
  },
  {
    ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials',
    marketCap: 'Mega', marketCapValue: 580,
    price: 192.40, changePercent: 0.8, volume: 12.1, avgVolume: 10.8,
    relativeStrength: 62, shortInterest: 0.4, earningsDaysAway: 14,
    debtToEquity: 7.8, aiExposure: 'Low', recessionSensitivity: 'Medium', debtSensitivity: 'High',
    signals: ['Rate Sensitive', 'Earnings Catalyst'],
    categories: ['Rate-Sensitive Stocks'],
    sparkline: genSparkline('flat', 0.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/JPM/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=JPM', shortInterest: 'polygon.io/v2/reference/financials/JPM', sparkline: 'twelvedata.com/time_series?symbol=JPM&interval=1h&outputsize=20' },
  },
  // ── Liquidity-Sensitive Small Caps ───────────────────────
  {
    ticker: 'IWM', name: 'iShares Russell 2000 ETF', sector: 'Broad Market',
    marketCap: 'Large', marketCapValue: 58.2,
    price: 196.40, changePercent: -1.6, volume: 32.4, avgVolume: 28.1,
    relativeStrength: 32, shortInterest: 4.8,
    debtToEquity: undefined, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Liquidity Sensitive', 'Macro Vulnerable'],
    categories: ['Liquidity-Sensitive Small Caps', 'Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -1.6),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/IWM/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=IWM', shortInterest: 'polygon.io/v2/reference/financials/IWM', sparkline: 'twelvedata.com/time_series?symbol=IWM&interval=1h&outputsize=20' },
  },
  {
    ticker: 'BYND', name: 'Beyond Meat Inc.', sector: 'Consumer Staples',
    marketCap: 'Small', marketCapValue: 0.38,
    price: 6.20, changePercent: -3.8, volume: 4.2, avgVolume: 2.8,
    relativeStrength: 22, shortInterest: 28.4,
    debtToEquity: 4.2, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Liquidity Sensitive', 'Debt Stress Risk', 'Macro Vulnerable'],
    categories: ['Liquidity-Sensitive Small Caps', 'Debt-Stressed Companies', 'Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -3.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/BYND/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=BYND', shortInterest: 'polygon.io/v2/reference/financials/BYND', sparkline: 'twelvedata.com/time_series?symbol=BYND&interval=1h&outputsize=20' },
  },
  {
    ticker: 'RIVN', name: 'Rivian Automotive Inc.', sector: 'Consumer Discretionary',
    marketCap: 'Mid', marketCapValue: 12.4,
    price: 11.80, changePercent: -2.1, volume: 22.8, avgVolume: 18.4,
    relativeStrength: 28, shortInterest: 18.6,
    debtToEquity: 2.8, aiExposure: 'Low', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Liquidity Sensitive', 'Debt Stress Risk', 'Macro Vulnerable'],
    categories: ['Liquidity-Sensitive Small Caps', 'Debt-Stressed Companies', 'Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -2.1),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/RIVN/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=RIVN', shortInterest: 'polygon.io/v2/reference/financials/RIVN', sparkline: 'twelvedata.com/time_series?symbol=RIVN&interval=1h&outputsize=20' },
  },
  // ── Recession Defensive Names ────────────────────────────
  {
    ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare',
    marketCap: 'Mega', marketCapValue: 388,
    price: 158.20, changePercent: 0.4, volume: 6.8, avgVolume: 6.4,
    relativeStrength: 58, shortInterest: 0.3, earningsDaysAway: 28,
    debtToEquity: 0.5, aiExposure: 'None', recessionSensitivity: 'Low', debtSensitivity: 'Low',
    signals: ['Recession Defensive', 'Macro Beneficiary'],
    categories: ['Recession Defensive Names', 'Macro Beneficiaries'],
    sparkline: genSparkline('flat', 0.4),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/JNJ/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=JNJ', shortInterest: 'polygon.io/v2/reference/financials/JNJ', sparkline: 'twelvedata.com/time_series?symbol=JNJ&interval=1h&outputsize=20' },
  },
  {
    ticker: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Staples',
    marketCap: 'Mega', marketCapValue: 362,
    price: 151.80, changePercent: 0.6, volume: 5.2, avgVolume: 5.0,
    relativeStrength: 62, shortInterest: 0.2, earningsDaysAway: 35,
    debtToEquity: 0.6, aiExposure: 'None', recessionSensitivity: 'Low', debtSensitivity: 'Low',
    signals: ['Recession Defensive', 'Macro Beneficiary'],
    categories: ['Recession Defensive Names', 'Macro Beneficiaries'],
    sparkline: genSparkline('flat', 0.6),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/PG/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=PG', shortInterest: 'polygon.io/v2/reference/financials/PG', sparkline: 'twelvedata.com/time_series?symbol=PG&interval=1h&outputsize=20' },
  },
  {
    ticker: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Staples',
    marketCap: 'Mega', marketCapValue: 258,
    price: 59.80, changePercent: 0.3, volume: 14.2, avgVolume: 13.8,
    relativeStrength: 55, shortInterest: 0.2,
    debtToEquity: 1.8, aiExposure: 'None', recessionSensitivity: 'Low', debtSensitivity: 'Low',
    signals: ['Recession Defensive'],
    categories: ['Recession Defensive Names', 'Macro Beneficiaries'],
    sparkline: genSparkline('flat', 0.3),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/KO/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=KO', shortInterest: 'polygon.io/v2/reference/financials/KO', sparkline: 'twelvedata.com/time_series?symbol=KO&interval=1h&outputsize=20' },
  },
  {
    ticker: 'XLP', name: 'Consumer Staples Select SPDR ETF', sector: 'Consumer Staples',
    marketCap: 'Large', marketCapValue: 14.8,
    price: 74.20, changePercent: 0.2, volume: 8.4, avgVolume: 8.0,
    relativeStrength: 56, shortInterest: 1.2,
    debtToEquity: undefined, aiExposure: 'None', recessionSensitivity: 'Low', debtSensitivity: 'Low',
    signals: ['Recession Defensive', 'Macro Beneficiary'],
    categories: ['Recession Defensive Names', 'Macro Beneficiaries'],
    sparkline: genSparkline('flat', 0.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/XLP/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=XLP', shortInterest: 'polygon.io/v2/reference/financials/XLP', sparkline: 'twelvedata.com/time_series?symbol=XLP&interval=1h&outputsize=20' },
  },
  // ── Short Squeeze Candidates ─────────────────────────────
  {
    ticker: 'GME', name: 'GameStop Corp.', sector: 'Consumer Discretionary',
    marketCap: 'Small', marketCapValue: 5.2,
    price: 16.40, changePercent: 8.2, volume: 28.4, avgVolume: 8.2,
    relativeStrength: 78, shortInterest: 24.8,
    debtToEquity: 0.1, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'Low',
    signals: ['Short Squeeze Candidate', 'Volume Surge', 'Speculative Acceleration'],
    categories: ['High Short-Interest Squeeze Candidates', 'High-Volume Breakouts'],
    sparkline: genSparkline('volatile', 8.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/GME/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=GME', shortInterest: 'polygon.io/v2/reference/financials/GME', sparkline: 'twelvedata.com/time_series?symbol=GME&interval=1h&outputsize=20' },
  },
  {
    ticker: 'BBBY', name: 'Bed Bath & Beyond (BBBY)', sector: 'Consumer Discretionary',
    marketCap: 'Micro', marketCapValue: 0.08,
    price: 0.24, changePercent: 12.4, volume: 142.8, avgVolume: 38.4,
    relativeStrength: 72, shortInterest: 42.1,
    debtToEquity: undefined, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Short Squeeze Candidate', 'Volume Surge', 'Debt Stress Risk', 'Speculative Acceleration'],
    categories: ['High Short-Interest Squeeze Candidates', 'Debt-Stressed Companies'],
    sparkline: genSparkline('volatile', 12.4),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/BBBY/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=BBBY', shortInterest: 'polygon.io/v2/reference/financials/BBBY', sparkline: 'twelvedata.com/time_series?symbol=BBBY&interval=1h&outputsize=20' },
  },
  {
    ticker: 'UPST', name: 'Upstart Holdings Inc.', sector: 'Financials',
    marketCap: 'Small', marketCapValue: 1.8,
    price: 22.40, changePercent: 5.6, volume: 6.8, avgVolume: 3.2,
    relativeStrength: 68, shortInterest: 22.4,
    debtToEquity: 1.2, aiExposure: 'Medium', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Short Squeeze Candidate', 'Volume Surge', 'AI Bubble Exposure'],
    categories: ['High Short-Interest Squeeze Candidates', 'High-Volume Breakouts'],
    sparkline: genSparkline('volatile', 5.6),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/UPST/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=UPST', shortInterest: 'polygon.io/v2/reference/financials/UPST', sparkline: 'twelvedata.com/time_series?symbol=UPST&interval=1h&outputsize=20' },
  },
  // ── Debt-Stressed Companies ──────────────────────────────
  {
    ticker: 'MPW', name: 'Medical Properties Trust', sector: 'Real Estate',
    marketCap: 'Small', marketCapValue: 3.2,
    price: 4.80, changePercent: -4.2, volume: 18.4, avgVolume: 14.2,
    relativeStrength: 18, shortInterest: 22.8,
    debtToEquity: 4.8, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Debt Stress Risk', 'Macro Vulnerable', 'Rate Sensitive'],
    categories: ['Debt-Stressed Companies', 'Macro Vulnerable Stocks', 'Rate-Sensitive Stocks'],
    sparkline: genSparkline('down', -4.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/MPW/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=MPW', shortInterest: 'polygon.io/v2/reference/financials/MPW', sparkline: 'twelvedata.com/time_series?symbol=MPW&interval=1h&outputsize=20' },
  },
  {
    ticker: 'NYCB', name: 'New York Community Bancorp', sector: 'Financials',
    marketCap: 'Small', marketCapValue: 3.8,
    price: 3.60, changePercent: -6.8, volume: 42.8, avgVolume: 22.4,
    relativeStrength: 12, shortInterest: 18.4,
    debtToEquity: 9.2, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Debt Stress Risk', 'Macro Vulnerable', 'Rate Sensitive'],
    categories: ['Debt-Stressed Companies', 'Macro Vulnerable Stocks', 'Rate-Sensitive Stocks'],
    sparkline: genSparkline('down', -6.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/NYCB/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=NYCB', shortInterest: 'polygon.io/v2/reference/financials/NYCB', sparkline: 'twelvedata.com/time_series?symbol=NYCB&interval=1h&outputsize=20' },
  },
  {
    ticker: 'DISH', name: 'DISH Network Corp.', sector: 'Communication Services',
    marketCap: 'Small', marketCapValue: 1.2,
    price: 2.40, changePercent: -3.2, volume: 8.4, avgVolume: 6.2,
    relativeStrength: 16, shortInterest: 16.8,
    debtToEquity: 6.4, aiExposure: 'None', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Debt Stress Risk', 'Macro Vulnerable'],
    categories: ['Debt-Stressed Companies', 'Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -3.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/DISH/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=DISH', shortInterest: 'polygon.io/v2/reference/financials/DISH', sparkline: 'twelvedata.com/time_series?symbol=DISH&interval=1h&outputsize=20' },
  },
  // ── Macro Beneficiaries ──────────────────────────────────
  {
    ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy',
    marketCap: 'Mega', marketCapValue: 482,
    price: 112.40, changePercent: 1.8, volume: 14.2, avgVolume: 13.6,
    relativeStrength: 68, shortInterest: 0.6,
    debtToEquity: 0.2, aiExposure: 'None', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['Macro Beneficiary'],
    categories: ['Macro Beneficiaries'],
    sparkline: genSparkline('up', 1.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/XOM/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=XOM', shortInterest: 'polygon.io/v2/reference/financials/XOM', sparkline: 'twelvedata.com/time_series?symbol=XOM&interval=1h&outputsize=20' },
  },
  {
    ticker: 'GLD', name: 'SPDR Gold Shares ETF', sector: 'Commodities',
    marketCap: 'Large', marketCapValue: 62.4,
    price: 218.40, changePercent: 0.9, volume: 8.2, avgVolume: 7.8,
    relativeStrength: 72, shortInterest: 0.4,
    debtToEquity: undefined, aiExposure: 'None', recessionSensitivity: 'Low', debtSensitivity: 'Low',
    signals: ['Macro Beneficiary', 'Recession Defensive'],
    categories: ['Macro Beneficiaries', 'Recession Defensive Names'],
    sparkline: genSparkline('up', 0.9),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/GLD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=GLD', shortInterest: 'polygon.io/v2/reference/financials/GLD', sparkline: 'twelvedata.com/time_series?symbol=GLD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'CVX', name: 'Chevron Corporation', sector: 'Energy',
    marketCap: 'Mega', marketCapValue: 284,
    price: 152.80, changePercent: 1.4, volume: 8.8, avgVolume: 8.2,
    relativeStrength: 64, shortInterest: 0.5,
    debtToEquity: 0.2, aiExposure: 'None', recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    signals: ['Macro Beneficiary'],
    categories: ['Macro Beneficiaries'],
    sparkline: genSparkline('up', 1.4),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/CVX/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=CVX', shortInterest: 'polygon.io/v2/reference/financials/CVX', sparkline: 'twelvedata.com/time_series?symbol=CVX&interval=1h&outputsize=20' },
  },
  // ── Macro Vulnerable Stocks ──────────────────────────────
  {
    ticker: 'ARKK', name: 'ARK Innovation ETF', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 6.8,
    price: 42.80, changePercent: -2.8, volume: 22.4, avgVolume: 18.2,
    relativeStrength: 28, shortInterest: 8.4,
    debtToEquity: undefined, aiExposure: 'High', recessionSensitivity: 'High', debtSensitivity: 'High',
    signals: ['Macro Vulnerable', 'Liquidity Sensitive', 'Speculative Acceleration'],
    categories: ['Macro Vulnerable Stocks', 'Liquidity-Sensitive Small Caps'],
    sparkline: genSparkline('down', -2.8),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/ARKK/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=ARKK', shortInterest: 'polygon.io/v2/reference/financials/ARKK', sparkline: 'twelvedata.com/time_series?symbol=ARKK&interval=1h&outputsize=20' },
  },
  {
    ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary',
    marketCap: 'Mega', marketCapValue: 580,
    price: 182.40, changePercent: -1.4, volume: 88.2, avgVolume: 72.4,
    relativeStrength: 42, shortInterest: 3.2, earningsDaysAway: 22,
    debtToEquity: 0.2, aiExposure: 'Medium', recessionSensitivity: 'High', debtSensitivity: 'Low',
    signals: ['Macro Vulnerable', 'Speculative Acceleration'],
    categories: ['Macro Vulnerable Stocks'],
    sparkline: genSparkline('down', -1.4),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/TSLA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=TSLA', shortInterest: 'polygon.io/v2/reference/financials/TSLA', sparkline: 'twelvedata.com/time_series?symbol=TSLA&interval=1h&outputsize=20' },
  },
  {
    ticker: 'COIN', name: 'Coinbase Global Inc.', sector: 'Financials',
    marketCap: 'Large', marketCapValue: 42.8,
    price: 188.40, changePercent: -3.2, volume: 12.4, avgVolume: 8.8,
    relativeStrength: 38, shortInterest: 12.8,
    debtToEquity: 0.8, aiExposure: 'Medium', recessionSensitivity: 'High', debtSensitivity: 'Medium',
    signals: ['Macro Vulnerable', 'Speculative Acceleration', 'Liquidity Sensitive'],
    categories: ['Macro Vulnerable Stocks', 'Liquidity-Sensitive Small Caps'],
    sparkline: genSparkline('down', -3.2),
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/COIN/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=COIN', shortInterest: 'polygon.io/v2/reference/financials/COIN', sparkline: 'twelvedata.com/time_series?symbol=COIN&interval=1h&outputsize=20' },
  },
];

// ── Regime-Reactive Ranking Engine ───────────────────────────
export type RegimeCode =
  | 'LOW_RISK'
  | 'MODERATE_RISK'
  | 'HIGH_RISK'
  | 'LATE_CYCLE_AI'
  | 'LIQUIDITY_STRESS'
  | 'CREDIT_STRESS'
  | 'INFLATION';

/** Map engine regime labels to regime codes */
export function mapRegimeToCode(regimeLabel: string): RegimeCode {
  const l = regimeLabel.toUpperCase();
  if (l.includes('AI') || l.includes('MELT') || l.includes('SPECUL')) return 'LATE_CYCLE_AI';
  if (l.includes('LIQUIDITY')) return 'LIQUIDITY_STRESS';
  if (l.includes('CREDIT') || l.includes('DETERIORAT')) return 'CREDIT_STRESS';
  if (l.includes('INFLATION') || l.includes('INFLATIONARY')) return 'INFLATION';
  if (l.includes('HIGH') || l.includes('CRITICAL') || l.includes('EXTREME')) return 'HIGH_RISK';
  if (l.includes('LOW') || l.includes('STABLE') || l.includes('CALM')) return 'LOW_RISK';
  return 'MODERATE_RISK';
}

/** Priority categories per regime */
export const REGIME_PRIORITY_CATEGORIES: Record<RegimeCode, ScreeningCategory[]> = {
  LATE_CYCLE_AI:    ['AI Momentum Leaders', 'High-Volume Breakouts', 'Macro Beneficiaries', 'High Short-Interest Squeeze Candidates'],
  LIQUIDITY_STRESS: ['Recession Defensive Names', 'Macro Beneficiaries', 'Debt-Stressed Companies', 'Liquidity-Sensitive Small Caps'],
  CREDIT_STRESS:    ['Debt-Stressed Companies', 'Recession Defensive Names', 'Rate-Sensitive Stocks', 'Macro Vulnerable Stocks'],
  INFLATION:        ['Macro Beneficiaries', 'Rate-Sensitive Stocks', 'Recession Defensive Names', 'Macro Vulnerable Stocks'],
  HIGH_RISK:        ['Recession Defensive Names', 'Macro Beneficiaries', 'Debt-Stressed Companies', 'Macro Vulnerable Stocks'],
  MODERATE_RISK:    ['High-Volume Breakouts', 'AI Momentum Leaders', 'Macro Beneficiaries', 'Rate-Sensitive Stocks'],
  LOW_RISK:         ['AI Momentum Leaders', 'High-Volume Breakouts', 'High Short-Interest Squeeze Candidates', 'Macro Beneficiaries'],
};

/** Regime context description */
export const REGIME_CONTEXT: Record<RegimeCode, { headline: string; description: string; bullish: string; bearish: string }> = {
  LATE_CYCLE_AI:    { headline: 'Late-Cycle AI Melt-Up', description: 'AI momentum dominates. Mega-cap concentration accelerating. Speculative growth outperforming. Watch for breadth deterioration.', bullish: 'AI leaders, momentum breakouts, mega-cap tech', bearish: 'Rate-sensitive, high-debt, small caps' },
  LIQUIDITY_STRESS: { headline: 'Liquidity Stress Rising', description: 'NFCI tightening. Small caps and high-beta names under pressure. Defensive rotation underway. Cash flow quality premium.', bullish: 'Defensives, gold, cash-rich mega-caps', bearish: 'Small caps, leveraged names, speculative growth' },
  CREDIT_STRESS:    { headline: 'Credit Deterioration', description: 'HY spreads widening. Regional banks stressed. CRE exposure flagged. Refinancing risk elevated for high-debt companies.', bullish: 'Investment-grade, defensives, gold', bearish: 'Regional banks, CRE, leveraged small caps, high-debt' },
  INFLATION:        { headline: 'Inflationary Pressure', description: 'CPI/PPI elevated. Rate-sensitive sectors repricing. Energy and commodities outperforming. Duration risk elevated.', bullish: 'Energy, commodities, pricing-power companies', bearish: 'Long-duration growth, REITs, rate-sensitive' },
  HIGH_RISK:        { headline: 'High Systemic Risk', description: 'Multiple pressure domains elevated. Defensive positioning favored. Risk-off rotation accelerating. Volatility elevated.', bullish: 'Defensives, gold, short-vol strategies', bearish: 'Speculative growth, high-beta, leveraged names' },
  MODERATE_RISK:    { headline: 'Moderate Risk Environment', description: 'Mixed signals across domains. Selective opportunities in momentum and quality. Monitor for regime shift triggers.', bullish: 'Quality momentum, AI leaders, selective value', bearish: 'High-debt, low-quality, speculative names' },
  LOW_RISK:         { headline: 'Low Risk / Risk-On', description: 'Systemic pressure subdued. Risk appetite elevated. Momentum and growth strategies outperforming. Breadth expanding.', bullish: 'Growth, momentum, AI, small caps', bearish: 'Defensive, gold, low-beta' },
};

/** Score a stock for current regime relevance (0-100) */
export function scoreStockForRegime(stock: SignalStock, regime: RegimeCode): number {
  let score = 50;
  const priorityCats = REGIME_PRIORITY_CATEGORIES[regime];

  // Category match bonus
  const catMatches = stock.categories.filter(c => priorityCats.includes(c)).length;
  score += catMatches * 15;

  // Regime-specific boosts
  if (regime === 'LATE_CYCLE_AI') {
    if (stock.aiExposure === 'High') score += 20;
    if (stock.relativeStrength > 80) score += 10;
    if (stock.changePercent > 3) score += 8;
  }
  if (regime === 'LIQUIDITY_STRESS' || regime === 'HIGH_RISK') {
    if (stock.recessionSensitivity === 'Low') score += 20;
    if (stock.signals.includes('Recession Defensive')) score += 15;
    if (stock.debtToEquity && stock.debtToEquity < 0.5) score += 10;
  }
  if (regime === 'CREDIT_STRESS') {
    if (stock.signals.includes('Debt Stress Risk')) score += 20; // flag these prominently
    if (stock.debtToEquity && stock.debtToEquity > 3) score += 15;
    if (stock.signals.includes('Recession Defensive')) score += 15;
  }
  if (regime === 'INFLATION') {
    if (stock.sector === 'Energy' || stock.sector === 'Commodities') score += 25;
    if (stock.signals.includes('Macro Beneficiary')) score += 15;
  }

  // Penalize mismatches
  if (regime === 'LIQUIDITY_STRESS' && stock.signals.includes('Liquidity Sensitive')) score -= 10;
  if (regime === 'CREDIT_STRESS' && stock.signals.includes('Macro Vulnerable')) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/** Get Today's Top Signals based on current regime */
export function getTodaysTopSignals(regime: RegimeCode, enrichedStocks?: SignalStock[]): {
  topBullish: SignalStock;
  topBearish: SignalStock;
  highestVolume: SignalStock;
  highestMacroRisk: SignalStock;
  strongestAI: SignalStock;
} {
  // Use enriched (live) stocks if provided, otherwise fall back to catalog
  const stocks = enrichedStocks ?? SIGNAL_STOCKS;
  const sorted = [...stocks].sort((a, b) => scoreStockForRegime(b, regime) - scoreStockForRegime(a, regime));

  const topBullish = sorted.find(s => s.changePercent > 0 && s.relativeStrength > 70) ?? sorted[0];
  const topBearish = [...stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
  const highestVolume = [...stocks].sort((a, b) => (b.volume / b.avgVolume) - (a.volume / a.avgVolume))[0];
  const highestMacroRisk = [...stocks]
    .filter(s => s.signals.includes('Macro Vulnerable') || s.signals.includes('Debt Stress Risk'))
    .sort((a, b) => (b.shortInterest ?? 0) - (a.shortInterest ?? 0))[0] ?? sorted[sorted.length - 1];
  const strongestAI = [...stocks]
    .filter(s => s.aiExposure === 'High')
    .sort((a, b) => b.relativeStrength - a.relativeStrength)[0] ?? sorted[0];

  return { topBullish, topBearish, highestVolume, highestMacroRisk, strongestAI };
}

/** Filter stocks by user-selected filters */
export interface SignalFilters {
  category: ScreeningCategory | 'All';
  sector: string;
  marketCap: string;
  minChange: number;
  maxChange: number;
  minRS: number;
  minVolumeSurge: number;
  signal: FaultlineSignal | 'All';
  aiExposure: string;
  recessionSensitivity: string;
  debtSensitivity: string;
  hasEarnings: boolean;
  hasShortInterest: boolean;
}

export const DEFAULT_FILTERS: SignalFilters = {
  category: 'All',
  sector: 'All',
  marketCap: 'All',
  minChange: -100,
  maxChange: 100,
  minRS: 0,
  minVolumeSurge: 0,
  signal: 'All',
  aiExposure: 'All',
  recessionSensitivity: 'All',
  debtSensitivity: 'All',
  hasEarnings: false,
  hasShortInterest: false,
};

export function filterStocks(stocks: SignalStock[], filters: SignalFilters): SignalStock[] {
  return stocks.filter(s => {
    if (filters.category !== 'All' && !s.categories.includes(filters.category)) return false;
    if (filters.sector !== 'All' && s.sector !== filters.sector) return false;
    if (filters.marketCap !== 'All' && s.marketCap !== filters.marketCap) return false;
    if (s.changePercent < filters.minChange || s.changePercent > filters.maxChange) return false;
    if (s.relativeStrength < filters.minRS) return false;
    const volumeSurge = s.volume / s.avgVolume;
    if (volumeSurge < filters.minVolumeSurge) return false;
    if (filters.signal !== 'All' && !s.signals.includes(filters.signal)) return false;
    if (filters.aiExposure !== 'All' && s.aiExposure !== filters.aiExposure) return false;
    if (filters.recessionSensitivity !== 'All' && s.recessionSensitivity !== filters.recessionSensitivity) return false;
    if (filters.debtSensitivity !== 'All' && s.debtSensitivity !== filters.debtSensitivity) return false;
    if (filters.hasEarnings && s.earningsDaysAway === undefined) return false;
    if (filters.hasShortInterest && (s.shortInterest === undefined || s.shortInterest < 5)) return false;
    return true;
  });
}

export const ALL_SECTORS = ['All', ...Array.from(new Set(SIGNAL_STOCKS.map(s => s.sector))).sort()];
export const ALL_MARKET_CAPS = ['All', 'Mega', 'Large', 'Mid', 'Small', 'Micro'];
export const ALL_CATEGORIES: Array<ScreeningCategory | 'All'> = ['All', ...Object.keys(CATEGORY_META) as ScreeningCategory[]];
