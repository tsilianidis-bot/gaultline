export const INTELLIGENCE_EVIDENCE_FLAG = "FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED" as const;
export const INTELLIGENCE_CORE_VISUAL_FLAG = "FAULTLINE_INTELLIGENCE_CORE_VISUAL_ENABLED" as const;
export const INTELLIGENCE_CORE_LEDGER_FLAG = "FAULTLINE_INTELLIGENCE_CORE_LEDGER_ENABLED" as const;

function enabled(name: string, env: NodeJS.ProcessEnv): boolean {
  return env[name]?.trim().toLowerCase() === "true";
}

/**
 * Phase 1 has no production side effects unless an operator explicitly opts in.
 * The default prevents provider polling, storage writes, and route results from
 * being activated merely because this code has been deployed.
 */
export function isIntelligenceEvidenceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return enabled(INTELLIGENCE_EVIDENCE_FLAG, env);
}

/**
 * The visual layer remains independently disabled until an operator verifies the
 * deployed evidence pipeline. It cannot activate source collection by itself.
 */
export function isIntelligenceCoreVisualEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return enabled(INTELLIGENCE_CORE_VISUAL_FLAG, env);
}

/**
 * Automatic institutional-assessment ledger records are opt-in separately from
 * collection and visual presentation. This protects production history from
 * unintended writes during feature rollout.
 */
export function isIntelligenceCoreLedgerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return enabled(INTELLIGENCE_CORE_LEDGER_FLAG, env);
}
