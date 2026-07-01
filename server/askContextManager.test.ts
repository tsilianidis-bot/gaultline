/**
 * Tests for the FAULTLINE Ask Intent Classifier
 * Verifies that every question is correctly classified as global/macro/stock/crypto/etc.
 * and that symbol context is correctly resolved, cleared, or switched.
 */
import { describe, it, expect } from "vitest";
import {
  classifyAskIntent,
  detectTickerInQuestion,
  getAskPlaceholder,
  type AskMode,
} from "../client/src/lib/askIntentClassifier";

// ── detectTickerInQuestion ────────────────────────────────────────────────────

describe("detectTickerInQuestion", () => {
  it("detects a known ticker in 'What about NVDA?'", () => {
    expect(detectTickerInQuestion("What about NVDA?")).toBe("NVDA");
  });

  it("detects ticker in 'Should I buy TSLA stock?'", () => {
    expect(detectTickerInQuestion("Should I buy TSLA stock?")).toBe("TSLA");
  });

  it("detects ticker in 'AAPL vs MSFT — which is better?'", () => {
    const result = detectTickerInQuestion("AAPL vs MSFT — which is better?");
    expect(["AAPL", "MSFT"]).toContain(result);
  });

  it("detects ticker in 'Analyze PLTR for me'", () => {
    expect(detectTickerInQuestion("Analyze PLTR for me")).toBe("PLTR");
  });

  it("does NOT detect common words as tickers", () => {
    expect(detectTickerInQuestion("What are the best stocks to buy right now?")).toBeNull();
  });

  it("does NOT detect 'AI' as a ticker in 'What is the AI market outlook?'", () => {
    // AI is in the exclusion list
    const result = detectTickerInQuestion("What is the AI market outlook?");
    expect(result).toBeNull();
  });

  it("detects BTC in 'Is BTC a buy?'", () => {
    expect(detectTickerInQuestion("Is BTC a buy?")).toBe("BTC");
  });

  it("detects ETH in 'ETH crypto analysis'", () => {
    expect(detectTickerInQuestion("ETH crypto analysis")).toBe("ETH");
  });

  it("does NOT detect 'US' as a ticker", () => {
    expect(detectTickerInQuestion("How is the US economy doing?")).toBeNull();
  });

  it("detects ticker in 'long NVDA position'", () => {
    expect(detectTickerInQuestion("long NVDA position")).toBe("NVDA");
  });
});

// ── classifyAskIntent — Global questions ─────────────────────────────────────

describe("classifyAskIntent — global questions", () => {
  const cases: [string, string][] = [
    ["What are the best investments right now?", "global"],
    ["What should I buy?", "global"],
    ["Top stocks to buy this week", "global"],
    ["Best opportunities right now", "global"],
    ["What sectors look strongest?", "sector"],
    ["Which sectors are performing best?", "sector"],
    ["How dangerous is the market?", "risk"],
    ["Overall market outlook", "global"],
    ["What are institutions buying?", "global"],
    ["What is hot right now?", "global"],
  ];

  cases.forEach(([question, expectedMode]) => {
    it(`classifies "${question}" as ${expectedMode}`, () => {
      const result = classifyAskIntent(question, null);
      expect(result.mode).toBe(expectedMode as AskMode);
      expect(result.resolvedTicker).toBeNull();
      // risk/trading modes with no active symbol return shouldClearSymbol=false (nothing to clear)
      // all other global modes return shouldClearSymbol=true
      const noSymbolToClear = expectedMode === "risk" || expectedMode === "trading";
      expect(result.shouldClearSymbol).toBe(!noSymbolToClear);
    });
  });
});

// ── classifyAskIntent — Global questions with active symbol ──────────────────

describe("classifyAskIntent — global questions clear active symbol", () => {
  it("clears RIGHT context when asking 'What are the top investment opportunities right now?'", () => {
    const result = classifyAskIntent(
      "What are the top investment opportunities right now?",
      "RIGHT",
      "stock",
    );
    expect(result.shouldClearSymbol).toBe(true);
    expect(result.resolvedTicker).toBeNull();
    expect(result.mode).toBe("global");
  });

  it("clears NVDA context when asking 'What sectors look strongest?'", () => {
    const result = classifyAskIntent(
      "What sectors look strongest?",
      "NVDA",
      "stock",
    );
    expect(result.shouldClearSymbol).toBe(true);
    expect(result.resolvedTicker).toBeNull();
  });

  it("clears BTC context when asking 'Best crypto opportunities?'", () => {
    const result = classifyAskIntent(
      "Best crypto opportunities?",
      "BTC",
      "crypto",
    );
    expect(result.shouldClearSymbol).toBe(true);
    expect(result.resolvedTicker).toBeNull();
    expect(result.mode).toBe("crypto");
  });

  it("clears TSLA context when asking 'How is the economy doing?'", () => {
    const result = classifyAskIntent(
      "How is the economy doing?",
      "TSLA",
      "stock",
    );
    expect(result.shouldClearSymbol).toBe(true);
    expect(result.resolvedTicker).toBeNull();
  });
});

// ── classifyAskIntent — Symbol-context questions ──────────────────────────────

describe("classifyAskIntent — symbol-context questions preserve active symbol", () => {
  const symbolQuestions = [
    "Should I buy more?",
    "How low could it fall?",
    "What's the downside?",
    "Is valuation stretched?",
    "Would you add here?",
    "What's my stop loss?",
    "What's the price target?",
    "Bull case?",
    "Bear case?",
    "Is this a buy?",
    "What are the risks?",
    "Upside potential?",
  ];

  symbolQuestions.forEach(question => {
    it(`preserves RIGHT context for "${question}"`, () => {
      const result = classifyAskIntent(question, "RIGHT", "stock");
      expect(result.resolvedTicker).toBe("RIGHT");
      expect(result.shouldClearSymbol).toBe(false);
    });
  });
});

// ── classifyAskIntent — Explicit ticker switch ────────────────────────────────

describe("classifyAskIntent — explicit ticker switch", () => {
  it("switches from RIGHT to NVDA when user asks 'What about NVDA?'", () => {
    const result = classifyAskIntent("What about NVDA?", "RIGHT", "stock");
    expect(result.resolvedTicker).toBe("NVDA");
    expect(result.detectedTicker).toBe("NVDA");
    expect(result.shouldClearSymbol).toBe(false);
  });

  it("switches from AAPL to TSLA when user asks 'Should I buy TSLA instead?'", () => {
    const result = classifyAskIntent("Should I buy TSLA instead?", "AAPL", "stock");
    expect(result.resolvedTicker).toBe("TSLA");
    expect(result.detectedTicker).toBe("TSLA");
  });

  it("switches from stock to crypto when user asks 'What about BTC?'", () => {
    const result = classifyAskIntent("What about BTC?", "NVDA", "stock");
    expect(result.resolvedTicker).toBe("BTC");
    expect(result.mode).toBe("crypto");
  });

  it("does NOT switch when ticker in question matches active symbol", () => {
    const result = classifyAskIntent("How low can NVDA fall?", "NVDA", "stock");
    expect(result.resolvedTicker).toBe("NVDA");
    // Should not set detectedTicker as a switch since it's the same
    expect(result.shouldClearSymbol).toBe(false);
  });
});

// ── classifyAskIntent — Macro questions ──────────────────────────────────────

describe("classifyAskIntent — macro questions", () => {
  const macroCases = [
    "What will the Fed do next?",
    "How will interest rate cuts affect the market?",
    "What is the inflation outlook?",
    "GDP growth forecast",
    "Yield curve analysis",
    "What is the FOMC decision impact?",
  ];

  macroCases.forEach(question => {
    it(`classifies "${question}" as macro`, () => {
      const result = classifyAskIntent(question, null);
      expect(result.mode).toBe("macro");
      expect(result.resolvedTicker).toBeNull();
    });
  });

  it("clears active symbol for macro questions", () => {
    const result = classifyAskIntent("What will the Fed do?", "NVDA", "stock");
    expect(result.shouldClearSymbol).toBe(true);
    expect(result.resolvedTicker).toBeNull();
  });
});

// ── classifyAskIntent — Portfolio questions ───────────────────────────────────

describe("classifyAskIntent — portfolio questions", () => {
  it("classifies 'How is my portfolio doing?' as portfolio", () => {
    const result = classifyAskIntent("How is my portfolio doing?", null);
    expect(result.mode).toBe("portfolio");
    expect(result.shouldClearSymbol).toBe(true);
  });

  it("classifies 'Should I rebalance my holdings?' as portfolio", () => {
    const result = classifyAskIntent("Should I rebalance my holdings?", "NVDA", "stock");
    expect(result.mode).toBe("portfolio");
    expect(result.shouldClearSymbol).toBe(true);
  });
});

// ── classifyAskIntent — Comparison questions ─────────────────────────────────

describe("classifyAskIntent — comparison questions", () => {
  it("classifies 'NVDA vs AMD — which is better?' as comparison", () => {
    const result = classifyAskIntent("NVDA vs AMD — which is better?", null);
    expect(result.mode).toBe("comparison");
  });

  it("classifies 'SPY vs QQQ' as comparison", () => {
    const result = classifyAskIntent("SPY vs QQQ", null);
    expect(result.mode).toBe("comparison");
  });
});

// ── classifyAskIntent — No symbol, no pattern → global fallback ───────────────

describe("classifyAskIntent — fallback behavior", () => {
  it("returns global mode with no ticker when no pattern matches and no active symbol", () => {
    const result = classifyAskIntent("Tell me something interesting", null);
    expect(result.mode).toBe("global");
    expect(result.resolvedTicker).toBeNull();
  });

  it("preserves active symbol for ambiguous questions", () => {
    const result = classifyAskIntent("What do you think?", "AAPL", "stock");
    expect(result.resolvedTicker).toBe("AAPL");
    expect(result.shouldClearSymbol).toBe(false);
  });
});

// ── getAskPlaceholder ─────────────────────────────────────────────────────────

describe("getAskPlaceholder", () => {
  it("shows symbol-specific placeholder when symbol is active", () => {
    const placeholder = getAskPlaceholder("stock", "RIGHT");
    expect(placeholder).toContain("RIGHT");
  });

  it("shows global placeholder when no symbol is active", () => {
    const placeholder = getAskPlaceholder("global", null);
    expect(placeholder).toContain("markets");
  });

  it("shows macro placeholder for macro mode", () => {
    const placeholder = getAskPlaceholder("macro", null);
    expect(placeholder.toLowerCase()).toContain("macro");
  });

  it("shows crypto placeholder for crypto mode", () => {
    const placeholder = getAskPlaceholder("crypto", null);
    expect(placeholder.toLowerCase()).toContain("crypto");
  });

  it("shows portfolio placeholder for portfolio mode", () => {
    const placeholder = getAskPlaceholder("portfolio", null);
    expect(placeholder.toLowerCase()).toContain("portfolio");
  });
});
