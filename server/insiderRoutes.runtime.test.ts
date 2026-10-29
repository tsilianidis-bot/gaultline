import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const INSIDER_UNAVAILABLE = "Insider Intelligence unavailable: source verification required.";
const OFFICIAL_OWNERSHIP_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <documentType>4</documentType>
  <periodOfReport>2026-09-30</periodOfReport>
  <issuer><issuerTradingSymbol>NVDA</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0001234567</rptOwnerCik><rptOwnerName>Fixture Owner</rptOwnerName></reportingOwnerId>
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

function makeUser(): User {
  return {
    id: 1,
    openId: "insider-contained-test",
    name: "Contained Insider Test",
    email: "contained-insider@example.com",
    loginMethod: "manus",
    role: "user",
    accessTier: "free",
    dashboardMode: "pulse",
    preflightPromptMode: "full_guidance",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00Z"),
  };
}

function makeCaller() {
  const ctx: TrpcContext = {
    user: makeUser(),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function makeGuestCaller() {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => typeof body === "string" ? body : JSON.stringify(body) };
}

function configuredOfficialFixtureFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://www.sec.gov/files/company_tickers.json") {
      return response({ 0: { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA CORP" } });
    }
    if (url === "https://data.sec.gov/submissions/CIK0001045810.json") {
      return response({
        filings: {
          recent: {
            form: ["4"],
            accessionNumber: ["0001045810-26-000100"],
            filingDate: ["2026-10-01"],
            reportDate: ["2026-09-30"],
            primaryDocument: ["xslF345X03/form4.xml"],
          },
        },
      });
    }
    if (url === "https://www.sec.gov/Archives/edgar/data/1045810/0001045810-26-000100-index.html") {
      return response('<a href="xslF345X03/form4.xml">XML</a>');
    }
    if (url === "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000100/xslF345X03/form4.xml") {
      return response(OFFICIAL_OWNERSHIP_XML);
    }
    throw new Error(`Unexpected official fixture URL: ${url}`);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("contained insider procedure callers", () => {
  it("radar returns SERVICE_UNAVAILABLE for an authenticated caller", async () => {
    await expect(makeCaller().insider.radar()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: INSIDER_UNAVAILABLE,
    });
  });

  it("company returns SERVICE_UNAVAILABLE for an authenticated caller", async () => {
    await expect(makeCaller().insider.company({ ticker: "NVDA" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: INSIDER_UNAVAILABLE,
    });
  });

  it("passes an explicitly configured, parsed official-source fixture through for an authenticated caller", async () => {
    const fetch = configuredOfficialFixtureFetch();
    vi.stubEnv("SEC_EDGAR_USER_AGENT", "FAULTLINE Synthetic Test sec-fixture@example.test");
    vi.stubGlobal("fetch", fetch);

    await expect(makeCaller().insider.company({ ticker: "NVDA" })).resolves.toMatchObject({
      status: "ok",
      ticker: "NVDA",
      cik: "0001045810",
      companyName: "NVIDIA CORP",
      filings: [{
        formType: "4",
        issuerTicker: "NVDA",
        reportingOwners: [{ cik: "0001234567", name: "Fixture Owner" }],
        transactions: [{ transactionCode: "P", shares: 1250, acquiredOrDisposed: "A" }],
      }],
    });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("keeps a guest caller outside the official-source reader", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(makeGuestCaller().insider.company({ ticker: "NVDA" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("tickerAlert returns SERVICE_UNAVAILABLE for an authenticated caller", async () => {
    await expect(makeCaller().insider.tickerAlert({ ticker: "NVDA" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: INSIDER_UNAVAILABLE,
    });
  });
});
