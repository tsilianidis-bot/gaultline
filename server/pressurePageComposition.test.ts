import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("Pressure page composition", () => {
  const pressureSource = source("client/src/pages/Pressure.tsx");
  const appSource = source("client/src/App.tsx");

  it("keeps Pressure on its expert route without changing canonical NOW wiring", () => {
    expect(appSource).toContain('const Pressure        = lazy(() => import("./pages/Pressure"));');
    expect(appSource).toContain('<Route path="/app/pressure" component={Pressure} />');
    expect(appSource).toContain('import Now from "./pages/Now"');
  });

  it("renders from a numeric canonical pressureIndex even when pressureLevel is regime-shaped", () => {
    expect(pressureSource).toContain("resolvePressureLevel(canonicalState.pressureLevel, canonicalState.pressureIndex)");
    expect(pressureSource).not.toContain("!isPressureLevel(canonicalState.pressureLevel)");
    expect(pressureSource).toContain("canonicalState.pressureIndex === null || Number.isNaN(canonicalState.pressureIndex)");
    expect(pressureSource).toContain("level: pressureLevel");
  });
});
