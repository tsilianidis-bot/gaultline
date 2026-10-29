import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("independent Docker/Railway build identity", () => {
  const dockerfile = readFileSync(resolve(projectRoot, "Dockerfile"), "utf8");
  const nixpacks = readFileSync(resolve(projectRoot, "nixpacks.toml"), "utf8");

  it("declares Railway git SHA as a Docker build-arg and bakes dist/build-identity.json", () => {
    expect(dockerfile).toContain("ARG RAILWAY_GIT_COMMIT_SHA=");
    expect(dockerfile).toContain("scripts/ci-write-build-identity.sh");
    expect(dockerfile).toContain("pnpm run build");
  });

  it("routes the Nixpacks fallback through the guarded production start path", () => {
    expect(nixpacks).toMatch(/\[start\]\s*cmd = "bash scripts\/start-production\.sh"/);
  });
});
