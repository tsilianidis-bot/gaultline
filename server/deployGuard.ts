/**
 * Refuse a Railway boot of a commit that is not on the production allowlist.
 * Local, CI, and startup smoke do not set Railway variables, so they are unchanged.
 * This does not deploy, tag, or change repository settings.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveBuildIdentity } from "./buildIdentity";

export const APPROVED_PRODUCTION_COMMITS_FILE = "config/approved-production-commits.txt";

export interface DeployGuardDecision {
  enforced: boolean;
  allow: boolean;
  reason: "not_enforced" | "approved" | "missing_commit" | "unapproved_commit";
  commits: string[];
}

export function readApprovedProductionCommits(text: string): Set<string> {
  const approved = new Set<string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    approved.add(trimmed);
  }
  return approved;
}

export function decideProductionDeploy(input: {
  env: NodeJS.ProcessEnv;
  allowlist: ReadonlySet<string>;
  bakedCommit?: string | null;
}): DeployGuardDecision {
  const enforced = input.env.FAULTLINE_ENFORCE_DEPLOY_GUARD === "true"
    || Boolean(input.env.RAILWAY_ENVIRONMENT)
    || Boolean(input.env.RAILWAY_GIT_COMMIT_SHA);
  const commits = [input.env.RAILWAY_GIT_COMMIT_SHA, input.env.BUILD_COMMIT, input.bakedCommit]
    .map(value => (typeof value === "string" ? value.trim() : ""))
    .filter(value => value.length > 0);
  if (!enforced) return { enforced: false, allow: true, reason: "not_enforced", commits };
  if (commits.length === 0) return { enforced: true, allow: false, reason: "missing_commit", commits };
  if (commits.some(commit => !input.allowlist.has(commit))) {
    return { enforced: true, allow: false, reason: "unapproved_commit", commits };
  }
  return { enforced: true, allow: true, reason: "approved", commits };
}

export function assertApprovedProductionDeploy(env: NodeJS.ProcessEnv = process.env): DeployGuardDecision {
  let text = "";
  try {
    text = readFileSync(resolve(process.cwd(), APPROVED_PRODUCTION_COMMITS_FILE), "utf8");
  } catch {
    text = "";
  }
  const decision = decideProductionDeploy({
    env,
    allowlist: readApprovedProductionCommits(text),
    bakedCommit: resolveBuildIdentity().commit,
  });
  if (!decision.allow) {
    const shown = decision.commits.length > 0 ? decision.commits.join(", ") : "(none)";
    throw new Error(
      `Refusing to boot an unapproved commit on Railway (${decision.reason}: ${shown}). Approved SHAs are listed in ${APPROVED_PRODUCTION_COMMITS_FILE}.`,
    );
  }
  return decision;
}
