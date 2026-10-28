import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { approvedShasFromExternalList, decidePreDeployApproval } from "./deployGuard";

const PRODUCTION = "1cb5dee13832c0556ec5a380ecc4ffb02513e875";
const OTHER = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CANDIDATE = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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

  it("refuses when FAULTLINE_APPROVED_SHA differs from RAILWAY_GIT_COMMIT_SHA", () => {
    const matched = preDeploy({
      FAULTLINE_APPROVED_SHA: CANDIDATE,
      RAILWAY_GIT_COMMIT_SHA: CANDIDATE,
      BUILD_COMMIT: OTHER,
    });
    expect(matched.status).toBe(0);
    expect(matched.stdout).toMatch(new RegExp(CANDIDATE));

    const mismatch = preDeploy({
      FAULTLINE_APPROVED_SHA: CANDIDATE,
      RAILWAY_GIT_COMMIT_SHA: OTHER,
      FAULTLINE_APPROVED_DEPLOY_SHAS: OTHER,
      FAULTLINE_DEPLOY_SHA: OTHER,
    });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toMatch(/FAULTLINE_APPROVED_SHA .* does not match RAILWAY_GIT_COMMIT_SHA/);

    const missingPlatform = preDeploy({
      FAULTLINE_APPROVED_SHA: CANDIDATE,
      FAULTLINE_DEPLOY_SHA: CANDIDATE,
    });
    expect(missingPlatform.status).not.toBe(0);
    expect(missingPlatform.stderr).toMatch(/FAULTLINE_APPROVED_SHA .* does not match RAILWAY_GIT_COMMIT_SHA/);
  });

  it("requires FAULTLINE_APPROVED_SHA when the deploy guard is enforced", () => {
    const legacy = {
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_DEPLOY_SHAS: CANDIDATE,
      FAULTLINE_APPROVED_DEPLOY_TAGS: "production-f7756c7",
      RAILWAY_GIT_COMMIT_SHA: CANDIDATE,
      FAULTLINE_DEPLOY_SHA: CANDIDATE,
    };
    const empty = preDeploy(legacy);
    expect(empty.status).not.toBe(0);
    expect(empty.stderr).toMatch(/FAULTLINE_APPROVED_SHA is unset/);

    const blank = preDeploy({ ...legacy, FAULTLINE_APPROVED_SHA: "" });
    expect(blank.status).not.toBe(0);
    expect(blank.stderr).toMatch(/FAULTLINE_APPROVED_SHA is unset/);

    const short = preDeploy({
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_SHA: "abc",
      RAILWAY_GIT_COMMIT_SHA: "abc",
      FAULTLINE_APPROVED_DEPLOY_SHAS: CANDIDATE,
    });
    expect(short.status).not.toBe(0);
    expect(short.stderr).toMatch(/exactly 40 lowercase hex/);

    const shortHex = preDeploy({
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_SHA: "b".repeat(39),
      RAILWAY_GIT_COMMIT_SHA: "b".repeat(39),
    });
    expect(shortHex.status).not.toBe(0);
    expect(shortHex.stderr).toMatch(/exactly 40 lowercase hex/);

    const long = preDeploy({
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_SHA: `${CANDIDATE}b`,
      RAILWAY_GIT_COMMIT_SHA: `${CANDIDATE}b`,
      FAULTLINE_APPROVED_DEPLOY_SHAS: CANDIDATE,
    });
    expect(long.status).not.toBe(0);
    expect(long.stderr).toMatch(/exactly 40 lowercase hex/);

    const longer = preDeploy({
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_SHA: "c".repeat(64),
      RAILWAY_GIT_COMMIT_SHA: "c".repeat(64),
    });
    expect(longer.status).not.toBe(0);
    expect(longer.stderr).toMatch(/exactly 40 lowercase hex/);

    const mismatch = preDeploy({
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_SHA: CANDIDATE,
      RAILWAY_GIT_COMMIT_SHA: OTHER,
      FAULTLINE_APPROVED_DEPLOY_SHAS: OTHER,
      FAULTLINE_DEPLOY_SHA: OTHER,
    });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toMatch(/does not match RAILWAY_GIT_COMMIT_SHA/);

    const enforced = preDeploy({
      FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
      FAULTLINE_APPROVED_SHA: CANDIDATE,
      RAILWAY_GIT_COMMIT_SHA: CANDIDATE,
    });
    expect(enforced.status).toBe(0);
  });

  it("boots when the deploy guard flag is off", () => {
    const bin = mkdtempSync(join(tmpdir(), "faultline-node-"));
    const marker = join(bin, "started");
    writeFileSync(join(bin, "node"), `#!/bin/sh\nprintf started > ${JSON.stringify(marker)}\nexit 0\n`, { mode: 0o755 });
    const off = spawnSync("bash", ["scripts/start-production.sh"], {
      encoding: "utf8",
      env: { PATH: `${bin}:${process.env.PATH ?? ""}`, HOME: process.env.HOME ?? "" },
    });
    expect(off.status).toBe(0);
    expect(off.stderr).toMatch(/not enforced/);
    expect(readFileSync(marker, "utf8")).toContain("started");
    rmSync(marker);

    const on = spawnSync("bash", ["scripts/start-production.sh"], {
      encoding: "utf8",
      env: {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        HOME: process.env.HOME ?? "",
        FAULTLINE_ENFORCE_DEPLOY_GUARD: "1",
        FAULTLINE_APPROVED_DEPLOY_SHAS: CANDIDATE,
        FAULTLINE_APPROVED_DEPLOY_TAGS: "production-f7756c7",
        RAILWAY_GIT_COMMIT_SHA: CANDIDATE,
        FAULTLINE_DEPLOY_SHA: CANDIDATE,
      },
    });
    expect(on.status).not.toBe(0);
    expect(on.stderr).toMatch(/FAULTLINE_APPROVED_SHA is unset/);
    expect(() => readFileSync(marker, "utf8")).toThrow();
    rmSync(bin, { recursive: true, force: true });
  });
});
