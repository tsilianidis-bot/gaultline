import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagePath = new URL("../client/src/pages/seo/MarketCrashProbability2026.tsx", import.meta.url);
const scoreExplainerPath = new URL("../client/src/components/ScoreExplainer.tsx", import.meta.url);
const marketSynthesisPath = new URL("../client/src/components/MarketSynthesisPanel.tsx", import.meta.url);
const systemicAlertsPath = new URL("../client/src/components/SystemicAlerts.tsx", import.meta.url);
const shareCardPath = new URL("../client/src/components/ShareCard.tsx", import.meta.url);
const homeStockIntelPath = new URL("../client/src/components/HomeStockIntelSection.tsx", import.meta.url);
const productExperiencePath = new URL("../client/src/components/ProductExperience.tsx", import.meta.url);
const opportunityDiscoveryPath = new URL("../client/src/components/OpportunityDiscoveryPanel.tsx", import.meta.url);
const marketContextPath = new URL("../client/src/components/MarketContextStrip.tsx", import.meta.url);
const homeCryptoPath = new URL("../client/src/components/HomeCryptoSection.tsx", import.meta.url);
const ashaPanelPath = new URL("../client/src/components/AshaPanel.tsx", import.meta.url);
const oracleBriefingPath = new URL("../client/src/components/OracleBriefing.tsx", import.meta.url);
const smartDiscoveryPath = new URL("./routers/smartDiscovery.ts", import.meta.url);
const outlookRouterPath = new URL("./routers/outlook.ts", import.meta.url);

describe("critical public claim containment", () => {
  const page = readFileSync(pagePath, "utf8");
  const scoreExplainer = readFileSync(scoreExplainerPath, "utf8");
  const marketSynthesis = readFileSync(marketSynthesisPath, "utf8");
  const systemicAlerts = readFileSync(systemicAlertsPath, "utf8");
  const shareCard = readFileSync(shareCardPath, "utf8");
  const homeStockIntel = readFileSync(homeStockIntelPath, "utf8");
  const productExperience = readFileSync(productExperiencePath, "utf8");
  const opportunityDiscovery = readFileSync(opportunityDiscoveryPath, "utf8");
  const marketContext = readFileSync(marketContextPath, "utf8");
  const homeCrypto = readFileSync(homeCryptoPath, "utf8");
  const ashaPanel = readFileSync(ashaPanelPath, "utf8");
  const oracleBriefing = readFileSync(oracleBriefingPath, "utf8");
  const smartDiscovery = readFileSync(smartDiscoveryPath, "utf8");
  const outlookRouter = readFileSync(outlookRouterPath, "utf8");

  it("does not call the six-vector Pressure Index a crash probability", () => {
    expect(page).toContain("FAULTLINE does not offer a crash probability");
    expect(page).not.toContain("not a calibrated crash probability");
    expect(page).not.toContain("single 0-100 crash probability score");
    expect(page).not.toContain("core crash probability indicator");
  });

  it("does not misstate VIX, seven vectors, intraday updating, or historical FAULTLINE warnings", () => {
    expect(page).toContain("six-vector methodology");
    expect(page).toContain("it is not a VIX input");
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

  it("requires an explicit horizon disclosure for opportunity and generative forward-looking analysis", () => {
    expect(opportunityDiscovery).toContain("ForecastHorizonDisclosure");
    expect(opportunityDiscovery).not.toContain("{item.expectedTimeHorizon}</span>");
    expect(smartDiscovery).toContain("forecastHorizonPromptContract()");
    expect(smartDiscovery).toContain("Do not state or imply a timeframe unless structured forecast metadata supplies a SUPPORTED horizon");
  });

  it("does not manufacture Oracle timing or frame a derived scenario as the most likely market outcome", () => {
    expect(ashaPanel).not.toContain('response.expectedTimeframe || "2-4 weeks"');
    expect(ashaPanel).toContain("forecastMetadata: insufficientHorizonMetadata");
    expect(oracleBriefing).toContain("ForecastHorizonDisclosure");
    expect(oracleBriefing).toContain("WITHHELD — NO GOVERNED CONTRACT");
    expect(marketContext).not.toContain(">MOST LIKELY<");
    expect(marketContext).toContain("DERIVED SCENARIO");
  });

  it("binds Daily Story interpretations to server-issued claim IDs and withholds unsupported horizon or reward", () => {
    expect(outlookRouter).toContain("No prior comparable raw-source snapshot, market-event calendar, institutional positions/flows, or ticker news is supplied.");
    expect(outlookRouter).toContain("Do not claim overnight changes, duration, historical outcomes, catalysts, institutional activity, future returns or calibrated confidence.");
    expect(outlookRouter).toContain("allowedIds.has(id)");
    expect(outlookRouter).toContain("sourceClaimIds: story.claimIds as string[], evidencePacket: packet");
    expect(outlookRouter).toContain('topOpportunityTimeHorizon: "Not established"');
    expect(outlookRouter).toContain('topOpportunityExpectedReward: "Not established"');
    expect(outlookRouter).toContain("forecastMetadata: insufficientHorizonMetadata");
  });

  it("does not imply that Crypto Hub has activated Early Warning Intelligence", () => {
    expect(homeCrypto).not.toContain("as early warning signals");
    expect(homeCrypto).toContain("as evolving market-context signals");
  });
});
