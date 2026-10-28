export const INTELLIGENCE_EVIDENCE_FLAG = "FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED" as const;

/**
 * Phase 1 has no production side effects unless an operator explicitly opts in.
 * The default prevents provider polling, storage writes, and route results from
 * being activated merely because this code has been deployed.
 */
export function isIntelligenceEvidenceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[INTELLIGENCE_EVIDENCE_FLAG] === "true";
}
