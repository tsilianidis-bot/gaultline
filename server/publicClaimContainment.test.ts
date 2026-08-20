import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagePath = new URL("../client/src/pages/seo/MarketCrashProbability2026.tsx", import.meta.url);
const scoreExplainerPath = new URL("../client/src/components/ScoreExplainer.tsx", import.meta.url);
const marketSynthesisPath = new URL("../client/src/components/MarketSynthesisPanel.tsx", import.meta.url);
const systemicAlertsPath = new URL("../client/src/components/SystemicAlerts.tsx", import.meta.url);
const shareCardPath = new URL("../client/src/components/ShareCard.tsx", import.meta.url);
const homeStockIntelPath = new URL("../client/src/components/HomeStockIntelSection.tsx", import.meta.url);
const productExperiencePath = new URL("../client/src/components/ProductExperience.tsx", import.meta.url);

describe("critical public claim containment", () => {
  const page = readFileSync(pagePath, "utf8");
  const scoreExplainer = readFileSync(scoreExplainerPath, "utf8");
  const marketSynthesis = readFileSync(marketSynthesisPath, "utf8");
  const systemicAlerts = readFileSync(systemicAlertsPath, "utf8");
  const shareCard = readFileSync(shareCardPath, "utf8");
  const homeStockIntel = readFileSync(homeStockIntelPath, "utf8");
  const productExperience = readFileSync(productExperiencePath, "utf8");

  it("does not call the six-vector Pressure Index a crash probability", () => {
    expect(page).toContain("not a calibrated crash probability");
    expect(page).not.toContain("single 0-100 crash probability score");
    expect(page).not.toContain("core crash probability indicator");
  });

  it("does not misstate VIX, seven vectors, intraday updating, or historical FAULTLINE warnings", () => {
    expect(page).toContain("six-vector methodology");
    expect(page).toContain("it is not a live VIX input");
    expect(page).not.toContain("seven independent risk vectors");
    expect(page).not.toContain("updated continuously throughout the trading day");
    expect(page).toContain("does not support the claim that FAULTLINE historically issued warnings");
  });

  it("contains shared probability-like outputs as derived scenario context rather than calibrated forecasts", () => {
    expect(scoreExplainer).toContain("not a calibrated return forecast");
    expect(scoreExplainer).toContain("not a calibrated 90-day drawdown probability");
    expect(scoreExplainer).not.toContain("likelihood that current market conditions will be followed by positive returns over the next 30–90 days");
    expect(marketSynthesis).toContain("not calibrated forecasts");
    expect(marketSynthesis).not.toContain("Crash probability:");
    expect(shareCard).toContain("Derived scenario context, not a calibrated forecast");
    expect(shareCard).not.toContain("Bull Probability:");
  });

  it("does not convert analog similarity or static vectors into statistical outcome claims", () => {
    expect(systemicAlerts).toContain("feature-set reference cases, not probability-weighted forecasts");
    expect(systemicAlerts).not.toContain("statistically significant and warrants heightened awareness");
    expect(systemicAlerts).toContain("static model estimate, not a live market-cap series");
    expect(systemicAlerts).not.toContain("all 7 FAULTLINE vectors were simultaneously elevated");
  });

  it("does not expose static homepage mock probabilities or describe scenario output as probability-weighted", () => {
    expect(homeStockIntel).not.toContain("Bull Probability");
    expect(homeStockIntel).not.toContain("Crash Probability");
    expect(homeStockIntel).toContain("Forecast Horizon");
    expect(productExperience).not.toContain("probability-weighted outcomes");
  });
});
