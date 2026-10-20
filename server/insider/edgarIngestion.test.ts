import { describe, expect, it, vi } from "vitest";
import { getInsiderRadar } from "../insiderIntelligence";
import {
  SEC_EDGAR_INGESTION_ENABLED,
  ingestVerifiedEdgarForm4,
  validateEdgarForm4Claim,
} from "./edgarIngestion";

const filing = {
  accessionNumber: "0000320193-26-000001",
  filingDate: "2026-10-01",
  issuerTicker: "aapl",
  sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/form4.xml",
  transactions: [{
    insiderName: "Example Insider",
    role: "CEO",
    transactionCode: "P",
    shares: 100,
    pricePerShare: 180,
    acquiredOrDisposed: "A",
  }],
  provenance: {
    provider: "SEC EDGAR",
    retrievedAt: "2026-10-02T00:00:00Z",
    filingIndexUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/0000320193-26-000001-index.html",
  },
};

describe("SEC EDGAR ingestion stays disabled", () => {
  it("requires accession, filing date, transactions, source link, and provenance", () => {
    expect(validateEdgarForm4Claim(filing).ok).toBe(true);
    expect(validateEdgarForm4Claim({ ...filing, accessionNumber: "not-an-accession" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, filingDate: "" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, transactions: [] }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, sourceUrl: "https://example.com/form4" }).ok).toBe(false);
    expect(validateEdgarForm4Claim({ ...filing, provenance: { ...filing.provenance, provider: "generated" } }).ok).toBe(false);
  });

  it("does not fetch and does not return a filing while the source constant is false", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(SEC_EDGAR_INGESTION_ENABLED).toBe(false);
    expect(ingestVerifiedEdgarForm4(filing)).toEqual({ status: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("marks the synthetic radar as a generator record", async () => {
    const radar = await getInsiderRadar();
    expect(radar.recordClass).toBe("synthetic_generator");
    expect(radar.genuineSecFiling).toBe(false);
  });
});
