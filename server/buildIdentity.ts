/**
 * Preview/CI build identity. Env wins when non-empty; git HEAD is a
 * preview fallback when BUILD_COMMIT is unset. Production hosts that
 * already inject BUILD_COMMIT / BUILD_TIME are unchanged.
 *
 * See docs/RC_PREVIEW_BUILD_IDENTITY.md. Do not point this at getfaultline.live.
 */
import { execSync } from "node:child_process";

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

let bootBuildTime: string | undefined;

export function resolveBuildIdentity(now: () => string = () => new Date().toISOString()): BuildIdentity {
  if (!bootBuildTime) {
    bootBuildTime = nonEmptyEnv("BUILD_TIME") ?? now();
  }
  return {
    commit: nonEmptyEnv("BUILD_COMMIT") ?? gitHead() ?? "dev",
    buildTime: nonEmptyEnv("BUILD_TIME") ?? bootBuildTime,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    version: process.env.npm_package_version ?? "1.0.0",
  };
}

/** Test-only: reset the boot-stable BUILD_TIME fallback. */
export function resetBuildIdentityBootTime(): void {
  bootBuildTime = undefined;
}
