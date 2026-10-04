import { beforeEach, describe, expect, it, vi } from "vitest";

const { reading, getSectorRotationReading } = vi.hoisted(() => {
  const reading = { schemaVersion: 1, methodVersion: "sector-rotation-v1.0.0", status: "OK", sectors: [] };
  return { reading, getSectorRotationReading: vi.fn(async () => reading) };
});
vi.mock("./sectorRotation/service", () => ({ getSectorRotationReading }));

import { sectorRotationRouter } from "./routers/sectorRotation";
import { parseSsgaHoldings } from "./sectorRotation/universe";

describe("sectorRotation router", () => {
  beforeEach(() => getSectorRotationReading.mockClear());
  it("current returns the service reading for anonymous callers (read-only query)", async () => {
    const caller = sectorRotationRouter.createCaller({ req: {} as never, res: {} as never, user: null } as never);
    await expect(caller.current()).resolves.toBe(reading);
    expect(getSectorRotationReading).toHaveBeenCalledTimes(1);
  });
  it("exposes only a query (no mutations)", () => {
    const procs = (sectorRotationRouter as any)._def.procedures;
    expect(Object.keys(procs)).toEqual(["current"]);
    expect(procs.current._def.type).toBe("query");
  });
  it("is mounted on the app router as sectorRotation", async () => {
    const { appRouter } = await import("./routers");
    expect(Object.keys((appRouter as any)._def.record)).toContain("sectorRotation");
  });
});

describe("SSGA holdings parser (S&P 500 universe)", () => {
  const rows = [
    ["Fund Name:", "State Street Financial Select Sector SPDR ETF"], ["Ticker Symbol:", "XLF"], ["Holdings:", "As of 01-Oct-2026"], [],
    ["Name", "Ticker", "Identifier", "SEDOL", "Weight", "Sector", "Shares Held", "Local Currency"],
    ["BERKSHIRE HATHAWAY INC CL B", "BRK.B", "084670702", "2073390", 12.1, "-", 1, "USD"],
    ["JPMORGAN CHASE + CO", "JPM", "46625H100", "2190385", 10.2, "-", 1, "USD"],
    ["XAF FINANCIAL     DEC26", "IXAZ6", "ADI394XV5", "-", -0.01, "-", 1, "USD"],
    ["SSI US GOV MONEY MARKET CLASS", "-", "924QSGII3", "-", 0.05, "-", 1, "USD"],
    ["TPG INC", "2602335D", "436CVR021", "-", 0.0001, "-", 1, "USD"],
    [], ["Before investing in a fund, consider ..."],
  ];
  it("keeps equity rows only, maps share classes to Yahoo form, and reads the as-of date", () => {
    expect(parseSsgaHoldings(rows, "XLF")).toEqual({
      asOf: "2026-10-01",
      members: [{ ticker: "BRK-B", name: "BERKSHIRE HATHAWAY INC CL B", sectorEtf: "XLF" }, { ticker: "JPM", name: "JPMORGAN CHASE + CO", sectorEtf: "XLF" }],
    });
  });
  it("returns no members for an unrecognised file (caller marks the universe UNAVAILABLE)", () => {
    expect(parseSsgaHoldings([["<html>"]], "XLF").members).toEqual([]);
  });
});
