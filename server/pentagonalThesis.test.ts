import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPentagonalThesis,
  findThesisIntegrityViolations,
  scenarioIsInvalidated,
  scoreThesisOutcome,
  thesisStatements,
  type CompletedBar,
  type PentagonalThesisInput,
  type ThesisRecordPlan,
} from "../shared/pentagonalThesis";
import { composeStockPentagonalThesis } from "./pentagonalThesisCompose";
import { assertAppendOnlyPlan, maybeAppendThesisRecord, planAppendOnlyRecord, thesisRecordWritesEnabled } from "./pentagonalThesisRecord";
import { assertPentagonalThesisRateLimit, resetPentagonalThesisRateLimit } from "./routers/pentagonalThesis";
import { dropOpenSessionBar, type YahooQuote } from "./yahooProxy";

const root = resolve(import.meta.dirname, "..");
const NOW = "2026-10-27T15:00:00.000Z";

function bars(count = 20, close = 100): CompletedBar[] {
  return Array.from({ length: count }, (_, index) => ({
    high: close + 10,
    low: close - 10,
    close,
    volume: 1_000_000,
    timestamp: new Date(Date.parse("2026-10-26T20:00:00.000Z") - (count - 1 - index) * 86_400_000).toISOString(),
  }));
}

function input(overrides: Partial<PentagonalThesisInput> = {}): PentagonalThesisInput {
  return {
    symbol: "aapl",
    generatedAt: NOW,
    quote: {
      price: 102,
      previousClose: 100,
      volume: 2_000_000,
      changePercent: null,
      source: "yahoo",
      observedAt: NOW,
      fetchedAt: NOW,
      delayed: true,
    },
    bars: bars(),
    market: null,
    profile: null,
    ...overrides,
  };
}

const SURFACES = [
  "client/src/pages/UniversalSymbolIntelligence.tsx",
  "client/src/pages/SignalDetail.tsx",
  "client/src/pages/Signals.tsx",
  "client/src/pages/Watchlist.tsx",
  "client/src/pages/mobile/MobileWatchlist.tsx",
  "client/src/components/HomeStockIntelSection.tsx",
  "client/src/pages/seo/AIStocksDashboard.tsx",
  "client/src/pages/seo/DynamicStockPage.tsx",
  "client/src/pages/seo/StockSignalPage.tsx",
  "client/src/pages/StockHeatmap.tsx",
  "client/src/pages/Now.tsx",
  "client/src/pages/Why.tsx",
  "client/src/pages/Outlook.tsx",
  "client/src/pages/Watch.tsx",
  "client/src/pages/Act.tsx",
];

describe("Pentagonal Thesis engine", () => {
  it("builds the same five-section thesis from the same observations", () => {
    const first = buildPentagonalThesis(input());
    const second = buildPentagonalThesis(input());
    expect(second).toEqual(first);
    expect(first.sections.happening.title).toBe("What's happening");
    expect(first.sections.why.title).toBe("Why");
    expect(first.sections.next.title).toBe("What's next");
    expect(first.sections.watch.title).toBe("What to watch");
    expect(first.sections.do.title).toBe("What to do");
    expect(first.integrity.ok).toBe(true);
    expect(first.sections.next.scenarios.map(scenario => scenario.id)).toEqual(["bull", "base", "bear"]);
  });

  it("does not cite missing or stale observations as drivers", () => {
    const missing = buildPentagonalThesis(input({ quote: null, bars: [], market: null, profile: null }));
    expect(missing.items.every(entry => entry.driver === false)).toBe(true);
    expect(missing.gaps.some(entry => entry.field === "price" && entry.citedAsDriver === false)).toBe(true);
    expect(missing.sections.next.scenarios.every(scenario => scenario.confidence === "insufficient")).toBe(true);
    expect(missing.pressureIncluded).toBe(false);

    const stale = buildPentagonalThesis(input({
      quote: {
        price: 50,
        previousClose: 49,
        volume: 10,
        changePercent: 2,
        source: "yahoo",
        observedAt: "2026-01-01T00:00:00.000Z",
        fetchedAt: "2026-01-01T00:00:00.000Z",
        delayed: true,
      },
      bars: bars().map(bar => ({ ...bar, timestamp: "2026-01-01T00:00:00.000Z" })),
    }));
    expect(stale.items.filter(entry => entry.id.startsWith("happening:")).every(entry => entry.driver === false)).toBe(true);
    expect(stale.gaps.some(entry => entry.field === "price")).toBe(true);
    expect(stale.gaps.some(entry => entry.field === "bars")).toBe(true);
  });

  it("sketches scenarios from a fresh range and measures invalidation without a likelihood", () => {
    const thesis = buildPentagonalThesis(input());
    const bull = thesis.sections.next.scenarios[0]!;
    const base = thesis.sections.next.scenarios[1]!;
    const bear = thesis.sections.next.scenarios[2]!;
    expect(bull.confidence).toBe("moderate");
    expect(bull.invalidationMeasurable).toBe(true);
    expect(scenarioIsInvalidated(bull, 89)).toBe(true);
    expect(scenarioIsInvalidated(bull, 90)).toBe(true);
    expect(scenarioIsInvalidated(bull, 100)).toBe(false);
    expect(scenarioIsInvalidated(base, 100)).toBe(false);
    expect(scenarioIsInvalidated(base, 90)).toBe(true);
    expect(scenarioIsInvalidated(base, 110)).toBe(true);
    expect(scenarioIsInvalidated(base, 121)).toBe(true);
    expect(scenarioIsInvalidated(bear, 121)).toBe(true);
    expect(scenarioIsInvalidated(bear, 110)).toBe(true);
    expect(scenarioIsInvalidated(bear, 100)).toBe(false);
    expect(bull.invalidation.toLowerCase()).toContain("at or below");
    expect(thesis.sections.do.summary.toLowerCase()).toContain("not a recommendation to buy, sell");
  });

  it("includes pressure and regime only when the canonical reading is fresh, and labels the link as a hypothesis", () => {
    const fresh = buildPentagonalThesis(input({
      market: { pressureIndex: 42, regime: "MODERATE RISK", source: "canonical-intelligence-state", observedAt: NOW, usable: true },
    }));
    expect(fresh.pressureIncluded).toBe(true);
    expect(fresh.regimeIncluded).toBe(true);
    expect(fresh.items.find(entry => entry.id === "happening:pressure")?.driver).toBe(true);
    expect(fresh.items.find(entry => entry.id === "why:market-hypothesis")?.epistemic).toBe("hypothesis");
    expect(fresh.items.find(entry => entry.id === "why:market-hypothesis")?.driver).toBe(false);

    const stale = buildPentagonalThesis(input({
      market: { pressureIndex: 42, regime: "MODERATE RISK", source: "canonical-intelligence-state", observedAt: "2026-01-01T00:00:00.000Z", usable: true },
    }));
    expect(stale.pressureIncluded).toBe(false);
    expect(stale.regimeIncluded).toBe(false);
    expect(stale.items.some(entry => entry.id === "happening:pressure")).toBe(false);
  });

  it("rejects fabricated probabilities, trade calls, and missing-data drivers", () => {
    const thesis = buildPentagonalThesis(input());
    const text = thesisStatements(thesis).join("\n");
    expect(text).not.toMatch(/\bprobabilit/i);
    expect(text).not.toMatch(/\bearly[- ]warning\b/i);
    expect(text).not.toMatch(/\bhistorical accuracy\b/i);
    expect(thesis.gaps.some(entry => entry.field === "insider")).toBe(true);
    const forged = structuredClone(thesis);
    forged.headline = "There is a 70% probability of a crash.";
    forged.items[0]!.driver = true;
    forged.items[0]!.stale = true;
    expect(findThesisIntegrityViolations(forged).length).toBeGreaterThan(0);
  });

  it("plans an append-only version and refuses outcome scoring", () => {
    const thesis = buildPentagonalThesis(input());
    const priorPayload = "{\"frozen\":true}";
    const prior = { recordId: "prior-record", thesisVersion: 3, payloadJson: priorPayload };
    const plan = planAppendOnlyRecord(prior, thesis, "next-record");
    expect(prior.payloadJson).toBe(priorPayload);
    expect(plan.thesisVersion).toBe(4);
    expect(plan.supersedesRecordId).toBe("prior-record");
    expect(plan.outcomeStatus).toBe("UNSCORED");
    expect(plan.payloadJson).not.toContain("prior-record");
    expect(() => scoreThesisOutcome()).toThrow(/future hook only/);
    expect(thesisRecordWritesEnabled({})).toBe(false);
    expect(thesisRecordWritesEnabled({ PENTAGONAL_THESIS_RECORD_WRITES: "true" })).toBe(true);
  });

  it("does not write a record while the flag is off", async () => {
    const thesis = buildPentagonalThesis(input());
    const status = await maybeAppendThesisRecord(thesis, {});
    expect(status).toEqual({ written: false, reason: "PENTAGONAL_THESIS_RECORD_WRITES is off" });
  });

  it("composes the same thesis for two callers from the same observations", async () => {
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
    const deps = {
      getQuote: async () => quote,
      getDailyBars: async () => bars().map(bar => ({
        close: bar.close,
        open: bar.close,
        high: bar.high,
        low: bar.low,
        volume: bar.volume ?? 0,
        timestamp: Date.parse(bar.timestamp),
      })),
      getMarket: async () => null,
      getProfile: async () => null,
    };
    const first = await composeStockPentagonalThesis("aapl", { now: new Date(NOW), deps, useCache: false });
    const second = await composeStockPentagonalThesis("AAPL", { now: new Date(NOW), deps, useCache: false });
    expect(second.symbol).toBe(first.symbol);
    expect(second.sections).toEqual(first.sections);
    expect(first.persistence?.written).toBe(false);
  });

  it("keeps every stock surface on the shared narrative and leaves record writes off", () => {
    for (const path of SURFACES) {
      const source = readFileSync(resolve(root, path), "utf8");
      expect(source, path).toContain("PentagonalThesisNarrative");
    }
    const record = readFileSync(resolve(root, "server/pentagonalThesisRecord.ts"), "utf8");
    const compose = readFileSync(resolve(root, "server/pentagonalThesisCompose.ts"), "utf8");
    const migration = readFileSync(resolve(root, "drizzle/0075_pentagonal_thesis_records.sql"), "utf8");
    expect(existsSync(resolve(root, "drizzle/0072_pentagonal_thesis_records.sql"))).toBe(false);
    const journal = JSON.parse(readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string; when: number }> };
    const entry = journal.entries.find(item => item.tag === "0075_pentagonal_thesis_records");
    expect(entry?.when).toBeGreaterThan(1792100000000);
    expect(journal.entries.some(item => item.tag.startsWith("0072_pentagonal"))).toBe(false);
    expect(record).not.toContain("db.update(");
    expect(record).not.toContain(".update(pentagonalThesisRecords");
    expect(record).not.toContain("db.delete(");
    expect(record).toContain(".insert(");
    expect(record).toContain("assertAppendOnlyPlan");
    expect(migration).toContain("pentagonalThesisOutcomeScores");
    expect(migration).toContain("BEFORE UPDATE");
    expect(migration).toContain("BEFORE DELETE");
    expect(compose).not.toContain("calculateFaultlinePressure");
    expect(compose).not.toContain("crisisProbability");
    expect(migration).toContain("Do not apply");
    expect(readFileSync(resolve(root, ".env.example"), "utf8")).toContain("PENTAGONAL_THESIS_RECORD_WRITES=");
    expect(readFileSync(resolve(root, "client/src/pages/UniversalSymbolIntelligence.tsx"), "utf8")).toContain("not applied to crypto symbols");
    expect(readFileSync(resolve(root, "client/src/pages/mobile/MobileWatchlist.tsx"), "utf8")).not.toContain("stockItems[0]");
    expect(readFileSync(resolve(root, "server/pentagonalThesisCompose.ts"), "utf8")).not.toContain("observedAt: new Date()");
    expect(readFileSync(resolve(root, "client/src/components/HomeStockIntelSection.tsx"), "utf8")).not.toContain("495+ MORE ASSETS LOCKED");
    expect(readFileSync(resolve(root, "client/src/components/HomeStockIntelSection.tsx"), "utf8")).not.toContain("Signal Classification System");
  });

  it("rejects a mixed-age bar series and keeps only the contiguous recent tail", () => {
    const series = bars(20);
    series[0] = { ...series[0]!, timestamp: "2020-01-02T20:00:00.000Z" };
    const thesis = buildPentagonalThesis(input({ bars: series }));
    expect(thesis.gaps.some(entry => entry.field === "bars-contiguity" && entry.citedAsDriver === false)).toBe(true);
    expect(thesis.items.some(entry => entry.id === "happening:range")).toBe(false);
    expect(thesis.items.find(entry => entry.id === "happening:last-close")?.driver).toBe(true);
    expect(thesis.items.find(entry => entry.id === "happening:momentum")?.driver).toBe(true);
  });

  it("treats a profile without a provider as-of as unverified", async () => {
    const unverified = await composeStockPentagonalThesis("AAPL", {
      now: new Date(NOW),
      useCache: false,
      deps: {
        getQuote: async () => null,
        getDailyBars: async () => [],
        getMarket: async () => null,
        getProfile: async () => ({
          name: null,
          sector: "Technology",
          industry: "Hardware",
          marketCap: 1_000,
          trailingPe: 20,
          earningsDate: NOW,
          source: "yahoo-quote-summary",
          observedAt: null,
        }),
      },
    });
    expect(unverified.items.some(entry => entry.id === "happening:sector")).toBe(false);
    expect(unverified.gaps.some(entry => entry.field === "profile" && /as-of/i.test(entry.reason) && entry.citedAsDriver === false)).toBe(true);

    const verified = await composeStockPentagonalThesis("AAPL", {
      now: new Date(NOW),
      useCache: false,
      deps: {
        getQuote: async () => null,
        getDailyBars: async () => [],
        getMarket: async () => null,
        getProfile: async () => ({
          name: null,
          sector: "Technology",
          industry: null,
          marketCap: null,
          trailingPe: null,
          earningsDate: null,
          source: "yahoo-quote-summary",
          observedAt: NOW,
        }),
      },
    });
    expect(verified.items.find(entry => entry.id === "happening:sector")?.driver).toBe(true);
    expect(verified.items.find(entry => entry.id === "happening:sector")?.timestamp).toBe(NOW);
  });

  it("drops an in-progress session bar and keeps a completed one", () => {
    const start = 1_700_000_000;
    const end = start + 6 * 60 * 60;
    const meta = { currentTradingPeriod: { regular: { start, end } } };
    const completed = { timestamp: (start - 20 * 60 * 60) * 1000, close: 1 };
    const openBar = { timestamp: start * 1000, close: 2 };
    expect(dropOpenSessionBar([completed, openBar], meta, (start + 60) * 1000)).toEqual([completed]);
    expect(dropOpenSessionBar([completed, openBar], meta, (end + 60) * 1000)).toEqual([completed, openBar]);
  });

  it("refuses a plan that would rewrite the prior record", () => {
    const thesis = buildPentagonalThesis(input());
    const prior = { recordId: "prior-record", thesisVersion: 3, payloadJson: "{\"frozen\":true}" };
    const plan = planAppendOnlyRecord(prior, thesis, "next-record");
    expect(prior.payloadJson).toBe("{\"frozen\":true}");
    const rewritten: ThesisRecordPlan = { ...plan, recordId: prior.recordId, thesisVersion: prior.thesisVersion, supersedesRecordId: null };
    expect(() => assertAppendOnlyPlan(prior, rewritten)).toThrow(/rewrite/);
  });

  it("rate-limits the public thesis procedure", () => {
    resetPentagonalThesisRateLimit();
    for (let i = 0; i < 60; i += 1) assertPentagonalThesisRateLimit("test-ip", 1_000);
    expect(() => assertPentagonalThesisRateLimit("test-ip", 1_000)).toThrow(/Too many thesis requests/);
    expect(() => assertPentagonalThesisRateLimit("other-ip", 1_000)).not.toThrow();
    resetPentagonalThesisRateLimit();
  });
});
