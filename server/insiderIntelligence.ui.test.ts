import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companyUseQuery: vi.fn(),
  trackInsiderSearch: vi.fn(),
  useSEO: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({ trpc: { insider: { company: { useQuery: mocks.companyUseQuery } } } }));
vi.mock("@/hooks/useSEO", () => ({ PAGE_SEO: { insiderIntelligence: {} }, useSEO: mocks.useSEO }));
vi.mock("@/hooks/useAnalytics", () => ({ trackInsiderSearch: mocks.trackInsiderSearch }));
vi.mock("@/components/PageHeader", () => ({ default: () => null }));
vi.mock("@/components/PremiumGate", () => ({ PremiumGateFull: ({ children }: { children: unknown }) => children }));

import { InsiderIntelligenceInner } from "../client/src/pages/InsiderIntelligence";

const unavailable = {
  status: "unavailable" as const,
  ticker: "NVDA",
  reason: "configuration_required",
  message: "Official SEC/EDGAR retrieval is unavailable because no declared SEC contact user agent is configured.",
};

const official = {
  status: "ok" as const,
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
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000100/form4.xml",
    rawDocumentSha256: "a".repeat(64),
    reportingOwners: [{ cik: "0001234567", name: "Official Filing Owner", role: "Chief Executive Officer" }],
    transactions: [{ transactionDate: "2026-09-30", ownerCik: "0001234567", ownerName: "Official Filing Owner", role: "Chief Executive Officer", transactionCode: "P", shares: 1250, pricePerShare: 175.5, acquiredOrDisposed: "A" as const }],
    provenance: { provider: "SEC EDGAR" as const, retrievedAt: "2026-10-03T12:00:00.000Z", filingIndexUrl: "https://www.sec.gov/Archives/edgar/data/1045810/0001045810-26-000100-index.html", submissionsUrl: "https://data.sec.gov/submissions/CIK0001045810.json" },
  }],
};

beforeEach(() => {
  mocks.companyUseQuery.mockReset();
  mocks.companyUseQuery.mockReturnValue({ data: unavailable, error: null, isLoading: false });
});

describe("Insider Intelligence official-source rendering", () => {
  it("shows a real unavailable state and withholds all filing rows", () => {
    const markup = renderToStaticMarkup(React.createElement(InsiderIntelligenceInner));

    expect(markup).toContain("OFFICIAL SOURCE UNAVAILABLE");
    expect(markup).toContain(unavailable.message);
    expect(markup).not.toContain("Official Filing Owner");
    expect(markup).not.toContain("TRANSACTION ROWS AS FILED");
    expect(markup).not.toContain("Insider Accuracy");
    expect(markup).not.toContain("Smart Money Radar");
  });

  it("renders only official filing identity and transaction provenance when a source record is admitted", () => {
    mocks.companyUseQuery.mockReturnValue({ data: official, error: null, isLoading: false });
    const markup = renderToStaticMarkup(React.createElement(InsiderIntelligenceInner));

    expect(markup).toContain("NVIDIA CORP");
    expect(markup).toContain("FORM 4/A · AMENDMENT");
    expect(markup).toContain("Official Filing Owner");
    expect(markup).toContain("TRANSACTION ROWS AS FILED");
    expect(markup).toContain("2026-09-30");
    expect(markup).toContain("175.5");
    expect(markup).toContain("raw XML SHA-256");
    expect(markup).toContain("https://www.sec.gov/Archives/edgar/data/1045810/0001045810-26-000100-index.html");
    expect(markup).not.toContain("Conviction");
    expect(markup).not.toContain("Accuracy");
    expect(markup).not.toContain("Smart Money Radar");
  });
});
