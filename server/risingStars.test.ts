import { describe, expect, it } from "vitest";
import { scoreRisingStar, type RisingStarInput } from "./risingStars";

function baseInput(): RisingStarInput {
  return {
    ticker: "TEST",
    name: "Test Company",
    technical: { relativeStrength: 70, volumeAccumulation: 70, momentumInflection: 65, technicalStructure: 72, asymmetry: 75 },
    catalyst: { available: true, score: 65, note: "Source-backed news coverage is constructive." },
    macroAlignment: { score: 68, note: "Current macro conditions are supportive." },
    social: { available: false, sourceCount: 0, socialVolume: 0, sentimentScore: 0, positiveNews: 0, negativeNews: 0, memeHypeDetected: false },
  };
}

describe("Rising Stars scoring safeguards", () => {
  it("removes unavailable social, insider, and options inputs instead of treating them as zeroes", () => {
    const result = scoreRisingStar(baseInput());
    expect(result.socialDiscovery.score).toBeNull();
    expect(result.insiderConviction.score).toBeNull();
    expect(result.optionsConviction.score).toBeNull();
    expect(result.dataNotes.join(" ")).toContain("excluded from score");
    expect(result.risingStarScore).toBeGreaterThan(60);
  });

  it("uses reliable multi-source social discovery as a bounded contributor", () => {
    const input = baseInput();
    input.social = { available: true, sourceCount: 3, socialVolume: 18, sentimentScore: 0.45, positiveNews: 5, negativeNews: 1, memeHypeDetected: false };
    const result = scoreRisingStar(input);
    expect(result.socialDiscovery.status).toBe("live");
    expect(result.socialDiscovery.stage).toBe("EARLY");
    expect(result.informationLead).toBe("HIGH");
    expect(result.crossSignalConfidence).toBe("VERY HIGH");
  });

  it("reduces the score only when source-backed social data flags crowding", () => {
    const input = baseInput();
    input.technical.asymmetry = 35;
    input.social = { available: true, sourceCount: 3, socialVolume: 80, sentimentScore: 0.8, positiveNews: 8, negativeNews: 0, memeHypeDetected: true };
    const result = scoreRisingStar(input);
    expect(result.crowdingRisk).toBe("HIGH");
    expect(result.crowdingPenalty).toBe(7);
    expect(result.socialDiscovery.stage).toBe("CROWDED");
  });

  it("does not penalize strong attention when price remains early rather than extended", () => {
    const input = baseInput();
    input.technical.asymmetry = 75;
    input.social = { available: true, sourceCount: 3, socialVolume: 80, sentimentScore: 0.8, positiveNews: 8, negativeNews: 0, memeHypeDetected: true };
    const result = scoreRisingStar(input);
    expect(result.crowdingRisk).toBe("ELEVATED");
    expect(result.crowdingPenalty).toBe(0);
  });

  it("does not accept an unverified insider score", () => {
    const input = baseInput();
    input.insider = { available: false, score: 95, note: "Synthetic or unavailable public-filing data; excluded." };
    const result = scoreRisingStar(input);
    expect(result.insiderConviction.status).toBe("unavailable");
    expect(result.insiderConviction.score).toBeNull();
  });
});
