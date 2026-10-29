import { describe, expect, it, vi } from "vitest";
import {
  evaluateExpiredEntries,
  evaluateLedgerEntry,
  type DecisionLedgerEvaluationPersistence,
  type HorizonEvaluationSources,
  type LedgerEntryForEvaluation,
} from "./decisionLedgerEvaluator";
import type { CoinOHLCBar } from "./coingeckoProxy";
import type { YahooDailyBar } from "./yahooProxy";

const issuedAt = new Date("2026-01-05T22:00:00.000Z");
const horizonAt = new Date("2026-01-12T22:00:00.000Z");
const receiptAt = new Date("2026-01-14T22:00:00.000Z");

function entry(overrides: Partial<LedgerEntryForEvaluation> = {}): LedgerEntryForEvaluation {
  return {
    id: 41,
    ticker: "NVDA",
    assetType: "stock",
    verdict: "BUY",
    recommendationType: "positive",
    opportunityScore: 0,
    confidence: 0,
    primaryDriver: "Test-only driver",
    expectedTimeframe: "1 week",
    // This pre-existing field intentionally disagrees with the source baseline.
    // It is retained in provenance as unverified legacy data and never scored.
    priceAtEntry: 999,
    createdAt: issuedAt,
    ...overrides,
  };
}

function yahooBar(timestamp: string, close: number): YahooDailyBar {
  return {
    // Yahoo daily chart stamps are provider timestamps; selection uses the
    // corresponding completed NYSE session close, not this raw timestamp.
    timestamp: Date.parse(timestamp),
    close,
    open: close,
    high: close,
    low: close,
    volume: 1,
  };
}

function sources(stockBars: YahooDailyBar[] = []): HorizonEvaluationSources {
  return {
    getStockDailyBars: vi.fn().mockResolvedValue(stockBars),
    getCryptoDailyBars: vi.fn().mockResolvedValue([] as CoinOHLCBar[]),
  };
}

describe("Decision Ledger horizon evaluation", () => {
  it("finalizes from the designated-horizon bar pair, not the stored entry/current price", async () => {
    const historical = sources([
      yahooBar("2026-01-05T14:30:00.000Z", 100),
      // This much-later bar must not replace the first completed horizon close.
      yahooBar("2026-01-14T14:30:00.000Z", 500),
      yahooBar("2026-01-13T14:30:00.000Z", 107),
    ]);

    const result = await evaluateLedgerEntry(entry(), {
      now: receiptAt,
      sources: historical,
    });

    expect(result).toMatchObject({
      outcome: "correct",
      evaluationState: "verified",
      priceAtResolution: 107,
    });
    expect(result.provenance).toMatchObject({
      decisionLedgerId: 41,
      sourceProvider: "yahoo_finance_chart_daily",
      assetSymbol: "NVDA",
      originalIssuedAt: issuedAt,
      horizonAt,
      entryPrice: 100,
      horizonPrice: 107,
      returnPct: 7,
      outcome: "correct",
      receivedAt: receiptAt,
      reason: "horizon_observation_verified",
    });
    expect(result.provenance.entryObservationAt).toEqual(
      new Date("2026-01-05T14:30:00.000Z")
    );
    expect(result.provenance.horizonObservationAt).toEqual(
      new Date("2026-01-13T14:30:00.000Z")
    );
    expect(result.provenance.evidence).toMatchObject({
      originalStoredEntryPrice: 999,
      originalStoredEntryPriceStatus: "unverified_legacy_row_not_used_for_scoring",
      receiptMeaning: expect.stringContaining("not a provider observation time"),
    });
    expect(historical.getStockDailyBars).toHaveBeenCalledWith(
      "NVDA",
      "2025-12-22",
      "2026-01-26"
    );
  });

  it("keeps an entry pending/unverifiable when no completed horizon observation exists", async () => {
    const result = await evaluateLedgerEntry(entry(), {
      now: receiptAt,
      sources: sources([yahooBar("2026-01-05T14:30:00.000Z", 100)]),
    });

    expect(result).toMatchObject({
      outcome: null,
      evaluationState: "pending_unverifiable",
      priceAtResolution: null,
    });
    expect(result.provenance).toMatchObject({
      sourceProvider: "yahoo_finance_chart_daily",
      reason: "horizon_or_entry_observation_unavailable",
      originalIssuedAt: issuedAt,
      horizonAt,
      outcome: null,
    });
  });

  it("keeps macro entries pending and does not need a provider or an LLM", async () => {
    const historical = sources();
    const result = await evaluateLedgerEntry(entry({ ticker: null, assetType: null }), {
      now: receiptAt,
      sources: historical,
    });

    expect(result).toMatchObject({
      outcome: null,
      evaluationState: "pending_unverifiable",
    });
    expect(result.provenance).toMatchObject({
      sourceProvider: null,
      reason: "asset_not_supported_for_horizon_price_evaluation",
    });
    expect(historical.getStockDailyBars).not.toHaveBeenCalled();
    expect(historical.getCryptoDailyBars).not.toHaveBeenCalled();
  });

  it("records source evidence but remains pending when the original direction is unestablished", async () => {
    const result = await evaluateLedgerEntry(
      entry({ verdict: "WAIT", recommendationType: "unestablished" }),
      {
        now: receiptAt,
        sources: sources([
          yahooBar("2026-01-05T14:30:00.000Z", 100),
          yahooBar("2026-01-13T14:30:00.000Z", 93),
        ]),
      }
    );

    expect(result).toMatchObject({
      outcome: null,
      evaluationState: "pending_unverifiable",
    });
    expect(result.provenance).toMatchObject({
      reason: "unestablished_direction",
      entryPrice: 100,
      horizonPrice: 93,
      sourceProvider: "yahoo_finance_chart_daily",
    });
  });
});

describe("Decision Ledger automatic persistence", () => {
  it("delegates verified receipt/finalization to one atomic persistence operation", async () => {
    const order: string[] = [];
    const persistence: DecisionLedgerEvaluationPersistence = {
      pendingEntries: vi.fn().mockResolvedValue([entry()]),
      persistEvaluation: vi.fn(async (_id, result) => {
        order.push(`persist:${result.provenance.reason}:${result.outcome}`);
        return "finalized";
      }),
    };

    const summary = await evaluateExpiredEntries({
      now: receiptAt,
      sources: sources([
        yahooBar("2026-01-05T14:30:00.000Z", 100),
        yahooBar("2026-01-13T14:30:00.000Z", 107),
      ]),
      persistence,
    });

    expect(summary).toMatchObject({ evaluated: 1, skipped: 0, unverifiable: 0, errors: 0 });
    expect(order).toEqual([
      "persist:horizon_observation_verified:correct",
    ]);
  });

  it("persists an unverifiable receipt without relabelling the pending original row", async () => {
    const persistEvaluation = vi.fn().mockResolvedValue("unverifiable_recorded");
    const persistence: DecisionLedgerEvaluationPersistence = {
      pendingEntries: vi.fn().mockResolvedValue([entry()]),
      persistEvaluation,
    };

    const summary = await evaluateExpiredEntries({
      now: receiptAt,
      sources: sources([yahooBar("2026-01-05T14:30:00.000Z", 100)]),
      persistence,
    });

    expect(summary).toMatchObject({ evaluated: 0, unverifiable: 1, errors: 0 });
    expect(summary.results).toEqual([
      expect.objectContaining({ id: 41, outcome: "pending", evaluationState: "pending_unverifiable" }),
    ]);
    expect(persistEvaluation).toHaveBeenCalledWith(
      41,
      expect.objectContaining({ outcome: null, evaluationState: "pending_unverifiable" })
    );
  });

  it("fails closed when the atomic persistence transaction cannot commit", async () => {
    const persistence: DecisionLedgerEvaluationPersistence = {
      pendingEntries: vi.fn().mockResolvedValue([entry()]),
      persistEvaluation: vi.fn().mockRejectedValue(new Error("provenance table unavailable")),
    };

    const summary = await evaluateExpiredEntries({
      now: receiptAt,
      sources: sources([
        yahooBar("2026-01-05T14:30:00.000Z", 100),
        yahooBar("2026-01-13T14:30:00.000Z", 107),
      ]),
      persistence,
    });

    expect(summary).toMatchObject({ evaluated: 0, unverifiable: 0, errors: 1 });
  });

  it("does not count a manual/concurrent compare-and-set loser as finalized", async () => {
    const persistence: DecisionLedgerEvaluationPersistence = {
      pendingEntries: vi.fn().mockResolvedValue([entry()]),
      persistEvaluation: vi.fn().mockResolvedValue("manual_resolution"),
    };

    const summary = await evaluateExpiredEntries({
      now: receiptAt,
      sources: sources([
        yahooBar("2026-01-05T14:30:00.000Z", 100),
        yahooBar("2026-01-13T14:30:00.000Z", 107),
      ]),
      persistence,
    });

    expect(summary).toMatchObject({ evaluated: 0, skipped: 1, unverifiable: 0, errors: 0 });
    expect(summary.results).toEqual([]);
  });
});
