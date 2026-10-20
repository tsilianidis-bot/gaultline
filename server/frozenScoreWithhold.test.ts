/**
 * Scoring impact of the authorized frozen-engine corrections.
 * Complete inputs keep the prior formulas. Every other case is named here.
 */
import { describe, expect, it } from "vitest";
import { scoreRisingStar, type RisingStarInput } from "./risingStars";
import { risingStarSocialTerms } from "./signalOutlook";
import {
  buildEvidenceFamilies,
  computeSimilarity,
  historicalPercentileRank,
  LABOR_RATES_FAMILY_NAME,
  YIELD_CURVE_FAMILY_NAME,
  type HistoricalMonth,
} from "./seismographUnified";

function month(overrides: Partial<HistoricalMonth> = {}): HistoricalMonth {
  return {
    month: "2026-09",
    score: 40,
    regime: "MODERATE RISK",
    liquidity: 20,
    credit: 30,
    volatility: 40,
    macro: 50,
    breadth: 60,
    aiBubble: 30,
    baaSpread: null,
    hySpread: null,
    tsy10y: 4,
    tsy2y: 3.5,
    fedfunds: null,
    cpiYoy: null,
    unemployment: null,
    sp500: null,
    ...overrides,
  };
}

/** The pre-correction similarity formula: missing sub-scores compared as 50. */
function legacySimilarity(a: HistoricalMonth, b: HistoricalMonth): number {
  const scoreSimil = Math.max(0, 100 - Math.abs(a.score - b.score) * 2);
  const subDiff = [
    Math.abs((a.liquidity || 50) - (b.liquidity || 50)),
    Math.abs((a.credit || 50) - (b.credit || 50)),
    Math.abs((a.volatility || 50) - (b.volatility || 50)),
    Math.abs((a.macro || 50) - (b.macro || 50)),
    Math.abs((a.breadth || 50) - (b.breadth || 50)),
  ].reduce((sum, value) => sum + value, 0);
  const subSimil = Math.max(0, 100 - subDiff / 5);
  const macroSimil = a.tsy10y !== null && b.tsy10y !== null
    ? Math.max(0, 100 - Math.abs(a.tsy10y - b.tsy10y) * 10)
    : 70;
  return Math.round(scoreSimil * 0.4 + subSimil * 0.4 + macroSimil * 0.2);
}

function legacyPercentile(currentScore: number, scores: number[]): number {
  const sorted = [...scores].sort((a, b) => a - b);
  const percentileIdx = sorted.findIndex(score => score >= currentScore);
  return percentileIdx >= 0 ? Math.round((percentileIdx / sorted.length) * 100) : 50;
}

function star(overrides: Partial<RisingStarInput> = {}): RisingStarInput {
  return {
    ticker: "TEST",
    name: "Test Company",
    technical: { relativeStrength: 70, volumeAccumulation: 70, momentumInflection: 65, technicalStructure: 72, asymmetry: 75 },
    catalyst: { available: true, score: 65, note: "Source-backed news coverage is constructive." },
    macroAlignment: { score: 68, note: "Current macro conditions are supportive." },
    social: { available: true, sourceCount: 3, socialVolume: 18, sentimentScore: 0.45, positiveNews: 5, negativeNews: 1, memeHypeDetected: false },
    ...overrides,
  };
}

describe("complete inputs stay on the prior formulas", () => {
  it("analog similarity is byte-identical when every sub-score and yield is present", () => {
    const left = month({ score: 40, liquidity: 20, credit: 30, volatility: 40, macro: 50, breadth: 60, tsy10y: 4.2 });
    const right = month({ score: 48, liquidity: 30, credit: 30, volatility: 40, macro: 50, breadth: 70, tsy10y: 4.4 });
    const actual = computeSimilarity(left, right);
    expect(actual).toBe(legacySimilarity(left, right));
    expect(String(actual)).toBe(String(legacySimilarity(left, right)));
  });

  it("evidence-family text is unchanged when the latest score and the six-month window are complete", () => {
    const complete = month({
      liquidity: 29, credit: 25, volatility: 28, macro: 44, breadth: 22, tsy10y: null, tsy2y: null,
    });
    const history = Array.from({ length: 6 }, () => complete);
    const families = buildEvidenceFamilies(complete, history);
    const liquidity = families.find(family => family.name === "Liquidity Conditions")!;
    expect(liquidity.strength).toBe(29);
    expect(liquidity.signal).toBe("neutral");
    expect(liquidity.currentValue).toBe("29/100");
    expect(liquidity.historicalContext).toBe("6-month average: 29/100. Liquidity conditions are consistent with recent trend.");
    expect(families.map(family => family.name)).toEqual([
      "Liquidity Conditions",
      "Credit Markets",
      YIELD_CURVE_FAMILY_NAME,
      "Macro Sensitivity",
      LABOR_RATES_FAMILY_NAME,
    ]);
  });

  it("a rankable percentile matches the old index formula", () => {
    const scores = [10, 20, 30, 40];
    expect(historicalPercentileRank(20, scores)).toBe(legacyPercentile(20, scores));
    expect(historicalPercentileRank(10, scores)).toBe(0);
    expect(historicalPercentileRank(40, scores)).toBe(75);
  });

  it("a present social composite, including a genuine 0, keeps the rising-star result", () => {
    for (const sentiment of [0.45, 0]) {
      const snapshot = {
        sourceCount: 3, socialVolume: 18, newsCount: 4, sentimentScore: sentiment,
        positiveNews: 5, negativeNews: 1, extremeAttentionDetected: false, fetchedAt: 1_700_000_000_000,
      };
      const terms = risingStarSocialTerms(snapshot);
      const viaHelper = scoreRisingStar(star({ catalyst: terms.catalyst, social: terms.social }));
      const direct = scoreRisingStar(star({
        catalyst: {
          available: true,
          score: Math.max(0, Math.min(100, Math.round(50 + sentiment * 30 + Math.min(20, 6 * 4)))),
          note: "6 directionally classified recent public-news items.",
        },
        social: {
          available: true, sourceCount: 3, socialVolume: 18, sentimentScore: sentiment,
          positiveNews: 5, negativeNews: 1, memeHypeDetected: false,
          note: terms.social.note,
        },
      }));
      expect(JSON.stringify(viaHelper)).toBe(JSON.stringify(direct));
      expect(terms.social.sentimentScore).toBe(sentiment);
    }
  });
});

describe("cases where output changes", () => {
  it("a missing sub-score is excluded from similarity instead of compared as 50", () => {
    const observed = month({ liquidity: 90, breadth: 60 });
    const missing = month({ liquidity: null, breadth: 60 });
    expect(computeSimilarity(observed, missing)).toBe(100);
    expect(legacySimilarity(observed, missing)).toBeLessThan(100);
  });

  it("withholds the sub-score block when no sub-score can be compared", () => {
    const left = month({ score: 40, liquidity: null, credit: null, volatility: null, macro: null, breadth: null, tsy10y: 4, tsy2y: 3 });
    const right = month({ score: 50, liquidity: null, credit: null, volatility: null, macro: null, breadth: null, tsy10y: 5, tsy2y: 3 });
    const scoreSimil = Math.max(0, 100 - 10 * 2);
    const macroSimil = Math.max(0, 100 - Math.abs(4 - 5) * 10);
    expect(computeSimilarity(left, right)).toBe(Math.round(scoreSimil * (0.4 / 0.6) + macroSimil * (0.2 / 0.6)));
    expect(computeSimilarity(left, right)).not.toBe(legacySimilarity(left, right));
  });

  it("omits a missing evidence family instead of publishing 50/100", () => {
    const history = [month({ credit: null }), month({ credit: null })];
    const families = buildEvidenceFamilies(month({ credit: null }), history);
    expect(families.some(family => family.name === "Credit Markets")).toBe(false);
    const macro = families.find(family => family.name === "Macro Sensitivity");
    expect(macro?.currentValue).toBe("50/100");
  });

  it("does not describe an unrankable score as the 50th percentile", () => {
    expect(historicalPercentileRank(100, [10, 20, 30])).toBeNull();
    expect(legacyPercentile(100, [10, 20, 30])).toBe(50);
    expect(historicalPercentileRank(Number.NaN, [10, 20, 30])).toBeNull();
    expect(historicalPercentileRank(10, [])).toBeNull();
  });

  it("withholds the social and catalyst terms when the verified composite is missing", () => {
    const snapshot = {
      sourceCount: 3, socialVolume: 18, newsCount: 4, sentimentScore: null,
      positiveNews: 5, negativeNews: 1, extremeAttentionDetected: false, fetchedAt: 1_700_000_000_000,
    };
    const terms = risingStarSocialTerms(snapshot);
    expect(terms.social.available).toBe(false);
    expect(terms.social.sentimentScore).toBeNull();
    expect(terms.catalyst.available).toBe(false);
    const withheld = scoreRisingStar(star({ catalyst: terms.catalyst, social: terms.social }));
    const substituted = scoreRisingStar(star({
      catalyst: { available: true, score: Math.round(50 + 0 * 30 + Math.min(20, 24)), note: "substituted" },
      social: { available: true, sourceCount: 3, socialVolume: 18, sentimentScore: 0, positiveNews: 5, negativeNews: 1, memeHypeDetected: false },
    }));
    expect(withheld.socialDiscovery.score).toBeNull();
    expect(substituted.socialDiscovery.score).not.toBeNull();
    expect(withheld.risingStarScore).not.toBe(substituted.risingStarScore);
  });

  it("a missing snapshot still withholds social and does not store a composite of 0", () => {
    const terms = risingStarSocialTerms(null);
    expect(terms.social.sentimentScore).toBeNull();
    expect(terms.social.available).toBe(false);
    expect(terms.catalyst.available).toBe(false);
    expect(terms.catalyst.note).toBe("Insufficient recent public-news coverage; excluded from score.");
    expect(terms.social.note).toBe("No cached multi-source social snapshot is available; excluded from score.");
  });
});
