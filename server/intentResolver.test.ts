import { describe, expect, it } from "vitest";
import {
  COMMODITY_MAP,
  CRYPTO_NAME_MAP,
  CRYPTO_TICKERS,
  STOCK_NAME_MAP,
  detectQuestionIntent,
  resolveIntent,
} from "./intentResolver";

describe("detectQuestionIntent", () => {
  it.each([
    ["How low can Bitcoin fall?", "downside"],
    ["Where should I enter NVDA?", "entry_zone"],
    ["Compare BTC versus ETH", "compare"],
    ["Show me the best opportunities", "opportunity_ranking"],
  ] as const)("classifies %s", (query, expected) => {
    expect(detectQuestionIntent(query)).toBe(expected);
  });
});

describe("resolveIntent", () => {
  it("resolves named crypto without treating question words as tickers", () => {
    expect(resolveIntent("Should I buy BTC today?")).toMatchObject({
      ticker: "BTC",
      assetType: "crypto",
      queryType: "security",
      confidence: "high",
    });
  });

  it("resolves a common stock name", () => {
    expect(resolveIntent("Analyze Nvidia")).toMatchObject({
      ticker: "NVDA",
      assetType: "stock",
      assetName: "NVIDIA",
      confidence: "high",
    });
  });

  it("keeps broad opportunity queries independent of ticker context", () => {
    expect(resolveIntent("What are the best AI stocks?", "TSLA", "stock")).toEqual({
      ticker: null,
      assetType: null,
      queryType: "opportunity",
      assetName: null,
      needsClarification: false,
      clarificationPrompt: null,
      confidence: "high",
    });
  });

  it("inherits ticker context only for explicit back-references", () => {
    expect(resolveIntent("Tell me more", "TSLA", "stock")).toMatchObject({
      ticker: "TSLA",
      assetType: "stock",
      queryType: "security",
      confidence: "medium",
    });
    expect(resolveIntent("What is inflation doing?", "TSLA", "stock")).toMatchObject({
      ticker: null,
      assetType: null,
      queryType: "macro",
    });
  });

  it("resolves commodity names before ticker token extraction", () => {
    expect(resolveIntent("Gold outlook")).toMatchObject({
      ticker: "XAUUSD",
      assetType: "commodity",
      assetName: "Gold",
    });
  });

  it("preserves the exported asset taxonomy", () => {
    expect(CRYPTO_TICKERS.has("BTC")).toBe(true);
    expect(CRYPTO_NAME_MAP.bitcoin).toBe("BTC");
    expect(STOCK_NAME_MAP.nvidia.ticker).toBe("NVDA");
    expect(COMMODITY_MAP.gold.ticker).toBe("XAUUSD");
  });
});
