import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { approvedShasFromExternalList, decidePreDeployApproval } from "./deployGuard";

const PRODUCTION = "1cb5dee13832c0556ec5a380ecc4ffb02513e875";
const OTHER = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function preDeploy(env: Record<string, string>, cwd?: string) {
  return spawnSync("bash", [cwd ? join(process.cwd(), "scripts/guard-approved-deploy.sh") : "scripts/guard-approved-deploy.sh"], {
    encoding: "utf8",
    cwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...env,
    },
  });
}

describe("pre-deploy allowlist", () => {
  it("compares one target SHA to an external list and ignores a stale BUILD_COMMIT", () => {
    const allowlist = approvedShasFromExternalList(`${PRODUCTION}, TRUE, short, ${OTHER.toUpperCase()}`);
    expect(allowlist).toEqual(new Set([PRODUCTION]));
    expect(decidePreDeployApproval({ targetSha: PRODUCTION, allowlist })).toMatchObject({ allow: true, reason: "approved" });
    expect(decidePreDeployApproval({ targetSha: OTHER, allowlist })).toMatchObject({ allow: false, reason: "unapproved_commit" });
    expect(decidePreDeployApproval({ targetSha: "dev", allowlist })).toMatchObject({ allow: false, reason: "missing_target" });
    expect(decidePreDeployApproval({ targetSha: PRODUCTION, allowlist: new Set() })).toMatchObject({ allow: false, reason: "missing_allowlist" });
  });

  it("the script allows only an external allowlist match and does not read BUILD_COMMIT", () => {
    const approved = preDeploy({
      FAULTLINE_APPROVED_DEPLOY_SHAS: PRODUCTION,
      FAULTLINE_DEPLOY_SHA: PRODUCTION,
      BUILD_COMMIT: OTHER,
    });
    expect(approved.status).toBe(0);

    const staleTarget = preDeploy({
      FAULTLINE_APPROVED_DEPLOY_SHAS: PRODUCTION,
      FAULTLINE_DEPLOY_SHA: OTHER,
      BUILD_COMMIT: PRODUCTION,
    });
    expect(staleTarget.status).not.toBe(0);

    const missingList = preDeploy({ FAULTLINE_DEPLOY_SHA: PRODUCTION, BUILD_COMMIT: PRODUCTION });
    expect(missingList.status).not.toBe(0);

    const missingSha = preDeploy({ FAULTLINE_APPROVED_DEPLOY_SHAS: PRODUCTION });
    expect(missingSha.status).not.toBe(0);
    expect(missingSha.stderr).toMatch(/neither RAILWAY_GIT_COMMIT_SHA nor FAULTLINE_DEPLOY_SHA/);

    const mismatch = preDeploy({
      FAULTLINE_APPROVED_DEPLOY_SHAS: PRODUCTION,
      FAULTLINE_DEPLOY_SHA: PRODUCTION,
      RAILWAY_GIT_COMMIT_SHA: OTHER,
    });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toMatch(/does not match/);

    const platformWins = preDeploy({
      FAULTLINE_APPROVED_DEPLOY_SHAS: PRODUCTION,
      RAILWAY_GIT_COMMIT_SHA: PRODUCTION,
      FAULTLINE_DEPLOY_SHA: PRODUCTION,
    });
    expect(platformWins.status).toBe(0);

    const tagsWithoutGit = preDeploy({
      FAULTLINE_APPROVED_DEPLOY_TAGS: "production-1cb5dee",
      FAULTLINE_DEPLOY_SHA: PRODUCTION,
    }, mkdtempSync(join(tmpdir(), "guard-no-git-")));
    expect(tagsWithoutGit.status).not.toBe(0);
    expect(tagsWithoutGit.stderr).toMatch(/no git checkout/);
  });
});
