/* ============================================================
   FAULTLINE — Insider Intelligence™ Engine Tests
   ============================================================ */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock LLM so tests run without API calls ───────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mock AI interpretation for testing." } }],
  }),
}));

import {
  getInsiderRadar,
  getInsiderCompany,
  getInsiderAlertsForTicker,
  type InsiderRadarOutput,
  type InsiderCompanyOutput,
  type ConvictionBand,
  type SellingClassification,
} from "./insiderIntelligence";

// ── Helpers ───────────────────────────────────────────────────
const VALID_CONVICTION_BANDS: ConvictionBand[] = [
  "Exceptional Conviction",
  "Strong Conviction",
  "Moderate Conviction",
  "Neutral",
  "Weak Conviction",
  "Negative Insider Signal",
];

const VALID_SELLING_CLASSIFICATIONS: SellingClassification[] = [
  "Normal", "Elevated", "Aggressive", "Unusual",
];

// ── getInsiderRadar ───────────────────────────────────────────
describe("getInsiderRadar", () => {
  let radar: InsiderRadarOutput;

  beforeEach(async () => {
    radar = await getInsiderRadar();
  });

  it("returns a valid InsiderRadarOutput shape", () => {
    expect(radar).toBeDefined();
    expect(Array.isArray(radar.radar)).toBe(true);
    expect(Array.isArray(radar.clusterAlerts)).toBe(true);
    expect(Array.isArray(radar.topSellingAlerts)).toBe(true);
    expect(typeof radar.weeklyStats).toBe("object");
  });

  it("radar contains at least 5 entries", () => {
    expect(radar.radar.length).toBeGreaterThanOrEqual(5);
  });

  it("each radar entry has required fields", () => {
    for (const entry of radar.radar) {
      expect(typeof entry.ticker).toBe("string");
      expect(entry.ticker.length).toBeGreaterThan(0);
      expect(typeof entry.company).toBe("string");
      expect(typeof entry.rank).toBe("number");
      expect(typeof entry.convictionScore).toBe("number");
      expect(typeof entry.dollarAmount).toBe("number");
      expect(typeof entry.activity).toBe("string");
      expect(typeof entry.convictionBand).toBe("string");
      expect(["green", "yellow", "red"]).toContain(entry.signalColor);
      expect(["improving", "neutral", "weakening"]).toContain(entry.trend);
    }
  });

  it("conviction scores are in range 0-100", () => {
    for (const entry of radar.radar) {
      expect(entry.convictionScore).toBeGreaterThanOrEqual(0);
      expect(entry.convictionScore).toBeLessThanOrEqual(100);
    }
  });

  it("conviction bands are valid", () => {
    for (const entry of radar.radar) {
      expect(VALID_CONVICTION_BANDS).toContain(entry.convictionBand);
    }
  });

  it("ranks are sequential starting from 1", () => {
    const ranks = radar.radar.map(e => e.rank);
    for (let i = 0; i < ranks.length; i++) {
      expect(ranks[i]).toBe(i + 1);
    }
  });

  it("radar is sorted by conviction score descending", () => {
    for (let i = 0; i < radar.radar.length - 1; i++) {
      expect(radar.radar[i].convictionScore).toBeGreaterThanOrEqual(radar.radar[i + 1].convictionScore);
    }
  });

  it("weeklyStats has all required fields", () => {
    const ws = radar.weeklyStats;
    expect(typeof ws.totalBuyValue).toBe("number");
    expect(typeof ws.totalSellValue).toBe("number");
    expect(typeof ws.netSentiment).toBe("number");
    expect(typeof ws.activeTickers).toBe("number");
    expect(typeof ws.clusterCount).toBe("number");
    expect(ws.totalBuyValue).toBeGreaterThanOrEqual(0);
    expect(ws.totalSellValue).toBeGreaterThanOrEqual(0);
    expect(ws.activeTickers).toBeGreaterThan(0);
  });

  it("clusterAlerts have valid strength values", () => {
    for (const alert of radar.clusterAlerts) {
      expect(["MODERATE", "HIGH", "EXCEPTIONAL"]).toContain(alert.strength);
      expect(alert.insiderCount).toBeGreaterThanOrEqual(2);
      expect(alert.totalCapital).toBeGreaterThan(0);
      expect(Array.isArray(alert.insiders)).toBe(true);
      expect(alert.insiders.length).toBeGreaterThan(0);
    }
  });

  it("topSellingAlerts have valid classification values", () => {
    for (const alert of radar.topSellingAlerts) {
      expect(VALID_SELLING_CLASSIFICATIONS).toContain(alert.classification);
      expect(alert.saleAmount).toBeGreaterThan(0);
      expect(typeof alert.reason).toBe("string");
      expect(alert.reason.length).toBeGreaterThan(0);
    }
  });

  it("weeklyStats.activeTickers matches radar length", () => {
    expect(radar.weeklyStats.activeTickers).toBe(radar.radar.length);
  });

  it("weeklyStats.clusterCount matches clusterAlerts length", () => {
    expect(radar.weeklyStats.clusterCount).toBe(radar.clusterAlerts.length);
  });
});

// ── getInsiderCompany ─────────────────────────────────────────
describe("getInsiderCompany", () => {
  let result: InsiderCompanyOutput;

  beforeEach(async () => {
    result = await getInsiderCompany("NVDA");
  });

  it("returns a valid InsiderCompanyOutput shape", () => {
    expect(result).toBeDefined();
    expect(typeof result.profile).toBe("object");
    expect(Array.isArray(result.timeline)).toBe(true);
    expect(Array.isArray(result.accuracyHistory)).toBe(true);
  });

  it("profile has all required fields", () => {
    const p = result.profile;
    expect(typeof p.ticker).toBe("string");
    expect(typeof p.company).toBe("string");
    expect(typeof p.convictionScore).toBe("number");
    expect(typeof p.convictionBand).toBe("string");
    expect(typeof p.historicalAccuracy).toBe("number");
    expect(typeof p.impactPoints).toBe("number");
    expect(typeof p.mostRecentFiling).toBe("string");
    expect(typeof p.aiInterpretation).toBe("string");
    expect(typeof p.buyVsSell).toBe("object");
    expect(typeof p.largestInsider).toBe("object");
    expect(Array.isArray(p.sellingAnalysis)).toBe(true);
  });

  it("profile conviction score is in range 0-100", () => {
    expect(result.profile.convictionScore).toBeGreaterThanOrEqual(0);
    expect(result.profile.convictionScore).toBeLessThanOrEqual(100);
  });

  it("profile conviction band is valid", () => {
    expect(VALID_CONVICTION_BANDS).toContain(result.profile.convictionBand);
  });

  it("historical accuracy is in range 0-100", () => {
    expect(result.profile.historicalAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.profile.historicalAccuracy).toBeLessThanOrEqual(100);
  });

  it("impact points are in range -20 to +20", () => {
    expect(result.profile.impactPoints).toBeGreaterThanOrEqual(-20);
    expect(result.profile.impactPoints).toBeLessThanOrEqual(20);
  });

  it("buyVsSell has valid structure", () => {
    const bvs = result.profile.buyVsSell;
    expect(typeof bvs.buyValue).toBe("number");
    expect(typeof bvs.sellValue).toBe("number");
    expect(typeof bvs.buyCount).toBe("number");
    expect(typeof bvs.sellCount).toBe("number");
    expect(bvs.buyValue).toBeGreaterThanOrEqual(0);
    expect(bvs.sellValue).toBeGreaterThanOrEqual(0);
    expect(bvs.buyCount).toBeGreaterThanOrEqual(0);
    expect(bvs.sellCount).toBeGreaterThanOrEqual(0);
  });

  it("timeline entries have required fields", () => {
    for (const ev of result.timeline) {
      expect(typeof ev.date).toBe("string");
      expect(["buy", "sell"]).toContain(ev.type);
      expect(typeof ev.amount).toBe("number");
      expect(typeof ev.label).toBe("string");
      expect(ev.amount).toBeGreaterThan(0);
    }
  });

  it("accuracy history entries have required fields", () => {
    for (const h of result.accuracyHistory) {
      expect(typeof h.period).toBe("string");
      expect(["buy", "sell"]).toContain(h.insiderAction);
      expect(typeof h.subsequentReturn).toBe("number");
      expect(typeof h.wasCorrect).toBe("boolean");
    }
  });

  it("returns consistent results for the same ticker (deterministic)", async () => {
    const r1 = await getInsiderCompany("AAPL");
    const r2 = await getInsiderCompany("AAPL");
    expect(r1.profile.convictionScore).toBe(r2.profile.convictionScore);
    expect(r1.profile.convictionBand).toBe(r2.profile.convictionBand);
    expect(r1.profile.historicalAccuracy).toBe(r2.profile.historicalAccuracy);
  });

  it("returns different results for different tickers", async () => {
    const r1 = await getInsiderCompany("AAPL");
    const r2 = await getInsiderCompany("TSLA");
    // At least one field should differ
    const same = r1.profile.convictionScore === r2.profile.convictionScore &&
      r1.profile.historicalAccuracy === r2.profile.historicalAccuracy;
    expect(same).toBe(false);
  });
});

// ── getInsiderAlertsForTicker ─────────────────────────────────────────────
describe("getInsiderAlertsForTicker", () => {
  it("returns a valid alert shape for a known ticker", async () => {
    const result = await getInsiderAlertsForTicker("NVDA");
    expect(result).toBeDefined();
    expect(typeof result.convictionScore).toBe("number");
    expect(typeof result.convictionBand).toBe("string");
    expect(typeof result.impactPoints).toBe("number");
    expect(typeof result.recentActivity).toBe("string");
    expect(typeof result.aiSummary).toBe("string");
  });

  it("conviction score is in range 0-100", async () => {
    const result = await getInsiderAlertsForTicker("AAPL");
    expect(result.convictionScore).toBeGreaterThanOrEqual(0);
    expect(result.convictionScore).toBeLessThanOrEqual(100);
  });

  it("conviction band is valid", async () => {
    const result = await getInsiderAlertsForTicker("MSFT");
    expect(VALID_CONVICTION_BANDS).toContain(result.convictionBand);
  });

  it("recentActivity is a non-empty string", async () => {
    const result = await getInsiderAlertsForTicker("PLTR");
    expect(result.recentActivity.length).toBeGreaterThan(0);
  });

  it("impact points are in range -20 to +20", async () => {
    const result = await getInsiderAlertsForTicker("TSLA");
    expect(result.impactPoints).toBeGreaterThanOrEqual(-20);
    expect(result.impactPoints).toBeLessThanOrEqual(20);
  });

  it("is deterministic for the same ticker", async () => {
    const r1 = await getInsiderAlertsForTicker("AAPL");
    const r2 = await getInsiderAlertsForTicker("AAPL");
    expect(r1.convictionScore).toBe(r2.convictionScore);
    expect(r1.convictionBand).toBe(r2.convictionBand);
    expect(r1.impactPoints).toBe(r2.impactPoints);
  });
});
