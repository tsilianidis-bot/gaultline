/**
 * Evidence available to check a stored sub-score, from the checked-in FRED
 * fixture `fred-2026-10-12-deep.json` (latest-vintage download of 2026-10-12,
 * observations through 2026-10-09).
 *
 * Daily HY (BAMLH0A0HYM2) and SOFR in that fixture begin on 2026-07-17.
 * They do not cover May 2026, so a stored liquidity 0 for that month cannot
 * be confirmed as the HY<=200 and SOFR<=2 floor. Monthly CPI, PPI, Fed Funds,
 * and unemployment do cover May 2026 and are enough to show that a stored 0
 * for macro, credit, and breadth is not a floor of the v1 formula.
 *
 * This is not a month switch. Each cell is assessed from whatever observations
 * fall on or before that month. The recompute classifies a stored 0 only.
 * A stored non-zero is kept, and a row's own inputs win over this fixture.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dateMatchedYoY, parseFredValue, type StoredVectorInputs } from "./engine";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/fred-2026-10-12-deep.json",
);

type FredObs = { date: string; value: string };
type Fixture = { results: Record<string, { observations?: FredObs[] } | undefined> };

let cached: Fixture | null = null;

function fixture(): Fixture {
  if (!cached) cached = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
  return cached;
}

function observations(seriesId: string): FredObs[] {
  return fixture().results[seriesId]?.observations ?? [];
}

/** First valid observation date in the fixture, if the series has one. */
export function fredFixtureSeriesStart(seriesId: string): string | null {
  let start: string | null = null;
  for (const obs of observations(seriesId)) {
    if (parseFredValue(obs.value) == null || typeof obs.date !== "string") continue;
    if (start == null || obs.date < start) start = obs.date;
  }
  return start;
}

function monthCutoff(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0));
  return last.toISOString().slice(0, 10);
}

function latestOnOrBefore(seriesId: string, cutoff: string): { value: number; date: string } | null {
  let best: { value: number; date: string } | null = null;
  for (const obs of observations(seriesId)) {
    if (typeof obs.date !== "string" || obs.date > cutoff) continue;
    const value = parseFredValue(obs.value);
    if (value == null) continue;
    if (!best || obs.date > best.date) best = { value, date: obs.date };
  }
  return best;
}

export interface FredFixtureEvidence {
  inputs: StoredVectorInputs;
  /** How each input was, or was not, observed. Included in the cell reason. */
  evidence: string;
}

/**
 * v1 inputs observed on or before the end of `month` (YYYY-MM) in the fixture.
 * HY is converted from FRED percent to basis points, matching the live loader.
 * CPI and PPI are date-matched year-over-year percents.
 */
export function fredFixtureInputsForMonth(month: string): FredFixtureEvidence {
  const cutoff = monthCutoff(month);
  const notes: string[] = [`FRED fixture fred-2026-10-12-deep.json, observations on or before ${cutoff}.`];
  const hy = latestOnOrBefore("BAMLH0A0HYM2", cutoff);
  const sofr = latestOnOrBefore("SOFR", cutoff);
  const tsy10 = latestOnOrBefore("DGS10", cutoff);
  const tsy2 = latestOnOrBefore("DGS2", cutoff);
  const fedFunds = latestOnOrBefore("FEDFUNDS", cutoff);
  const unemployment = latestOnOrBefore("UNRATE", cutoff);
  const cpi = dateMatchedYoY(observations("CPIAUCSL").filter(obs => obs.date <= cutoff));
  const ppi = dateMatchedYoY(observations("PPIACO").filter(obs => obs.date <= cutoff));

  const gap = (seriesId: string, found: { date: string } | null) => {
    if (found) {
      notes.push(`${seriesId} observed ${found.date}.`);
      return;
    }
    const start = fredFixtureSeriesStart(seriesId);
    notes.push(start
      ? `${seriesId} has no observation on or before ${cutoff}; the fixture series begins ${start}.`
      : `${seriesId} has no valid observation in the fixture.`);
  };
  gap("BAMLH0A0HYM2", hy);
  gap("SOFR", sofr);
  gap("DGS10", tsy10);
  gap("DGS2", tsy2);
  gap("FEDFUNDS", fedFunds);
  gap("UNRATE", unemployment);
  notes.push(cpi ? `CPI YoY ${cpi.value} dated ${cpi.observationDate}.` : "CPI YoY is not available on or before the month.");
  notes.push(ppi ? `PPI YoY ${ppi.value} dated ${ppi.observationDate}.` : "PPI YoY is not available on or before the month.");

  return {
    inputs: {
      hySpreadBps: hy ? (hy.value > 20 ? hy.value : hy.value * 100) : null,
      sofr: sofr?.value ?? null,
      tsy10y: tsy10?.value ?? null,
      tsy2y: tsy2?.value ?? null,
      fedFunds: fedFunds?.value ?? null,
      unemployment: unemployment?.value ?? null,
      cpiYoy: cpi?.value ?? null,
      ppiYoy: ppi?.value ?? null,
    },
    evidence: notes.join(" "),
  };
}
