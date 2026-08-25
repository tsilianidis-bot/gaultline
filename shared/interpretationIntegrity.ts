import type { EvidencePacket } from "./evidenceContract";

export const INTERPRETATION_CONTRACT_VERSION = "phase4-interpretation-integrity-v1" as const;
export const INTERPRETATION_PROMPT_VERSION = "phase4-prompt-v1" as const;

export type InterpretationChannel = "ASHA" | "ORACLE" | "DAILY_GREETING" | "OUTLOOK";
export type InterpretationValidationStatus = "PASS" | "CORRECTED" | "WITHHELD" | "FAIL";

export interface InterpretationTransaction {
  contractVersion: typeof INTERPRETATION_CONTRACT_VERSION;
  responseId: string;
  channel: InterpretationChannel;
  originatingStateId: string | null;
  originatingEffectiveAt: string | null;
  originatingGeneratedAt: string | null;
  evidenceClaimIds: string[];
  forecastClaimIds: string[];
  historicalClaimIds: string[];
  evidenceStrength: string[];
  dataQuality: string[];
  promptVersion: typeof INTERPRETATION_PROMPT_VERSION;
  modelVersion: string | null;
  createdAt: string;
}

export interface InterpretationValidationResult {
  status: InterpretationValidationStatus;
  issues: string[];
  withheldClaimReasons: string[];
  normalizedOutput: Record<string, unknown>;
}

const NO_FORECAST_FIELDS = new Set([
  "bullProbability", "bearProbability", "finalVerdictProbability", "confidence", "finalVerdictConfidence", "expectedTimeframe", "finalVerdictTimeHorizon",
  "timeHorizon", "horizon", "target", "targets", "profitTargets", "entryZone", "entryZoneIdeal",
  "entryZoneAggressive", "entryZoneConservative", "entryZoneStop", "entryZoneTarget", "entryZoneRR",
  "exitZonePrimary", "exitZoneSecondary", "exitZoneFull", "support", "resistance", "stopLevel",
  "downsideBaseZone", "downsideBearTarget", "downsideExtremeTarget", "upsideBaseTarget",
  "upsideBullTarget", "upsideExtremeTarget", "invalidationPrice", "riskRewardRatio", "maxDrawdownEstimate",
]);

const CONFIRMATION_FIELDS = new Set([
  "confirmationConditions", "invalidationConditions", "invalidation", "invalidationTriggers", "downsideInvalidation", "upsideInvalidation", "invalidationWhatHappens",
]);

const GENERIC_FILLER = /\b(critical juncture|remain vigilant|conditions remain fluid|monitor developments|multiple factors are at play)\b/i;
const UNSUPPORTED_CAUSAL = /\b(caused|causing|because of)\b/i;
const FALSE_SYSTEM_SCOPE = /\b(system[- ]wide|entire system|multiple engines?)\b.{0,40}\b(confirm|deteriorat)/i;

function cloneOutput(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeText(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(token => token.length > 2);
}

function overlap(left: string, right: string): number {
  const a = new Set(normalizeText(left));
  const b = new Set(normalizeText(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

/** Starts one immutable current-intelligence generation transaction. */
export function createInterpretationTransaction(
  channel: InterpretationChannel,
  packet: EvidencePacket | null,
  modelVersion: string | null,
  now = new Date().toISOString(),
): InterpretationTransaction {
  const claims = packet?.claims ?? [];
  const canonical = packet?.canonicalState ?? null;
  const responseId = `${channel.toLowerCase()}:${canonical?.stateId ?? "unavailable"}:${now}`;
  return {
    contractVersion: INTERPRETATION_CONTRACT_VERSION,
    responseId,
    channel,
    originatingStateId: canonical?.stateId ?? null,
    originatingEffectiveAt: canonical?.effectiveAt ?? null,
    originatingGeneratedAt: packet?.createdAt ?? null,
    evidenceClaimIds: claims.map(claim => claim.claimId),
    forecastClaimIds: claims.filter(claim => claim.evidenceClass === "FORECAST" && claim.forecastAuthorized).map(claim => claim.claimId),
    historicalClaimIds: claims.filter(claim => claim.evidenceClass === "HISTORICAL").map(claim => claim.claimId),
    evidenceStrength: Array.from(new Set(claims.map(claim => claim.evidenceStrength))),
    dataQuality: Array.from(new Set(claims.map(claim => claim.qualityStatus))),
    promptVersion: INTERPRETATION_PROMPT_VERSION,
    modelVersion,
    createdAt: now,
  };
}

/** Supplies allowed evidence and explicit claim boundaries before generation. */
export function buildInterpretationPromptContract(transaction: InterpretationTransaction, packet: EvidencePacket | null): string {
  const claims = packet?.claims ?? [];
  const claimList = claims.map(claim => ({
    claimId: claim.claimId,
    class: claim.evidenceClass,
    statement: claim.statement,
    value: claim.value ?? null,
    unit: claim.unit ?? null,
    evidenceStrength: claim.evidenceStrength,
    dataQuality: claim.qualityStatus,
    limitations: claim.limitations,
  }));
  const stateRule = transaction.originatingStateId
    ? `This response is bound to canonical state ${transaction.originatingStateId} effective ${transaction.originatingEffectiveAt}. Do not use or imply another state.`
    : "Canonical state is unavailable. Do not produce a current market narrative; provide only a concise unavailable/insufficient-evidence response.";
  return [
    "PHASE 4 INTERPRETATION CONTRACT (AUTHORITATIVE):",
    stateRule,
    "You are an interpretation system, not an independent quantitative engine.",
    "Use only the supplied evidence claims. Do not create observations, metrics, historical facts, probabilities, targets, timing windows, confirmation rules, invalidation rules, causal relationships, cross-engine confirmation, model confidence, or source data.",
    "Historical frequency remains HISTORICAL_FREQUENCY. Analog similarity remains HISTORICAL_SIMILARITY. Scenario scores remain DERIVED_SCENARIO_SCORE. None is a current model probability.",
    transaction.forecastClaimIds.length
      ? `Authorized forecast claims: ${transaction.forecastClaimIds.join(", ")}. Only these may support a forecast, and retain their supplied event, horizon, model, and methodology.`
      : "No authorized forecast claim exists. State 'No governed forecast available' when asked for probability, target, direction, magnitude, or timing.",
    `Evidence strength present: ${transaction.evidenceStrength.join(", ") || "not established"}. Data quality present: ${transaction.dataQuality.join(", ") || "not established"}. When evidence is PRELIMINARY, PARTIAL, DEGRADED, UNAVAILABLE, stale, delayed, or conflicted, explicitly qualify the interpretation; never translate strength or quality into probability.`,
    "Do not call a single engine system-wide deterioration. Do not call multiple raw metrics confirmation. Do not use causal language unless supplied by an authorized structured claim.",
    "For missing confirmation or invalidation rules, state 'No governed confirmation condition is currently defined' or 'No governed invalidation condition is currently defined.'",
    "Answer the question first. Use concise sections with distinct jobs: EXECUTIVE ANSWER, KEY EVIDENCE, INTERPRETATION, WHAT IS NOT ESTABLISHED, WATCH. Do not repeat a conclusion across sections. Remove generic filler.",
    `ALLOWED EVIDENCE CLAIMS: ${JSON.stringify(claimList)}`,
  ].join("\n");
}

/**
 * Deterministically blocks unsafe generated fields before delivery. This is a
 * bounded correction layer; callers may retry once with the returned issues.
 */
export function validateInterpretationOutput(
  output: Record<string, unknown>,
  transaction: InterpretationTransaction,
): InterpretationValidationResult {
  const normalizedOutput = cloneOutput(output);
  const issues: string[] = [];
  const withheldClaimReasons: string[] = [];
  const hasForecast = transaction.forecastClaimIds.length > 0;
  const hasCanonical = Boolean(transaction.originatingStateId);

  for (const [field, value] of Object.entries(normalizedOutput)) {
    if (!hasForecast && NO_FORECAST_FIELDS.has(field) && isMeaningful(value)) {
      normalizedOutput[field] = null;
      issues.push(`${field} withheld because no authorized forecast claim exists.`);
      withheldClaimReasons.push(`Forecast field ${field} withheld: no authorized forecast claim.`);
    }
    if (CONFIRMATION_FIELDS.has(field) && isMeaningful(value)) {
      const replacement = field.toLowerCase().includes("confirmation")
        ? "No governed confirmation condition is currently defined."
        : "No governed invalidation condition is currently defined.";
      normalizedOutput[field] = Array.isArray(value) ? [replacement] : replacement;
      issues.push(`${field} withheld because no structured rule provenance exists.`);
      withheldClaimReasons.push(`${field} withheld: no structured rule provenance.`);
    }
  }

  const textFields = ["reply", "directAnswer", "executiveSummary", "coreThesis", "missionRecommendation", "whyThisVerdict", "collectiveReading"]
    .map(key => [key, normalizedOutput[key]] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string");

  for (const [field, text] of textFields) {
    if (GENERIC_FILLER.test(text)) issues.push(`${field} contains generic filler.`);
    if (UNSUPPORTED_CAUSAL.test(text)) issues.push(`${field} contains unsupported causal language.`);
    if (FALSE_SYSTEM_SCOPE.test(text)) issues.push(`${field} contains unsupported system-wide or multi-engine confirmation.`);
  }
  for (let i = 0; i < textFields.length; i += 1) {
    for (let j = i + 1; j < textFields.length; j += 1) {
      if (overlap(textFields[i][1], textFields[j][1]) > 0.82) issues.push(`${textFields[i][0]} materially duplicates ${textFields[j][0]}.`);
    }
  }

  if (!hasCanonical) {
    issues.push("Current interpretation withheld because canonical state is unavailable.");
    normalizedOutput.reply = "Canonical state unavailable. Insufficient evidence for a current market interpretation.";
    normalizedOutput.directAnswer = normalizedOutput.reply;
    withheldClaimReasons.push("Current narrative withheld: canonical state unavailable.");
  }

  const unsafeNarrative = issues.some(issue => /generic filler|causal language|system-wide|duplicates/i.test(issue));
  if (unsafeNarrative) {
    const safeReply = "The supplied evidence does not support that generated conclusion as stated. Review the claim-level evidence and current limitations.";
    normalizedOutput.reply = safeReply;
    if ("directAnswer" in normalizedOutput) normalizedOutput.directAnswer = safeReply;
    if ("executiveSummary" in normalizedOutput) normalizedOutput.executiveSummary = safeReply;
    if ("coreThesis" in normalizedOutput) normalizedOutput.coreThesis = "No additional governed interpretation is available from the supplied evidence.";
    if ("keyFindings" in normalizedOutput) normalizedOutput.keyFindings = [];
    if ("supportingEvidence" in normalizedOutput) normalizedOutput.supportingEvidence = [];
    if ("crossEngineSynthesis" in normalizedOutput) normalizedOutput.crossEngineSynthesis = [];
    withheldClaimReasons.push("Generated narrative withheld: output validation detected unsupported escalation, causality, duplication, or generic filler.");
  }

  const status: InterpretationValidationStatus = !issues.length
    ? "PASS"
    : !hasCanonical ? "WITHHELD"
      : unsafeNarrative ? "WITHHELD" : "CORRECTED";
  return { status, issues, withheldClaimReasons, normalizedOutput };
}

export function assertSameInterpretationState(transaction: InterpretationTransaction, packet: EvidencePacket | null): void {
  const currentStateId = packet?.canonicalState?.stateId ?? null;
  if (transaction.originatingStateId !== currentStateId) {
    throw new Error(`Interpretation transaction state changed from ${transaction.originatingStateId ?? "unavailable"} to ${currentStateId ?? "unavailable"}.`);
  }
}
