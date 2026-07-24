export type CryptoSignal = "Bullish" | "Neutral" | "Bearish";
export type CryptoRisk = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type MomentumDir = "Accelerating" | "Stable" | "Decelerating" | "Reversing";
export type CyclePhase =
  | "Early Bull"
  | "Mid Bull"
  | "Late Bull / Euphoria"
  | "Distribution"
  | "Early Bear"
  | "Mid Bear"
  | "Capitulation"
  | "Bear Market → Accumulation Phase"
  | "Accumulation";

export interface AccumulationPhaseAnalysis {
  directAnswer: string;
  confidenceLevel: number;
  confidenceLabel: string;
  keyEvidence: string[];
  bullCycleConfirmation: string[];
  invalidationSignals: string[];
  tradingBias: string;
  disclaimer: string;
}

export interface CryptoAssetSignal {
  id: string;
  name: string;
  ticker: string;
  signal: CryptoSignal;
  momentum: MomentumDir;
  risk: CryptoRisk;
  riskScore: number;
  signalScore: number;
  explanation: string;
  keyDrivers: string[];
  macroAlignment: "Aligned" | "Diverging" | "Neutral";
}

export interface BitcoinMacroDashboard {
  trendStrength: { score: number; label: string; direction: "up" | "down" | "sideways"; note: string };
  liquidityConditions: { score: number; label: string; direction: "expanding" | "contracting" | "neutral"; note: string };
  dollarPressure: { score: number; label: string; direction: "strengthening" | "weakening" | "neutral"; note: string };
  yieldPressure: { score: number; label: string; direction: "rising" | "falling" | "neutral"; note: string };
  etfInstitutionalFlow: { score: number; label: string; direction: "inflow" | "outflow" | "neutral"; note: string };
  marketCyclePhase: { phase: CyclePhase; confidence: number; note: string };
  overallBtcBias: CryptoSignal;
  aiNarrative: string;
  accumulationAnalysis?: AccumulationPhaseAnalysis;
}

export interface AltcoinRiskAssessment {
  overallRisk: CryptoRisk;
  riskScore: number;
  btcDominanceSignal: string;
  liquiditySignal: string;
  stablecoinSignal: string;
  riskOnOffSignal: string;
  macroPressureSignal: string;
  volatilitySignal: string;
  altcoinSeasonProbability: number;
  recommendation: string;
}

export interface CryptoMacroCorrelation {
  fedPolicyImpact: { signal: CryptoSignal; note: string };
  interestRateImpact: { signal: CryptoSignal; note: string };
  dollarStrength: { signal: CryptoSignal; note: string };
  liquidityCycle: { signal: CryptoSignal; note: string };
  equityRiskAppetite: { signal: CryptoSignal; note: string };
  bondMarketStress: { signal: CryptoSignal; note: string };
  overallMacroSignal: CryptoSignal;
  correlationSummary: string;
}

export interface CryptoPortfolioGuidance {
  btcGuidance: { action: string; condition: string; note: string };
  ethGuidance: { action: string; condition: string; note: string };
  altGuidance: { action: string; condition: string; note: string };
  stableGuidance: { action: string; condition: string; note: string };
  overallBias: string;
  disclaimer: string;
}

export interface CryptoIntelligenceReport {
  generatedAt: number;
  pressureIndex: number;
  regime: string;
  signals: CryptoAssetSignal[];
  btcDashboard: BitcoinMacroDashboard;
  altcoinRisk: AltcoinRiskAssessment;
  macroCorrelation: CryptoMacroCorrelation;
  portfolioGuidance: CryptoPortfolioGuidance;
  cached?: boolean;
}
