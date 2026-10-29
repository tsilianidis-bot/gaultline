import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/InsiderIntelligence.tsx", import.meta.url), "utf8");
const edgar = readFileSync(new URL("./insider/edgarIngestion.ts", import.meta.url), "utf8");

describe("insider source containment and official-record handoff", () => {
  it("wires only company to the official reader and keeps synthetic procedures fail-closed", () => {
    expect(routers).not.toMatch(/getInsiderRadar|getInsiderCompany|getInsiderAlertsForTicker/);
    expect(routers).toContain('import { readOfficialEdgarInsiderFilings, type EdgarTickerReadResult } from "./insider/edgarIngestion";');
    expect(routers).toContain("readOfficialEdgarInsiderFilings(input.ticker)");
    expect(routers).not.toContain("InsiderCompanyOutput");
    expect(routers).toContain("query((): InsiderRadarOutput =>");
    expect(routers).toContain("convictionBand: ConvictionBand;");
    const throws = routers.match(/Insider Intelligence unavailable: source verification required\./g) ?? [];
    expect(throws.length).toBeGreaterThanOrEqual(2);
  });

  it("limits the owned reader to declared-contact official SEC ownership filings and never admits 13F as insider activity", () => {
    expect(edgar).toContain("SEC_EDGAR_USER_AGENT");
    expect(edgar).toContain('"Accept-Encoding": "gzip, deflate"');
    expect(edgar).toContain("SEC_EDGAR_MAX_REQUESTS_PER_SECOND = 4");
    expect(edgar).toContain('const OWNERSHIP_FORMS = new Set(["3", "3/A", "4", "4/A", "5", "5/A"])');
    expect(edgar).not.toContain('"13F-HR"');
    expect(edgar).toContain("readOfficialEdgarInsiderFilings");
    expect(edgar).toContain("rawDocumentSha256");
  });

  it("renders only raw official filing fields on the owned customer page", () => {
    expect(page).toContain("OFFICIAL SOURCE UNAVAILABLE");
    expect(page).toContain("TRANSACTION ROWS AS FILED");
    expect(page).toContain("Form 13F and inferred conviction, rankings, accuracy, and signals are not used or displayed.");
    expect(page).not.toContain("Smart Money Radar");
    expect(page).not.toContain("Insider Accuracy Rating");
    expect(page).not.toContain("ConvictionGauge");
  });
});
