/**
 * SIGNALS information-hierarchy / evidence-state UX (display only).
 * Guards: movers above preflight; explicit preflight score labeling;
 * DELAYED integrity detail; signal engines untouched.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const signalsMode = read("client/src/components/dashboard/SignalsMode.tsx");
const marketPreflight = read("client/src/components/MarketPreflight.tsx");
const dataIntegrity = read("client/src/components/DataIntegrity.tsx");
const dashboard = read("client/src/pages/Dashboard.tsx");

describe("SIGNALS information hierarchy (Crypto / Stocks / Rotation)", () => {
  it("root JSX orders movers → integrity → preflight secondary", () => {
    const rootJsx = signalsMode.slice(signalsMode.indexOf("export default function SignalsMode"));
    const movers = rootJsx.indexOf("<CryptoSignalGrid");
    const integrity = rootJsx.indexOf('data-signals-hierarchy="integrity"');
    const preflight = rootJsx.indexOf("<SignalsPreflightSecondary");
    expect(movers).toBeGreaterThan(0);
    expect(integrity).toBeGreaterThan(movers);
    expect(preflight).toBeGreaterThan(integrity);
  });

  it("covers Crypto, Stocks, and Rotation tabs with hierarchy markers", () => {
    expect(signalsMode).toContain('data-signals-tab="crypto"');
    expect(signalsMode).toContain('data-signals-tab="stocks"');
    expect(signalsMode).toContain('data-signals-tab="rotation"');
    expect(signalsMode).toContain("CATALYST UNCLEAR");
    expect(signalsMode).toContain("data-signals-field=\"direction\"");
    expect(signalsMode).toContain("data-signals-field=\"pct-move\"");
    expect(signalsMode).toContain("data-signals-field=\"turnover\"");
    expect(signalsMode).toContain("TURNOVER {turnover");
    expect(signalsMode).toContain("(VOL/MCAP)");
    expect(signalsMode).toContain("data-signals-field=\"momentum\"");
    expect(signalsMode).toContain("data-signals-field=\"freshness\"");
  });

  it("never calls Vol/MCap 'relative volume' and has no per-row 'Watch next' prompt", () => {
    expect(signalsMode).not.toMatch(/REL VOL|RVOL|relative-volume|relativeVolume/);
    expect(signalsMode).not.toMatch(/Watch next:|watch-next/);
  });

  it("does not blank the entire SignalsMode on missing canonical state", () => {
    // Regression: early `if (!canonicalState) return null` hid movers and let Pre-Flight dominate.
    expect(signalsMode).not.toMatch(/if\s*\(\s*!canonicalState\s*\)\s*return\s+null/);
  });

  it("keeps Pre-Flight as compact secondary inside SignalsMode", () => {
    expect(signalsMode).toContain('variant="compact"');
    expect(signalsMode).toContain("SignalsPreflightSecondary");
    expect(signalsMode).toContain('variant="signals"'); // DataIntegrity compact signals variant
  });

  it("Dashboard does not re-mount large awareness / preflight entry in signals mode", () => {
    expect(dashboard).toContain('dashMode !== "signals"');
    expect(dashboard).toContain("Signals mode owns compact integrity");
  });
});

describe("Pre-Flight score labeling (never Pressure Index)", () => {
  it("labels the gauge as PRE-FLIGHT COMPLETION / MARKET AWARENESS CHECK", () => {
    expect(marketPreflight).toContain("PRE-FLIGHT COMPLETION ·");
    expect(marketPreflight).toContain("MARKET AWARENESS CHECK ·");
    expect(marketPreflight).toContain("PRE-FLIGHT /100");
    expect(marketPreflight).toContain("not Pressure Index");
    expect(marketPreflight).toContain('data-preflight-score-label={completionLabel}');
  });

  it("ScoreRing aria-label identifies Pre-Flight Completion, not market intelligence", () => {
    expect(marketPreflight).toContain("Pre-Flight Completion ${score} of 100");
    expect(marketPreflight).toContain('data-preflight-score-ring="true"');
  });
});

describe("Data integrity DELAYED / STALE / UNAVAILABLE detail", () => {
  it("always surfaces age and degraded usability detail", () => {
    expect(dataIntegrity).toContain("data-integrity-age=");
    expect(dataIntegrity).toContain("data-integrity-affected-feeds");
    expect(dataIntegrity).toContain("data-integrity-last-obs");
    expect(dataIntegrity).toContain("data-integrity-withheld");
    expect(dataIntegrity).toContain("data-integrity-usability=");
    expect(dataIntegrity).toContain("Never presents stale as current");
    expect(dataIntegrity).toMatch(/LIVE \/ DELAYED \/ STALE \/ UNAVAILABLE/);
    // Age must not be gated on isLive only
    expect(dataIntegrity).not.toMatch(/freshness !== null && isLive &&/);
  });

  it("does not count feeds from the always-empty client rawFred map (false 0/10)", () => {
    expect(dataIntegrity).not.toMatch(/rawFred\[/);
    expect(dataIntegrity).not.toContain("FRED_FEEDS");
    expect(dataIntegrity).toContain("canonicalInputRows");
    expect(dataIntegrity).toContain("not reported to this view");
  });
});

describe("Signal calculation / methodology untouched", () => {
  const engineFiles = [
    "server/cryptoSignals.ts",
    "server/cryptoEngine.ts",
    "server/tradingSignals.ts",
    "server/signalOutlook.ts",
    "server/preFlight.ts",
    "server/tradePreflight.ts",
  ];

  it("engine-diff is empty against branch base for signal engines", () => {
    const base = "1cfa1299f6644a7eb9a60246330c7b9a13ccc433";
    for (const file of engineFiles) {
      const diff = execSync(`git diff -- ${file}`, { cwd: root, encoding: "utf8" });
      expect(diff, `${file} must be unchanged`).toBe("");
    }
    // Also confirm vs explicit base (uncommitted + committed)
    const named = execSync(`git diff ${base} -- ${engineFiles.join(" ")}`, { cwd: root, encoding: "utf8" });
    expect(named.trim()).toBe("");
  });
});

describe("canonicalInputRows reads fields already in the canonical payload", async () => {
  const { canonicalInputRows } = await import("../client/src/components/DataIntegrity");
  const prod = JSON.parse(read("server/__fixtures__/prod-2026-10-01/canonical-current.json"));

  it("prod fixture: 9 inputs from engines[].sourceInputIds, 5 delayed, 1 static, 3 current", () => {
    const rows = canonicalInputRows(prod)!;
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(9);
    expect(rows.filter(r => r.state === "DELAYED").map(r => r.id).sort()).toEqual([...prod.delayedInputs].sort());
    expect(rows.filter(r => r.state === "STATIC").map(r => r.id)).toEqual(["ai_concentration_static_baseline"]);
    expect(rows.filter(r => r.state === "CURRENT").length).toBe(3);
  });

  it("returns null (not reported) when the snapshot lists no inputs", () => {
    expect(canonicalInputRows(null)).toBeNull();
    expect(canonicalInputRows({ engines: [], delayedInputs: [], staleInputs: [], unavailableInputs: [], fallbackInputs: [] })).toBeNull();
  });

  it("precedence UNAVAILABLE > STALE > FALLBACK > DELAYED", () => {
    const rows = canonicalInputRows({ engines: [{ sourceInputIds: ["a", "b", "c", "d"] }], unavailableInputs: ["a"], staleInputs: ["a", "b"], fallbackInputs: ["b", "c"], delayedInputs: ["c", "d"] })!;
    expect(Object.fromEntries(rows.map(r => [r.id, r.state]))).toEqual({ a: "UNAVAILABLE", b: "STALE", c: "FALLBACK", d: "DELAYED" });
  });
});
