import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  SEC_FORM4_PROVIDER_ID,
  createSecForm4Adapter,
  parseSecForm4Xml,
  type SecForm4FilingMetadata,
} from "./secForm4Adapter";

const FIXTURE_URL = "https://www.sec.gov/Archives/edgar/data/764478/000122520824006528/xslF345X05/doc4.xml";
const FIXTURE_METADATA: SecForm4FilingMetadata = {
  accessionNumber: "0001225208-24-006528",
  issuerCik: "0000764478",
  ticker: "BBY",
  filingDate: "2024-06-03",
  acceptanceDateTime: "2024-06-03T23:44:09.000Z",
  primaryDocument: "xslF345X05/doc4.xml",
  sourceUrl: FIXTURE_URL,
};
/** Recorded official SEC XML; provider metadata is intentionally part of the fixture. */
const RECORDED_SEC_FIXTURE = {
  provider: {
    id: SEC_FORM4_PROVIDER_ID,
    name: "SEC EDGAR" as const,
    ticker: "BBY",
    fetchedAt: "2024-06-04T12:00:00.000Z",
    sourceUrls: [FIXTURE_URL],
  },
  filing: FIXTURE_METADATA,
  xml: readFileSync(new URL("./__fixtures__/sec-form4-bby-2024-05-30.xml", import.meta.url), "utf8"),
};

function submissionResponse() {
  return {
    filings: {
      recent: {
        form: ["4"],
        accessionNumber: [FIXTURE_METADATA.accessionNumber],
        filingDate: [FIXTURE_METADATA.filingDate],
        acceptanceDateTime: [FIXTURE_METADATA.acceptanceDateTime],
        primaryDocument: [FIXTURE_METADATA.primaryDocument],
      },
    },
  };
}

function fixtureFetch(xml = RECORDED_SEC_FIXTURE.xml) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://www.sec.gov/files/company_tickers.json") {
      return new Response(JSON.stringify({ 0: { cik_str: 764478, ticker: "BBY", title: "BEST BUY CO INC" } }), { status: 200 });
    }
    if (url === "https://data.sec.gov/submissions/CIK0000764478.json") {
      return new Response(JSON.stringify(submissionResponse()), { status: 200 });
    }
    if (url === FIXTURE_URL) return new Response(xml, { status: 200 });
    return new Response("not found", { status: 404 });
  });
}

describe("SEC Form 4 adapter — recorded SEC source fixtures", () => {
  it("maps exact accession, issuer, owner, code, shares, price, amount, filing time, and source link", () => {
    const observations = parseSecForm4Xml(RECORDED_SEC_FIXTURE.xml, RECORDED_SEC_FIXTURE.filing);
    const firstSale = observations.find(observation => observation.transactionCode === "S");

    expect(firstSale).toMatchObject({
      accessionNumber: "0001225208-24-006528",
      issuerCik: "0000764478",
      issuerName: "BEST BUY CO INC",
      ticker: "BBY",
      sourceUrl: FIXTURE_URL,
      filingDate: "2024-06-03",
      acceptanceDateTime: "2024-06-03T23:44:09.000Z",
      transactionCode: "S",
      transactionType: "sale",
      acquiredDisposedCode: "D",
      planStatus: "disclosed",
    });
    expect(firstSale?.reportingOwners[0]?.name).toBe("SCHULZE RICHARD M");
    expect(firstSale?.shares).toBeGreaterThan(0);
    expect(firstSale?.pricePerShare).not.toBeNull();
    expect(firstSale?.amount).toBe(firstSale!.shares * firstSale!.pricePerShare!);
    expect(RECORDED_SEC_FIXTURE.provider.id).toBe(SEC_FORM4_PROVIDER_ID);
  });

  it("uses the declared SEC user agent and carries provider metadata through the adapter result", async () => {
    const fetchMock = fixtureFetch();
    const adapter = createSecForm4Adapter({
      fetchImpl: fetchMock as unknown as typeof fetch,
      userAgent: "FAULTLINE Test Operations test@example.com",
      now: () => new Date("2024-06-04T12:00:00.000Z"),
    });

    const result = await adapter("BBY");

    expect(result.status).toBe("AVAILABLE");
    expect(result.reason).toBeNull();
    expect(result.provider).toMatchObject({ id: SEC_FORM4_PROVIDER_ID, ticker: "BBY", sourceUrls: expect.arrayContaining([FIXTURE_URL]) });
    expect(result.observations[0]).toMatchObject({ accessionNumber: FIXTURE_METADATA.accessionNumber, issuerCik: FIXTURE_METADATA.issuerCik, sourceUrl: FIXTURE_URL });
    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((firstRequest.headers as Record<string, string>)["User-Agent"]).toBe("FAULTLINE Test Operations test@example.com");
  });

  it("returns UNAVAILABLE with no observations when SEC_USER_AGENT is not configured", async () => {
    const fetchMock = fixtureFetch();
    const adapter = createSecForm4Adapter({ fetchImpl: fetchMock as unknown as typeof fetch, userAgent: "", now: () => new Date("2024-06-04T12:00:00.000Z") });
    const result = await adapter("BBY");
    expect(result).toMatchObject({ status: "UNAVAILABLE", observations: [], observedAt: null });
    expect(result.reason).toMatch(/SEC_USER_AGENT/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns UNAVAILABLE with no observations for malformed transaction evidence", async () => {
    const malformed = RECORDED_SEC_FIXTURE.xml.replace(/(<transactionShares>\s*<value>)\d+/, "$1not-a-number");
    const adapter = createSecForm4Adapter({
      fetchImpl: fixtureFetch(malformed) as unknown as typeof fetch,
      userAgent: "FAULTLINE Test Operations test@example.com",
      now: () => new Date("2024-06-04T12:00:00.000Z"),
    });
    const result = await adapter("BBY");
    expect(result).toMatchObject({ status: "UNAVAILABLE", observations: [], observedAt: null });
    expect(result.reason).toMatch(/invalid transaction shares/i);
  });

  it("returns UNAVAILABLE with no observations when the provider request fails", async () => {
    const adapter = createSecForm4Adapter({
      fetchImpl: vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch,
      userAgent: "FAULTLINE Test Operations test@example.com",
      now: () => new Date("2024-06-04T12:00:00.000Z"),
    });
    const result = await adapter("BBY");
    expect(result).toMatchObject({ status: "UNAVAILABLE", observations: [], observedAt: null, reason: "network down" });
  });

  it("returns UNAVAILABLE rather than presenting stale filings as current", async () => {
    const adapter = createSecForm4Adapter({
      fetchImpl: fixtureFetch() as unknown as typeof fetch,
      userAgent: "FAULTLINE Test Operations test@example.com",
      now: () => new Date("2024-08-01T12:00:00.000Z"),
      maxFilingAgeDays: 45,
    });
    const result = await adapter("BBY");
    expect(result).toMatchObject({ status: "UNAVAILABLE", observations: [], observedAt: null });
    expect(result.reason).toMatch(/freshness limit/i);
  });
});
