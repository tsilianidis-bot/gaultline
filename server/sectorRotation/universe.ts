/**
 * S&P 500 constituent universe from the 11 Select Sector SPDR daily holdings
 * files (State Street). Pure parser — fetching lives in ./service.ts.
 */
import type { SectorEtfTicker } from "../../shared/sectorRotation";
import type { UniverseMember } from "./calc";

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
/** Parses one SSGA holdings sheet (rows as arrays). Equity rows only: ticker shape + a SEDOL (futures/cash rows have "-"). */
export function parseSsgaHoldings(rows: unknown[][], etf: SectorEtfTicker): { asOf: string | null; members: UniverseMember[] } {
  let asOf: string | null = null;
  const asOfRow = rows.find(r => String(r?.[0] ?? "").startsWith("Holdings"));
  const m = String(asOfRow?.[1] ?? "").match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (m && MONTHS[m[2].toUpperCase()]) asOf = `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1]}`;
  const header = rows.findIndex(r => r?.[0] === "Name" && r?.[1] === "Ticker");
  if (header < 0) return { asOf, members: [] };
  const members: UniverseMember[] = [];
  for (const r of rows.slice(header + 1)) {
    const name = typeof r?.[0] === "string" ? r[0].trim() : "";
    const ticker = typeof r?.[1] === "string" ? r[1].trim() : "";
    const sedol = typeof r?.[3] === "string" ? r[3].trim() : String(r?.[3] ?? "");
    if (!name || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker) || !sedol || sedol === "-") continue;
    members.push({ ticker: ticker.replace(".", "-"), name, sectorEtf: etf });
  }
  return { asOf, members };
}
