import { describe, expect, it, vi } from "vitest";
import {
  SEC_EDGAR_INGESTION_ENABLED,
  SEC_EDGAR_MAX_REQUESTS_PER_SECOND,
  SecRequestPacer,
  ingestVerifiedEdgarForm4,
  readOfficialEdgarInsiderFilings,
  validateEdgarForm4Claim,
} from "./edgarIngestion";

const hash = "a".repeat(64);

const filing = {
  accessionNumber: "0000320193-26-000001",
  formType: "4/A" as const,
  isAmendment: true,
  filingDate: "2026-10-01",
  reportDate: "2026-09-30",
  issuerTicker: "aapl",
  sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/form4.xml",
  rawDocumentSha256: hash,
  reportingOwners: [{ cik: "0000123456", name: "Example Insider", role: "Chief Executive Officer" }],
  transactions: [{
    transactionDate: "2026-09-30",
    ownerCik: "0000123456",
    ownerName: "Example Insider",
    role: "Chief Executive Officer",
    transactionCode: "P",
    shares: 100,
    pricePerShare: 180,
    acquiredOrDisposed: "A" as const,
  }],
  provenance: {
    provider: "SEC EDGAR" as const,
    retrievedAt: "2026-10-02T00:00:00.000Z",
    filingIndexUrl: "https://www.sec.gov/Archives/edgar/data/320193/0000320193-26-000001-index.html",
    submissionsUrl: "https://data.sec.gov/submissions/CIK0000320193.json",
  },
};

const ownershipXml = `<?xml version="1.0"?>
<ownershipDocument>
  <documentType>4</documentType>
  <periodOfReport>2026-09-30</periodOfReport>
  <issuer><issuerTradingSymbol>NVDA</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0001234567</rptOwnerCik><rptOwnerName>Example Owner</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship><isDirector>0</isDirector><isOfficer>1</isOfficer><officerTitle>Chief Executive Officer</officerTitle><isTenPercentOwner>0</isTenPercentOwner></reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-09-30</value></transactionDate>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>1250</value></transactionShares>
        <transactionPricePerShare><value>175.50</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => typeof body === "string" ? body : JSON.stringify(body) };
}

function configuredFetch(overrides: { primaryFirstStatus?: number } = {}) {
  let primaryCalls = 0;
  return vi.fn(async (url: string) => {
    if (url === "https://www.sec.gov/files/company_tickers.json") {
      return response({ 0: { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA CORP" } });
    }
    if (url === "https://data.sec.gov/submissions/CIK0001045810.json") {
      return response({
        filings: {
          recent: {
            form: ["13F-HR", "4/A"],
            accessionNumber: ["0001045810-26-000099", "0001045810-26-000100"],
            filingDate: ["2026-10-02", "2026-10-01"],
            reportDate: ["2026-09-30", "2026-09-30"],
            primaryDocument: ["holdings.xml", "xslF345X03/form4.xml"],
          },
        },
      });
    }
    if (url === "https://www.sec.gov/Archives/edgar/data/1045810/0001045810-26-000100-index.html") {
      return response('<a href="xslF345X03/form4.xml">XML</a>');
    }
    if (url === "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000100/xslF345X03/form4.xml") {
      primaryCalls += 1;
      if (overrides.primaryFirstStatus && primaryCalls === 1) return response("busy", overrides.primaryFirstStatus);
      return response(ownershipXml);
    }
    throw new Error(`Unexpected official URL: ${url}`);
  });
}

describe("SEC EDGAR official ownership ingestion", () => {
  it("validates accession, forms, amendment, source URLs, owner identity, dates, codes, and provenance", () => {
    expect(validateEdgarForm4Claim(filing).ok).toBe(true);
    expect(validateEdgarForm4Claim({ ...filing, accessionNumber: "not-an-accession" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, formType: "13F-HR" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, reportDate: "2026-02-30" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, transactions: [] }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, sourceUrl: "https://example.com/form4.xml" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, rawDocumentSha256: "not-a-hash" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, reportingOwners: [] }).ok).toBe(false);
    expect(ingestVerifiedEdgarForm4(filing)).toMatchObject({ status: "accepted", filing: { formType: "4/A", isAmendment: true } });
  });

  it("fails closed without a syntactically declared SEC contact user agent and never fetches", async () => {
    const fetch = vi.fn();
    const result = await readOfficialEdgarInsiderFilings("NVDA", { fetch, userAgent: "FAULTLINE" });

    expect(SEC_EDGAR_INGESTION_ENABLED).toBe(true);
    expect(result).toMatchObject({ status: "unavailable", reason: "configuration_required" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a successful empty lookup when an official submissions fixture has no Section 16 filing", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === "https://www.sec.gov/files/company_tickers.json") {
        return response({ 0: { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA CORP" } });
      }
      if (url === "https://data.sec.gov/submissions/CIK0001045810.json") {
        return response({
          filings: {
            recent: {
              form: ["13F-HR"],
              accessionNumber: ["0001045810-26-000099"],
              filingDate: ["2026-10-02"],
              reportDate: ["2026-09-30"],
              primaryDocument: ["holdings.xml"],
            },
          },
        });
      }
      throw new Error(`Unexpected official URL: ${url}`);
    });

    const result = await readOfficialEdgarInsiderFilings("NVDA", {
      fetch,
      userAgent: "FAULTLINE Engineering sec-contact@example.test",
      now: () => new Date("2026-10-03T12:00:00.000Z"),
      sleep: async () => undefined,
      pacer: new SecRequestPacer(),
    });

    expect(result).toMatchObject({
      status: "ok",
      ticker: "NVDA",
      cik: "0001045810",
      companyName: "NVIDIA CORP",
      filings: [],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reads only official Section 16 XML rows and preserves filing, report, transaction, code, owner, amendment, hash, and SEC URLs", async () => {
    const fetch = configuredFetch();
    const headers: Array<Record<string, string>> = [];
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      headers.push((init?.headers ?? {}) as Record<string, string>);
      return configuredFetch()(url, init);
    });
    const result = await readOfficialEdgarInsiderFilings("nvda", {
      fetch,
      userAgent: "FAULTLINE Engineering sec-contact@example.test",
      now: () => new Date("2026-10-03T12:00:00.000Z"),
      sleep: async () => undefined,
      pacer: new SecRequestPacer(),
    });

    expect(result).toMatchObject({
      status: "ok",
      ticker: "NVDA",
      cik: "0001045810",
      companyName: "NVIDIA CORP",
      retrievedAt: "2026-10-03T12:00:00.000Z",
      filings: [{
        accessionNumber: "0001045810-26-000100",
        formType: "4/A",
        isAmendment: true,
        filingDate: "2026-10-01",
        reportDate: "2026-09-30",
        issuerTicker: "NVDA",
        reportingOwners: [{ cik: "0001234567", name: "Example Owner", role: "Chief Executive Officer" }],
        transactions: [{ transactionDate: "2026-09-30", transactionCode: "P", shares: 1250, pricePerShare: 175.5, acquiredOrDisposed: "A" }],
        provenance: { provider: "SEC EDGAR", submissionsUrl: "https://data.sec.gov/submissions/CIK0001045810.json" },
      }],
    });
    if (result.status === "ok") {
      expect(result.filings[0]?.rawDocumentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.filings[0]?.sourceUrl).toBe("https://www.sec.gov/Archives/edgar/data/1045810/000104581026000100/xslF345X03/form4.xml");
      expect(result.filings[0]?.provenance.filingIndexUrl).toBe("https://www.sec.gov/Archives/edgar/data/1045810/0001045810-26-000100-index.html");
    }
    expect(fetch.mock.calls.map(call => call[0])).not.toContain(expect.stringContaining("13F"));
    expect(headers.every(header => header["User-Agent"] === "FAULTLINE Engineering sec-contact@example.test" && header["Accept-Encoding"] === "gzip, deflate")).toBe(true);
  });

  it("retries a transient official response once with bounded pacing and does not exceed the documented module limit", async () => {
    const fetch = configuredFetch({ primaryFirstStatus: 429 });
    const sleeps: number[] = [];
    const result = await readOfficialEdgarInsiderFilings("NVDA", {
      fetch,
      userAgent: "FAULTLINE Engineering sec-contact@example.test",
      now: () => new Date("2026-10-03T12:00:00.000Z"),
      sleep: async milliseconds => { sleeps.push(milliseconds); },
      pacer: new SecRequestPacer(),
    });

    expect(result.status).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(sleeps).toContain(500);
    expect(SEC_EDGAR_MAX_REQUESTS_PER_SECOND).toBeLessThan(10);
  });
});
