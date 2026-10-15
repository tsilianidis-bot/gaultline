/*
 * FAULTLINE Market Action Monitor — display and persistence contract.
 *
 * This contract is intentionally separate from the daily Pressure Index. It records
 * source-backed, time-bounded market observations and only describes a material
 * move when its detection policy and source coverage are both available.
 */

export const MARKET_ACTION_METHOD_VERSION = "market-action-v1-2026-10-15" as const;

export type MarketActionSourceStatus = "available" | "unavailable";
export type MarketActionSourceFreshness = "delayed" | "daily" | "continuous" | "stale" | "unavailable";
export type MarketActionServedFreshness = "CURRENT" | "DELAYED" | "STALE" | "UNAVAILABLE";
export type MarketActionSeverity = "low" | "moderate" | "high" | "critical";
export type MarketActionDirection = "deteriorating" | "improving" | "stable" | "neutral";
export type MarketActionKind =
  | "broad_equity_selloff"
  | "sector_specific_stress"
  | "volatility_spike"
  | "crypto_stress"
  | "cross_market_stress"
  | "accelerating_equity_loss";

export interface MarketActionSourceCoverage {
  id: "equities" | "sectors" | "volatility" | "crypto" | "treasury" | "credit";
  label: string;
  provider: "Yahoo Finance" | "CoinGecko" | "FRED";
  status: MarketActionSourceStatus;
  freshness: MarketActionSourceFreshness;
  observedAt: string | null;
  detail: string;
}

export interface MarketActionReading {
  id: string;
  label: string;
  value: number | null;
  changePercent: number | null;
  observedAt: string | null;
  provider: string;
  freshness: MarketActionSourceFreshness;
  unavailableReason: string | null;
}

export interface MarketActionEvent {
  key: string;
  kind: MarketActionKind;
  severity: MarketActionSeverity;
  direction: MarketActionDirection;
  detectedAt: string;
  headline: string;
  evidence: string[];
  /** Deterministic, policy-bound interpretation. Not a causal attribution. */
  inference: string;
  /** Only source-linked drivers may appear here. An empty list is an explicit absence. */
  sourcedDrivers: string[];
  /** AI restatement constrained to verified observations. Null when unavailable. */
  aiSummary: string | null;
  aiGeneratedAt: string | null;
  watchConditions: string[];
  decisionBoundary: string;
}

export interface MarketActionSnapshot {
  kind: "market-action-snapshot";
  methodVersion: typeof MARKET_ACTION_METHOD_VERSION;
  capturedAt: string;
  calculationAt: string;
  /** Latest provider observation included in the snapshot, not the fetch time. */
  latestObservedAt: string | null;
  coverage: MarketActionSourceCoverage[];
  readings: MarketActionReading[];
  events: MarketActionEvent[];
  sourceNote: string;
}

export interface MarketActionServed {
  snapshot: MarketActionSnapshot | null;
  latestEvent: MarketActionEvent | null;
  freshness: MarketActionServedFreshness;
  freshnessReason: string;
  /** The last successful collector run, not a claim that every source is live. */
  lastSuccessfulCollectionAt: string | null;
}
