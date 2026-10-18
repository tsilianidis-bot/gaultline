import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getInsiderAlertsForTicker,
  getInsiderCompany,
  getInsiderRadar,
  InsiderSourceUnavailableError,
  type Form4ObservationProvider,
} from "./insiderIntelligence";
import {
  SEC_FORM4_PROVIDER_ID,
  parseSecForm4Xml,
  type Form4ObservationResult,
  type SecForm4FilingMetadata,
} from "./providers/secForm4Adapter";

const XML = readFileSync(new URL("./providers/__fixtures__/sec-form4-bby-2024-05-30.xml", import.meta.url), "utf8");
const FILING: SecForm4FilingMetadata = {
  accessionNumber: "0001225208-24-006528",
  issuerCik: "0000764478",
  ticker: "BBY",
  filingDate: "2024-06-03",
  acceptanceDateTime: "2024-06-03T23:44:09.000Z",
  primaryDocument: "xslF345X05/doc4.xml",
  sourceUrl: "https://www.sec.gov/Archives/edgar/data/764478/000122520824006528/xslF345X05/doc4.xml",
};
const OBSERVATIONS = parseSecForm4Xml(XML, FILING);

function availableFixture(): Form4ObservationResult {
  return {
    status: "AVAILABLE",
    observations: OBSERVATIONS,
    provider: {
      id: SEC_FORM4_PROVIDER_ID,
      name: "SEC EDGAR",
      ticker: "BBY",
      fetchedAt: "2024-06-04T12:00:00.000Z",
      sourceUrls: [FILING.sourceUrl],
    },
    observedAt: FILING.acceptanceDateTime,
    reason: null,
  };
}

const fixtureProvider: Form4ObservationProvider = async ticker => {
  expect(ticker).toBe("BBY");
  return availableFixture();
};

describe("Insider Intelligence — SEC Form 4 backed analytics", () => {
  it("preserves the recorded SEC source fields and does not fabricate identities, accuracy, or AI analysis", async () => {
    const output = await getInsiderCompany("BBY", { observationProvider: fixtureProvider });
    const sale = output.profile.recentTransactions.find(transaction => transaction.transactionCode === "S");

    expect(sale).toMatchObject({
      ticker: "BBY",
      company: "BEST BUY CO INC",
      accessionNumber: FILING.accessionNumber,
      issuerCik: FILING.issuerCik,
      filingDate: FILING.filingDate,
      acceptanceDateTime: FILING.acceptanceDateTime,
      sourceUrl: FILING.sourceUrl,
      transactionCode: "S",
      transactionType: "sale",
      planStatus: "disclosed",
    });
    expect(sale?.insiderName).toBe(sale?.reportingOwners.map(owner => owner.name).join(" / "));
    expect(sale?.shares).toBeGreaterThan(0);
    expect(sale?.pricePerShare).not.toBeNull();
    expect(sale?.totalValue).toBe(sale!.shares * sale!.pricePerShare!);
    expect(output.profile.historicalAccuracy).toBeNull();
    expect(output.accuracyHistory).toEqual([]);
    expect(output.profile.aiInterpretation).toBeNull();
    expect(output.timeline[0]).toMatchObject({ accessionNumber: FILING.accessionNumber, sourceUrl: FILING.sourceUrl });
  });

  it("labels scores and selling classifications as deterministic derived methodology with source claim IDs", async () => {
    const output = await getInsiderCompany("BBY", { observationProvider: fixtureProvider });
    expect(output.profile.methodology).toMatchObject({ methodologyId: "sec-form4-insider-conviction", methodologyVersion: "2.0.0" });
    expect(output.profile.methodology?.sourceClaimIds.every(id => id.startsWith("sec-form4:"))).toBe(true);
    expect(output.profile.sellingAnalysis.some(analysis => analysis.transactionCode === "S" && analysis.isScheduledPlan === "disclosed")).toBe(true);
    expect(output.profile.sellingAnalysis.every(analysis => analysis.isDiversification === "unknown")).toBe(true);
  });

  it("builds a radar only from injected SEC observations and retains the observed source timestamp", async () => {
    const radar = await getInsiderRadar({ tickers: ["BBY"], observationProvider: fixtureProvider });
    expect(radar.observedAt).toBe(FILING.acceptanceDateTime);
    expect(radar.provider[0]).toMatchObject({ id: SEC_FORM4_PROVIDER_ID, ticker: "BBY", sourceUrls: [FILING.sourceUrl] });
    expect(radar.radar).toHaveLength(1);
    expect(radar.radar[0]).toMatchObject({ ticker: "BBY", trend: "unavailable", methodology: { methodologyId: "sec-form4-insider-conviction" } });
    expect(radar.topSellingAlerts.every(alert => alert.sourceUrl === FILING.sourceUrl)).toBe(true);
  });

  it("returns nullable score fields rather than a neutral default when returned filings lack open-market P/S rows", async () => {
    const awardXml = readFileSync(new URL("./providers/__fixtures__/sec-form4-bio-techne-2023-10-30.xml", import.meta.url), "utf8");
    const awardFiling: SecForm4FilingMetadata = {
      accessionNumber: "0001062993-23-019844", issuerCik: "0000842023", ticker: "TECH", filingDate: "2023-10-30",
      acceptanceDateTime: "2023-10-30T20:00:00.000Z", primaryDocument: "form4.xml",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/842023/000106299323019844/form4.xml",
    };
    const provider: Form4ObservationProvider = async () => ({
      status: "AVAILABLE", observations: parseSecForm4Xml(awardXml, awardFiling),
      provider: { id: SEC_FORM4_PROVIDER_ID, name: "SEC EDGAR", ticker: "TECH", fetchedAt: "2023-10-31T00:00:00.000Z", sourceUrls: [awardFiling.sourceUrl] },
      observedAt: awardFiling.acceptanceDateTime, reason: null,
    });
    const output = await getInsiderCompany("TECH", { observationProvider: provider });
    expect(output.profile.convictionScore).toBeNull();
    expect(output.profile.convictionBand).toBeNull();
    expect(output.profile.impactPoints).toBeNull();
    expect(output.profile.methodology).toBeNull();
  });

  it("propagates verified source unavailability rather than returning a no-activity or synthetic result", async () => {
    const unavailableProvider: Form4ObservationProvider = async () => ({
      status: "UNAVAILABLE",
      observations: [],
      provider: { id: SEC_FORM4_PROVIDER_ID, name: "SEC EDGAR", ticker: "BBY", fetchedAt: "2024-06-04T12:00:00.000Z", sourceUrls: [] },
      observedAt: null,
      reason: "SEC_USER_AGENT is not configured.",
    });
    await expect(getInsiderCompany("BBY", { observationProvider: unavailableProvider })).rejects.toBeInstanceOf(InsiderSourceUnavailableError);
    await expect(getInsiderAlertsForTicker("BBY", { observationProvider: unavailableProvider })).rejects.toThrow("SEC_USER_AGENT");
  });
});
