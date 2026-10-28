import { describe, expect, it } from "vitest";
import { decideProductionDeploy, readApprovedProductionCommits } from "./deployGuard";

const PRODUCTION = "1cb5dee13832c0556ec5a380ecc4ffb02513e875";
const allowlist = readApprovedProductionCommits(`# note\n${PRODUCTION}\n`);

describe("production deploy guard", () => {
  it("allows local and CI boots that are not on Railway", () => {
    expect(decideProductionDeploy({
      env: {},
      allowlist,
      bakedCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toMatchObject({ allow: true, reason: "not_enforced" });
  });

  it("allows only the approved production SHA when Railway identity is present", () => {
    expect(decideProductionDeploy({
      env: { RAILWAY_ENVIRONMENT: "production", RAILWAY_GIT_COMMIT_SHA: PRODUCTION },
      allowlist,
      bakedCommit: PRODUCTION,
    })).toMatchObject({ allow: true, reason: "approved" });
  });

  it("refuses an unapproved commit and a missing identity", () => {
    expect(decideProductionDeploy({
      env: { RAILWAY_GIT_COMMIT_SHA: "b19716b1b19716b1b19716b1b19716b1b19716b1", FAULTLINE_ENFORCE_DEPLOY_GUARD: "true" },
      allowlist,
    })).toMatchObject({ allow: false, reason: "unapproved_commit" });
    expect(decideProductionDeploy({
      env: { FAULTLINE_ENFORCE_DEPLOY_GUARD: "true" },
      allowlist,
      bakedCommit: "dev",
    })).toMatchObject({ allow: false, reason: "unapproved_commit" });
    expect(decideProductionDeploy({
      env: { RAILWAY_ENVIRONMENT: "production" },
      allowlist,
      bakedCommit: "",
    })).toMatchObject({ allow: false, reason: "missing_commit" });
  });

  it("does not treat lookalike flag values as enforcement by themselves", () => {
    expect(decideProductionDeploy({
      env: { FAULTLINE_ENFORCE_DEPLOY_GUARD: "TRUE" },
      allowlist,
      bakedCommit: "not-approved",
    })).toMatchObject({ allow: true, reason: "not_enforced" });
  });
});
