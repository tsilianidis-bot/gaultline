/**
 * FAULTLINE — Question Intent Detection Tests
 * Tests for detectQuestionIntent() and MSTR/MicroStrategy alias resolution
 */
import { describe, it, expect } from "vitest";
import { detectQuestionIntent, resolveIntent } from "./intentResolver";

describe("detectQuestionIntent", () => {
  // ── Downside ──────────────────────────────────────────────────
  describe("downside intent", () => {
    it("detects 'how low can it fall'", () => {
      expect(detectQuestionIntent("How low can Bitcoin fall?")).toBe("downside");
    });
    it("detects 'what is the downside'", () => {
      expect(detectQuestionIntent("What is the downside for NVDA?")).toBe("downside");
    });
    it("detects 'how far can it drop'", () => {
      expect(detectQuestionIntent("How far can ETH drop from here?")).toBe("downside");
    });
    it("detects 'crash to'", () => {
      expect(detectQuestionIntent("Could MSTR crash to $100?")).toBe("downside");
    });
    it("detects 'bear case price'", () => {
      expect(detectQuestionIntent("What is the bear case price for Tesla?")).toBe("downside");
    });
    it("detects 'worst case target'", () => {
      expect(detectQuestionIntent("Worst case target for gold?")).toBe("downside");
    });
  });

  // ── Upside ────────────────────────────────────────────────────
  describe("upside intent", () => {
    it("detects 'how high can it go'", () => {
      expect(detectQuestionIntent("How high can Bitcoin go?")).toBe("upside");
    });
    it("detects 'upside'", () => {
      expect(detectQuestionIntent("What is the upside for NVDA?")).toBe("upside");
    });
    it("detects 'rally to'", () => {
      expect(detectQuestionIntent("Can ETH rally to $5000?")).toBe("upside");
    });
    it("detects 'bull case price'", () => {
      expect(detectQuestionIntent("What is the bull case price for AAPL?")).toBe("upside");
    });
  });

  // ── Target Price ──────────────────────────────────────────────
  describe("target_price intent", () => {
    it("detects 'price target'", () => {
      expect(detectQuestionIntent("What is the price target for NVDA?")).toBe("upside");
    });
    it("detects 'where will it go'", () => {
      expect(detectQuestionIntent("Where will Bitcoin go by end of year?")).toBe("upside");
    });
    it("detects 'fair value'", () => {
      expect(detectQuestionIntent("What's the fair value for TSLA?")).toBe("upside");
    });
  });

  // ── Buy Verdict ───────────────────────────────────────────────
  describe("buy_verdict intent", () => {
    it("detects 'should I buy'", () => {
      expect(detectQuestionIntent("Should I buy Bitcoin now?")).toBe("buy_verdict");
    });
    it("detects 'is it a good buy'", () => {
      expect(detectQuestionIntent("Is NVDA a good buy at this price?")).toBe("buy_verdict");
    });
    it("detects 'buy or wait'", () => {
      expect(detectQuestionIntent("Should I buy ETH or wait?")).toBe("buy_verdict");
    });
    it("detects 'good time to buy'", () => {
      expect(detectQuestionIntent("Is this a good time to buy gold?")).toBe("buy_verdict");
    });
    it("detects 'accumulate now'", () => {
      expect(detectQuestionIntent("Should I accumulate now?")).toBe("buy_verdict");
    });
  });

  // ── Sell Verdict ──────────────────────────────────────────────
  describe("sell_verdict intent", () => {
    it("detects 'should I sell'", () => {
      expect(detectQuestionIntent("Should I sell my Bitcoin?")).toBe("sell_verdict");
    });
    it("detects 'time to sell'", () => {
      expect(detectQuestionIntent("Is it time to sell NVDA?")).toBe("sell_verdict");
    });
    it("detects 'take profit'", () => {
      expect(detectQuestionIntent("Should I take profit on ETH now?")).toBe("sell_verdict");
    });
    it("detects 'lock in gains'", () => {
      expect(detectQuestionIntent("Should I lock in gains on TSLA?")).toBe("sell_verdict");
    });
  });

  // ── Wait Verdict ──────────────────────────────────────────────
  describe("wait_verdict intent", () => {
    it("detects 'should I wait'", () => {
      expect(detectQuestionIntent("Should I wait before buying Bitcoin?")).toBe("wait_verdict");
    });
    it("detects 'is now the right time'", () => {
      expect(detectQuestionIntent("Is now the right time to invest in NVDA?")).toBe("wait_verdict");
    });
  });

  // ── Entry Zone ────────────────────────────────────────────────
  describe("entry_zone intent", () => {
    it("detects 'where should I enter'", () => {
      expect(detectQuestionIntent("Where should I enter Bitcoin?")).toBe("entry_zone");
    });
    it("detects 'entry zone'", () => {
      expect(detectQuestionIntent("What is the entry zone for NVDA?")).toBe("entry_zone");
    });
    it("detects 'good entry'", () => {
      expect(detectQuestionIntent("What is a good entry for ETH?")).toBe("entry_zone");
    });
    it("detects 'buy at'", () => {
      expect(detectQuestionIntent("Should I buy at $90,000?")).toBe("entry_zone");
    });
  });

  // ── Exit Zone ─────────────────────────────────────────────────
  describe("exit_zone intent", () => {
    it("detects 'where should I exit'", () => {
      expect(detectQuestionIntent("Where should I exit my Bitcoin position?")).toBe("exit_zone");
    });
    it("detects 'take profit at'", () => {
      expect(detectQuestionIntent("Where should I take profit on NVDA?")).toBe("exit_zone");
    });
    it("detects 'sell target'", () => {
      expect(detectQuestionIntent("What is the sell target for ETH?")).toBe("exit_zone");
    });
  });

  // ── Invalidation ──────────────────────────────────────────────
  describe("invalidation intent", () => {
    it("detects 'what price invalidates'", () => {
      expect(detectQuestionIntent("What price invalidates the Bitcoin bull case?")).toBe("invalidation");
    });
    it("detects 'what breaks the thesis'", () => {
      expect(detectQuestionIntent("What breaks the thesis for NVDA?")).toBe("invalidation");
    });
    it("detects 'stop loss'", () => {
      expect(detectQuestionIntent("Where should my stop loss be for ETH?")).toBe("invalidation");
    });
    it("detects 'thesis fails'", () => {
      expect(detectQuestionIntent("When does the thesis fail for gold?")).toBe("invalidation");
    });
  });

  // ── Risk Assessment ───────────────────────────────────────────
  describe("risk_assessment intent", () => {
    it("detects 'how risky'", () => {
      expect(detectQuestionIntent("How risky is Bitcoin right now?")).toBe("risk_assessment");
    });
    it("detects 'what is the risk'", () => {
      expect(detectQuestionIntent("What's the risk of buying NVDA here?")).toBe("risk_assessment");
    });
    it("detects 'risk reward'", () => {
      expect(detectQuestionIntent("What is the risk reward for ETH?")).toBe("risk_assessment");
    });
    it("detects 'how much can I lose'", () => {
      expect(detectQuestionIntent("How much can I lose on this trade?")).toBe("risk_assessment");
    });
  });

  // ── Compare ───────────────────────────────────────────────────
  describe("compare intent", () => {
    it("detects 'vs'", () => {
      expect(detectQuestionIntent("Bitcoin vs Ethereum which is better?")).toBe("compare");
    });
    it("detects 'versus'", () => {
      expect(detectQuestionIntent("NVDA versus AMD — which should I buy?")).toBe("compare");
    });
    it("detects 'compare'", () => {
      expect(detectQuestionIntent("Compare gold vs Bitcoin as a safe haven")).toBe("compare");
    });
    it("detects 'which is better'", () => {
      expect(detectQuestionIntent("Which is better right now, BTC or ETH?")).toBe("compare");
    });
  });

  // ── Opportunity Ranking ───────────────────────────────────────
  describe("opportunity_ranking intent", () => {
    it("detects 'best opportunities'", () => {
      expect(detectQuestionIntent("What are the best opportunities right now?")).toBe("opportunity_ranking");
    });
    it("detects 'top picks'", () => {
      expect(detectQuestionIntent("What are your top picks today?")).toBe("opportunity_ranking");
    });
    it("detects 'what should I buy'", () => {
      expect(detectQuestionIntent("What should I buy right now?")).toBe("opportunity_ranking");
    });
    it("detects 'best stocks'", () => {
      expect(detectQuestionIntent("What are the best stocks to buy?")).toBe("opportunity_ranking");
    });
    it("detects 'investment ideas'", () => {
      expect(detectQuestionIntent("Give me your best investment ideas")).toBe("opportunity_ranking");
    });
  });

  // ── General Analysis (fallback) ───────────────────────────────
  describe("general_analysis fallback", () => {
    it("returns general_analysis for vague questions", () => {
      expect(detectQuestionIntent("Tell me about Bitcoin")).toBe("general_analysis");
    });
    it("returns general_analysis for analysis requests", () => {
      expect(detectQuestionIntent("Analyze NVDA for me")).toBe("general_analysis");
    });
    it("returns general_analysis for macro questions", () => {
      expect(detectQuestionIntent("What is the current market regime?")).toBe("general_analysis");
    });
  });
});

// ── MicroStrategy / MSTR Alias Resolution ────────────────────
describe("MSTR/MicroStrategy alias resolution", () => {
  it("resolves 'microstrategy' to MSTR", () => {
    const result = resolveIntent("How low will MicroStrategy fall?", null, null);
    expect(result.ticker).toBe("MSTR");
  });
  it("resolves 'mstr' to MSTR", () => {
    const result = resolveIntent("Should I buy MSTR?", null, null);
    expect(result.ticker).toBe("MSTR");
  });
  it("resolves 'strategy' to MSTR (Bitcoin proxy)", () => {
    const result = resolveIntent("What is the downside for Strategy?", null, null);
    expect(result.ticker).toBe("MSTR");
  });
  it("resolves 'marathon digital' to MARA", () => {
    const result = resolveIntent("Is Marathon Digital a good buy?", null, null);
    expect(result.ticker).toBe("MARA");
  });
  it("resolves 'riot platforms' to RIOT", () => {
    const result = resolveIntent("What is the upside for Riot Platforms?", null, null);
    expect(result.ticker).toBe("RIOT");
  });
});
