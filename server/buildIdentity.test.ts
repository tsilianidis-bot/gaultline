import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetBuildIdentityBootTime, resolveBuildIdentity } from "./buildIdentity";

const ORIGINAL = {
  BUILD_COMMIT: process.env.BUILD_COMMIT,
  BUILD_TIME: process.env.BUILD_TIME,
  NODE_ENV: process.env.NODE_ENV,
  npm_package_version: process.env.npm_package_version,
  FAULTLINE_BUILD_IDENTITY_FILE: process.env.FAULTLINE_BUILD_IDENTITY_FILE,
  RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetBuildIdentityBootTime();
});

describe("resolveBuildIdentity", () => {
  it("prefers non-empty BUILD_COMMIT and BUILD_TIME over git/dev fallbacks", () => {
    delete process.env.FAULTLINE_BUILD_IDENTITY_FILE;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.BUILD_COMMIT = "10e579dbc1646b2336b41393268ac3faf3210433";
    process.env.BUILD_TIME = "2026-09-13T00:00:00Z";
    process.env.NODE_ENV = "production";
    process.env.npm_package_version = "1.0.0";
    resetBuildIdentityBootTime();

    expect(resolveBuildIdentity()).toMatchObject({
      commit: "10e579dbc1646b2336b41393268ac3faf3210433",
      buildTime: "2026-09-13T00:00:00Z",
      nodeEnv: "production",
      version: "1.0.0",
    });
  });

  it("treats blank BUILD_COMMIT / BUILD_TIME as unset (preview-safe)", () => {
    delete process.env.FAULTLINE_BUILD_IDENTITY_FILE;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.BUILD_COMMIT = "   ";
    process.env.BUILD_TIME = "";
    resetBuildIdentityBootTime();

    const identity = resolveBuildIdentity(() => "2026-09-13T12:00:00.000Z");
    expect(identity.commit).not.toBe("");
    expect(identity.commit.length).toBeGreaterThan(2);
    expect(identity.buildTime).toBe("2026-09-13T12:00:00.000Z");
  });

  it("keeps fallback buildTime stable across calls when env time is missing", () => {
    delete process.env.FAULTLINE_BUILD_IDENTITY_FILE;
    delete process.env.BUILD_TIME;
    resetBuildIdentityBootTime();
    const first = resolveBuildIdentity(() => "boot-1");
    const second = resolveBuildIdentity(() => "boot-2");
    expect(first.buildTime).toBe("boot-1");
    expect(second.buildTime).toBe("boot-1");
  });

  it("uses baked Docker identity over a stale BUILD_COMMIT service variable", () => {
    const dir = mkdtempSync(join(tmpdir(), "faultline-identity-"));
    const file = join(dir, "build-identity.json");
    writeFileSync(file, JSON.stringify({
      commit: "1395b0ce2627f90cd086d68863408aef65ee2cf5",
      buildTime: "2026-09-14T19:30:00.000Z",
    }));
    process.env.FAULTLINE_BUILD_IDENTITY_FILE = file;
    process.env.BUILD_COMMIT = "21f6f18ab80ea76369605ed0efc35ca6a6046e1b";
    process.env.BUILD_TIME = "2026-09-14T18:00:00.000Z";
    resetBuildIdentityBootTime();

    expect(resolveBuildIdentity()).toMatchObject({
      commit: "1395b0ce2627f90cd086d68863408aef65ee2cf5",
      buildTime: "2026-09-14T19:30:00.000Z",
    });
  });

  it("falls back to RAILWAY_GIT_COMMIT_SHA when BUILD_COMMIT is unset", () => {
    delete process.env.FAULTLINE_BUILD_IDENTITY_FILE;
    delete process.env.BUILD_COMMIT;
    process.env.RAILWAY_GIT_COMMIT_SHA = "525d202c484dd1286b8f6d20532c5fb90f67ef44";
    process.env.BUILD_TIME = "2026-09-14T19:09:00.000Z";
    resetBuildIdentityBootTime();

    expect(resolveBuildIdentity().commit).toBe("525d202c484dd1286b8f6d20532c5fb90f67ef44");
  });
});
