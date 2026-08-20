export type EvidenceClass = "OBSERVED" | "DERIVED" | "HISTORICAL" | "INTERPRETED" | "FORECAST";
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
}

export function insufficientHorizonMetadata(forecastType: string, generatedAt = new Date().toISOString(), reason = "Insufficient evidence for reliable estimate"): ForecastMetadata {
  return {
    forecastType,
    evidenceClass: "INTERPRETED",
    expectedHorizonStatus: "INSUFFICIENT_EVIDENCE",
    horizonBucket: "NOT_ESTABLISHED",
    forecastGeneratedAt: generatedAt,
    horizonDisclosure: reason,
  };
}

export function supportedHorizonMetadata(metadata: Omit<ForecastMetadata, "expectedHorizonStatus" | "horizonDisclosure"> & { expectedHorizon: string; horizonMinDays: number; horizonMaxDays: number; horizonBucket: Exclude<HorizonBucket, "NOT_ESTABLISHED">; horizonMethodology: string }): ForecastMetadata {
  return { ...metadata, expectedHorizonStatus: "SUPPORTED", horizonDisclosure: `Evidence-supported horizon: ${metadata.expectedHorizon}.` };
}

export function forecastHorizonPromptContract(metadata?: ForecastMetadata): string {
  if (!metadata || metadata.expectedHorizonStatus !== "SUPPORTED") {
    return "FORECAST HORIZON RULE: No validated timeframe is available. Do not invent timing, duration, target date, or confidence. If asked when or by when, state: ‘Time horizon: insufficient evidence for reliable estimate.’";
  }
  return `FORECAST HORIZON RULE: Use only the structured horizon ${metadata.expectedHorizon}; it is a FORECAST, not an observed fact. Timing confidence: ${metadata.timingConfidence ?? "not established"}. Methodology: ${metadata.horizonMethodology}.`;
}
