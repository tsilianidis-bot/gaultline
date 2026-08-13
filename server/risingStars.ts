/**
 * FAULTLINE Rising Stars™ scoring contract.
 *
 * This module is intentionally provider-agnostic and only accepts measurements
 * that have already passed a source/reliability check. It never invents an
 * insider or options signal, and missing components are removed from the
 * weighted average rather than scored as zero.
 */

export type RisingStarDataStatus = "live" | "unavailable";
export type ConfidenceBand = "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";
export type InformationLead = "LOW" | "MODERATE" | "HIGH" | "UNAVAILABLE";
export type CrowdingRisk = "LOW" | "ELEVATED" | "HIGH" | "UNAVAILABLE";
export type DiscoveryStage = "EARLY" | "BUILDING" | "CROWDED" | "UNAVAILABLE";

export interface RisingStarEvidence {
  key: string;
  label: string;
  score: number;
  weight: number;
  available: boolean;
  note: string;
}

export interface SocialDiscoveryInput {
  available: boolean;
  sourceCount: number;
  socialVolume: number;
  sentimentScore: number; // -1 to +1, computed from source data
  positiveNews: number;
  negativeNews: number;
  memeHypeDetected: boolean;
  note?: string;
}

export interface OptionalConvictionInput {
  /** Set only for a lawful, public, source-backed observation. */
  available: boolean;
  score?: number;
  note: string;
}

export interface RisingStarInput {
  ticker: string;
  name: string;
  technical: {
    relativeStrength: number;
    volumeAccumulation: number;
    momentumInflection: number;
    technicalStructure: number;
    /** Higher is better: a high value means price is not materially extended. */
    asymmetry: number;
    note?: string;
  };
  catalyst?: OptionalConvictionInput;
  macroAlignment: { score: number; note: string };
  sectorTailwind?: OptionalConvictionInput;
  social: SocialDiscoveryInput;
  insider?: OptionalConvictionInput;
  options?: OptionalConvictionInput;
}

export interface RisingStarResult {
  ticker: string;
  name: string;
  risingStarScore: number;
  baseScore: number;
  crowdingPenalty: number;
  socialDiscovery: {
    status: RisingStarDataStatus;
    score: number | null;
    stage: DiscoveryStage;
    note: string;
  };
  insiderConviction: { status: RisingStarDataStatus; score: number | null; note: string };
  optionsConviction: { status: RisingStarDataStatus; score: number | null; note: string };
  crossSignalConfidence: ConfidenceBand;
  informationLead: InformationLead;
  crowdingRisk: CrowdingRisk;
  whySeeingItEarly: string[];
  dataNotes: string[];
  evidence: RisingStarEvidence[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function socialDiscoveryScore(input: SocialDiscoveryInput): {
  score: number | null;
  stage: DiscoveryStage;
  crowdingRisk: CrowdingRisk;
  note: string;
} {
  if (!input.available || input.sourceCount < 2) {
    return {
      score: null,
      stage: "UNAVAILABLE",
      crowdingRisk: "UNAVAILABLE",
      note: input.note ?? "Insufficient multi-source social coverage; excluded from score.",
    };
  }

  const sentiment = clamp(50 + input.sentimentScore * 50);
  const sourceBreadth = clamp(Math.min(100, input.sourceCount * 40));
  const coverage = clamp(Math.min(100, input.socialVolume * 4));
  const balancedAttention = input.socialVolume >= 5 && input.socialVolume <= 75 ? 85 : input.socialVolume < 5 ? 45 : 35;
  const score = clamp(sentiment * 0.45 + sourceBreadth * 0.25 + coverage * 0.1 + balancedAttention * 0.2);

  if (input.memeHypeDetected && input.socialVolume >= 20) {
    return {
      score,
      stage: "CROWDED",
      crowdingRisk: "HIGH",
      note: "Multi-source attention is present, but the current social analysis flags meme/hype risk.",
    };
  }
  if (score >= 62 && input.socialVolume <= 75) {
    return {
      score,
      stage: "EARLY",
      crowdingRisk: "LOW",
      note: "Constructive multi-source attention without a current hype flag; historical baseline coverage is still developing.",
    };
  }
  return {
    score,
    stage: "BUILDING",
    crowdingRisk: "UNAVAILABLE",
    note: "Multi-source attention is observable, but no sufficiently long baseline is available to label crowding.",
  };
}

function confidenceBand(positiveSignals: number): ConfidenceBand {
  if (positiveSignals >= 5) return "VERY HIGH";
  if (positiveSignals >= 4) return "HIGH";
  if (positiveSignals >= 2) return "MODERATE";
  return "LOW";
}

/**
 * Computes a Rising Star score from source-verified component measurements.
 * Weights are intentionally unequal: technical structure and relative strength
 * carry more weight than social attention, while insider/options can contribute
 * only when an actual public-data provider has supplied them.
 */
export function scoreRisingStar(input: RisingStarInput): RisingStarResult {
  const social = socialDiscoveryScore(input.social);
  const insiderAvailable = Boolean(input.insider?.available && input.insider.score != null);
  const optionsAvailable = Boolean(input.options?.available && input.options.score != null);

  const evidence: RisingStarEvidence[] = [
    { key: "relative_strength", label: "Relative Strength Acceleration", score: clamp(input.technical.relativeStrength), weight: 0.14, available: true, note: "Price performance versus its recent range." },
    { key: "volume", label: "Volume / Accumulation", score: clamp(input.technical.volumeAccumulation), weight: 0.12, available: true, note: "Recent volume compared with the security's own recent average." },
    { key: "momentum", label: "Momentum Inflection", score: clamp(input.technical.momentumInflection), weight: 0.11, available: true, note: "Short-term momentum versus the preceding trading window." },
    { key: "structure", label: "Technical Structure", score: clamp(input.technical.technicalStructure), weight: 0.15, available: true, note: input.technical.note ?? "Price location and moving-average structure." },
    { key: "catalyst", label: "Catalyst Strength", score: input.catalyst?.available && input.catalyst.score != null ? clamp(input.catalyst.score) : 0, weight: 0.10, available: Boolean(input.catalyst?.available && input.catalyst.score != null), note: input.catalyst?.note ?? "No source-backed public catalyst coverage is available; excluded from score." },
    { key: "macro", label: "FAULTLINE Macro Alignment", score: clamp(input.macroAlignment.score), weight: 0.10, available: true, note: input.macroAlignment.note },
    { key: "sector", label: "Sector / Theme Tailwind", score: input.sectorTailwind?.available && input.sectorTailwind.score != null ? clamp(input.sectorTailwind.score) : 0, weight: 0.07, available: Boolean(input.sectorTailwind?.available && input.sectorTailwind.score != null), note: input.sectorTailwind?.note ?? "No source-backed sector/theme feed is connected; excluded from score." },
    { key: "asymmetry", label: "Asymmetry / Extension", score: clamp(input.technical.asymmetry), weight: 0.08, available: true, note: "Rewards an improving setup that is not materially extended." },
    { key: "social", label: "Social Discovery", score: social.score ?? 0, weight: 0.07, available: social.score != null, note: social.note },
    { key: "insider", label: "Insider Conviction", score: insiderAvailable ? clamp(input.insider!.score!) : 0, weight: 0.03, available: insiderAvailable, note: input.insider?.note ?? "No source-backed public-insider feed is connected; excluded from score." },
    { key: "options", label: "Options Conviction", score: optionsAvailable ? clamp(input.options!.score!) : 0, weight: 0.03, available: optionsAvailable, note: input.options?.note ?? "No source-backed options-flow feed is connected; excluded from score." },
  ];

  const availableWeight = evidence.filter(item => item.available).reduce((sum, item) => sum + item.weight, 0);
  const baseScore = availableWeight > 0
    ? clamp(evidence.filter(item => item.available).reduce((sum, item) => sum + item.score * item.weight, 0) / availableWeight)
    : 0;

  const positiveSignals = [
    input.technical.relativeStrength >= 60,
    input.technical.volumeAccumulation >= 60,
    input.technical.momentumInflection >= 60,
    input.technical.technicalStructure >= 60,
    input.catalyst?.available && (input.catalyst.score ?? 0) >= 60,
    input.macroAlignment.score >= 60,
    input.sectorTailwind?.available && (input.sectorTailwind.score ?? 0) >= 60,
    social.stage === "EARLY",
    insiderAvailable && (input.insider?.score ?? 0) >= 60,
    optionsAvailable && (input.options?.score ?? 0) >= 60,
  ].filter(Boolean).length;

  const crossSignalConfidence = confidenceBand(positiveSignals);
  const leadEvidence = [
    input.technical.volumeAccumulation >= 60,
    input.technical.technicalStructure >= 60,
    input.technical.asymmetry >= 60,
    social.stage === "EARLY",
    insiderAvailable && (input.insider?.score ?? 0) >= 60,
    optionsAvailable && (input.options?.score ?? 0) >= 60,
  ].filter(Boolean).length;
  const informationLead: InformationLead = leadEvidence >= 4 ? "HIGH" : leadEvidence >= 3 ? "MODERATE" : "LOW";
  // Attention alone is not a penalty. It becomes late-hype risk only when
  // verified extreme attention coincides with a materially extended price.
  const crowdingRisk: CrowdingRisk = social.crowdingRisk === "HIGH"
    ? (input.technical.asymmetry <= 45 ? "HIGH" : "ELEVATED")
    : social.crowdingRisk;
  const crowdingPenalty = crowdingRisk === "HIGH" ? 7 : 0;
  const confirmationBonus = crossSignalConfidence === "VERY HIGH" ? 4 : crossSignalConfidence === "HIGH" ? 2 : 0;
  const informationLeadBonus = informationLead === "HIGH" ? 3 : informationLead === "MODERATE" ? 1 : 0;
  const risingStarScore = clamp(baseScore + confirmationBonus + informationLeadBonus - crowdingPenalty);

  const whySeeingItEarly: string[] = [];
  if (input.technical.volumeAccumulation >= 60) whySeeingItEarly.push("Relative volume is above its recent baseline.");
  if (input.technical.relativeStrength >= 60) whySeeingItEarly.push("Price strength is improving within its recent trading range.");
  if (input.technical.technicalStructure >= 60) whySeeingItEarly.push("Technical structure is constructive without relying on a forecast.");
  if (social.stage === "EARLY") whySeeingItEarly.push("Multi-source social attention is constructive without a current hype flag.");
  if (insiderAvailable && (input.insider?.score ?? 0) >= 60) whySeeingItEarly.push("Source-backed public insider activity is supportive.");
  if (optionsAvailable && (input.options?.score ?? 0) >= 60) whySeeingItEarly.push("Source-backed options positioning is supportive.");
  if (input.catalyst?.available && (input.catalyst.score ?? 0) >= 60) whySeeingItEarly.push("Source-backed public catalyst coverage is constructive.");
  if (input.macroAlignment.score >= 60) whySeeingItEarly.push("Current FAULTLINE macro conditions are supportive of the setup.");

  const dataNotes = evidence.filter(item => !item.available).map(item => `${item.label}: ${item.note}`);
  if (social.stage === "BUILDING") dataNotes.push("Crowding is not labeled low or high without a sufficient historical attention baseline.");

  return {
    ticker: input.ticker,
    name: input.name,
    risingStarScore,
    baseScore,
    crowdingPenalty,
    socialDiscovery: { status: social.score == null ? "unavailable" : "live", score: social.score, stage: social.stage, note: social.note },
    insiderConviction: { status: insiderAvailable ? "live" : "unavailable", score: insiderAvailable ? clamp(input.insider!.score!) : null, note: input.insider?.note ?? "No source-backed public-insider feed is connected; excluded from score." },
    optionsConviction: { status: optionsAvailable ? "live" : "unavailable", score: optionsAvailable ? clamp(input.options!.score!) : null, note: input.options?.note ?? "No source-backed options-flow feed is connected; excluded from score." },
    crossSignalConfidence,
    informationLead,
    crowdingRisk,
    whySeeingItEarly,
    dataNotes,
    evidence,
  };
}
