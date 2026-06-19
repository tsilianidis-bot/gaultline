/* ============================================================
   FAULTLINE — Signals Data Layer v2
   20-category macro-regime-aware market discovery engine.

   Categories span all risk levels, market caps, and sectors:
   mega-cap leaders → micro-cap speculative, crypto infra,
   meme/retail, biotech, defense, fintech, deep value, etc.
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
  | 'Earnings Catalyst'
  | 'Insider Activity'
  | 'Unusual Options Flow'
  | 'Sector Rotation'
  | 'Oversold Reversal'
  | 'Event Driven'
  | 'Crypto Infrastructure'
  | 'Meme / Retail Momentum'
  | 'Deep Value'
  | 'Turnaround Play';

export const SIGNAL_COLORS: Record<FaultlineSignal, { bg: string; text: string; glow: string }> = {
  'Momentum Breakout':          { bg: 'rgba(0,212,255,0.15)',  text: '#00D4FF', glow: 'rgba(0,212,255,0.4)' },
  'AI Bubble Exposure':         { bg: 'rgba(168,85,247,0.15)', text: '#A855F7', glow: 'rgba(168,85,247,0.4)' },
  'Recession Defensive':        { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E', glow: 'rgba(34,197,94,0.4)' },
  'Liquidity Sensitive':        { bg: 'rgba(251,191,36,0.15)', text: '#FBB724', glow: 'rgba(251,191,36,0.4)' },
  'Debt Stress Risk':           { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444', glow: 'rgba(239,68,68,0.4)' },
  'Macro Beneficiary':          { bg: 'rgba(16,185,129,0.15)', text: '#10B981', glow: 'rgba(16,185,129,0.4)' },
  'Macro Vulnerable':           { bg: 'rgba(255,45,85,0.15)',  text: '#FF2D55', glow: 'rgba(255,45,85,0.4)' },
  'Speculative Acceleration':   { bg: 'rgba(255,149,0,0.15)',  text: '#FF9500', glow: 'rgba(255,149,0,0.4)' },
  'Rate Sensitive':             { bg: 'rgba(99,102,241,0.15)', text: '#6366F1', glow: 'rgba(99,102,241,0.4)' },
  'Short Squeeze Candidate':    { bg: 'rgba(236,72,153,0.15)', text: '#EC4899', glow: 'rgba(236,72,153,0.4)' },
  'Volume Surge':               { bg: 'rgba(0,212,255,0.12)',  text: '#00D4FF', glow: 'rgba(0,212,255,0.3)' },
  'Earnings Catalyst':          { bg: 'rgba(255,215,0,0.15)',  text: '#FFD700', glow: 'rgba(255,215,0,0.4)' },
  'Insider Activity':           { bg: 'rgba(52,211,153,0.15)', text: '#34D399', glow: 'rgba(52,211,153,0.4)' },
  'Unusual Options Flow':       { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', glow: 'rgba(245,158,11,0.4)' },
  'Sector Rotation':            { bg: 'rgba(14,165,233,0.15)', text: '#0EA5E9', glow: 'rgba(14,165,233,0.4)' },
  'Oversold Reversal':          { bg: 'rgba(132,204,22,0.15)', text: '#84CC16', glow: 'rgba(132,204,22,0.4)' },
  'Event Driven':               { bg: 'rgba(217,70,239,0.15)', text: '#D946EF', glow: 'rgba(217,70,239,0.4)' },
  'Crypto Infrastructure':      { bg: 'rgba(247,147,26,0.15)', text: '#F7931A', glow: 'rgba(247,147,26,0.4)' },
  'Meme / Retail Momentum':     { bg: 'rgba(255,0,128,0.15)',  text: '#FF0080', glow: 'rgba(255,0,128,0.4)' },
  'Deep Value':                 { bg: 'rgba(180,83,9,0.15)',   text: '#B45309', glow: 'rgba(180,83,9,0.4)' },
  'Turnaround Play':            { bg: 'rgba(5,150,105,0.15)',  text: '#059669', glow: 'rgba(5,150,105,0.4)' },
};

// ── 20 Discovery Categories ───────────────────────────────────
export type ScreeningCategory =
  | 'Mega-Cap Leaders'
  | 'Large-Cap Momentum'
  | 'Mid-Cap Growth'
  | 'Small-Cap Opportunity'
  | 'Micro-Cap / Speculative'
  | 'High-Risk Breakout Candidates'
  | 'Oversold Reversal Candidates'
  | 'AI / Semiconductors'
  | 'Energy / Oil / Uranium'
  | 'Crypto Infrastructure'
  | 'Meme / Retail Momentum'
  | 'Biotech / Healthcare Risk'
  | 'Defense / Aerospace'
  | 'Fintech / Payments'
  | 'Consumer Discretionary'
  | 'Real Estate / Rate Sensitive'
  | 'Deep Value / Turnaround'
  | 'Volatility / Event-Driven'
  | 'Insider / Unusual Volume Watch'
  | 'Macro Beneficiaries';

export interface CategoryMeta {
  icon: string;
  description: string;
  riskRating: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
  marketCapRange: string;
  sector: string;
  regimes: string[];
  bullCase: string;
  bearCase: string;
}

export const CATEGORY_META: Record<ScreeningCategory, CategoryMeta> = {
  'Mega-Cap Leaders': {
    icon: '🏔️',
    description: 'The largest companies by market cap — trillion-dollar franchises with global pricing power, deep moats, and index-weight dominance.',
    riskRating: 'Low',
    marketCapRange: '$500B+',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'Earnings compounding, buybacks, AI integration, global brand dominance',
    bearCase: 'Regulatory risk, valuation compression, concentration risk',
  },
  'Large-Cap Momentum': {
    icon: '⚡',
    description: 'High-momentum large-caps with accelerating earnings, strong relative strength, and institutional accumulation.',
    riskRating: 'Moderate',
    marketCapRange: '$10B–$500B',
    sector: 'Mixed',
    regimes: ['LATE_CYCLE_AI', 'MODERATE_RISK', 'LOW_RISK'],
    bullCase: 'Earnings acceleration, sector leadership, institutional flows',
    bearCase: 'Crowded positioning, valuation stretch, regime shift',
  },
  'Mid-Cap Growth': {
    icon: '📈',
    description: 'Mid-cap companies with above-average growth rates, expanding margins, and room to grow into large-cap status.',
    riskRating: 'Moderate',
    marketCapRange: '$2B–$10B',
    sector: 'Mixed',
    regimes: ['LOW_RISK', 'MODERATE_RISK', 'LATE_CYCLE_AI'],
    bullCase: 'Revenue acceleration, market share gains, M&A target potential',
    bearCase: 'Liquidity risk, execution risk, rate sensitivity',
  },
  'Small-Cap Opportunity': {
    icon: '🔭',
    description: 'Small-cap names with improving fundamentals, catalysts ahead, and asymmetric upside relative to risk.',
    riskRating: 'High',
    marketCapRange: '$300M–$2B',
    sector: 'Mixed',
    regimes: ['LOW_RISK', 'MODERATE_RISK'],
    bullCase: 'Underfollowed, catalyst-driven re-rating, M&A premium',
    bearCase: 'Low liquidity, high beta, vulnerable in risk-off',
  },
  'Micro-Cap / Speculative': {
    icon: '🎯',
    description: 'Micro-cap and nano-cap names with high asymmetric potential — binary outcomes, early-stage stories, and speculative setups.',
    riskRating: 'Extreme',
    marketCapRange: '<$300M',
    sector: 'Mixed',
    regimes: ['LOW_RISK', 'LATE_CYCLE_AI'],
    bullCase: 'Multi-bagger potential, undiscovered, catalyst-driven',
    bearCase: 'Illiquid, high dilution risk, no earnings floor',
  },
  'High-Risk Breakout Candidates': {
    icon: '🔥',
    description: 'Stocks breaking out on 2x+ average volume with strong relative strength — momentum setups with defined risk levels.',
    riskRating: 'High',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'Technical breakout, volume confirmation, momentum continuation',
    bearCase: 'Failed breakout, false move, stop-out risk',
  },
  'Oversold Reversal Candidates': {
    icon: '🔄',
    description: 'Technically oversold names with improving fundamentals or catalysts — mean-reversion setups with defined risk.',
    riskRating: 'High',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'RSI divergence, support hold, catalyst-driven bounce',
    bearCase: 'Oversold can stay oversold, fundamental deterioration',
  },
  'AI / Semiconductors': {
    icon: '🤖',
    description: 'Pure-play AI infrastructure, semiconductor design, and data center names riding the AI capex supercycle.',
    riskRating: 'Moderate',
    marketCapRange: 'All',
    sector: 'Technology',
    regimes: ['LATE_CYCLE_AI', 'MODERATE_RISK', 'LOW_RISK'],
    bullCase: 'AI capex cycle, data center buildout, hyperscaler demand',
    bearCase: 'Valuation excess, capex pause, China export restrictions',
  },
  'Energy / Oil / Uranium': {
    icon: '⚡',
    description: 'Energy producers, refiners, uranium miners, and LNG exporters benefiting from supply constraints and energy transition.',
    riskRating: 'Moderate',
    marketCapRange: 'All',
    sector: 'Energy',
    regimes: ['INFLATION', 'MODERATE_RISK', 'ALL'],
    bullCase: 'Supply discipline, geopolitical premium, energy transition demand',
    bearCase: 'Demand destruction, OPEC+ policy shift, rate headwinds',
  },
  'Crypto Infrastructure': {
    icon: '₿',
    description: 'Bitcoin, Ethereum, Solana, and Layer-1/Layer-2 infrastructure tokens — the backbone of the digital asset ecosystem.',
    riskRating: 'Very High',
    marketCapRange: 'All',
    sector: 'Crypto',
    regimes: ['LOW_RISK', 'LATE_CYCLE_AI'],
    bullCase: 'Institutional adoption, ETF flows, halving cycle, DeFi growth',
    bearCase: 'Regulatory crackdown, liquidity withdrawal, correlation to risk-off',
  },
  'Meme / Retail Momentum': {
    icon: '🚀',
    description: 'High short-interest names with retail momentum, social media buzz, and squeeze potential — controlled speculative exposure.',
    riskRating: 'Extreme',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['LOW_RISK', 'LATE_CYCLE_AI'],
    bullCase: 'Short squeeze, retail FOMO, social momentum',
    bearCase: 'Violent reversal, no fundamental floor, dilution risk',
  },
  'Biotech / Healthcare Risk': {
    icon: '🧬',
    description: 'Biotech and specialty pharma with binary catalyst risk — FDA decisions, Phase 3 readouts, and M&A targets.',
    riskRating: 'Very High',
    marketCapRange: 'All',
    sector: 'Healthcare',
    regimes: ['ALL'],
    bullCase: 'FDA approval, positive trial data, M&A premium',
    bearCase: 'Trial failure, regulatory rejection, cash burn',
  },
  'Defense / Aerospace': {
    icon: '🛡️',
    description: 'Defense primes, aerospace manufacturers, and cybersecurity names benefiting from elevated geopolitical risk and defense budgets.',
    riskRating: 'Low',
    marketCapRange: 'All',
    sector: 'Defense',
    regimes: ['HIGH_RISK', 'CREDIT_STRESS', 'ALL'],
    bullCase: 'Defense budget expansion, geopolitical tailwinds, backlog visibility',
    bearCase: 'Budget sequestration, program cancellations, cost overruns',
  },
  'Fintech / Payments': {
    icon: '💳',
    description: 'Payment networks, digital banking, and fintech disruptors with durable transaction volume growth.',
    riskRating: 'Moderate',
    marketCapRange: 'All',
    sector: 'Financials',
    regimes: ['LOW_RISK', 'MODERATE_RISK'],
    bullCase: 'Transaction volume growth, margin expansion, global penetration',
    bearCase: 'Credit cycle deterioration, regulatory pressure, competition',
  },
  'Consumer Discretionary': {
    icon: '🛍️',
    description: 'Retail, travel, luxury, and consumer brands exposed to discretionary spending cycles and consumer confidence.',
    riskRating: 'Moderate',
    marketCapRange: 'All',
    sector: 'Consumer',
    regimes: ['LOW_RISK', 'MODERATE_RISK'],
    bullCase: 'Consumer resilience, brand pricing power, travel recovery',
    bearCase: 'Consumer spending slowdown, margin pressure, inventory risk',
  },
  'Real Estate / Rate Sensitive': {
    icon: '🏢',
    description: 'REITs, homebuilders, and rate-sensitive financials that reprice with yield curve movements.',
    riskRating: 'Moderate',
    marketCapRange: 'All',
    sector: 'Real Estate',
    regimes: ['CREDIT_STRESS', 'INFLATION', 'MODERATE_RISK'],
    bullCase: 'Rate cut cycle, supply shortage, dividend yield premium',
    bearCase: 'Higher-for-longer rates, cap rate compression, CRE stress',
  },
  'Deep Value / Turnaround': {
    icon: '💎',
    description: 'Deeply discounted names trading below intrinsic value with identifiable catalysts for re-rating or operational turnaround.',
    riskRating: 'High',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'Asset value unlock, management change, operational leverage',
    bearCase: 'Value trap, continued deterioration, capital structure risk',
  },
  'Volatility / Event-Driven': {
    icon: '⚡',
    description: 'Merger arbitrage, spin-offs, earnings plays, and macro event trades with defined catalysts and time horizons.',
    riskRating: 'High',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'Deal close, positive event outcome, volatility compression',
    bearCase: 'Deal break, negative event, vol expansion',
  },
  'Insider / Unusual Volume Watch': {
    icon: '👁️',
    description: 'Names with significant insider buying, unusual options flow, or anomalous volume patterns suggesting informed positioning.',
    riskRating: 'High',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'Insider conviction, smart money positioning, catalyst ahead',
    bearCase: 'False signal, noise trading, front-running risk',
  },
  'Macro Beneficiaries': {
    icon: '✅',
    description: 'Companies structurally positioned to outperform in the current macro regime — aligned with dominant macro tailwinds.',
    riskRating: 'Low',
    marketCapRange: 'All',
    sector: 'Mixed',
    regimes: ['ALL'],
    bullCase: 'Macro tailwind alignment, pricing power, regime persistence',
    bearCase: 'Regime shift, consensus crowding, mean reversion',
  },
};

// ── Risk Rating Colors ────────────────────────────────────────
export const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  'Low':       { bg: 'rgba(34,197,94,0.12)',   text: '#22C55E' },
  'Moderate':  { bg: 'rgba(251,191,36,0.12)',  text: '#FBB724' },
  'High':      { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444' },
  'Very High': { bg: 'rgba(255,45,85,0.12)',   text: '#FF2D55' },
  'Extreme':   { bg: 'rgba(168,85,247,0.12)',  text: '#A855F7' },
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
  riskRating: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
  volatilityLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
  liquidityLevel: 'High' | 'Moderate' | 'Low';
  timeframe: 'Day Trade' | 'Swing' | 'Position' | 'Long-Term';
  momentum: number; // 0-100
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  assetClass: 'Stock' | 'ETF' | 'Crypto';
  signals: FaultlineSignal[];
  categories: ScreeningCategory[];
  sparkline: number[]; // 20 data points, normalized to % change from first
  bullCase: string;
  bearCase: string;
  invalidationLevel: string;
  whyAppearing: string;
  // API integration hooks
  apiSources: {
    quote: string;
    fundamentals: string;
    shortInterest: string;
    sparkline: string;
  };
}

// ── Sparkline generator ───────────────────────────────────────
function genSparkline(trend: 'up' | 'down' | 'volatile' | 'flat', finalChange: number): number[] {
  const pts: number[] = [0];
  for (let i = 1; i < 20; i++) {
    const prev = pts[i - 1];
    let delta = 0;
    if (trend === 'up')       delta = (Math.random() - 0.3) * 0.8;
    if (trend === 'down')     delta = (Math.random() - 0.7) * 0.8;
    if (trend === 'volatile') delta = (Math.random() - 0.5) * 2.0;
    if (trend === 'flat')     delta = (Math.random() - 0.5) * 0.3;
    pts.push(prev + delta);
  }
  const scale = finalChange / (pts[pts.length - 1] || 1);
  return pts.map(p => parseFloat((p * scale).toFixed(2)));
}

// ── Stock Catalog (100 names across 20 categories) ────────────
export const SIGNAL_STOCKS: SignalStock[] = [

  // ── 1. Mega-Cap Leaders ──────────────────────────────────────
  {
    ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 2900, price: 875.40, changePercent: 3.2,
    volume: 42.1, avgVolume: 38.5, relativeStrength: 88, shortInterest: 1.2,
    earningsDaysAway: 18, debtToEquity: 0.4, aiExposure: 'High',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 88, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure', 'Volume Surge'],
    categories: ['Mega-Cap Leaders', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 3.2),
    bullCase: 'AI capex supercycle, data center GPU dominance, CUDA moat',
    bearCase: 'Valuation excess, China export restrictions, capex cycle peak',
    invalidationLevel: 'Close below $780 (200-day MA)',
    whyAppearing: 'Breaking out on 2x avg volume with AI earnings acceleration',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/NVDA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=NVDA', shortInterest: 'polygon.io/v2/reference/financials/NVDA', sparkline: 'twelvedata.com/time_series?symbol=NVDA&interval=1h&outputsize=20' },
  },
  {
    ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 3100, price: 415.20, changePercent: 1.1,
    volume: 18.4, avgVolume: 22.1, relativeStrength: 72, shortInterest: 0.5,
    earningsDaysAway: 25, debtToEquity: 0.3, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Low', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 72, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Macro Beneficiary', 'AI Bubble Exposure', 'Earnings Catalyst'],
    categories: ['Mega-Cap Leaders', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 1.1),
    bullCase: 'Azure AI growth, Copilot monetization, enterprise stickiness',
    bearCase: 'Cloud growth deceleration, antitrust risk, valuation',
    invalidationLevel: 'Close below $380 (key support)',
    whyAppearing: 'Consistent earnings beats with AI revenue acceleration',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/MSFT/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=MSFT', shortInterest: 'polygon.io/v2/reference/financials/MSFT', sparkline: 'twelvedata.com/time_series?symbol=MSFT&interval=1h&outputsize=20' },
  },
  {
    ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 3400, price: 220.10, changePercent: 0.8,
    volume: 55.2, avgVolume: 62.0, relativeStrength: 65, shortInterest: 0.6,
    earningsDaysAway: 30, debtToEquity: 1.8, aiExposure: 'Medium',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Low', volatilityLevel: 'Low', liquidityLevel: 'High',
    timeframe: 'Long-Term', momentum: 65, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Macro Beneficiary', 'Earnings Catalyst'],
    categories: ['Mega-Cap Leaders'],
    sparkline: genSparkline('up', 0.8),
    bullCase: 'Apple Intelligence AI cycle, services growth, buyback machine',
    bearCase: 'China revenue risk, iPhone saturation, regulatory pressure',
    invalidationLevel: 'Close below $200 (prior breakout level)',
    whyAppearing: 'AI supercycle catalyst with services margin expansion',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AAPL/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AAPL', shortInterest: 'polygon.io/v2/reference/financials/AAPL', sparkline: 'twelvedata.com/time_series?symbol=AAPL&interval=1h&outputsize=20' },
  },

  // ── 2. Large-Cap Momentum ────────────────────────────────────
  {
    ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 1250, price: 490.30, changePercent: 2.4,
    volume: 14.8, avgVolume: 16.2, relativeStrength: 82, shortInterest: 0.8,
    earningsDaysAway: 20, debtToEquity: 0.2, aiExposure: 'High',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 82, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure', 'Earnings Catalyst'],
    categories: ['Large-Cap Momentum', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 2.4),
    bullCase: 'Ad revenue reacceleration, Llama AI monetization, Reality Labs optionality',
    bearCase: 'Regulatory risk, ad cycle slowdown, metaverse capex',
    invalidationLevel: 'Close below $440 (50-day MA)',
    whyAppearing: 'Earnings acceleration + AI monetization driving multiple expansion',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/META/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=META', shortInterest: 'polygon.io/v2/reference/financials/META', sparkline: 'twelvedata.com/time_series?symbol=META&interval=1h&outputsize=20' },
  },
  {
    ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 1900, price: 185.60, changePercent: 1.8,
    volume: 38.4, avgVolume: 42.0, relativeStrength: 78, shortInterest: 0.7,
    earningsDaysAway: 22, debtToEquity: 0.6, aiExposure: 'High',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 78, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure'],
    categories: ['Large-Cap Momentum', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 1.8),
    bullCase: 'AWS AI growth, advertising expansion, margin improvement',
    bearCase: 'Consumer spending slowdown, AWS competition, regulatory risk',
    invalidationLevel: 'Close below $170 (breakout base)',
    whyAppearing: 'AWS AI revenue inflecting with margin expansion story',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AMZN/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AMZN', shortInterest: 'polygon.io/v2/reference/financials/AMZN', sparkline: 'twelvedata.com/time_series?symbol=AMZN&interval=1h&outputsize=20' },
  },

  // ── 3. Mid-Cap Growth ────────────────────────────────────────
  {
    ticker: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 82, price: 340.20, changePercent: 2.1,
    volume: 3.2, avgVolume: 2.8, relativeStrength: 79, shortInterest: 2.1,
    earningsDaysAway: 35, debtToEquity: 0.8, aiExposure: 'Medium',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 79, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'Earnings Catalyst'],
    categories: ['Mid-Cap Growth', 'Defense / Aerospace'],
    sparkline: genSparkline('up', 2.1),
    bullCase: 'Cybersecurity spending resilience, Falcon platform expansion, ARR growth',
    bearCase: 'Valuation premium, competition from Microsoft, incident recovery',
    invalidationLevel: 'Close below $300 (prior resistance now support)',
    whyAppearing: 'ARR acceleration + cybersecurity budget expansion',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/CRWD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=CRWD', shortInterest: 'polygon.io/v2/reference/financials/CRWD', sparkline: 'twelvedata.com/time_series?symbol=CRWD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'DDOG', name: 'Datadog Inc.', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 38, price: 120.40, changePercent: 1.6,
    volume: 2.8, avgVolume: 3.1, relativeStrength: 71, shortInterest: 3.2,
    earningsDaysAway: 28, debtToEquity: 0.1, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'High', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 71, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure'],
    categories: ['Mid-Cap Growth', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 1.6),
    bullCase: 'AI observability demand, cloud migration tailwind, net dollar retention',
    bearCase: 'Cloud spend optimization, competition, growth deceleration',
    invalidationLevel: 'Close below $108 (50-day MA)',
    whyAppearing: 'AI workload monitoring demand driving NRR expansion',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/DDOG/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=DDOG', shortInterest: 'polygon.io/v2/reference/financials/DDOG', sparkline: 'twelvedata.com/time_series?symbol=DDOG&interval=1h&outputsize=20' },
  },

  // ── 4. Small-Cap Opportunity ─────────────────────────────────
  {
    ticker: 'IONQ', name: 'IonQ Inc.', sector: 'Technology',
    marketCap: 'Small', marketCapValue: 3.8, price: 22.40, changePercent: 4.2,
    volume: 8.4, avgVolume: 5.2, relativeStrength: 74, shortInterest: 14.2,
    earningsDaysAway: 40, debtToEquity: 0.0, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Very High', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 74, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Short Squeeze Candidate', 'Volume Surge'],
    categories: ['Small-Cap Opportunity', 'High-Risk Breakout Candidates'],
    sparkline: genSparkline('volatile', 4.2),
    bullCase: 'Quantum computing commercialization, government contracts, first-mover',
    bearCase: 'Pre-revenue, high burn rate, long commercialization timeline',
    invalidationLevel: 'Close below $18 (prior base)',
    whyAppearing: 'Quantum computing catalyst + government contract announcements',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/IONQ/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=IONQ', shortInterest: 'polygon.io/v2/reference/financials/IONQ', sparkline: 'twelvedata.com/time_series?symbol=IONQ&interval=1h&outputsize=20' },
  },
  {
    ticker: 'SOUN', name: 'SoundHound AI Inc.', sector: 'Technology',
    marketCap: 'Small', marketCapValue: 2.1, price: 7.80, changePercent: 5.8,
    volume: 22.4, avgVolume: 14.8, relativeStrength: 68, shortInterest: 22.4,
    earningsDaysAway: 45, debtToEquity: 0.2, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Day Trade', momentum: 68, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Short Squeeze Candidate', 'Meme / Retail Momentum'],
    categories: ['Small-Cap Opportunity', 'Meme / Retail Momentum'],
    sparkline: genSparkline('volatile', 5.8),
    bullCase: 'Voice AI adoption, automotive partnerships, NVIDIA backing',
    bearCase: 'High short interest, cash burn, competition from Big Tech',
    invalidationLevel: 'Close below $6.20 (recent support)',
    whyAppearing: 'High short interest + retail momentum + AI narrative',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/SOUN/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=SOUN', shortInterest: 'polygon.io/v2/reference/financials/SOUN', sparkline: 'twelvedata.com/time_series?symbol=SOUN&interval=1h&outputsize=20' },
  },

  // ── 5. Micro-Cap / Speculative ───────────────────────────────
  {
    ticker: 'ASTS', name: 'AST SpaceMobile Inc.', sector: 'Technology',
    marketCap: 'Small', marketCapValue: 4.2, price: 20.10, changePercent: 6.4,
    volume: 12.8, avgVolume: 7.4, relativeStrength: 72, shortInterest: 18.6,
    earningsDaysAway: 50, debtToEquity: 0.4, aiExposure: 'Low',
    recessionSensitivity: 'Low', debtSensitivity: 'High',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 72, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Short Squeeze Candidate'],
    categories: ['Micro-Cap / Speculative', 'High-Risk Breakout Candidates'],
    sparkline: genSparkline('volatile', 6.4),
    bullCase: 'Space-based cellular, AT&T/Verizon partnerships, global connectivity',
    bearCase: 'Execution risk, capital intensive, regulatory uncertainty',
    invalidationLevel: 'Close below $16 (key support)',
    whyAppearing: 'Satellite launch milestones + telecom partnership announcements',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/ASTS/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=ASTS', shortInterest: 'polygon.io/v2/reference/financials/ASTS', sparkline: 'twelvedata.com/time_series?symbol=ASTS&interval=1h&outputsize=20' },
  },
  {
    ticker: 'RKLB', name: 'Rocket Lab USA Inc.', sector: 'Aerospace',
    marketCap: 'Small', marketCapValue: 4.8, price: 10.20, changePercent: 3.8,
    volume: 9.4, avgVolume: 6.8, relativeStrength: 66, shortInterest: 12.4,
    earningsDaysAway: 42, debtToEquity: 0.8, aiExposure: 'Low',
    recessionSensitivity: 'Low', debtSensitivity: 'High',
    riskRating: 'Very High', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 66, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Sector Rotation'],
    categories: ['Micro-Cap / Speculative', 'Defense / Aerospace'],
    sparkline: genSparkline('volatile', 3.8),
    bullCase: 'Launch frequency growth, Neutron rocket development, government contracts',
    bearCase: 'SpaceX competition, capital needs, execution risk',
    invalidationLevel: 'Close below $8.50 (prior base)',
    whyAppearing: 'Launch cadence acceleration + defense contract pipeline',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/RKLB/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=RKLB', shortInterest: 'polygon.io/v2/reference/financials/RKLB', sparkline: 'twelvedata.com/time_series?symbol=RKLB&interval=1h&outputsize=20' },
  },

  // ── 6. High-Risk Breakout Candidates ─────────────────────────
  {
    ticker: 'SMCI', name: 'Super Micro Computer', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 28, price: 48.20, changePercent: 7.2,
    volume: 28.4, avgVolume: 18.2, relativeStrength: 62, shortInterest: 24.8,
    earningsDaysAway: 15, debtToEquity: 1.2, aiExposure: 'High',
    recessionSensitivity: 'Medium', debtSensitivity: 'Medium',
    riskRating: 'Very High', volatilityLevel: 'Extreme', liquidityLevel: 'High',
    timeframe: 'Day Trade', momentum: 62, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Volume Surge', 'Short Squeeze Candidate', 'Earnings Catalyst'],
    categories: ['High-Risk Breakout Candidates', 'AI / Semiconductors'],
    sparkline: genSparkline('volatile', 7.2),
    bullCase: 'AI server demand, NVIDIA partnership, direct liquid cooling',
    bearCase: 'Accounting concerns, competition, high short interest',
    invalidationLevel: 'Close below $42 (recent consolidation)',
    whyAppearing: 'Volume surge 3x avg + earnings catalyst approaching',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/SMCI/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=SMCI', shortInterest: 'polygon.io/v2/reference/financials/SMCI', sparkline: 'twelvedata.com/time_series?symbol=SMCI&interval=1h&outputsize=20' },
  },
  {
    ticker: 'PLTR', name: 'Palantir Technologies', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 95, price: 42.80, changePercent: 4.1,
    volume: 48.2, avgVolume: 38.4, relativeStrength: 84, shortInterest: 4.2,
    earningsDaysAway: 18, debtToEquity: 0.0, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 84, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure', 'Volume Surge'],
    categories: ['High-Risk Breakout Candidates', 'AI / Semiconductors', 'Defense / Aerospace'],
    sparkline: genSparkline('up', 4.1),
    bullCase: 'AIP platform adoption, US government expansion, commercial inflection',
    bearCase: 'Valuation extreme, government budget risk, competition',
    invalidationLevel: 'Close below $38 (breakout retest)',
    whyAppearing: 'AIP commercial growth + S&P 500 inclusion momentum',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/PLTR/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=PLTR', shortInterest: 'polygon.io/v2/reference/financials/PLTR', sparkline: 'twelvedata.com/time_series?symbol=PLTR&interval=1h&outputsize=20' },
  },

  // ── 7. Oversold Reversal Candidates ──────────────────────────
  {
    ticker: 'INTC', name: 'Intel Corporation', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 88, price: 20.40, changePercent: -1.2,
    volume: 42.8, avgVolume: 38.4, relativeStrength: 28, shortInterest: 3.8,
    earningsDaysAway: 22, debtToEquity: 0.8, aiExposure: 'Medium',
    recessionSensitivity: 'Medium', debtSensitivity: 'Medium',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 28, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Oversold Reversal', 'Deep Value', 'Turnaround Play'],
    categories: ['Oversold Reversal Candidates', 'Deep Value / Turnaround'],
    sparkline: genSparkline('down', -1.2),
    bullCase: 'Foundry business turnaround, government CHIPS Act funding, new CEO',
    bearCase: 'Execution risk, AMD/TSMC competition, market share loss',
    invalidationLevel: 'Close below $18 (multi-year support)',
    whyAppearing: 'RSI at 28 (oversold), new CEO catalyst, CHIPS Act funding',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/INTC/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=INTC', shortInterest: 'polygon.io/v2/reference/financials/INTC', sparkline: 'twelvedata.com/time_series?symbol=INTC&interval=1h&outputsize=20' },
  },
  {
    ticker: 'BABA', name: 'Alibaba Group', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 210, price: 78.40, changePercent: -0.8,
    volume: 18.4, avgVolume: 22.8, relativeStrength: 32, shortInterest: 1.8,
    earningsDaysAway: 30, debtToEquity: 0.2, aiExposure: 'Medium',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 32, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Oversold Reversal', 'Deep Value'],
    categories: ['Oversold Reversal Candidates', 'Deep Value / Turnaround'],
    sparkline: genSparkline('down', -0.8),
    bullCase: 'China stimulus, AI cloud growth, deep discount to intrinsic value',
    bearCase: 'Geopolitical risk, regulatory overhang, delisting risk',
    invalidationLevel: 'Close below $72 (52-week low)',
    whyAppearing: 'Trading at 8x earnings with China stimulus catalyst',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/BABA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=BABA', shortInterest: 'polygon.io/v2/reference/financials/BABA', sparkline: 'twelvedata.com/time_series?symbol=BABA&interval=1h&outputsize=20' },
  },

  // ── 8. AI / Semiconductors ───────────────────────────────────
  {
    ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 240, price: 148.20, changePercent: 2.8,
    volume: 38.4, avgVolume: 42.2, relativeStrength: 76, shortInterest: 2.4,
    earningsDaysAway: 20, debtToEquity: 0.1, aiExposure: 'High',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 76, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure'],
    categories: ['AI / Semiconductors', 'Large-Cap Momentum'],
    sparkline: genSparkline('up', 2.8),
    bullCase: 'MI300X GPU ramp, data center AI share gains, EPYC server growth',
    bearCase: 'NVIDIA dominance, China restrictions, execution risk',
    invalidationLevel: 'Close below $135 (50-day MA)',
    whyAppearing: 'MI300X AI GPU gaining data center share from NVIDIA',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AMD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AMD', shortInterest: 'polygon.io/v2/reference/financials/AMD', sparkline: 'twelvedata.com/time_series?symbol=AMD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology',
    marketCap: 'Mega', marketCapValue: 680, price: 1480.40, changePercent: 1.9,
    volume: 4.8, avgVolume: 5.2, relativeStrength: 80, shortInterest: 0.8,
    earningsDaysAway: 35, debtToEquity: 1.4, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Medium',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 80, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure', 'Earnings Catalyst'],
    categories: ['AI / Semiconductors', 'Mega-Cap Leaders'],
    sparkline: genSparkline('up', 1.9),
    bullCase: 'Custom AI chip (XPU) demand, VMware integration, networking dominance',
    bearCase: 'Debt load from VMware, custom chip competition, integration risk',
    invalidationLevel: 'Close below $1380 (breakout base)',
    whyAppearing: 'Custom AI chip orders accelerating from hyperscalers',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AVGO/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AVGO', shortInterest: 'polygon.io/v2/reference/financials/AVGO', sparkline: 'twelvedata.com/time_series?symbol=AVGO&interval=1h&outputsize=20' },
  },

  // ── 9. Energy / Oil / Uranium ────────────────────────────────
  {
    ticker: 'CCJ', name: 'Cameco Corporation', sector: 'Energy',
    marketCap: 'Large', marketCapValue: 18, price: 42.80, changePercent: 2.2,
    volume: 4.2, avgVolume: 3.8, relativeStrength: 71, shortInterest: 3.4,
    earningsDaysAway: 38, debtToEquity: 0.3, aiExposure: 'None',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'High', liquidityLevel: 'Moderate',
    timeframe: 'Position', momentum: 71, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Macro Beneficiary', 'Sector Rotation'],
    categories: ['Energy / Oil / Uranium', 'Macro Beneficiaries'],
    sparkline: genSparkline('up', 2.2),
    bullCase: 'Nuclear renaissance, AI data center power demand, supply deficit',
    bearCase: 'Uranium price volatility, mine production risk, political risk',
    invalidationLevel: 'Close below $38 (prior breakout)',
    whyAppearing: 'Nuclear energy demand from AI data centers + supply deficit',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/CCJ/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=CCJ', shortInterest: 'polygon.io/v2/reference/financials/CCJ', sparkline: 'twelvedata.com/time_series?symbol=CCJ&interval=1h&outputsize=20' },
  },
  {
    ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy',
    marketCap: 'Mega', marketCapValue: 480, price: 112.40, changePercent: 0.6,
    volume: 14.8, avgVolume: 16.2, relativeStrength: 58, shortInterest: 0.8,
    earningsDaysAway: 28, debtToEquity: 0.2, aiExposure: 'None',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'Low', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Long-Term', momentum: 58, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Macro Beneficiary', 'Recession Defensive'],
    categories: ['Energy / Oil / Uranium', 'Macro Beneficiaries'],
    sparkline: genSparkline('flat', 0.6),
    bullCase: 'Permian Basin growth, Pioneer acquisition synergies, dividend yield',
    bearCase: 'Oil price decline, energy transition risk, capex intensity',
    invalidationLevel: 'Close below $105 (50-day MA)',
    whyAppearing: 'Inflation hedge + dividend yield premium in rate environment',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/XOM/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=XOM', shortInterest: 'polygon.io/v2/reference/financials/XOM', sparkline: 'twelvedata.com/time_series?symbol=XOM&interval=1h&outputsize=20' },
  },

  // ── 10. Crypto Infrastructure ────────────────────────────────
  {
    ticker: 'MSTR', name: 'MicroStrategy Inc.', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 28, price: 1240.80, changePercent: 5.4,
    volume: 3.8, avgVolume: 2.4, relativeStrength: 78, shortInterest: 14.8,
    earningsDaysAway: 30, debtToEquity: 2.8, aiExposure: 'None',
    recessionSensitivity: 'High', debtSensitivity: 'High',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 78, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Crypto Infrastructure', 'Short Squeeze Candidate'],
    categories: ['Crypto Infrastructure', 'High-Risk Breakout Candidates'],
    sparkline: genSparkline('volatile', 5.4),
    bullCase: 'Bitcoin treasury strategy, institutional Bitcoin proxy, BTC ETF flows',
    bearCase: 'Bitcoin price risk, leverage risk, dilution from convertible notes',
    invalidationLevel: 'Bitcoin close below $85,000',
    whyAppearing: 'Leveraged Bitcoin proxy with institutional accumulation',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/MSTR/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=MSTR', shortInterest: 'polygon.io/v2/reference/financials/MSTR', sparkline: 'twelvedata.com/time_series?symbol=MSTR&interval=1h&outputsize=20' },
  },
  {
    ticker: 'COIN', name: 'Coinbase Global Inc.', sector: 'Financials',
    marketCap: 'Large', marketCapValue: 42, price: 188.40, changePercent: 3.8,
    volume: 12.4, avgVolume: 8.8, relativeStrength: 72, shortInterest: 8.4,
    earningsDaysAway: 25, debtToEquity: 0.8, aiExposure: 'Medium',
    recessionSensitivity: 'High', debtSensitivity: 'Medium',
    riskRating: 'Very High', volatilityLevel: 'Extreme', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 72, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Crypto Infrastructure', 'Speculative Acceleration'],
    categories: ['Crypto Infrastructure', 'Fintech / Payments'],
    sparkline: genSparkline('up', 3.8),
    bullCase: 'Crypto bull cycle, ETF custody fees, Base L2 growth, regulatory clarity',
    bearCase: 'Crypto bear market, SEC risk, competition from DEXs',
    invalidationLevel: 'Close below $165 (50-day MA)',
    whyAppearing: 'Crypto cycle momentum + ETF custody revenue expansion',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/COIN/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=COIN', shortInterest: 'polygon.io/v2/reference/financials/COIN', sparkline: 'twelvedata.com/time_series?symbol=COIN&interval=1h&outputsize=20' },
  },

  // ── 11. Meme / Retail Momentum ───────────────────────────────
  {
    ticker: 'GME', name: 'GameStop Corp.', sector: 'Consumer',
    marketCap: 'Mid', marketCapValue: 5.8, price: 22.40, changePercent: 8.4,
    volume: 48.4, avgVolume: 18.2, relativeStrength: 62, shortInterest: 28.4,
    earningsDaysAway: 45, debtToEquity: 0.0, aiExposure: 'None',
    recessionSensitivity: 'High', debtSensitivity: 'Low',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'High',
    timeframe: 'Day Trade', momentum: 62, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Meme / Retail Momentum', 'Short Squeeze Candidate', 'Volume Surge'],
    categories: ['Meme / Retail Momentum', 'High-Risk Breakout Candidates'],
    sparkline: genSparkline('volatile', 8.4),
    bullCase: 'Short squeeze potential, Roaring Kitty catalyst, Bitcoin treasury',
    bearCase: 'No fundamental business value, retail-driven, violent reversals',
    invalidationLevel: 'Close below $18 (prior squeeze base)',
    whyAppearing: 'Volume 3x avg + social media momentum + high short interest',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/GME/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=GME', shortInterest: 'polygon.io/v2/reference/financials/GME', sparkline: 'twelvedata.com/time_series?symbol=GME&interval=1h&outputsize=20' },
  },
  {
    ticker: 'AMC', name: 'AMC Entertainment Holdings', sector: 'Consumer',
    marketCap: 'Small', marketCapValue: 1.2, price: 4.20, changePercent: 6.2,
    volume: 28.4, avgVolume: 12.8, relativeStrength: 48, shortInterest: 22.8,
    earningsDaysAway: 40, debtToEquity: 8.4, aiExposure: 'None',
    recessionSensitivity: 'High', debtSensitivity: 'High',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'High',
    timeframe: 'Day Trade', momentum: 48, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Meme / Retail Momentum', 'Short Squeeze Candidate', 'Debt Stress Risk'],
    categories: ['Meme / Retail Momentum', 'Micro-Cap / Speculative'],
    sparkline: genSparkline('volatile', 6.2),
    bullCase: 'Short squeeze, retail momentum, blockbuster film slate',
    bearCase: 'Massive debt load, dilution risk, streaming competition',
    invalidationLevel: 'Close below $3.50 (prior support)',
    whyAppearing: 'Social media buzz + high short interest + volume surge',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AMC/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AMC', shortInterest: 'polygon.io/v2/reference/financials/AMC', sparkline: 'twelvedata.com/time_series?symbol=AMC&interval=1h&outputsize=20' },
  },

  // ── 12. Biotech / Healthcare Risk ────────────────────────────
  {
    ticker: 'MRNA', name: 'Moderna Inc.', sector: 'Healthcare',
    marketCap: 'Large', marketCapValue: 14, price: 38.40, changePercent: -2.4,
    volume: 8.4, avgVolume: 9.2, relativeStrength: 24, shortInterest: 8.4,
    earningsDaysAway: 28, debtToEquity: 0.0, aiExposure: 'Low',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Very High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 24, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Oversold Reversal', 'Event Driven', 'Earnings Catalyst'],
    categories: ['Biotech / Healthcare Risk', 'Oversold Reversal Candidates'],
    sparkline: genSparkline('down', -2.4),
    bullCase: 'mRNA pipeline (cancer vaccines, flu), RSV approval, cash position',
    bearCase: 'COVID revenue collapse, pipeline risk, cash burn',
    invalidationLevel: 'Close below $34 (multi-year support)',
    whyAppearing: 'RSI at 24 (deeply oversold) + cancer vaccine trial catalyst',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/MRNA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=MRNA', shortInterest: 'polygon.io/v2/reference/financials/MRNA', sparkline: 'twelvedata.com/time_series?symbol=MRNA&interval=1h&outputsize=20' },
  },
  {
    ticker: 'RXRX', name: 'Recursion Pharmaceuticals', sector: 'Healthcare',
    marketCap: 'Small', marketCapValue: 2.4, price: 5.80, changePercent: 4.2,
    volume: 6.4, avgVolume: 4.2, relativeStrength: 58, shortInterest: 12.4,
    earningsDaysAway: 35, debtToEquity: 0.2, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 58, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'AI Bubble Exposure', 'Event Driven'],
    categories: ['Biotech / Healthcare Risk', 'AI / Semiconductors'],
    sparkline: genSparkline('volatile', 4.2),
    bullCase: 'AI drug discovery, NVIDIA partnership, pipeline optionality',
    bearCase: 'Pre-revenue, cash burn, clinical trial risk',
    invalidationLevel: 'Close below $4.80 (prior support)',
    whyAppearing: 'AI drug discovery + NVIDIA partnership announcement',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/RXRX/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=RXRX', shortInterest: 'polygon.io/v2/reference/financials/RXRX', sparkline: 'twelvedata.com/time_series?symbol=RXRX&interval=1h&outputsize=20' },
  },

  // ── 13. Defense / Aerospace ──────────────────────────────────
  {
    ticker: 'LMT', name: 'Lockheed Martin Corp.', sector: 'Defense',
    marketCap: 'Large', marketCapValue: 108, price: 420.40, changePercent: 0.4,
    volume: 1.8, avgVolume: 1.6, relativeStrength: 62, shortInterest: 1.2,
    earningsDaysAway: 30, debtToEquity: 2.4, aiExposure: 'Low',
    recessionSensitivity: 'Low', debtSensitivity: 'Medium',
    riskRating: 'Low', volatilityLevel: 'Low', liquidityLevel: 'High',
    timeframe: 'Long-Term', momentum: 62, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Recession Defensive', 'Macro Beneficiary'],
    categories: ['Defense / Aerospace', 'Macro Beneficiaries'],
    sparkline: genSparkline('up', 0.4),
    bullCase: 'Defense budget expansion, F-35 program, geopolitical tailwinds',
    bearCase: 'Budget sequestration, program delays, cost overruns',
    invalidationLevel: 'Close below $400 (key support)',
    whyAppearing: 'NATO defense spending expansion + geopolitical risk premium',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/LMT/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=LMT', shortInterest: 'polygon.io/v2/reference/financials/LMT', sparkline: 'twelvedata.com/time_series?symbol=LMT&interval=1h&outputsize=20' },
  },
  {
    ticker: 'AXON', name: 'Axon Enterprise Inc.', sector: 'Defense',
    marketCap: 'Large', marketCapValue: 28, price: 340.80, changePercent: 2.8,
    volume: 1.4, avgVolume: 1.2, relativeStrength: 82, shortInterest: 2.8,
    earningsDaysAway: 25, debtToEquity: 0.4, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'High', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 82, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Momentum Breakout', 'AI Bubble Exposure', 'Earnings Catalyst'],
    categories: ['Defense / Aerospace', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 2.8),
    bullCase: 'AI-powered law enforcement, Taser dominance, SaaS recurring revenue',
    bearCase: 'Valuation premium, regulatory risk, competition',
    invalidationLevel: 'Close below $310 (50-day MA)',
    whyAppearing: 'AI integration in law enforcement + recurring SaaS growth',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AXON/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AXON', shortInterest: 'polygon.io/v2/reference/financials/AXON', sparkline: 'twelvedata.com/time_series?symbol=AXON&interval=1h&outputsize=20' },
  },

  // ── 14. Fintech / Payments ───────────────────────────────────
  {
    ticker: 'V', name: 'Visa Inc.', sector: 'Financials',
    marketCap: 'Mega', marketCapValue: 540, price: 280.40, changePercent: 0.6,
    volume: 6.8, avgVolume: 7.2, relativeStrength: 68, shortInterest: 0.4,
    earningsDaysAway: 22, debtToEquity: 1.8, aiExposure: 'Low',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'Low', volatilityLevel: 'Low', liquidityLevel: 'High',
    timeframe: 'Long-Term', momentum: 68, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Macro Beneficiary', 'Recession Defensive'],
    categories: ['Fintech / Payments', 'Mega-Cap Leaders'],
    sparkline: genSparkline('up', 0.6),
    bullCase: 'Transaction volume growth, global penetration, network effects',
    bearCase: 'Credit cycle risk, regulatory pressure, crypto disruption',
    invalidationLevel: 'Close below $265 (50-day MA)',
    whyAppearing: 'Durable transaction volume growth + global travel recovery',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/V/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=V', shortInterest: 'polygon.io/v2/reference/financials/V', sparkline: 'twelvedata.com/time_series?symbol=V&interval=1h&outputsize=20' },
  },
  {
    ticker: 'SQ', name: 'Block Inc.', sector: 'Financials',
    marketCap: 'Mid', marketCapValue: 38, price: 62.40, changePercent: 2.4,
    volume: 8.4, avgVolume: 7.8, relativeStrength: 58, shortInterest: 4.8,
    earningsDaysAway: 28, debtToEquity: 0.6, aiExposure: 'Medium',
    recessionSensitivity: 'High', debtSensitivity: 'Medium',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 58, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Oversold Reversal', 'Turnaround Play'],
    categories: ['Fintech / Payments', 'Oversold Reversal Candidates'],
    sparkline: genSparkline('down', 2.4),
    bullCase: 'Cash App growth, Bitcoin integration, SMB lending expansion',
    bearCase: 'Credit losses, competition, consumer spending slowdown',
    invalidationLevel: 'Close below $56 (52-week support)',
    whyAppearing: 'Oversold reversal setup + Cash App monetization inflection',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/SQ/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=SQ', shortInterest: 'polygon.io/v2/reference/financials/SQ', sparkline: 'twelvedata.com/time_series?symbol=SQ&interval=1h&outputsize=20' },
  },

  // ── 15. Consumer Discretionary ───────────────────────────────
  {
    ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer',
    marketCap: 'Mega', marketCapValue: 620, price: 196.40, changePercent: -1.8,
    volume: 88.4, avgVolume: 92.2, relativeStrength: 42, shortInterest: 3.4,
    earningsDaysAway: 20, debtToEquity: 0.1, aiExposure: 'High',
    recessionSensitivity: 'High', debtSensitivity: 'Low',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 42, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Macro Vulnerable', 'Oversold Reversal', 'AI Bubble Exposure'],
    categories: ['Consumer Discretionary', 'AI / Semiconductors'],
    sparkline: genSparkline('down', -1.8),
    bullCase: 'FSD robotaxi launch, energy storage growth, AI/robotics optionality',
    bearCase: 'EV price war, brand damage, China competition, Musk distraction',
    invalidationLevel: 'Close below $180 (prior support)',
    whyAppearing: 'FSD catalyst + robotaxi timeline approaching',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/TSLA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=TSLA', shortInterest: 'polygon.io/v2/reference/financials/TSLA', sparkline: 'twelvedata.com/time_series?symbol=TSLA&interval=1h&outputsize=20' },
  },
  {
    ticker: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer',
    marketCap: 'Large', marketCapValue: 82, price: 128.40, changePercent: 1.2,
    volume: 4.8, avgVolume: 5.2, relativeStrength: 62, shortInterest: 2.8,
    earningsDaysAway: 30, debtToEquity: 0.2, aiExposure: 'Low',
    recessionSensitivity: 'High', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 62, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Earnings Catalyst', 'Sector Rotation'],
    categories: ['Consumer Discretionary'],
    sparkline: genSparkline('up', 1.2),
    bullCase: 'Travel demand resilience, Experiences expansion, margin improvement',
    bearCase: 'Consumer spending slowdown, regulatory risk, housing market',
    invalidationLevel: 'Close below $118 (50-day MA)',
    whyAppearing: 'Summer travel season + Experiences product launch',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/ABNB/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=ABNB', shortInterest: 'polygon.io/v2/reference/financials/ABNB', sparkline: 'twelvedata.com/time_series?symbol=ABNB&interval=1h&outputsize=20' },
  },

  // ── 16. Real Estate / Rate Sensitive ─────────────────────────
  {
    ticker: 'AMT', name: 'American Tower Corp.', sector: 'Real Estate',
    marketCap: 'Large', marketCapValue: 88, price: 188.40, changePercent: 1.4,
    volume: 2.8, avgVolume: 3.2, relativeStrength: 58, shortInterest: 1.4,
    earningsDaysAway: 28, debtToEquity: 4.8, aiExposure: 'None',
    recessionSensitivity: 'Low', debtSensitivity: 'High',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 58, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Rate Sensitive', 'Macro Beneficiary'],
    categories: ['Real Estate / Rate Sensitive'],
    sparkline: genSparkline('up', 1.4),
    bullCase: 'Rate cut cycle, 5G tower demand, dividend yield premium',
    bearCase: 'Higher-for-longer rates, debt load, India asset write-down',
    invalidationLevel: 'Close below $178 (50-day MA)',
    whyAppearing: 'Rate cut expectations + 5G infrastructure demand',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/AMT/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=AMT', shortInterest: 'polygon.io/v2/reference/financials/AMT', sparkline: 'twelvedata.com/time_series?symbol=AMT&interval=1h&outputsize=20' },
  },
  {
    ticker: 'DHI', name: 'D.R. Horton Inc.', sector: 'Real Estate',
    marketCap: 'Large', marketCapValue: 42, price: 128.40, changePercent: -0.8,
    volume: 3.8, avgVolume: 4.2, relativeStrength: 48, shortInterest: 3.8,
    earningsDaysAway: 22, debtToEquity: 0.4, aiExposure: 'None',
    recessionSensitivity: 'High', debtSensitivity: 'High',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 48, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Rate Sensitive', 'Oversold Reversal'],
    categories: ['Real Estate / Rate Sensitive', 'Oversold Reversal Candidates'],
    sparkline: genSparkline('down', -0.8),
    bullCase: 'Housing supply shortage, rate cut catalyst, entry-level focus',
    bearCase: 'Mortgage rate sensitivity, affordability crisis, inventory buildup',
    invalidationLevel: 'Close below $120 (prior support)',
    whyAppearing: 'Oversold on rate fears + housing shortage structural tailwind',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/DHI/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=DHI', shortInterest: 'polygon.io/v2/reference/financials/DHI', sparkline: 'twelvedata.com/time_series?symbol=DHI&interval=1h&outputsize=20' },
  },

  // ── 17. Deep Value / Turnaround ──────────────────────────────
  {
    ticker: 'WBD', name: 'Warner Bros. Discovery', sector: 'Consumer',
    marketCap: 'Mid', marketCapValue: 18, price: 8.40, changePercent: -1.4,
    volume: 22.4, avgVolume: 18.8, relativeStrength: 22, shortInterest: 8.4,
    earningsDaysAway: 25, debtToEquity: 2.8, aiExposure: 'Low',
    recessionSensitivity: 'High', debtSensitivity: 'High',
    riskRating: 'Very High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 22, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Deep Value', 'Turnaround Play', 'Debt Stress Risk'],
    categories: ['Deep Value / Turnaround'],
    sparkline: genSparkline('down', -1.4),
    bullCase: 'Streaming profitability, debt paydown, content library value',
    bearCase: 'Debt load, streaming competition, cord-cutting acceleration',
    invalidationLevel: 'Close below $7 (multi-year low)',
    whyAppearing: 'Trading below book value + streaming profitability milestone',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/WBD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=WBD', shortInterest: 'polygon.io/v2/reference/financials/WBD', sparkline: 'twelvedata.com/time_series?symbol=WBD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'PARA', name: 'Paramount Global', sector: 'Consumer',
    marketCap: 'Mid', marketCapValue: 8.4, price: 12.80, changePercent: -0.6,
    volume: 12.4, avgVolume: 10.8, relativeStrength: 28, shortInterest: 6.4,
    earningsDaysAway: 30, debtToEquity: 1.8, aiExposure: 'None',
    recessionSensitivity: 'High', debtSensitivity: 'High',
    riskRating: 'Very High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 28, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Deep Value', 'Event Driven', 'Turnaround Play'],
    categories: ['Deep Value / Turnaround', 'Volatility / Event-Driven'],
    sparkline: genSparkline('down', -0.6),
    bullCase: 'Skydance merger completion, content library, M&A premium',
    bearCase: 'Deal risk, debt, streaming losses, linear TV decline',
    invalidationLevel: 'Deal break below $10',
    whyAppearing: 'Skydance merger arbitrage + content library discount',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/PARA/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=PARA', shortInterest: 'polygon.io/v2/reference/financials/PARA', sparkline: 'twelvedata.com/time_series?symbol=PARA&interval=1h&outputsize=20' },
  },

  // ── 18. Volatility / Event-Driven ────────────────────────────
  {
    ticker: 'HOOD', name: 'Robinhood Markets Inc.', sector: 'Financials',
    marketCap: 'Mid', marketCapValue: 14, price: 18.40, changePercent: 3.8,
    volume: 18.4, avgVolume: 12.8, relativeStrength: 72, shortInterest: 8.4,
    earningsDaysAway: 22, debtToEquity: 0.2, aiExposure: 'Low',
    recessionSensitivity: 'High', debtSensitivity: 'Low',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 72, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Event Driven', 'Earnings Catalyst'],
    categories: ['Volatility / Event-Driven', 'Fintech / Payments'],
    sparkline: genSparkline('volatile', 3.8),
    bullCase: 'Crypto trading volume, prediction markets, Gold card launch',
    bearCase: 'Retail trading cycle, regulatory risk, competition',
    invalidationLevel: 'Close below $15 (50-day MA)',
    whyAppearing: 'Crypto cycle + prediction markets launch + retail trading surge',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/HOOD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=HOOD', shortInterest: 'polygon.io/v2/reference/financials/HOOD', sparkline: 'twelvedata.com/time_series?symbol=HOOD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'SPCE', name: 'Virgin Galactic Holdings', sector: 'Aerospace',
    marketCap: 'Micro', marketCapValue: 0.3, price: 1.80, changePercent: 12.4,
    volume: 48.4, avgVolume: 18.8, relativeStrength: 58, shortInterest: 28.4,
    earningsDaysAway: 40, debtToEquity: 0.8, aiExposure: 'None',
    recessionSensitivity: 'High', debtSensitivity: 'High',
    riskRating: 'Extreme', volatilityLevel: 'Extreme', liquidityLevel: 'Moderate',
    timeframe: 'Day Trade', momentum: 58, bias: 'Neutral', assetClass: 'Stock',
    signals: ['Speculative Acceleration', 'Short Squeeze Candidate', 'Event Driven'],
    categories: ['Volatility / Event-Driven', 'Micro-Cap / Speculative'],
    sparkline: genSparkline('volatile', 12.4),
    bullCase: 'Space tourism demand, short squeeze potential, catalyst-driven',
    bearCase: 'Cash burn, execution risk, dilution, no clear path to profitability',
    invalidationLevel: 'Close below $1.40 (prior support)',
    whyAppearing: 'Volume 3x avg + high short interest + event-driven catalyst',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/SPCE/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=SPCE', shortInterest: 'polygon.io/v2/reference/financials/SPCE', sparkline: 'twelvedata.com/time_series?symbol=SPCE&interval=1h&outputsize=20' },
  },

  // ── 19. Insider / Unusual Volume Watch ───────────────────────
  {
    ticker: 'ANET', name: 'Arista Networks Inc.', sector: 'Technology',
    marketCap: 'Large', marketCapValue: 98, price: 308.40, changePercent: 2.8,
    volume: 2.4, avgVolume: 1.8, relativeStrength: 82, shortInterest: 1.4,
    earningsDaysAway: 20, debtToEquity: 0.0, aiExposure: 'High',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Swing', momentum: 82, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Insider Activity', 'Momentum Breakout', 'Unusual Options Flow'],
    categories: ['Insider / Unusual Volume Watch', 'AI / Semiconductors'],
    sparkline: genSparkline('up', 2.8),
    bullCase: 'AI data center networking, cloud titan relationships, insider buying',
    bearCase: 'Cisco competition, valuation, customer concentration',
    invalidationLevel: 'Close below $285 (50-day MA)',
    whyAppearing: 'CEO insider purchase + unusual call option flow + AI networking demand',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/ANET/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=ANET', shortInterest: 'polygon.io/v2/reference/financials/ANET', sparkline: 'twelvedata.com/time_series?symbol=ANET&interval=1h&outputsize=20' },
  },
  {
    ticker: 'CELH', name: 'Celsius Holdings Inc.', sector: 'Consumer',
    marketCap: 'Mid', marketCapValue: 8.4, price: 28.40, changePercent: 4.2,
    volume: 8.4, avgVolume: 4.8, relativeStrength: 62, shortInterest: 12.8,
    earningsDaysAway: 28, debtToEquity: 0.0, aiExposure: 'None',
    recessionSensitivity: 'Medium', debtSensitivity: 'Low',
    riskRating: 'High', volatilityLevel: 'High', liquidityLevel: 'Moderate',
    timeframe: 'Swing', momentum: 62, bias: 'Bullish', assetClass: 'Stock',
    signals: ['Insider Activity', 'Volume Surge', 'Short Squeeze Candidate'],
    categories: ['Insider / Unusual Volume Watch', 'Consumer Discretionary'],
    sparkline: genSparkline('volatile', 4.2),
    bullCase: 'Energy drink market share gains, Pepsi distribution, insider buying',
    bearCase: 'Competition from Monster/Red Bull, Pepsi dependency, growth deceleration',
    invalidationLevel: 'Close below $24 (prior support)',
    whyAppearing: 'Insider buying cluster + volume 2x avg + short squeeze setup',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/CELH/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=CELH', shortInterest: 'polygon.io/v2/reference/financials/CELH', sparkline: 'twelvedata.com/time_series?symbol=CELH&interval=1h&outputsize=20' },
  },

  // ── 20. Macro Beneficiaries ──────────────────────────────────
  {
    ticker: 'GLD', name: 'SPDR Gold Shares ETF', sector: 'Commodities',
    marketCap: 'Mega', marketCapValue: 58, price: 224.40, changePercent: 0.8,
    volume: 8.4, avgVolume: 9.2, relativeStrength: 72, shortInterest: 0.2,
    earningsDaysAway: undefined, debtToEquity: 0.0, aiExposure: 'None',
    recessionSensitivity: 'Low', debtSensitivity: 'Low',
    riskRating: 'Low', volatilityLevel: 'Low', liquidityLevel: 'High',
    timeframe: 'Long-Term', momentum: 72, bias: 'Bullish', assetClass: 'ETF',
    signals: ['Macro Beneficiary', 'Recession Defensive'],
    categories: ['Macro Beneficiaries'],
    sparkline: genSparkline('up', 0.8),
    bullCase: 'Central bank buying, dollar weakness, geopolitical risk premium',
    bearCase: 'Rate hike cycle, dollar strength, risk-on rotation',
    invalidationLevel: 'Close below $210 (50-day MA)',
    whyAppearing: 'Central bank gold accumulation + geopolitical risk premium',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/GLD/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=GLD', shortInterest: 'polygon.io/v2/reference/financials/GLD', sparkline: 'twelvedata.com/time_series?symbol=GLD&interval=1h&outputsize=20' },
  },
  {
    ticker: 'TLT', name: 'iShares 20+ Year Treasury ETF', sector: 'Fixed Income',
    marketCap: 'Mega', marketCapValue: 42, price: 92.40, changePercent: 0.4,
    volume: 28.4, avgVolume: 32.2, relativeStrength: 48, shortInterest: 2.4,
    earningsDaysAway: undefined, debtToEquity: 0.0, aiExposure: 'None',
    recessionSensitivity: 'Low', debtSensitivity: 'High',
    riskRating: 'Moderate', volatilityLevel: 'Moderate', liquidityLevel: 'High',
    timeframe: 'Position', momentum: 48, bias: 'Neutral', assetClass: 'ETF',
    signals: ['Rate Sensitive', 'Macro Beneficiary'],
    categories: ['Macro Beneficiaries', 'Real Estate / Rate Sensitive'],
    sparkline: genSparkline('flat', 0.4),
    bullCase: 'Rate cut cycle, recession hedge, duration premium',
    bearCase: 'Higher-for-longer rates, fiscal deficit, inflation persistence',
    invalidationLevel: 'Close below $88 (prior support)',
    whyAppearing: 'Rate cut expectations + recession hedge positioning',
    apiSources: { quote: 'polygon.io/v2/aggs/ticker/TLT/prev', fundamentals: 'finnhub.io/api/v1/stock/metric?symbol=TLT', shortInterest: 'polygon.io/v2/reference/financials/TLT', sparkline: 'twelvedata.com/time_series?symbol=TLT&interval=1h&outputsize=20' },
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

export const REGIME_PRIORITY_CATEGORIES: Record<RegimeCode, ScreeningCategory[]> = {
  LATE_CYCLE_AI:    ['AI / Semiconductors', 'Mega-Cap Leaders', 'Large-Cap Momentum', 'Meme / Retail Momentum'],
  LIQUIDITY_STRESS: ['Macro Beneficiaries', 'Defense / Aerospace', 'Deep Value / Turnaround', 'Real Estate / Rate Sensitive'],
  CREDIT_STRESS:    ['Macro Beneficiaries', 'Defense / Aerospace', 'Real Estate / Rate Sensitive', 'Deep Value / Turnaround'],
  INFLATION:        ['Energy / Oil / Uranium', 'Macro Beneficiaries', 'Defense / Aerospace', 'Real Estate / Rate Sensitive'],
  HIGH_RISK:        ['Macro Beneficiaries', 'Defense / Aerospace', 'Oversold Reversal Candidates', 'Deep Value / Turnaround'],
  MODERATE_RISK:    ['Large-Cap Momentum', 'Mid-Cap Growth', 'AI / Semiconductors', 'Fintech / Payments'],
  LOW_RISK:         ['High-Risk Breakout Candidates', 'Small-Cap Opportunity', 'Meme / Retail Momentum', 'Crypto Infrastructure'],
};

export const REGIME_CONTEXT: Record<RegimeCode, { headline: string; description: string; bullish: string; bearish: string }> = {
  LATE_CYCLE_AI:    { headline: 'Late-Cycle AI Melt-Up', description: 'AI momentum dominates. Mega-cap concentration accelerating. Speculative growth outperforming. Watch for breadth deterioration.', bullish: 'AI leaders, momentum breakouts, mega-cap tech', bearish: 'Rate-sensitive, high-debt, small caps' },
  LIQUIDITY_STRESS: { headline: 'Liquidity Stress Rising', description: 'NFCI tightening. Small caps and high-beta names under pressure. Defensive rotation underway. Cash flow quality premium.', bullish: 'Defensives, gold, cash-rich mega-caps', bearish: 'Small caps, leveraged names, speculative growth' },
  CREDIT_STRESS:    { headline: 'Credit Deterioration', description: 'HY spreads widening. Regional banks stressed. CRE exposure flagged. Refinancing risk elevated for high-debt companies.', bullish: 'Investment-grade, defensives, gold', bearish: 'Regional banks, CRE, leveraged small caps, high-debt' },
  INFLATION:        { headline: 'Inflationary Pressure', description: 'CPI/PPI elevated. Rate-sensitive sectors repricing. Energy and commodities outperforming. Duration risk elevated.', bullish: 'Energy, commodities, pricing-power companies', bearish: 'Long-duration growth, REITs, rate-sensitive' },
  HIGH_RISK:        { headline: 'High Systemic Risk', description: 'Multiple pressure domains elevated. Defensive positioning favored. Risk-off rotation accelerating. Volatility elevated.', bullish: 'Defensives, gold, short-vol strategies', bearish: 'Speculative growth, high-beta, leveraged names' },
  MODERATE_RISK:    { headline: 'Moderate Risk Environment', description: 'Mixed signals across domains. Selective opportunities in momentum and quality. Monitor for regime shift triggers.', bullish: 'Quality momentum, AI leaders, selective value', bearish: 'High-debt, low-quality, speculative names' },
  LOW_RISK:         { headline: 'Low Risk / Risk-On', description: 'Systemic pressure subdued. Risk appetite elevated. Momentum and growth strategies outperforming. Breadth expanding.', bullish: 'Growth, momentum, AI, small caps', bearish: 'Defensive, gold, low-beta' },
};

export function scoreStockForRegime(stock: SignalStock, regime: RegimeCode): number {
  let score = 50;
  const priorityCats = REGIME_PRIORITY_CATEGORIES[regime];
  const catMatches = stock.categories.filter(c => priorityCats.includes(c)).length;
  score += catMatches * 15;

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
    if (stock.signals.includes('Debt Stress Risk')) score += 20;
    if (stock.debtToEquity && stock.debtToEquity > 3) score += 15;
    if (stock.signals.includes('Recession Defensive')) score += 15;
  }
  if (regime === 'INFLATION') {
    if (stock.sector === 'Energy' || stock.sector === 'Commodities') score += 25;
    if (stock.signals.includes('Macro Beneficiary')) score += 15;
  }

  if (regime === 'LIQUIDITY_STRESS' && stock.signals.includes('Liquidity Sensitive')) score -= 10;
  if (regime === 'CREDIT_STRESS' && stock.signals.includes('Macro Vulnerable')) score -= 5;

  return Math.max(0, Math.min(100, score));
}

export function getTodaysTopSignals(regime: RegimeCode, enrichedStocks?: SignalStock[]): {
  topBullish: SignalStock;
  topBearish: SignalStock;
  highestVolume: SignalStock;
  highestMacroRisk: SignalStock;
  strongestAI: SignalStock;
} {
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

// ── Signal Filters ────────────────────────────────────────────
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
  // New v2 filters
  riskRating: string;
  volatilityLevel: string;
  liquidityLevel: string;
  timeframe: string;
  bias: string;
  assetClass: string;
  minMomentum: number;
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
  riskRating: 'All',
  volatilityLevel: 'All',
  liquidityLevel: 'All',
  timeframe: 'All',
  bias: 'All',
  assetClass: 'All',
  minMomentum: 0,
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
    // New v2 filters
    if (filters.riskRating !== 'All' && s.riskRating !== filters.riskRating) return false;
    if (filters.volatilityLevel !== 'All' && s.volatilityLevel !== filters.volatilityLevel) return false;
    if (filters.liquidityLevel !== 'All' && s.liquidityLevel !== filters.liquidityLevel) return false;
    if (filters.timeframe !== 'All' && s.timeframe !== filters.timeframe) return false;
    if (filters.bias !== 'All' && s.bias !== filters.bias) return false;
    if (filters.assetClass !== 'All' && s.assetClass !== filters.assetClass) return false;
    if (s.momentum < filters.minMomentum) return false;
    return true;
  });
}

export const ALL_SECTORS = ['All', ...Array.from(new Set(SIGNAL_STOCKS.map(s => s.sector))).sort()];
export const ALL_MARKET_CAPS = ['All', 'Mega', 'Large', 'Mid', 'Small', 'Micro'];
export const ALL_CATEGORIES: Array<ScreeningCategory | 'All'> = ['All', ...Object.keys(CATEGORY_META) as ScreeningCategory[]];
export const ALL_RISK_RATINGS = ['All', 'Low', 'Moderate', 'High', 'Very High', 'Extreme'];
export const ALL_VOLATILITY_LEVELS = ['All', 'Low', 'Moderate', 'High', 'Extreme'];
export const ALL_LIQUIDITY_LEVELS = ['All', 'High', 'Moderate', 'Low'];
export const ALL_TIMEFRAMES = ['All', 'Day Trade', 'Swing', 'Position', 'Long-Term'];
export const ALL_BIASES = ['All', 'Bullish', 'Bearish', 'Neutral'];
export const ALL_ASSET_CLASSES = ['All', 'Stock', 'ETF', 'Crypto'];
