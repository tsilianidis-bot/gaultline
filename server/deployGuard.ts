/**
 * Pre-deploy comparison of one target SHA against an allowlist that lives
 * outside this commit (an env var or release-tag commits). This module does
 * not run at server boot, does not read config/approved-production-commits.txt,
 * and does not consult BUILD_COMMIT.
 */

const FULL_SHA = /^[0-9a-f]{40}$/;

export type PreDeployDecisionReason = "approved" | "missing_target" | "missing_allowlist" | "unapproved_commit";

export interface PreDeployDecision {
  allow: boolean;
  reason: PreDeployDecisionReason;
  targetSha: string;
}

/** Split an external allowlist. Only exact 40-character lowercase SHAs count. */
export function approvedShasFromExternalList(source: string | null | undefined): Set<string> {
  const approved = new Set<string>();
  if (!source) return approved;
  for (const part of source.split(/[\s,]+/)) {
    if (FULL_SHA.test(part)) approved.add(part);
  }
  return approved;
}

export function decidePreDeployApproval(input: {
  targetSha: string | null | undefined;
  allowlist: ReadonlySet<string>;
}): PreDeployDecision {
  const targetSha = (input.targetSha ?? "").trim();
  if (input.allowlist.size === 0) return { allow: false, reason: "missing_allowlist", targetSha };
  if (!FULL_SHA.test(targetSha)) return { allow: false, reason: "missing_target", targetSha };
  if (!input.allowlist.has(targetSha)) return { allow: false, reason: "unapproved_commit", targetSha };
  return { allow: true, reason: "approved", targetSha };
}
