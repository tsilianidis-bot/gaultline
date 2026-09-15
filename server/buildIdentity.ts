/**
 * Preview/CI/Docker build identity.
 *
 * Order: baked dist/build-identity.json (Docker image) → BUILD_COMMIT env →
 * RAILWAY_GIT_COMMIT_SHA → git HEAD → "dev".
 * The baked file wins so a stale Railway service variable cannot pin an old SHA.
 *
 * See docs/RC_PREVIEW_BUILD_IDENTITY.md. Do not point this at getfaultline.live.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface BuildIdentity {
  commit: string;
  buildTime: string;
  nodeEnv: string;
  version: string;
}

function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function gitHead(): string | undefined {
  try {
    const sha = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return sha.length > 0 ? sha : undefined;
  } catch {
    return undefined;
  }
}

function bakedIdentityPath(): string | undefined {
  const override = nonEmptyEnv("FAULTLINE_BUILD_IDENTITY_FILE");
  if (override) return override;
  try {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), "build-identity.json");
  } catch {
    return undefined;
  }
}

function readBakedIdentity(): { commit?: string; buildTime?: string } {
  const file = bakedIdentityPath();
  if (!file) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
      commit?: unknown;
      buildTime?: unknown;
    };
    const commit = typeof parsed.commit === "string" ? parsed.commit.trim() : "";
    const buildTime = typeof parsed.buildTime === "string" ? parsed.buildTime.trim() : "";
    return {
      commit: commit.length > 0 ? commit : undefined,
      buildTime: buildTime.length > 0 ? buildTime : undefined,
    };
  } catch {
    return {};
  }
}

let bootBuildTime: string | undefined;

export function resolveBuildIdentity(now: () => string = () => new Date().toISOString()): BuildIdentity {
  const baked = readBakedIdentity();
  if (!bootBuildTime) {
    bootBuildTime = baked.buildTime ?? nonEmptyEnv("BUILD_TIME") ?? now();
  }
  return {
    commit: baked.commit
      ?? nonEmptyEnv("BUILD_COMMIT")
      ?? nonEmptyEnv("RAILWAY_GIT_COMMIT_SHA")
      ?? gitHead()
      ?? "dev",
    buildTime: baked.buildTime ?? nonEmptyEnv("BUILD_TIME") ?? bootBuildTime,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    version: process.env.npm_package_version ?? "1.0.0",
  };
}

/** Test-only: reset the boot-stable BUILD_TIME fallback. */
export function resetBuildIdentityBootTime(): void {
  bootBuildTime = undefined;
}
