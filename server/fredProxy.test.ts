import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

// ── fredClient.ts — shared FRED fetch module ─────────────────────────────────

describe("fredClient — shared FRED fetch module", () => {
  const clientSource = source("server/fredClient.ts");

  it("reads FRED_API_KEY from environment variable, not hardcoded", () => {
    // Must reference process.env.FRED_API_KEY
    expect(clientSource).toContain("process.env.FRED_API_KEY");
    // Must NOT contain the old hardcoded key
    expect(clientSource).not.toContain("458f0a0564e325c70e60f016f6f85f79");
  });

  it("logs a warning when FRED_API_KEY is missing", () => {
    expect(clientSource).toContain("FRED_API_KEY not configured");
    expect(clientSource).toContain("log.warn");
  });

  it("exports fetchFredSeries for single-series fetches", () => {
    expect(clientSource).toContain("export async function fetchFredSeries");
  });

  it("exports fetchFredBulk for multi-series fetches", () => {
    expect(clientSource).toContain("export async function fetchFredBulk");
  });

  it("exports clearFredCache for cache management", () => {
    expect(clientSource).toContain("export function clearFredCache");
  });

  it("implements retry logic with maxAttempts parameter", () => {
    expect(clientSource).toContain("maxAttempts");
    expect(clientSource).toContain("attempt <= maxAttempts");
  });

  it("uses exponential backoff between retry attempts", () => {
    expect(clientSource).toContain("500 * attempt");
  });

  it("treats 4xx responses as non-retryable", () => {
    expect(clientSource).toContain("status >= 400 && ");
    expect(clientSource).toContain("status < 500");
  });

  it("logs empty observations as a warning not a silent failure", () => {
    expect(clientSource).toContain("observations array is empty");
  });

  it("logs a summary of failed series after bulk fetch", () => {
    expect(clientSource).toContain("series failed");
  });

  it("marks empty-observation series as error in bulk results", () => {
    expect(clientSource).toContain('"empty observations"');
  });

  it("uses Promise.allSettled for parallel bulk fetches", () => {
    expect(clientSource).toContain("Promise.allSettled");
  });
});

// ── fredProxy.ts — thin HTTP route wrapper ────────────────────────────────────

describe("fredProxy — delegates to fredClient (no duplicate logic)", () => {
  const proxySource = source("server/fredProxy.ts");

  it("imports from fredClient, not reimplementing fetch logic", () => {
    expect(proxySource).toContain("from \"./fredClient\"");
    expect(proxySource).toContain("fetchFredSeries");
    expect(proxySource).toContain("fetchFredBulk");
    expect(proxySource).toContain("clearFredCache");
  });

  it("does not contain hardcoded FRED API key", () => {
    expect(proxySource).not.toContain("458f0a0564e325c70e60f016f6f85f79");
  });

  it("does not reimplement retry logic (no maxAttempts in proxy)", () => {
    // Retry logic lives in fredClient, not the proxy
    expect(proxySource).not.toContain("maxAttempts");
  });

  it("registers GET /api/fred route", () => {
    expect(proxySource).toContain('"/api/fred"');
  });

  it("registers POST /api/fred/bulk route", () => {
    expect(proxySource).toContain('"/api/fred/bulk"');
  });

  it("registers POST /api/fred/clear-cache route", () => {
    expect(proxySource).toContain('"/api/fred/clear-cache"');
  });
});

// ── engine.ts — no localhost self-call ───────────────────────────────────────

describe("pressure engine — no localhost HTTP self-call", () => {
  const engineSource = source("server/pressure/engine.ts");

  it("imports fetchFredBulk from fredClient directly", () => {
    expect(engineSource).toContain("from \"../fredClient\"");
    expect(engineSource).toContain("fetchFredBulk");
  });

  it("does not contain localhost self-call", () => {
    expect(engineSource).not.toContain("localhost:3000");
    expect(engineSource).not.toContain("127.0.0.1:3000");
    expect(engineSource).not.toContain("/api/fred/bulk");
  });

  it("does not contain fredBaseUrl parameter (removed)", () => {
    expect(engineSource).not.toContain("fredBaseUrl");
  });

  it("includes server-level snapshot cache for stale-snapshot recovery", () => {
    expect(engineSource).toContain("_lastLiveSnapshot");
    expect(engineSource).toContain("SNAPSHOT_STALE_MS");
  });

  it("preserves live snapshot and serves it during FRED outages", () => {
    expect(engineSource).toContain("dataSource === \"live\"");
    expect(engineSource).toContain("_lastLiveSnapshot = result");
    expect(engineSource).toContain("serving preserved snapshot");
  });

  it("includes priorPressure field in FaultlinePressureOutput type", () => {
    expect(engineSource).toContain("priorPressure");
    expect(engineSource).toContain("number | null");
  });
});

// ── routers.ts — prior pressure DB lookup ────────────────────────────────────

describe("routers.ts — getCurrentPressure attaches prior pressure from DB", () => {
  const routerSource = source("server/routers.ts");

  it("fetches the most recent prior run before inserting the new one", () => {
    expect(routerSource).toContain("getRecentPressureRuns(1)");
    expect(routerSource).toContain("result.priorPressure");
  });

  it("uses the prior run's overallPressure as the reference point", () => {
    expect(routerSource).toContain("priorRuns[0].overallPressure");
  });
});

// ── seismographAdapters — fallback confidence degradation ────────────────────

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

// ── App.tsx — FREDDebugConsole admin gate ─────────────────────────────────────

describe("App.tsx — FREDDebugConsole admin gate", () => {
  const appSource = source("client/src/App.tsx");

  it("gates FREDDebugConsole behind admin role check", () => {
    expect(appSource).toContain("user?.role === 'admin'");
    expect(appSource).toContain("FREDDebugConsole");
  });

  it("does not render FREDDebugConsole unconditionally", () => {
    const adminGatePattern = /user\?\.role\s*===\s*['"]admin['"]\s*&&\s*<FREDDebugConsole/;
    expect(adminGatePattern.test(appSource)).toBe(true);
  });
});

// ── Now.tsx — Pressure Index instrument strengthening ────────────────────────

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

  it("uses true prior reading from DB when available", () => {
    expect(nowSource).toContain("serverPressure?.priorPressure");
    expect(nowSource).toContain("serverPressure.overallPressure - serverPressure.priorPressure");
  });

  it("falls back to delta-vs-baseline when no DB prior exists", () => {
    expect(nowSource).toContain("output.overall.delta * 10");
  });

  it("includes sensor-pulse keyframe animation", () => {
    expect(nowSource).toContain("sensor-pulse");
  });
});
