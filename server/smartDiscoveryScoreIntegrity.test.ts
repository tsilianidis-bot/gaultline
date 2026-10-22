import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bindRankedOpportunitiesToScan,
  withholdInventedSectorRatings,
  withholdUnsupportedAskScores,
} from "./routers/smartDiscovery";

describe("Smart Discovery does not keep invented LLM scores", () => {
  it("nulls ask confidence, opportunity, verdict confidence, and evidence scores", () => {
    const withheld = withholdUnsupportedAskScores({
      confidence: 86,
      opportunityScore: 50,
      finalVerdictConfidence: 72,
      executiveSummary: "Credit is calm.",
      evidenceScores: [
        { category: "Liquidity", score: 50, signal: "neutral", explanation: "Not applicable" },
        { category: "Momentum", score: 91, signal: "bullish", explanation: "Price is higher." },
      ],
    });
    expect(withheld.confidence).toBeNull();
    expect(withheld.opportunityScore).toBeNull();
    expect(withheld.finalVerdictConfidence).toBeNull();
    expect(withheld.executiveSummary).toBe("Credit is calm.");
    expect(withheld.evidenceScores).toEqual([
      { category: "Liquidity", score: null, signal: "neutral", explanation: "Not applicable" },
      { category: "Momentum", score: null, signal: "bullish", explanation: "Price is higher." },
    ]);
  });

  it("keeps a ranked row only when the scan scored that ticker, and uses the scan composite", () => {
    const scan = [
      { ticker: "AAPL", compositeScore: 64 },
      { ticker: "msft", compositeScore: Number.NaN },
    ];
    const bound = bindRankedOpportunitiesToScan([
      { ticker: "aapl", convictionScore: 99, confidencePercent: 88, thesisSummary: "From the scan." },
      { ticker: "NVDA", convictionScore: 86, confidencePercent: 80, thesisSummary: "Model invented this." },
      { ticker: "MSFT", convictionScore: 70, confidencePercent: 60, thesisSummary: "Scan score was not finite." },
    ], scan);
    expect(bound).toEqual([
      { ticker: "aapl", convictionScore: 64, confidencePercent: null, thesisSummary: "From the scan." },
    ]);
  });

  it("withholds a sector star rating the model invented", () => {
    expect(withholdInventedSectorRatings([
      { sector: "Technology", rating: 5, bias: "bullish", reason: "Leadership." },
      null,
    ])).toEqual([
      { sector: "Technology", rating: null, bias: "bullish", reason: "Leadership." },
    ]);
  });

  it("does not ask the model for a neutral 50, a minimum of five names, or a default ticker list", () => {
    const source = readFileSync("server/routers/smartDiscovery.ts", "utf8");
    const ranking = source.slice(source.indexOf("async function orchestrateOpportunityRanking("), source.indexOf("// ── Route opportunity queries"));
    expect(ranking).not.toContain("MUST return at least 5");
    expect(ranking).not.toContain("supplement with well-known");
    expect(ranking).not.toContain("ALWAYS RANK SOMETHING");
    expect(ranking).not.toContain("NVDA, MSFT, BTC");
    expect(ranking).toContain('"confidencePercent": null');
    expect(ranking).toContain("rating is null");
    expect(ranking).toContain("withholdInventedSectorRatings(raw.sectorLeaderboard)");
    expect(source).not.toContain("score 50");
    expect(source).toContain("withholdUnsupportedAskScores(");
    expect(source).toContain("Do not use LLM-generated scores");
    const page = readFileSync("client/src/pages/SmartDiscovery.tsx", "utf8");
    expect(page).toContain('>Unavailable</span>');
    expect(page).toContain('typeof answer.opportunityScore === "number"');
  });
});
