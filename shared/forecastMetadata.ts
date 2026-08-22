import type { EvidenceClass } from "./evidenceContract";
export type { EvidenceClass } from "./evidenceContract";
import type { ForecastAuthorization } from "./evidenceContract";
export type HorizonBucket = "IMMEDIATE" | "SHORT_TERM" | "SWING" | "INTERMEDIATE" | "LONG_TERM" | "STRUCTURAL" | "NOT_ESTABLISHED";
export type HorizonStatus = "SUPPORTED" | "NOT_ESTABLISHED" | "INSUFFICIENT_EVIDENCE";

export interface ForecastMetadata {
  forecastType: string;
  evidenceClass: EvidenceClass;
  expectedHorizonStatus: HorizonStatus;
  expectedHorizon?: string;
  horizonMinDays?: number;
  horizonMaxDays?: number;
  horizonBucket: HorizonBucket;
  targetValue?: string;
  targetPrice?: number;
  expectedMagnitude?: string;
  upsidePercent?: number;
  downsidePercent?: number;
  targetConfidence?: number;
  timingConfidence?: number;
  evidenceStrength?: string;
  targetMethodology?: string;
  horizonMethodology?: string;
  confirmationConditions?: string[];
  invalidationConditions?: string[];
  historicalAnalogCount?: number;
  historicalSuccessRate?: number;
  medianTimeToTarget?: string;
  dataConfidence?: string;
  forecastGeneratedAt: string;
  forecastExpiresAt?: string;
  horizonDisclosure: string;
  /** Phase 3: a forecast is usable only when its complete authorization is present. */
  forecastAuthorized?: boolean;
  forecastContract?: ForecastAuthorization | null;
  canonicalStateId?: string | null;
}

export function insufficientHorizonMetadata(forecastType: string, generatedAt = new Date().toISOString(), reason = "Insufficient evidence for reliable estimate"): ForecastMetadata {
  return {
    forecastType,
    evidenceClass: "INTERPRETED",
    expectedHorizonStatus: "INSUFFICIENT_EVIDENCE",
    horizonBucket: "NOT_ESTABLISHED",
    forecastGeneratedAt: generatedAt,
    horizonDisclosure: reason,
    forecastAuthorized: false,
    forecastContract: null,
  };
}

export function supportedHorizonMetadata(metadata: Omit<ForecastMetadata, "expectedHorizonStatus" | "horizonDisclosure" | "forecastAuthorized"> & { expectedHorizon: string; horizonMinDays: number; horizonMaxDays: number; horizonBucket: Exclude<HorizonBucket, "NOT_ESTABLISHED">; horizonMethodology: string; forecastContract: ForecastAuthorization; canonicalStateId: string }): ForecastMetadata {
  return { ...metadata, expectedHorizonStatus: "SUPPORTED", forecastAuthorized: true, horizonDisclosure: `Evidence-supported horizon: ${metadata.expectedHorizon}.` };
}

export function forecastHorizonPromptContract(metadata?: ForecastMetadata): string {
  if (!metadata || metadata.expectedHorizonStatus !== "SUPPORTED" || !metadata.forecastAuthorized || !metadata.forecastContract || !metadata.canonicalStateId) {
    return "FORECAST HORIZON RULE: No validated timeframe is available. Do not invent timing, duration, target date, or confidence. If asked when or by when, state: ‘Time horizon: insufficient evidence for reliable estimate.’";
  }
  return `FORECAST HORIZON RULE: Use only the authorized structured horizon ${metadata.expectedHorizon}; it is a FORECAST, not an observed fact. Forecast contract: ${metadata.forecastContract.forecastContractId}. Canonical state: ${metadata.canonicalStateId}. Timing confidence: ${metadata.timingConfidence ?? "not established"}. Methodology: ${metadata.horizonMethodology}.`;
}
