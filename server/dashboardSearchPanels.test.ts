import { describe, expect, it } from "vitest";

// ── Mirrors the demo data from DashboardSearchPanels.tsx ──────
const CRYPTO_DEMO: Record<string, {
  name: string; price: string; change: number;
  score: number; riskLevel: string; bias: string;
  momentum: string; signals: string[]; color: string;
}> = {
  BTC:  { name: "Bitcoin",        price: "$97,420", change: +1.84, score: 62, riskLevel: "Elevated", bias: "Bullish",  momentum: "Stable",       signals: ["Macro Sensitive", "Liquidity Fragile"],      color: "#FF9500" },
  ETH:  { name: "Ethereum",       price: "$3,240",  change: +2.31, score: 55, riskLevel: "Moderate", bias: "Bullish",  momentum: "Accelerating", signals: ["Momentum Breakout", "AI Narrative Exposure"], color: "#00D4FF" },
  SOL:  { name: "Solana",         price: "$178",    change: -0.92, score: 71, riskLevel: "High",     bias: "Neutral",  momentum: "Decelerating", signals: ["Speculative Acceleration", "Risk-Off Vulnerable"], color: "#FF2D55" },
  AVAX: { name: "Avalanche",      price: "$38.40",  change: +0.44, score: 58, riskLevel: "Elevated", bias: "Neutral",  momentum: "Stable",       signals: ["Macro Sensitive"],                            color: "#FFD700" },
  RNDR: { name: "Render",         price: "$8.72",   change: +5.12, score: 78, riskLevel: "High",     bias: "Bullish",  momentum: "Accelerating", signals: ["AI Narrative Exposure", "Speculative Acceleration"], color: "#C084FC" },
  HYPE: { name: "Hyperliquid",    price: "$24.15",  change: -2.40, score: 82, riskLevel: "Critical", bias: "Bearish",  momentum: "Reversing",    signals: ["Deleveraging Risk", "Liquidity Fragile"],    color: "#FF2D55" },
};

const STOCK_DEMO: Record<string, {
  name: string; price: string; change: number;
  score: number; action: string; confidence: number;
  signals: string[]; regime: string; color: string;
}> = {
  NVDA: { name: "NVIDIA Corp",       price: "$924",  change: +3.42, score: 84, action: "BUY",   confidence: 84, signals: ["Momentum Breakout", "AI Bubble Exposure"],  regime: "Aligned",       color: "#00D4FF" },
  AAPL: { name: "Apple Inc",         price: "$211",  change: +0.88, score: 61, action: "HOLD",  confidence: 61, signals: ["Macro Beneficiary", "Neutral / Watch"],      regime: "Neutral",       color: "#FFD700" },
  TSLA: { name: "Tesla Inc",         price: "$248",  change: -1.44, score: 72, action: "WATCH", confidence: 58, signals: ["Liquidity Sensitive", "Macro Vulnerable"],   regime: "Counter-Trend", color: "#FF9500" },
  SPY:  { name: "S&P 500 ETF",       price: "$527",  change: +0.61, score: 55, action: "HOLD",  confidence: 65, signals: ["Macro Beneficiary"],                         regime: "Neutral",       color: "#00FF88" },
  XLU:  { name: "Utilities SPDR",    price: "$68",   change: +0.71, score: 48, action: "WATCH", confidence: 61, signals: ["Recession Defensive", "Macro Beneficiary"],  regime: "Neutral",       color: "#94A3B8" },
  ARKK: { name: "ARK Innovation ETF",price: "$48",   change: -1.87, score: 77, action: "SELL",  confidence: 77, signals: ["Liquidity Sensitive", "Macro Vulnerable"],   regime: "Counter-Trend", color: "#FF2D55" },
};

describe("DashboardSearchPanels — Crypto demo data", () => {
  it("has 6 crypto symbols", () => {
    expect(Object.keys(CRYPTO_DEMO)).toHaveLength(6);
  });

  it("all crypto scores are in 0–100 range", () => {
    for (const [sym, d] of Object.entries(CRYPTO_DEMO)) {
      expect(d.score, `${sym} score out of range`).toBeGreaterThanOrEqual(0);
      expect(d.score, `${sym} score out of range`).toBeLessThanOrEqual(100);
    }
  });

  it("all crypto entries have at least one signal", () => {
    for (const [sym, d] of Object.entries(CRYPTO_DEMO)) {
      expect(d.signals.length, `${sym} has no signals`).toBeGreaterThan(0);
    }
  });

  it("HYPE is Critical risk (highest in demo set)", () => {
    expect(CRYPTO_DEMO.HYPE.riskLevel).toBe("Critical");
    expect(CRYPTO_DEMO.HYPE.score).toBeGreaterThan(CRYPTO_DEMO.BTC.score);
  });
});

describe("DashboardSearchPanels — Stock demo data", () => {
  it("has 6 stock symbols", () => {
    expect(Object.keys(STOCK_DEMO)).toHaveLength(6);
  });

  it("all stock confidence values are in 0–100 range", () => {
    for (const [sym, d] of Object.entries(STOCK_DEMO)) {
      expect(d.confidence, `${sym} confidence out of range`).toBeGreaterThanOrEqual(0);
      expect(d.confidence, `${sym} confidence out of range`).toBeLessThanOrEqual(100);
    }
  });

  it("all stock entries have valid action values", () => {
    const validActions = ["BUY", "SELL", "HOLD", "WATCH"];
    for (const [sym, d] of Object.entries(STOCK_DEMO)) {
      expect(validActions, `${sym} has invalid action`).toContain(d.action);
    }
  });

  it("ARKK is SELL with Counter-Trend regime", () => {
    expect(STOCK_DEMO.ARKK.action).toBe("SELL");
    expect(STOCK_DEMO.ARKK.regime).toBe("Counter-Trend");
  });

  it("NVDA is BUY with highest confidence in demo set", () => {
    const maxConf = Math.max(...Object.values(STOCK_DEMO).map(d => d.confidence));
    expect(STOCK_DEMO.NVDA.confidence).toBe(maxConf);
    expect(STOCK_DEMO.NVDA.action).toBe("BUY");
  });
});
