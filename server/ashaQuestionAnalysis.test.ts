import { describe, expect, it } from "vitest";
import {
  buildAshaQuestionAnalysis,
  classifyAshaQuestionScope,
  restrictAshaPageContextForScope,
} from "../shared/ashaQuestionAnalysis";
import type { CanonicalMarketState } from "../shared/marketState";

const page = {
  page: "/app/symbol-intelligence",
  additionalContext: {
    symbol: "GE",
    ticker: "GE",
    companyName: "GE Aerospace",
    priceLevels: { support: 210, resistance: 245 },
    pressureScore: 42,
  },
};

const state = {
  now: { pressureScore: 42, topDrivers: ["Credit spreads stable", "Breadth mixed"] },
  why: {
    evidenceFamilies: [
      { name: "Credit", signal: "neutral", currentValue: "342 bp" },
      { name: "Liquidity", signal: "bullish", currentValue: "Neutral" },
      { name: "Volatility", signal: "stressed", currentValue: "VIX elevated" },
    ],
  },
  outlook: {
    probabilities: {
      bear: 31,
      confidence: 72,
      evidenceBasis: "One of three available evidence families is signaling stress.",
      historicalBasis: "Historical basis is illustrative in this test fixture.",
    },
    topAnalog: { label: "Soft Landing", similarity: 84 },
    invalidationConditions: ["Credit spreads narrow", "Breadth improves"],
    transitionProbabilities: { currentEvidence: ["Volatility expands", "Liquidity deteriorates"] },
  },
} as unknown as CanonicalMarketState;

describe("ASHA question analysis", () => {
  it("classifies broad-market correction questions as MARKET and strips active ticker context before retrieval", () => {
    const question = "How likely is a large correction in the next 6–8 weeks?";
    expect(classifyAshaQuestionScope(question, page)).toBe("MARKET");
    const scoped = restrictAshaPageContextForScope(page, "MARKET");
    expect(scoped.additionalContext).toEqual({ pressureScore: 42 });

    const analysis = buildAshaQuestionAnalysis(question, page, state);
    expect(analysis.analysisScope).toBe("MARKET");
    expect(analysis.eventDefinition).toBe(">10% broad-market correction");
    expect(analysis.timeHorizon).toBe("6–8 weeks");
    expect(analysis.probability).toBeNull();
    expect(analysis.probabilityProvenance.availability).toBe("NOT_CALIBRATED");
  });

  it("allows ticker evidence only for an explicit ticker question", () => {
    expect(classifyAshaQuestionScope("How likely is GE to correct in the next 6–8 weeks?", page)).toBe("TICKER");
    expect(restrictAshaPageContextForScope(page, "TICKER").additionalContext).toMatchObject({ symbol: "GE" });
  });

  it("identifies a market-to-ticker transmission question and keeps both contexts distinct", () => {
    expect(classifyAshaQuestionScope("What happens to GE if the Pressure Index reaches 45?", page)).toBe("MARKET_TICKER_RELATIONSHIP");
  });

  it("keeps historical similarity explicitly separate from a calibrated forecast probability", () => {
    const analysis = buildAshaQuestionAnalysis("What is the current broad-market directional assessment?", page, state);
    expect(analysis.probability).toBe(31);
    expect(analysis.historicalAnalogs[0]).toMatchObject({ label: "Soft Landing", similarity: 84 });
    expect(analysis.historicalAnalogs[0]?.interpretation).toContain("not a forecast probability");
  });
});
