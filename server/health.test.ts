import { afterEach, describe, expect, it } from "vitest";
import { resetBuildIdentityBootTime } from "./buildIdentity";
import { handleHealth, healthBody } from "./health";

const ORIGINAL = {
  BUILD_COMMIT: process.env.BUILD_COMMIT,
  BUILD_TIME: process.env.BUILD_TIME,
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

describe("GET /api/health", () => {
  it("returns 200 { ok: true, commit, buildTime } from resolveBuildIdentity", () => {
    delete process.env.FAULTLINE_BUILD_IDENTITY_FILE;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.BUILD_COMMIT = "7894429c537e377992a3016d57f61ee3bd5ab7d1";
    process.env.BUILD_TIME = "2026-09-14T00:00:00.000Z";
    resetBuildIdentityBootTime();

    expect(healthBody()).toEqual({
      ok: true,
      commit: "7894429c537e377992a3016d57f61ee3bd5ab7d1",
      buildTime: "2026-09-14T00:00:00.000Z",
    });

    const state: { status?: number; body?: unknown } = {};
    const res = {
      status(code: number) {
        state.status = code;
        return this;
      },
      json(body: unknown) {
        state.body = body;
        return this;
      },
    };
    handleHealth({} as any, res as any);
    expect(state.status).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      commit: "7894429c537e377992a3016d57f61ee3bd5ab7d1",
      buildTime: "2026-09-14T00:00:00.000Z",
    });
  });
});
