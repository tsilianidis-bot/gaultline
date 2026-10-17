import { TRPCError } from "@trpc/server";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { GlobalStats } from "./coingeckoProxy";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";

export const REQUIRED_PRESSURE_VECTOR_IDS = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"] as const;

export function toOperationalPressure(state: CanonicalIntelligenceState | null, requireAllVectors = false) {
  const pressure = projectPressureFromCanonical(state);
  if (!pressure || (requireAllVectors && REQUIRED_PRESSURE_VECTOR_IDS.some(id => !pressure.vectors.some(vector => vector.id === id && Number.isFinite(vector.score))))) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Verified canonical market context is unavailable." });
  }
  return { ...pressure, canonicalStateId: state!.stateId, canonicalAsOf: state!.effectiveAt,
    evidenceQuality: state!.confidenceOrEvidenceQuality };
}

export async function readOperationalPressure(requireAllVectors = false) {
  return toOperationalPressure(await getAuthoritativeCanonicalIntelligenceState(), requireAllVectors);
}

export function toSignalRegime(pressure: { overallPressure: number; regime: string }) {
  if (!Number.isFinite(pressure.overallPressure) || pressure.overallPressure < 0 || pressure.overallPressure > 100 || !pressure.regime?.trim()) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Invalid canonical pressure input." });
  }
  return { label: pressure.regime, score: pressure.overallPressure / 10 };
}

export function requireObservedCryptoGlobals(stats: GlobalStats | null, now = Date.now()): GlobalStats {
  if (!stats || ![stats.btcDominance, stats.totalMarketCap, stats.marketCapChangePercent24h, stats.observedAt, stats.fetchedAt].every(value => typeof value === "number" && Number.isFinite(value)) ||
      stats.totalMarketCap <= 0 || stats.btcDominance < 0 || stats.btcDominance > 100 ||
      (stats.observedAt as number) > stats.fetchedAt + 60_000 || stats.fetchedAt > now + 60_000 || now - (stats.observedAt as number) > 15 * 60_000) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Timestamped crypto global observations are unavailable or stale." });
  }
  return stats;
}

/** Never replace an invalid calculation with an observed-looking zero. */
export function requireFiniteSignalPayload(value: unknown): void {
  if (typeof value === "number" && !Number.isFinite(value)) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Signal calculation has an unavailable numeric input." });
  if (Array.isArray(value)) value.forEach(requireFiniteSignalPayload);
  else if (value && typeof value === "object") Object.values(value).forEach(requireFiniteSignalPayload);
}
