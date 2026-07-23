import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  CANONICAL_DESTINATIONS,
  PERSISTENT_UTILITIES,
} from "../shared/routeRegistry";

const CLIENT_ROOT = join(process.cwd(), "client", "src");
const HARDCODED_CANONICAL_PATH = /["'`]\/app\/(?:now|why|outlook|watch|act)(?:[?#"'`]|$)/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("route-registry client ownership", () => {
  it("contains no duplicated canonical destination paths in any client source", () => {
    const violations = sourceFiles(CLIENT_ROOT)
      .filter(path => HARDCODED_CANONICAL_PATH.test(readFileSync(path, "utf8")))
      .map(path => relative(CLIENT_ROOT, path));

    expect(violations).toEqual([]);
  });

  it("separates exactly five analytical destinations from persistent utilities", () => {
    expect(CANONICAL_DESTINATIONS.map(item => item.id)).toEqual(["now", "why", "outlook", "watch", "act"]);
    expect(CANONICAL_DESTINATIONS.every(item => item.surface === "primary")).toBe(true);
    expect(PERSISTENT_UTILITIES.map(item => item.id)).toEqual(["asha", "search", "alerts", "help", "account"]);
    expect(PERSISTENT_UTILITIES.every(item => item.surface === "utility")).toBe(true);
  });
});
