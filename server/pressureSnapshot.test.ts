import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import { CHAMPION_REGIME_THRESHOLDS } from "./pressure/championBaseline";
import { classifyRegimeLabel } from "./fmos/utils";
import {
  PRESSURE_BANDS,
  formatPressureAsOf,
  pressureBandFor,
  pressureRingFraction,
  selectPressureSnapshot,
} from "../client/src/lib/pressureSnapshot";
import { PressureBandLegend, PressureSnapshotGauge } from "../client/src/components/PressureSnapshotGauge";

function source(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");
}

function canonicalState(overrides: Partial<PublicCanonicalIntelligenceState> = {}): PublicCanonicalIntelligenceState {
  return {
    schemaVersion: "phase2-canonical-state-v1",
    stateId: "state:2026-09-29T18:02:38.264Z:98a6912f6180a3a0",
    generatedAt: "2026-09-29T18:02:38.264Z",
    effectiveAt: "2026-09-29T18:02:38.264Z",
    calculationStartedAt: null,
    calculationCompletedAt: "2026-09-29T18:02:38.264Z",
    championVersion: "champion-v1-frozen",
    modelVersion: "2.0",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1",
    inputSnapshotId: "input:test",
    stateHash: "98a6912f6180a3a0",
    regime: "MODERATE RISK",
    pressureIndex: 28,
    pressureLevel: "MODERATE RISK",
    pressureDirection: "Stable",
    pressureAcceleration: null,
    pressurePersistence: null,
    engines: [],
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: { canonicalLiveHistory: "", reconstructedResearch: "", historicalAnalogOutput: "", patternResolution: "" },
    dataQualitySummary: { status: "PARTIAL", staleInputCount: 0, delayedInputCount: 0, unavailableInputCount: 0, fallbackInputCount: 0 },
    confidenceOrEvidenceQuality: "PARTIAL",
    staleInputs: [],
    delayedInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    warnings: [],
    conflicts: [],
    historicalDatasetVersion: "h",
    researchDatasetVersion: "r",
    provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "g", coherenceStatus: "MIXED_FRESHNESS" },
    ...overrides,
  };
}

describe("pressure bands come from the engine thresholds", () => {
  it("uses 25 / 45 / 65 / 80 lower bounds with the engine regime labels", () => {
    expect(PRESSURE_BANDS.map(b => [b.min, b.regime, b.range])).toEqual([
      [0, "LOW RISK", "<25"],
      [25, "MODERATE RISK", "25–44"],
      [45, "ELEVATED RISK", "45–64"],
      [65, "HIGH STRESS", "65–79"],
      [80, "SYSTEMIC CRISIS", "80+"],
    ]);
    expect(PRESSURE_BANDS.map(b => b.label)).toEqual(["LOW", "MODERATE", "ELEVATED", "HIGH STRESS", "SYSTEMIC CRISIS"]);
  });

  it("agrees with the engine regime classifier at every integer score", () => {
    for (let score = 0; score <= 100; score++) {
      expect(pressureBandFor(score).regime, `score ${score}`).toBe(classifyRegimeLabel(score));
    }
    expect(pressureBandFor(24.9).regime).toBe("LOW RISK");
  });

  it("reads the same thresholds the pressure engine classifier hard-codes", () => {
    const engine = source("server/pressure/engine.ts");
    for (const { minimum, regime } of CHAMPION_REGIME_THRESHOLDS) {
      if (minimum === 0) continue;
      expect(engine).toContain(`if (pressure >= ${minimum}) return { regime: "${regime}"`);
    }
  });
});

describe("selectPressureSnapshot", () => {
  it("takes ring, number, band, regime, timestamp and interpretation from one state object", () => {
    const state = canonicalState();
    const view = selectPressureSnapshot({ data: state, isLoading: false });
    expect(view.status).toBe("ready");
    if (view.status !== "ready") return;
    expect(view.state).toBe(state);
    expect(view.score).toBe(28);
    expect(view.displayScore).toBe(28);
    expect(pressureRingFraction(view)).toBeCloseTo(0.28);
    expect(view.band.regime).toBe("MODERATE RISK");
    expect(view.regime).toBe("MODERATE RISK");
    expect(view.regimeMatchesBand).toBe(true);
    expect(view.interpretation).toBe(view.band.interpretation);
    expect(view.provenance).toEqual({
      stateId: state.stateId,
      stateHash: state.stateHash,
      asOf: state.effectiveAt,
      generatedAt: state.generatedAt,
      coherenceStatus: "MIXED_FRESHNESS",
      evidenceQuality: "PARTIAL",
    });
    expect(view.refreshFailed).toBe(false);
  });

  it("uses the score's band (not the old 30/50/75 cut-offs) at 28", () => {
    const view = selectPressureSnapshot({ data: canonicalState({ pressureIndex: 28 }), isLoading: false });
    if (view.status !== "ready") throw new Error("expected ready");
    expect(view.band.label).toBe("MODERATE");
    expect(view.interpretation).toMatch(/^Moderate pressure/);
  });

  it("flags a published regime that disagrees with the score band instead of hiding it", () => {
    const view = selectPressureSnapshot({ data: canonicalState({ pressureIndex: 28, regime: "LOW RISK" }), isLoading: false });
    if (view.status !== "ready") throw new Error("expected ready");
    expect(view.regime).toBe("LOW RISK");
    expect(view.band.regime).toBe("MODERATE RISK");
    expect(view.regimeMatchesBand).toBe(false);
  });

  it("keeps the last good snapshot when a background refresh fails, with the failure flagged", () => {
    const view = selectPressureSnapshot({ data: canonicalState(), isLoading: false, error: new Error("network") });
    expect(view.status).toBe("ready");
    if (view.status === "ready") expect(view.refreshFailed).toBe(true);
  });

  it("returns loading, never a 0 score, while the query has no data", () => {
    const view = selectPressureSnapshot({ data: undefined, isLoading: true });
    expect(view).toEqual({ status: "loading" });
    expect(pressureRingFraction(view)).toBeNull();
  });

  it.each([
    ["no state published", { data: null, isLoading: false }, "NO_STATE"],
    ["query error with no data", { data: undefined, isLoading: false, error: new Error("x") }, "QUERY_ERROR"],
    ["withheld evidence", { data: canonicalState({ confidenceOrEvidenceQuality: "UNAVAILABLE" }), isLoading: false }, "WITHHELD"],
    ["null score", { data: canonicalState({ pressureIndex: null }), isLoading: false }, "INVALID_SCORE"],
    ["NaN score", { data: canonicalState({ pressureIndex: Number.NaN }), isLoading: false }, "INVALID_SCORE"],
    ["out-of-range score", { data: canonicalState({ pressureIndex: 140 }), isLoading: false }, "INVALID_SCORE"],
  ] as const)("maps %s to unavailable (%s)", (_label, query, reason) => {
    const view = selectPressureSnapshot(query as Parameters<typeof selectPressureSnapshot>[0]);
    expect(view.status).toBe("unavailable");
    if (view.status === "unavailable") expect(view.reason).toBe(reason);
    expect(pressureRingFraction(view)).toBeNull();
  });

  it("keeps provenance on a withheld state so the timestamp is not lost", () => {
    const view = selectPressureSnapshot({ data: canonicalState({ pressureIndex: null }), isLoading: false });
    if (view.status !== "unavailable") throw new Error("expected unavailable");
    expect(view.provenance?.stateId).toBe("state:2026-09-29T18:02:38.264Z:98a6912f6180a3a0");
  });

  it("formats the as-of timestamp with an explicit UTC label", () => {
    expect(formatPressureAsOf("2026-09-29T18:02:38.264Z")).toBe("2026-09-29 18:02 UTC");
    expect(formatPressureAsOf(null)).toBeNull();
    expect(formatPressureAsOf("not a date")).toBeNull();
  });
});

describe("PressureSnapshotGauge rendering", () => {
  const CIRCUMFERENCE = 2 * Math.PI * 52;

  it("renders the ring at the snapshot score on first paint, matching the number and regime", () => {
    const view = selectPressureSnapshot({ data: canonicalState({ pressureIndex: 28 }), isLoading: false });
    const html = renderToStaticMarkup(createElement(PressureSnapshotGauge, { snapshot: view }));
    const offsets = [...html.matchAll(/stroke-dashoffset="([\d.]+)"/g)].map(m => Number(m[1]));
    expect(offsets).toHaveLength(1);
    expect(offsets[0]).toBeCloseTo(CIRCUMFERENCE * (1 - 0.28), 3);
    expect(html).toContain('aria-valuenow="28"');
    expect(html).toContain('data-pressure-score="28"');
    expect(html).toContain(">28</div>");
    expect(html).toContain("MODERATE RISK");
    expect(html).toContain("AS OF 2026-09-29 18:02 UTC");
    expect(html).toContain('data-pressure-state-id="state:2026-09-29T18:02:38.264Z:98a6912f6180a3a0"');
  });

  it("renders an explicit unavailable state with no progress arc and no 0", () => {
    const view = selectPressureSnapshot({ data: null, isLoading: false });
    const html = renderToStaticMarkup(createElement(PressureSnapshotGauge, { snapshot: view }));
    expect(html).toContain("DATA UNAVAILABLE");
    expect(html).toContain('data-pressure-snapshot-state="unavailable"');
    expect(html).not.toContain("stroke-dashoffset");
    expect(html).not.toMatch(/>0<\/div>/);
    expect(html).not.toContain("aria-valuenow");
  });

  it("renders an explicit loading state with no progress arc and no 0", () => {
    const html = renderToStaticMarkup(createElement(PressureSnapshotGauge, { snapshot: { status: "loading" } }));
    expect(html).toContain("LOADING SNAPSHOT");
    expect(html).not.toContain("stroke-dashoffset");
    expect(html).not.toMatch(/>0<\/div>/);
  });

  it("legend lists the engine bands and marks the snapshot's band", () => {
    const view = selectPressureSnapshot({ data: canonicalState({ pressureIndex: 28 }), isLoading: false });
    const html = renderToStaticMarkup(createElement(PressureBandLegend, { snapshot: view }));
    for (const band of PRESSURE_BANDS) expect(html).toContain(band.range.replace("<", "&lt;"));
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*>[^]*?MODERATE</);
  });
});

describe("public Pressure Index page binding", () => {
  const page = source("client/src/pages/PressureIndex.tsx");
  const hook = source("client/src/hooks/usePressureSnapshot.ts");

  it("reads a single snapshot through usePressureSnapshot (canonicalCurrent)", () => {
    expect(page).toContain("usePressureSnapshot()");
    expect(page).not.toContain("canonicalCurrent.useQuery");
    expect(hook).toContain("trpc.marketState.canonicalCurrent.useQuery");
  });

  it("has no animate-from-0 gauge state or hard-coded legend cut-offs", () => {
    expect(page).not.toMatch(/useState\(0\)[^]*strokeDashoffset/);
    expect(page).not.toContain("AnimatedNumber");
    expect(page).not.toContain('"0–30"');
    expect(page).not.toContain("score >= 75");
    expect(page).toContain("<PressureSnapshotGauge snapshot={snapshot} />");
    expect(page).toContain("<PressureBandLegend snapshot={snapshot} />");
  });
});
