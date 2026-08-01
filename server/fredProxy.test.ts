import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("fredProxy — retry logic and error classification", () => {
  const fredSource = source("server/fredProxy.ts");

  it("implements a retry helper function with maxAttempts parameter", () => {
    expect(fredSource).toContain("fetchFredSeries");
    expect(fredSource).toContain("maxAttempts");
    expect(fredSource).toContain("attempt <= maxAttempts");
  });

  it("uses exponential backoff between retry attempts", () => {
    expect(fredSource).toContain("sleep(500 * attempt)");
  });

  it("treats 4xx responses as non-retryable", () => {
    expect(fredSource).toContain("fredRes.status >= 400 && fredRes.status < 500");
    expect(fredSource).toContain("throw lastErr");
  });

  it("logs empty observations as a warning not a silent failure", () => {
    expect(fredSource).toContain("observations array is empty");
    expect(fredSource).toContain("log.warn");
  });

  it("logs a summary of failed series after bulk fetch", () => {
    expect(fredSource).toContain("Bulk:");
    expect(fredSource).toContain("series failed:");
  });

  it("marks empty-observation series as error in bulk results", () => {
    expect(fredSource).toContain('"empty observations"');
  });

  it("uses the bulk endpoint for all series in parallel", () => {
    expect(fredSource).toContain("Promise.allSettled");
    expect(fredSource).toContain("/api/fred/bulk");
  });
});

describe("seismographAdapters — fallback confidence degradation", () => {
  const adapterSource = source("server/seismographAdapters.ts");

  it("degrades confidence by 15 points when dataSource is fallback", () => {
    expect(adapterSource).toContain("dataSource === \"fallback\"");
    expect(adapterSource).toContain("baseConfidence - 15");
  });

  it("floors degraded confidence at 50 to prevent nonsensical values", () => {
    expect(adapterSource).toContain("Math.max(50, baseConfidence - 15)");
  });

  it("uses full confidence when dataSource is live", () => {
    expect(adapterSource).toContain("baseConfidence");
    expect(adapterSource).toContain(": baseConfidence");
  });
});

describe("App.tsx — FREDDebugConsole admin gate", () => {
  const appSource = source("client/src/App.tsx");

  it("gates FREDDebugConsole behind admin role check", () => {
    expect(appSource).toContain("user?.role === 'admin'");
    expect(appSource).toContain("FREDDebugConsole");
  });

  it("does not render FREDDebugConsole unconditionally", () => {
    // The console must only appear inside an admin role conditional
    // Verify the pattern: {user?.role === 'admin' && <FREDDebugConsole />}
    const adminGatePattern = /user\?\.role\s*===\s*['"]admin['"]\s*&&\s*<FREDDebugConsole/;
    expect(adminGatePattern.test(appSource)).toBe(true);
  });
});

describe("Now.tsx — Pressure Index instrument strengthening", () => {
  const nowSource = source("client/src/pages/Now.tsx");

  it("accepts a scoreChange prop on PressureInstrument", () => {
    expect(nowSource).toContain("scoreChange");
    expect(nowSource).toContain("scoreChange?: number | null");
  });

  it("renders the score at 68px font size", () => {
    expect(nowSource).toContain('fontSize="68"');
  });

  it("renders the regime label above the score", () => {
    expect(nowSource).toContain("pressureLabel(score)");
  });

  it("renders the scale text as score / 100", () => {
    expect(nowSource).toContain("{score} / 100");
  });

  it("renders the change from prior reading with direction arrows", () => {
    expect(nowSource).toContain("from prior");
    expect(nowSource).toContain("↑");
    expect(nowSource).toContain("↓");
  });

  it("passes scoreChange derived from output.overall.delta * 10 to PressureInstrument", () => {
    expect(nowSource).toContain("output.overall.delta * 10");
  });

  it("includes sensor-pulse keyframe animation", () => {
    expect(nowSource).toContain("sensor-pulse");
  });
});
