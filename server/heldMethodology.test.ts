/* HELD methodology changes (probability/held-methodology-2026-10-02).
   Not in PR #60: each changes a calculated output and needs owner approval.
   See /workspace/probability/HELD_CHANGES.md. */
import { describe, expect, it } from "vitest";
import { SEISMOGRAPH_EVIDENCE_VOTE_V2_SEISMOGRAPH_VERSION, scenarioModelForSeismographVersion } from "../shared/probabilityContract";
import { computeSimilarity, normalizeSubScore, buildEvidenceFamilies, type HistoricalMonth } from "./seismographUnified";
import { fmosToEvidencePackets } from "./seismographAdapters";

describe("evidence-vote v2 versioning (seismograph-core 2.1)", () => {
  it("2.1 manifests resolve to evidence-vote v2; older manifests keep v1", () => {
    expect(scenarioModelForSeismographVersion("2.0").modelVersion).toBe("seismograph-evidence-vote-v1");
    expect(scenarioModelForSeismographVersion(SEISMOGRAPH_EVIDENCE_VOTE_V2_SEISMOGRAPH_VERSION).modelVersion).toBe("seismograph-evidence-vote-v2");
  });
});

describe("historical-analog packet (evidence-vote v2 defect fix)", () => {
  it("never votes bear from similarity", () => {
    const output = {
      regime: { pressureLevel: "Low", currentRegime: "Calm", confidence: 70, description: "d" },
      confidence: { score: 60 },
      probability: { bull: 60, neutral: 30, bear: 10, confidence: 50, primaryDriver: "x", bullEvidence: [], bearEvidence: [] },
      analogs: [{ label: "Fed Pivot Rally", similarity: 91, period: "2019-07" }],
      transition: null,
    };
    const packets = fmosToEvidencePackets(output as never);
    const analog = packets.find(p => p.evidenceType === "historical_analog");
    expect(analog?.signal).toBe("neutral");
  });
});

describe("missing sub-scores are null, never a neutral 50", () => {
  const month = (overrides: Partial<HistoricalMonth>): HistoricalMonth => ({
    month: "2026-09", score: 40, regime: "MODERATE RISK", liquidity: 40, credit: 40, volatility: 40, macro: 40, breadth: 40, aiBubble: 40,
    baaSpread: null, hySpread: null, tsy10y: null, tsy2y: null, fedfunds: null, cpiYoy: null, unemployment: null, sp500: null,
    ...overrides,
  });

  it("normalizeSubScore fails closed", () => {
    expect(normalizeSubScore(0)).toBeNull();
    expect(normalizeSubScore(undefined)).toBeNull();
    expect(normalizeSubScore(Number.NaN)).toBeNull();
    expect(normalizeSubScore(37)).toBe(37);
  });

  it("two months with all sub-scores missing are not a perfect sub-score match", () => {
    const empty = { liquidity: null, credit: null, volatility: null, macro: null, breadth: null };
    expect(computeSimilarity(month(empty), month(empty))).toBe(Math.round(100 * 0.4 + 0 * 0.4 + 70 * 0.2));
    expect(computeSimilarity(month({}), month({}))).toBe(100 * 0.4 + 100 * 0.4 + 70 * 0.2);
  });

  it("omits an evidence family whose current sub-score is missing", () => {
    const latest = month({ credit: null });
    const names = buildEvidenceFamilies(latest, [latest]).map(f => f.name);
    expect(names).not.toContain("Credit Markets");
    expect(names).toContain("Liquidity Conditions");
  });
});

