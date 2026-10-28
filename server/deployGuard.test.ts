import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { approvedShasFromExternalList, decidePreDeployApproval } from "./deployGuard";

const PRODUCTION = "1cb5dee13832c0556ec5a380ecc4ffb02513e875";
const OTHER = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function preDeploy(env: Record<string, string>) {
  return spawnSync("bash", ["scripts/guard-approved-deploy.sh"], {
    encoding: "utf8",
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
  });
});
