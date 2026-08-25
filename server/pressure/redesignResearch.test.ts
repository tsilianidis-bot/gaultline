import { describe, expect, it } from "vitest";
import {
  REDESIGN_EVALUATION_GATES,
  RESEARCH_INDICATOR_SPECS,
  canPromoteResearchCandidate,
  countConfirmedClusters,
  scoreCompleteResearchFeature,
} from "./redesignResearch";

describe("Champion redesign research contract", () => {
  it("keeps candidate cluster specifications explicitly source-bound and non-production", () => {
    expect(RESEARCH_INDICATOR_SPECS.some(spec => spec.currentAvailability === "requires_new_source")).toBe(true);
    expect(RESEARCH_INDICATOR_SPECS.filter(spec => spec.id === "hy_spread")).toHaveLength(1);
  });

  it("refuses to score incomplete indicator feature states", () => {
    expect(scoreCompleteResearchFeature({ level: 50, direction: 50, velocity: 50, acceleration: null, persistence: 50, historicalPercentile: 50, sourceComplete: true })).toBeNull();
    expect(scoreCompleteResearchFeature({ level: 50, direction: 50, velocity: 50, acceleration: 50, persistence: 50, historicalPercentile: 50, sourceComplete: true })).toBe(50);
  });

  it("counts confirmation breadth without assigning an amplification formula", () => {
    expect(countConfirmedClusters({ credit: 72, liquidity: 70, volatility: 45 }, 65)).toBe(2);
  });

  it("blocks promotion unless every required research gate passes", () => {
    expect(canPromoteResearchCandidate({ champion_reproducibility: true })).toBe(false);
    const complete = Object.fromEntries(REDESIGN_EVALUATION_GATES.map(gate => [gate.name, true]));
    expect(canPromoteResearchCandidate(complete)).toBe(true);
  });
});
