import type { CanonicalMarketState } from "./marketState";
import type { CanonicalDestinationId } from "./routeRegistry";

export interface AshaPageContext {
  page: string;
  pressureScore?: number;
  regime?: string;
  regimeConfidence?: number;
  narrative?: string;
  trend?: string;
  keyDrivers?: string[];
  historicalAnalog?: string;
  transitionProbability?: number;
  additionalContext?: Record<string, unknown>;
}

export interface AshaGatewayContext {
  version: "1.0";
  destination: CanonicalDestinationId | null;
  page: AshaPageContext;
  marketState: CanonicalMarketState;
}

export interface AshaModelTrace {
  selectedModel: string;
  attemptedModels: string[];
  resolutionSource: "live-catalog" | "transport-fallback";
  resolvedAt: string;
}

export interface AshaContextProvenance {
  contextVersion: "1.0";
  marketStateVersion: CanonicalMarketState["version"];
  generatedAt: string;
  sourceUpdatedAt: string;
  freshness: CanonicalMarketState["freshness"];
  cacheStatus: CanonicalMarketState["cache"]["status"];
  sourceHealth: CanonicalMarketState["sourceHealth"];
  warnings: string[];
}
