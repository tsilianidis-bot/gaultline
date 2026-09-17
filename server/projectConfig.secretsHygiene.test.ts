import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const LIVE_LOOKING = /^(sk_live_|sk_test_|pk_live_|pk_test_|whsec_|SG\.|AKIA|CG-)/;

function leafStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) leafStrings(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      leafStrings(child, acc);
    }
  }
  return acc;
}

describe("project-config secrets hygiene", () => {
  it("ignores .project-config.json and no longer tracks it", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toMatch(/^\.project-config\.json$/m);

    let stillTracked = false;
    try {
      execFileSync("git", ["ls-files", "--error-unmatch", ".project-config.json"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      stillTracked = true;
    } catch {
      stillTracked = false;
    }
    expect(stillTracked).toBe(false);
  });

  it("keeps a placeholder-only example with key names, never live-looking values", () => {
    const examplePath = resolve(root, ".project-config.example.json");
    expect(existsSync(examplePath)).toBe(true);

    const example = JSON.parse(read(".project-config.example.json")) as {
      env_vars?: Record<string, unknown>;
      secrets?: Record<string, unknown>;
      git_remote?: Record<string, unknown>;
    };

    expect(Object.keys(example.env_vars ?? {}).sort()).toEqual([
      "DATABASE_URL",
      "DRIZZLE_DATABASE_URL",
      "MANUS_WEBDEV_PROJECT_ID",
    ]);
    expect(Object.keys(example.git_remote ?? {}).sort()).toEqual([
      "access_key_id",
      "backend",
      "expiration",
      "repo_url",
      "secret_access_key",
      "session_token",
    ]);
    expect(Object.keys(example.secrets ?? {})).toEqual(
      expect.arrayContaining([
        "FRED_API_KEY",
        "JWT_SECRET",
        "QA_ACCESS_SECRET",
        "SENDGRID_API_KEY",
        "STRIPE_SECRET_KEY",
      ]),
    );

    for (const leaf of leafStrings(example)) {
      expect(leaf).not.toMatch(LIVE_LOOKING);
      expect(leaf).not.toMatch(/^mysql:\/\//);
    }
  });
});
