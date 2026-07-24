export type EvidenceType =
  | "macro_pressure"
  | "regime_classification"
  | "probability_distribution"
  | "historical_analog"
  | "transition_signal"
  | "liquidity_conditions"
  | "credit_stress"
  | "momentum"
  | "volatility"
  | "cross_market_alignment"
  | "crypto_cycle"
  | "breakdown_signals"
  | "recovery_confirmation"
  | "sentiment"
  | "insider_flow";

export type EvidenceSignal =
  | "bullish"
  | "bearish"
  | "neutral"
  | "stressed"
  | "recovering"
  | "transitioning";

export interface EvidencePacket {
  source: string;
  timestamp: number;
  evidenceType: EvidenceType;
  signal: EvidenceSignal;
  strength: number;
  confidence: number;
  primaryReading: string;
  humanReadable: string;
  subScores?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface SeismographProviderProvenance {
  fred: {
    status: "live" | "fallback" | "unavailable";
    detail: string;
    asOf: number;
  };
}

export interface EvidenceContributor<TInput = void> {
  readonly sourceId: string;
  readonly evidenceType: EvidenceType;
  toEvidencePacket(input: TInput): Promise<EvidencePacket>;
}
