import { readFileSync } from "node:fs";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SystemicRegimeModule from "../client/src/components/SystemicRegimeModule";
import AppMarketHeader from "../client/src/components/AppMarketHeader";
import { signalsFeedLabel, signalsSubtitle, signalsFooter } from "../client/src/lib/signalQuoteView";
import { formatModelScorePct, headerRegimeChip, regimeModelScoreDisplay, REGIME_MODEL_SCORE_LABEL } from "../shared/credibilityLabels";
import { deriveProviderProvenance } from "./seismographCore";
import { buildAtomicIntelligenceStateManifest } from "./intelligenceGovernance";
import { buildSubScores, RECONSTRUCTED_RECORD_CLASS } from "./seismographBackfill";

// Server-side vitest uses the classic JSX runtime; the app bundle injects React.
(globalThis as any).React = React;

const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// Live production reading captured Oct 1 2026 (systemicRegime.current).
const reading = {
  systemicRiskScore: 1,
  crisisProbability: 0.0036,
  stressBuildingProbability: 0,
  transitionProbability: 0.03,
  currentRegime: "NORMAL",
  regimeConfidence: 0.996398,
  creditStressZ: -0.5, volStressZ: -0.3, ratesStressZ: 0.1, pc1: -0.9,
  factorArrows: { credit: "down", vol: "flat", rates: "up" },
  modelVersion: "sre-hmm2-v1.0.0",
  modelType: "gaussian-hmm-2state",
  pcaMethod: "standard_scaler_pca",
  nStates: 2,
  dataAsOf: "2026-09-30",
  computedAt: "2026-10-01T19:00:55.000Z",
  freshnessStatus: "CURRENT",
  historyClass: "live_verified",
  contributesToPressureIndex: false,
} as any;

describe("1a NOW systemic regime score label", () => {
  it("formats the HMM posterior to one decimal and never rounds up to 100%", () => {
    expect(formatModelScorePct(0.996398)).toBe("99.6%");
    expect(formatModelScorePct(0.99996)).toBe(">99.9%");
    expect(formatModelScorePct(1)).toBe(">99.9%");
    expect(formatModelScorePct(0.00001)).toBe("<0.1%");
    expect(formatModelScorePct(null)).toBe("—");
    expect(formatModelScorePct(Number.NaN)).toBe("—");
  });

  it("labels it an uncalibrated model score with an as-of time, not confidence or accuracy", () => {
    const d = regimeModelScoreDisplay(reading, false);
    expect(d.label).toBe("Model score (uncalibrated)");
    // Probability contract: uncalibrated (ECE 0.5152) → no number.
    expect(d.value).toBe("Uncalibrated");
    expect(d.asOf).toBe("data through 2026-09-30 · computed Oct 1, 3:00 PM ET");
    expect(d.explanation).toMatch(/not calibrated/);
    expect(d.explanation).toMatch(/not a forecast or a measure of accuracy/);
    expect(regimeModelScoreDisplay(null, true).value).toBe("—");
  });

  it("renders the Model score as Uncalibrated (probability contract, ECE 0.5152) instead of CONFIDENCE 100%", () => {
    const html = renderToStaticMarkup(createElement(SystemicRegimeModule, { reading, convergence: null }));
    expect(html).toContain("Model score");
    expect(html).toContain("uncalibrated");
    expect(html).toContain("Uncalibrated");
    expect(html).not.toContain("99.6%");
    expect(html).not.toMatch(/>\d+(\.\d+)?%</);
    expect(html).toContain(REGIME_MODEL_SCORE_LABEL);
    expect(html).toContain("computed Oct 1, 3:00 PM ET");
    expect(html).not.toContain(">100%<");
    expect(html).not.toMatch(/>Confidence</);
  });

  it("shows an unavailable state without a score", () => {
    const html = renderToStaticMarkup(createElement(SystemicRegimeModule, { reading: { ...reading, freshnessStatus: "UNAVAILABLE" }, convergence: null }));
    expect(html).toContain("UNAVAILABLE");
    expect(html).not.toContain("99.6%");
  });
});

describe("1b header EQ/BTC regime chips", () => {
  const intelligence = {
    stockRegime: { regime: "Expansion", confidence: 53, fetchedAt: Date.parse("2026-10-02T08:14:28.443Z") },
    cryptoRegime: { regime: "Expansion", confidence: 65, fetchedAt: Date.parse("2026-10-02T08:14:28.578Z") },
    alignmentStatus: "Strongly Aligned — Risk On",
    alignmentScore: 90,
  };

  it("suppresses the heuristic percentages and states what each label is", () => {
    const html = renderToStaticMarkup(createElement(AppMarketHeader, { items: [], isMobile: false, intelligence }));
    expect(html).not.toContain("53%");
    expect(html).not.toContain("65%");
    expect(html).toContain("RULE-BASED");
    expect(html).toContain("MACRO-IMPLIED");
    expect(html).toContain("Computed Oct 2, 4:14 AM ET");
    expect(html).toContain("no BTC price input");
  });

  it("shows UNAVAILABLE honestly", () => {
    expect(headerRegimeChip("BTC", { regime: "UNAVAILABLE", confidence: 0 })).toMatchObject({ regime: "UNAVAILABLE", tag: "" });
    expect(headerRegimeChip("EQ", null).regime).toBe("UNAVAILABLE");
    const html = renderToStaticMarkup(createElement(AppMarketHeader, { items: [], isMobile: false, intelligence: { cryptoRegime: { regime: "UNAVAILABLE", confidence: 0 } } }));
    expect(html).toContain("UNAVAILABLE");
    expect(html).not.toContain("0%");
  });
});

describe("1c Signals subtitle follows the quote feed label", () => {
  const closed = { ticker: "AAPL", price: 200, changePercent: 1, isLive: false, marketStatus: "closed" } as any;
  const open = { ...closed, isLive: true, marketStatus: "open" } as any;

  it("never says live prices unless a quote is live in an open session", () => {
    const lastClose = signalsFeedLabel({ source: "live", quotes: [closed], tickerCount: 41 });
    expect(signalsSubtitle(lastClose)).toContain("last-close prices (not live)");
    expect(signalsSubtitle(lastClose)).not.toMatch(/live prices/);
    expect(signalsSubtitle(signalsFeedLabel({ source: "live", quotes: [open], tickerCount: 41 }))).toContain("live intraday prices (market open)");
    expect(signalsSubtitle(signalsFeedLabel({ source: "live", quotes: [{ ...closed, marketStatus: "pre" }], tickerCount: 41 }))).toContain("delayed prices (not live)");
    expect(signalsSubtitle(signalsFeedLabel({ source: "stale", quotes: [closed], tickerCount: 41 }))).toContain("stale cached prices");
    expect(signalsSubtitle(signalsFeedLabel({ source: "fallback", quotes: [], tickerCount: 41 }))).toContain("prices currently unavailable");
    expect(signalsSubtitle(null, { loading: true })).toContain("checking quote freshness");
  });

  it("subtitle and footer read the same feed label; the hard-coded copy is gone", () => {
    const feed = signalsFeedLabel({ source: "live", quotes: [closed], tickerCount: 41 });
    expect(signalsFooter(feed).title).toBe("LAST CLOSE");
    const page = src("../client/src/pages/Signals.tsx");
    expect(page).not.toContain("live prices, trading signals");
    expect(page).toContain("subtitle={subtitle}");
    expect(page).toMatch(/signalsSubtitle\(feedLabel/);
    expect(page).toMatch(/signalsFooter\(feedLabel\)/);
  });
});

describe("1d FRED provenance copy", () => {
  it("does not call FRED observations Live", () => {
    const detail = deriveProviderProvenance([{ source: "pressure-engine", metadata: { dataSource: "live" }, timestamp: 1 } as any]).fred?.detail ?? "";
    expect(detail).not.toMatch(/^Live/);
    expect(detail).toContain("FRED macro and credit observations");
  });
});

describe("2 forward-evidence manifest provenance", () => {
  const pressure = {
    overallPressure: 33, regime: "MODERATE RISK", level: "Moderate",
    timestamp: "2026-10-01T18:00:00.000Z", lastUpdated: "2026-10-01T18:00:00.000Z",
    dataSource: "live", priorPressure: null, alerts: [], analogs: [],
    topAnalog: { year: 2018, label: "Reference", similarity: 54, description: "reference" },
    vectors: [
      { id: "credit-contagion", score: 20, trend: "stable", weight: 0.5, rawInputs: { hySpread: 300 }, dataStatus: "live", source: "FRED", label: "Credit", description: "", level: "Low", driver: "" },
      { id: "macro-sensitivity", score: 25, trend: "stable", weight: 0.5, rawInputs: { cpi: 2 }, dataStatus: "delayed", source: "FRED", label: "Macro", description: "", level: "Moderate", driver: "" },
    ],
  } as any;
  const args = { pressure, seismograph: null, originatingRunId: "seismograph:test", generatedAt: "2026-10-01T18:00:34.034Z", persistedHooks: { systemicRegime: reading } };

  it("records run identity, code + methodology versions and record class without changing state identity", () => {
    const base = buildAtomicIntelligenceStateManifest(args);
    const withCode = buildAtomicIntelligenceStateManifest({ ...args, codeVersion: "ce491b3ddfb1ecf9524aadddc9c8cf2ee1785245" });
    expect(withCode.manifest.stateHash).toBe(base.manifest.stateHash);
    expect(withCode.manifest.stateId).toBe(base.manifest.stateId);
    expect(withCode.runProvenance).toMatchObject({
      recordClass: "LIVE_FORWARD_RECORD",
      recordedAt: "2026-10-01T18:00:34.034Z",
      originatingRunId: "seismograph:test",
      codeVersion: "ce491b3ddfb1ecf9524aadddc9c8cf2ee1785245",
      inputSnapshotId: base.manifest.inputSnapshotId,
      inputObservationDatesCaptured: false,
      writePolicy: "APPEND_ONLY_INSERT_IF_ABSENT",
      correctionOf: null,
      methodology: { systemicRegimeModelVersion: "sre-hmm2-v1.0.0", systemicRegimeModelType: "gaussian-hmm-2state", systemicRegimeDataAsOf: "2026-09-30", scoringVersion: "faultline-pressure-v1-frozen" },
    });
    expect(base.runProvenance.codeVersion).toBeNull();
  });

  it("marks corrections as separate records that point at the original", () => {
    const corr = buildAtomicIntelligenceStateManifest({ ...args, generatedAt: "2026-10-01T20:00:00.000Z", originatingRunId: "seismograph:corr", correctionOf: { stateId: "state:orig", reason: "provider revision" } });
    expect(corr.runProvenance.recordClass).toBe("LIVE_FORWARD_CORRECTION");
    expect(corr.runProvenance.correctionOf).toEqual({ stateId: "state:orig", reason: "provider revision" });
  });

  it("persists runProvenance inside the existing manifestJson column, insert-only", async () => {
    vi.resetModules();
    const inserted: any[] = [];
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: async (v: any) => { inserted.push(v); } }),
      update: () => { throw new Error("manifests must never be updated"); },
    };
    vi.doMock("./db", () => ({ getDb: async () => db }));
    const gov = await import("./intelligenceGovernance");
    const result = gov.buildAtomicIntelligenceStateManifest({ ...args, codeVersion: "abc123" });
    await gov.persistAtomicIntelligenceStateManifest(result);
    const json = JSON.parse(inserted[0].manifestJson);
    expect(json.runProvenance.codeVersion).toBe("abc123");
    expect(json.inputQuality.length).toBeGreaterThan(0);
    expect(inserted[0].manifestJson.length).toBeLessThan(65_535);
    vi.doUnmock("./db");
  });

  it("the scheduled run passes the build commit", () => {
    expect(src("./scheduledSeismograph.ts")).toMatch(/codeVersion: \(\(\) => \{ try \{ return resolveBuildIdentity\(\)\.commit/);
  });
});

describe("2 backfill reconstructions are never presented as readings made at the time", () => {
  it("omits missing domains instead of synthesising them and tags the record class", () => {
    const sub = buildSubScores({ month: "2008-09", overallPressure: 80, regime: "CRISIS", liquidityStress: 70, creditContagion: null, volatilityRegime: null, macroSensitivity: null, marketBreadth: null, aiBubble: null });
    expect(sub).toEqual({ recordClass: RECONSTRUCTED_RECORD_CLASS, liquidity: 70 });
  });

  it("writes no retrospective probabilities, never overwrites originals, and is excluded from live history", () => {
    const backfill = src("./seismographBackfill.ts");
    expect(backfill).not.toMatch(/overallPressure \* 0\.\d+/);
    expect(backfill).not.toContain("deriveProbabilities");
    expect(backfill).toMatch(/bullProbability: null/);
    expect(backfill).toMatch(/crashProbability: null/);
    expect(backfill).toContain("readingDate: sql`readingDate`");
    expect(backfill).toContain("Reconstructed from monthly pressure history (not detected at the time)");
    const router = src("./routers/seismograph.ts");
    expect(router).toMatch(/notLike\(seismographReadings\.subScoresJson, `%\$\{RECONSTRUCTED_RECORD_CLASS\}%`\)/);
  });
});
