// ============================================================
// FAULTLINE — Simulated Macro Intelligence Data
// All data is simulated for demonstration purposes
// ============================================================

export type RiskLevel = 'critical' | 'high' | 'elevated' | 'moderate' | 'low';

export interface MetricCard {
  id: string;
  label: string;
  value: string;
  unit?: string;
  change: number;
  changeLabel: string;
  direction: 'up' | 'down' | 'flat';
  riskLevel: RiskLevel;
  interpretation: string;
  historicalComparison: string;
  category: string;
  chartData: { date: string; value: number }[];
}

export interface RiskScore {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  delta: number;
  riskLevel: RiskLevel;
  description: string;
}

export interface ScenarioProbability {
  id: string;
  label: string;
  probability: number;
  trend: 'rising' | 'falling' | 'stable';
  description: string;
  color: string;
}

export interface HistoricalAnalog {
  id: string;
  era: string;
  year: string;
  similarity: number;
  description: string;
  debtLevel: number;
  speculationIndex: number;
  liquidityStress: number;
  yieldBehavior: string;
  outcome: string;
  chartData: { date: string; value: number }[];
}

export interface AIWatchItem {
  id: string;
  company: string;
  headline: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'warning';
  marketImpact: 'high' | 'medium' | 'low';
  riskInterpretation: string;
  timestamp: string;
  category: string;
}

export interface AlertItem {
  id: string;
  trigger: string;
  severity: RiskLevel;
  description: string;
  timestamp: string;
  status: 'active' | 'monitoring' | 'resolved';
}

// ---- Utility ----
function generateChartData(baseValue: number, points = 30, volatility = 0.03): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  let val = baseValue;
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    val = val * (1 + (Math.random() - 0.48) * volatility);
    data.push({ date: d.toISOString().slice(0, 10), value: parseFloat(val.toFixed(3)) });
  }
  return data;
}

// ---- Core Metrics ----
export const metrics: MetricCard[] = [
  {
    id: 'treasury-10y',
    label: '10Y Treasury Yield',
    value: '4.68',
    unit: '%',
    change: 0.12,
    changeLabel: '+12bps',
    direction: 'up',
    riskLevel: 'elevated',
    interpretation: 'Yields pushing toward cycle highs. Refinancing pressure building across leveraged balance sheets.',
    historicalComparison: 'Highest since Oct 2023. Pre-GFC levels approached.',
    category: 'Rates',
    chartData: generateChartData(4.2, 30, 0.015),
  },
  {
    id: 'treasury-30y',
    label: '30Y Treasury Yield',
    value: '4.91',
    unit: '%',
    change: 0.09,
    changeLabel: '+9bps',
    direction: 'up',
    riskLevel: 'elevated',
    interpretation: 'Long-end steepening signals fiscal concern. Term premium re-emerging after decade of suppression.',
    historicalComparison: 'Approaching 2007 pre-crisis levels.',
    category: 'Rates',
    chartData: generateChartData(4.5, 30, 0.012),
  },
  {
    id: 'credit-spreads',
    label: 'HY Credit Spreads',
    value: '342',
    unit: 'bps',
    change: 18,
    changeLabel: '+18bps',
    direction: 'up',
    riskLevel: 'high',
    interpretation: 'High-yield spreads widening sharply. Credit stress migrating from CRE into broader corporate sector.',
    historicalComparison: 'Widest since Q4 2022. Approaching 2016 energy crisis levels.',
    category: 'Credit',
    chartData: generateChartData(310, 30, 0.025),
  },
  {
    id: 'cpi',
    label: 'CPI Inflation',
    value: '3.4',
    unit: '%',
    change: 0.2,
    changeLabel: '+0.2%',
    direction: 'up',
    riskLevel: 'elevated',
    interpretation: 'Re-acceleration risk elevated. Services inflation sticky. Fed pivot timeline pushed further out.',
    historicalComparison: 'Remains well above 2% target. Echoes 1970s secondary inflation wave.',
    category: 'Inflation',
    chartData: generateChartData(3.1, 30, 0.02),
  },
  {
    id: 'ppi',
    label: 'PPI Inflation',
    value: '2.8',
    unit: '%',
    change: 0.3,
    changeLabel: '+0.3%',
    direction: 'up',
    riskLevel: 'elevated',
    interpretation: 'Producer prices re-accelerating. Pipeline inflation pressure building. Margin compression risk for corporates.',
    historicalComparison: 'Trending back toward 2022 highs after brief deflation.',
    category: 'Inflation',
    chartData: generateChartData(2.4, 30, 0.03),
  },
  {
    id: 'fed-policy',
    label: 'Fed Policy Expectations',
    value: '5.25',
    unit: '%',
    change: -0.25,
    changeLabel: 'No cut priced',
    direction: 'flat',
    riskLevel: 'high',
    interpretation: 'Market has repriced from 6 cuts to 0-1 cuts in 2024. Policy error risk elevated in both directions.',
    historicalComparison: 'Longest hold at restrictive levels since Volcker era.',
    category: 'Monetary Policy',
    chartData: generateChartData(5.25, 30, 0.005),
  },
  {
    id: 'ai-concentration',
    label: 'AI/Mega-Cap Concentration',
    value: '32.4',
    unit: '%',
    change: 1.8,
    changeLabel: '+1.8%',
    direction: 'up',
    riskLevel: 'critical',
    interpretation: 'Top-7 AI/tech names represent 32% of S&P 500. Concentration exceeds Nifty Fifty and Dot-com peak.',
    historicalComparison: 'Highest single-sector concentration in US market history.',
    category: 'AI Bubble',
    chartData: generateChartData(28, 30, 0.02),
  },
  {
    id: 'treasury-auction',
    label: 'Treasury Auction Demand',
    value: '2.31',
    unit: 'x',
    change: -0.18,
    changeLabel: '-0.18x',
    direction: 'down',
    riskLevel: 'high',
    interpretation: 'Bid-to-cover ratios declining. Foreign demand softening. Primary dealers absorbing increasing share.',
    historicalComparison: 'Weakest demand since 2019. Tail risk of failed auction rising.',
    category: 'Sovereign Debt',
    chartData: generateChartData(2.6, 30, 0.02),
  },
  {
    id: 'cre-stress',
    label: 'Commercial Real Estate Stress',
    value: '7.2',
    unit: '/10',
    change: 0.4,
    changeLabel: '+0.4',
    direction: 'up',
    riskLevel: 'critical',
    interpretation: 'Office vacancy at record highs. Regional bank CRE exposure creating systemic contagion risk.',
    historicalComparison: 'Stress levels approaching 2010 post-GFC lows in CRE valuations.',
    category: 'Real Estate',
    chartData: generateChartData(6.2, 30, 0.03),
  },
  {
    id: 'unemployment',
    label: 'Unemployment Trend',
    value: '4.1',
    unit: '%',
    change: 0.3,
    changeLabel: '+0.3%',
    direction: 'up',
    riskLevel: 'elevated',
    interpretation: 'Sahm Rule approaching trigger threshold. Labor market softening faster than Fed models suggest.',
    historicalComparison: 'Rate of change resembles early 2001 and 2008 inflection points.',
    category: 'Labor',
    chartData: generateChartData(3.7, 30, 0.015),
  },
  {
    id: 'consumer-delinquencies',
    label: 'Consumer Delinquencies',
    value: '3.1',
    unit: '%',
    change: 0.5,
    changeLabel: '+0.5%',
    direction: 'up',
    riskLevel: 'high',
    interpretation: 'Credit card and auto delinquencies at 12-year highs. Lower-income cohort under severe stress.',
    historicalComparison: 'Approaching 2010 peak delinquency levels for subprime auto.',
    category: 'Consumer',
    chartData: generateChartData(2.4, 30, 0.025),
  },
  {
    id: 'bank-liquidity',
    label: 'Bank Liquidity Stress',
    value: '6.8',
    unit: '/10',
    change: 0.6,
    changeLabel: '+0.6',
    direction: 'up',
    riskLevel: 'high',
    interpretation: 'Regional bank unrealized losses elevated. BTFP expiration creating funding gaps. Deposit flight risk.',
    historicalComparison: 'Stress index highest since SVB collapse in March 2023.',
    category: 'Banking',
    chartData: generateChartData(5.8, 30, 0.03),
  },
  {
    id: 'corp-refinancing',
    label: 'Corporate Refinancing Conditions',
    value: '8.4',
    unit: '%',
    change: 0.8,
    changeLabel: '+80bps',
    direction: 'up',
    riskLevel: 'high',
    interpretation: '$1.2T in corporate debt maturing in 2024-2025. Refinancing at 2-3x higher rates. Earnings pressure building.',
    historicalComparison: 'Maturity wall comparable to 2007-2008 LBO refinancing crisis.',
    category: 'Credit',
    chartData: generateChartData(7.2, 30, 0.02),
  },
  {
    id: 'ai-capex',
    label: 'AI Infrastructure Capex Race',
    value: '$214B',
    unit: '',
    change: 42,
    changeLabel: '+42% YoY',
    direction: 'up',
    riskLevel: 'elevated',
    interpretation: 'Hyperscaler AI capex at $214B annualized. ROI unproven at scale. Bubble dynamics intensifying.',
    historicalComparison: 'Capex growth rate exceeds 1999 fiber optic buildout at peak.',
    category: 'AI Bubble',
    chartData: generateChartData(150, 30, 0.04),
  },
];

// ---- Risk Scores ----
export const riskScores: RiskScore[] = [
  {
    id: 'overall',
    label: 'Overall Systemic Risk',
    score: 7.4,
    maxScore: 10,
    delta: 0.3,
    riskLevel: 'high',
    description: 'Composite of all systemic stress indicators. Elevated and rising.',
  },
  {
    id: 'treasury-debt',
    label: 'Treasury/Debt Stress',
    score: 7.8,
    maxScore: 10,
    delta: 0.4,
    riskLevel: 'high',
    description: 'Auction demand deteriorating. Fiscal deficit unsustainable at current rates.',
  },
  {
    id: 'inflation-fed',
    label: 'Inflation/Fed Pressure',
    score: 6.9,
    maxScore: 10,
    delta: 0.2,
    riskLevel: 'elevated',
    description: 'Re-acceleration risk. Policy error probability elevated.',
  },
  {
    id: 'credit-stress',
    label: 'Credit Market Stress',
    score: 7.1,
    maxScore: 10,
    delta: 0.5,
    riskLevel: 'high',
    description: 'HY spreads widening. Corporate refinancing wall approaching.',
  },
  {
    id: 'ai-bubble',
    label: 'AI Bubble/Speculation',
    score: 8.6,
    maxScore: 10,
    delta: 0.7,
    riskLevel: 'critical',
    description: 'Concentration at historic extremes. Capex ROI unproven.',
  },
  {
    id: 'liquidity',
    label: 'Liquidity Conditions',
    score: 6.4,
    maxScore: 10,
    delta: 0.3,
    riskLevel: 'elevated',
    description: 'QT continuing. Reserve drain accelerating. Repo stress emerging.',
  },
  {
    id: 'recession',
    label: 'Recession Risk',
    score: 6.2,
    maxScore: 10,
    delta: 0.4,
    riskLevel: 'elevated',
    description: 'Leading indicators deteriorating. Yield curve inversion persistent.',
  },
  {
    id: 'banking-cre',
    label: 'Banking/CRE Stress',
    score: 7.9,
    maxScore: 10,
    delta: 0.6,
    riskLevel: 'high',
    description: 'Regional bank exposure to CRE at systemic risk levels.',
  },
];

// ---- Scenario Probabilities ----
export const scenarios: ScenarioProbability[] = [
  {
    id: 'melt-up',
    label: 'Bullish Melt-Up',
    probability: 22,
    trend: 'falling',
    description: 'AI productivity boom materializes, soft landing achieved, Fed pivots successfully. Speculative excess continues.',
    color: '#00FF88',
  },
  {
    id: 'bear',
    label: 'Recessionary Bear Market',
    probability: 48,
    trend: 'rising',
    description: 'Credit stress triggers corporate defaults, unemployment rises above 5%, earnings collapse 20-30%. Orderly decline.',
    color: '#FF9500',
  },
  {
    id: 'crisis',
    label: 'Severe Systemic Crisis',
    probability: 30,
    trend: 'rising',
    description: 'Treasury auction failure, regional bank cascade, AI bubble implosion, and sovereign debt crisis converge simultaneously.',
    color: '#FF2D55',
  },
];

// ---- Historical Analogs ----
export const historicalAnalogs: HistoricalAnalog[] = [
  {
    id: '1929',
    era: 'Great Depression',
    year: '1929',
    similarity: 62,
    description: 'Speculative excess in equities, concentrated in new technology (radio, autos). Credit expansion, wealth inequality peak.',
    debtLevel: 45,
    speculationIndex: 88,
    liquidityStress: 72,
    yieldBehavior: 'Inverted before crash, then collapsed',
    outcome: 'S&P -89% over 3 years',
    chartData: generateChartData(100, 30, 0.06),
  },
  {
    id: '1973',
    era: 'Oil Shock Stagflation',
    year: '1973',
    similarity: 55,
    description: 'Supply shock inflation, Fed policy error, geopolitical disruption. Stagflation trap with no clean exit.',
    debtLevel: 38,
    speculationIndex: 52,
    liquidityStress: 68,
    yieldBehavior: 'Yields surged with inflation',
    outcome: 'S&P -48%, decade of stagflation',
    chartData: generateChartData(100, 30, 0.04),
  },
  {
    id: '2000',
    era: 'Dot-Com Bubble',
    year: '2000',
    similarity: 78,
    description: 'Technology concentration, unproven business models, capex boom with negative ROI. Nasdaq at 100x earnings.',
    debtLevel: 52,
    speculationIndex: 91,
    liquidityStress: 58,
    yieldBehavior: 'Inverted yield curve preceded bust',
    outcome: 'Nasdaq -78%, S&P -49%',
    chartData: generateChartData(100, 30, 0.05),
  },
  {
    id: '2008',
    era: 'Global Financial Crisis',
    year: '2008',
    similarity: 71,
    description: 'Credit bubble, bank leverage, real estate concentration, opaque derivatives. Systemic interconnection at maximum.',
    debtLevel: 78,
    speculationIndex: 74,
    liquidityStress: 95,
    yieldBehavior: 'Collapsed to zero post-Lehman',
    outcome: 'S&P -57%, global recession',
    chartData: generateChartData(100, 30, 0.07),
  },
  {
    id: '2020',
    era: 'COVID Liquidity Shock',
    year: '2020',
    similarity: 44,
    description: 'Exogenous shock, Fed balance sheet explosion, fiscal stimulus excess. Laid groundwork for current inflation.',
    debtLevel: 92,
    speculationIndex: 65,
    liquidityStress: 88,
    yieldBehavior: 'Collapsed then surged',
    outcome: 'S&P -34% then +100% recovery',
    chartData: generateChartData(100, 30, 0.08),
  },
  {
    id: 'ai-bubble',
    era: 'AI Bubble Era',
    year: '2024',
    similarity: 85,
    description: 'Current conditions. AI concentration, unproven ROI, hyperscaler capex race, sovereign debt at historic highs.',
    debtLevel: 98,
    speculationIndex: 86,
    liquidityStress: 64,
    yieldBehavior: 'Elevated and rising',
    outcome: 'TBD — Pressure building',
    chartData: generateChartData(100, 30, 0.03),
  },
];

// ---- AI Watch Feed ----
export const aiWatchItems: AIWatchItem[] = [
  {
    id: 'ai-1',
    company: 'NVIDIA',
    headline: 'Nvidia H200 backlog extends to 18 months as hyperscalers accelerate orders',
    sentiment: 'warning',
    marketImpact: 'high',
    riskInterpretation: 'Supply constraint masking demand destruction risk. Single-point-of-failure in global AI infrastructure.',
    timestamp: '2h ago',
    category: 'Chip Wars',
  },
  {
    id: 'ai-2',
    company: 'OpenAI',
    headline: 'OpenAI raises $6.6B at $157B valuation — largest private funding round in history',
    sentiment: 'warning',
    marketImpact: 'high',
    riskInterpretation: 'Valuation multiples disconnected from revenue. Bubble dynamics intensifying in private AI markets.',
    timestamp: '4h ago',
    category: 'Speculation',
  },
  {
    id: 'ai-3',
    company: 'Microsoft',
    headline: 'Microsoft Azure AI revenue growth decelerates to 29% — below 35% consensus',
    sentiment: 'bearish',
    marketImpact: 'high',
    riskInterpretation: 'First signs of AI monetization gap. $80B capex commitment with slowing revenue growth is unsustainable.',
    timestamp: '6h ago',
    category: 'Earnings',
  },
  {
    id: 'ai-4',
    company: 'Anthropic',
    headline: 'Anthropic Claude 4 achieves AGI-adjacent benchmarks — regulatory scrutiny intensifies',
    sentiment: 'neutral',
    marketImpact: 'medium',
    riskInterpretation: 'Regulatory risk rising. EU AI Act enforcement could constrain US AI companies in key markets.',
    timestamp: '8h ago',
    category: 'Regulation',
  },
  {
    id: 'ai-5',
    company: 'Meta',
    headline: 'Meta Llama 4 open-source release disrupts enterprise AI pricing models',
    sentiment: 'bearish',
    marketImpact: 'medium',
    riskInterpretation: 'Commoditization risk for closed-model AI companies. OpenAI and Anthropic revenue models under pressure.',
    timestamp: '10h ago',
    category: 'Competition',
  },
  {
    id: 'ai-6',
    company: 'Google DeepMind',
    headline: 'Google Gemini Ultra achieves state-of-art across all major benchmarks',
    sentiment: 'bullish',
    marketImpact: 'medium',
    riskInterpretation: 'Competitive dynamics intensifying. Winner-take-all dynamics may concentrate risk in fewer names.',
    timestamp: '12h ago',
    category: 'Competition',
  },
  {
    id: 'ai-7',
    company: 'xAI',
    headline: 'Elon Musk\'s xAI raises $6B, announces 100,000 GPU Memphis supercluster',
    sentiment: 'warning',
    marketImpact: 'medium',
    riskInterpretation: 'Capex arms race accelerating. Power grid strain and resource competition creating systemic bottlenecks.',
    timestamp: '1d ago',
    category: 'Infrastructure',
  },
  {
    id: 'ai-8',
    company: 'Sovereign AI',
    headline: 'UAE, Saudi Arabia announce $100B sovereign AI investment funds',
    sentiment: 'neutral',
    marketImpact: 'medium',
    riskInterpretation: 'Geopolitical AI race intensifying. Chip export controls creating fragmented global AI infrastructure.',
    timestamp: '1d ago',
    category: 'Geopolitics',
  },
  {
    id: 'ai-9',
    company: 'Amazon',
    headline: 'AWS Trainium3 chips challenge Nvidia dominance — $150B data center investment announced',
    sentiment: 'neutral',
    marketImpact: 'high',
    riskInterpretation: 'Nvidia moat being challenged. Transition risk if custom silicon adoption accelerates.',
    timestamp: '2d ago',
    category: 'Chip Wars',
  },
];

// ---- Alerts ----
export const alerts: AlertItem[] = [
  {
    id: 'alert-1',
    trigger: 'Treasury Auction Demand Deterioration',
    severity: 'critical',
    description: '30Y auction bid-to-cover fell to 2.24x — lowest since 2019. Primary dealer absorption at 42%. Foreign demand declining.',
    timestamp: '1h ago',
    status: 'active',
  },
  {
    id: 'alert-2',
    trigger: 'CRE Default Cascade — Regional Banks',
    severity: 'critical',
    description: 'New York Community Bancorp CRE loss provisions surge 400%. 5 regional banks flagged for elevated CRE concentration.',
    timestamp: '3h ago',
    status: 'active',
  },
  {
    id: 'alert-3',
    trigger: 'HY Credit Spread Widening',
    severity: 'high',
    description: 'High-yield spreads +18bps in 48 hours. Energy and real estate sectors leading widening. Contagion risk to IG.',
    timestamp: '5h ago',
    status: 'active',
  },
  {
    id: 'alert-4',
    trigger: 'AI Earnings Disappointment Signal',
    severity: 'high',
    description: 'Microsoft Azure AI growth deceleration. Alphabet AI revenue miss. Pattern suggests monetization gap widening.',
    timestamp: '6h ago',
    status: 'monitoring',
  },
  {
    id: 'alert-5',
    trigger: 'Liquidity Freeze Signal — Repo Market',
    severity: 'elevated',
    description: 'Overnight repo rates spiking above Fed Funds. Reserve scarcity signal. SOFR-OIS spread widening.',
    timestamp: '8h ago',
    status: 'monitoring',
  },
  {
    id: 'alert-6',
    trigger: 'Fed Policy Error Risk Elevated',
    severity: 'elevated',
    description: 'CPI re-acceleration forces Fed to hold longer. Unemployment rising simultaneously. Stagflation probability increasing.',
    timestamp: '12h ago',
    status: 'monitoring',
  },
  {
    id: 'alert-7',
    trigger: 'Sovereign Debt Instability — Japan',
    severity: 'elevated',
    description: 'JGB yields at 15-year highs. BoJ yield curve control abandonment creating global bond market volatility.',
    timestamp: '1d ago',
    status: 'monitoring',
  },
  {
    id: 'alert-8',
    trigger: 'Oil Shock Risk — Middle East Escalation',
    severity: 'moderate',
    description: 'Strait of Hormuz shipping disruption probability rising. 20% of global oil supply at risk. Stagflation amplifier.',
    timestamp: '2d ago',
    status: 'monitoring',
  },
];

// ---- Market Regime ----
export const marketRegime = {
  label: 'LATE-CYCLE FRAGILITY',
  sublabel: 'Elevated Systemic Stress',
  color: '#FF9500',
  description: 'Multiple fault lines converging. Credit stress, AI speculation, sovereign debt pressure, and liquidity deterioration creating compound risk.',
  bullProbability: 22,
  crashProbability: 78,
};

// ---- Daily Report ----
export const dailyReport = {
  date: 'May 13, 2026',
  regimeAssessment: 'LATE-CYCLE FRAGILITY — ELEVATED SYSTEMIC STRESS',
  summary: `Multiple systemic fault lines are converging simultaneously. The AI concentration bubble has reached historic extremes with the top-7 technology names comprising 32.4% of the S&P 500 — a level that exceeds both the Nifty Fifty era and the 2000 Dot-com peak. Treasury auction demand is deteriorating as foreign buyers reduce exposure, while the $1.2T corporate refinancing wall approaches at rates 2-3x higher than original issuance. Commercial real estate stress is cascading through regional bank balance sheets, and consumer delinquencies are at 12-year highs. The Fed remains trapped between persistent inflation and a softening labor market. The probability of a severe systemic event has risen to 30% — the highest reading since the 2020 COVID shock.`,
  keyRisks: [
    'Treasury auction failure risk rising — foreign demand softening',
    'AI bubble concentration at historic extremes — monetization gap widening',
    'Regional bank CRE cascade — systemic contagion pathway open',
    'Corporate refinancing wall — $1.2T maturing at 2-3x higher rates',
    'Consumer delinquency surge — lower-income cohort under severe stress',
  ],
};
