import {
  SYSTEMIC_REGIME_MODEL_TYPE,
  SYSTEMIC_REGIME_PCA_METHOD,
} from "../../shared/systemicRegime";

/** The only identity permitted for production LIVE Systemic Regime reads. */
export const APPROVED_SYSTEMIC_REGIME_IDENTITY = Object.freeze({
  modelVersion: "sre-hmm2-v1.0.0",
  modelType: SYSTEMIC_REGIME_MODEL_TYPE,
  pcaMethod: SYSTEMIC_REGIME_PCA_METHOD,
  nStates: 2,
});

export type SystemicRegimeIdentity = typeof APPROVED_SYSTEMIC_REGIME_IDENTITY;

type IdentityCandidate = {
  modelVersion?: unknown;
  modelType?: unknown;
  pcaMethod?: unknown;
  nStates?: unknown;
};

/**
 * Identity checks intentionally use exact equality. A missing, altered, or
 * unapproved bundle must be withheld rather than silently serving LIVE output.
 */
export function hasApprovedSystemicRegimeIdentity(candidate: IdentityCandidate | null | undefined): boolean {
  if (!candidate) return false;
  return candidate.modelVersion === APPROVED_SYSTEMIC_REGIME_IDENTITY.modelVersion
    && candidate.modelType === APPROVED_SYSTEMIC_REGIME_IDENTITY.modelType
    && candidate.pcaMethod === APPROVED_SYSTEMIC_REGIME_IDENTITY.pcaMethod
    && candidate.nStates === APPROVED_SYSTEMIC_REGIME_IDENTITY.nStates;
}
