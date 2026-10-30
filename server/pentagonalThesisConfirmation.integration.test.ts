import { describe, expect, it } from "vitest";
import type { CompletedBar } from "../shared/pentagonalThesis";
import { composeStockPentagonalThesis } from "./pentagonalThesisCompose";
import type { YahooQuote } from "./yahooProxy";

const NOW = "2026-10-27T15:00:00.000Z";

function bars(count = 20): CompletedBar[] {
  return Array.from({ length: count }, (_, index) => ({
    high: 110,
    low: 90,
    close: 100,
    volume: 1_000_000,
    timestamp: new Date(
      Date.parse("2026-10-26T20:00:00.000Z") - (count - 1 - index) * 86_400_000
    ).toISOString(),
  }));
}

const quote: YahooQuote = {
  ticker: "AAPL",
  price: 102,
  prevClose: 100,
  open: 100,
  high: 110,
  low: 90,
  volume: 2_000_000,
  change: 2,
  changePercent: 2,
  marketState: "REGULAR",
  isDelayed: true,
  source: "yahoo",
  observedAt: Date.parse(NOW),
  fetchedAt: Date.parse(NOW),
};

describe("Pentagonal Thesis confirmation composition", () => {
  it("carries only fresh completed-range confirmation conditions through the shared composer", async () => {
    const withRange = await composeStockPentagonalThesis("aapl", {
      now: new Date(NOW),
      useCache: false,
      deps: {
        getQuote: async () => quote,
        getDailyBars: async () =>
          bars().map(bar => ({
            ...bar,
            open: bar.close,
            timestamp: Date.parse(bar.timestamp),
          })),
        getMarket: async () => null,
        getProfile: async () => null,
      },
    });
    const withoutRange = await composeStockPentagonalThesis("aapl", {
      now: new Date(NOW),
      useCache: false,
      deps: {
        getQuote: async () => quote,
        getDailyBars: async () =>
          bars(19).map(bar => ({
            ...bar,
            open: bar.close,
            timestamp: Date.parse(bar.timestamp),
          })),
        getMarket: async () => null,
        getProfile: async () => null,
      },
    });

    expect(
      withRange.items.find(item => item.id === "happening:range")
    ).toMatchObject({
      fresh: true,
      driver: true,
      source: "completed-daily-bars",
    });
    expect(
      withRange.sections.next.scenarios.map(scenario => scenario.confirmation)
    ).toEqual([
      {
        available: true,
        evidenceIds: ["happening:range"],
        condition:
          "A later completed daily close stays above the reference range low.",
      },
      {
        available: true,
        evidenceIds: ["happening:range"],
        condition:
          "A later completed daily close remains within the reference range.",
      },
      {
        available: true,
        evidenceIds: ["happening:range"],
        condition:
          "A later completed daily close breaks below the reference range low.",
      },
    ]);
    expect(
      withRange.sections.next.scenarios.every(
        scenario => !/\d/.test(scenario.confirmation.condition)
      )
    ).toBe(true);
    expect(withRange.persistence).toEqual({
      written: false,
      reason: "A public read does not record a thesis.",
    });

    expect(
      withoutRange.items.some(
        item => item.id === "happening:range" && item.driver
      )
    ).toBe(false);
    expect(
      withoutRange.sections.next.scenarios.every(
        scenario =>
          scenario.confirmation.available === false &&
          scenario.confirmation.evidenceIds.length === 0
      )
    ).toBe(true);
    expect(
      withoutRange.sections.next.scenarios.every(scenario =>
        scenario.confirmation.condition.includes("Withheld")
      )
    ).toBe(true);
    expect(withoutRange.integrity).toEqual({ ok: true, violations: [] });
  });
});
