import { afterEach, describe, expect, it } from "vitest";
import { resetBuildIdentityBootTime, resolveBuildIdentity } from "./buildIdentity";

const ORIGINAL = {
  BUILD_COMMIT: process.env.BUILD_COMMIT,
  BUILD_TIME: process.env.BUILD_TIME,
  NODE_ENV: process.env.NODE_ENV,
  npm_package_version: process.env.npm_package_version,
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
    process.env.BUILD_COMMIT = "   ";
    process.env.BUILD_TIME = "";
    resetBuildIdentityBootTime();

    const identity = resolveBuildIdentity(() => "2026-09-13T12:00:00.000Z");
    expect(identity.commit).not.toBe("");
    expect(identity.commit.length).toBeGreaterThan(2);
    expect(identity.buildTime).toBe("2026-09-13T12:00:00.000Z");
  });

  it("keeps fallback buildTime stable across calls when env time is missing", () => {
    delete process.env.BUILD_TIME;
    resetBuildIdentityBootTime();
    const first = resolveBuildIdentity(() => "boot-1");
    const second = resolveBuildIdentity(() => "boot-2");
    expect(first.buildTime).toBe("boot-1");
    expect(second.buildTime).toBe("boot-1");
  });
});
