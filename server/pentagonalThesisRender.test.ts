import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPentagonalThesis, type PentagonalThesisInput } from "../shared/pentagonalThesis";

const detail = {
  observedAt: Date.parse("2026-10-27T15:00:00.000Z"),
  regime: { label: "MODERATE", pressureIndex: 42, direction: "flat" },
  bars: [{ timestamp: Date.parse("2026-10-26T20:00:00.000Z"), open: 100, high: 110, low: 90, close: 102, volume: 1_000_000 }],
  quote: { price: 102, changePercent: 2, isDelayed: true },
  avgVolume: 1_000_000,
  relativeStrength: 55,
  providerHealth: {
    quote: { status: "available", source: "yahoo", detail: "Delayed quote" },
    dailyBars: { status: "available", source: "yahoo", detail: "Completed bars", latestCompletedAt: Date.parse("2026-10-26T20:00:00.000Z") },
  },
  signal: {
    action: "BUY",
    actionLabel: "Accumulation Zone",
    confidence: 84,
    strength: "Strong",
    rationale: "Buy the dip at the calculated zone.",
    timeframe: "daily",
    regimeAlignment: "Aligned",
    regimeAlignmentScore: 8,
    priceLevels: {
      support: 90,
      resistance: 120,
      entryZone: 333.33,
      stopLoss: 222.22,
      targetPrice: 444.44,
      riskReward: 2,
      riskLevels: {
        tradeStop: { price: 222.22 },
        tradeStopExplanation: "trade stop",
        swingStop: { price: 90 },
        swingStopExplanation: "swing stop",
        thesisFailure: { price: 80 },
        thesisFailureExplanation: "failure",
      },
    },
    technicals: {
      rsiIsTrue: true,
      rsiEstimate: 55,
      rsiLabel: "Neutral",
      smaIsTrue: true,
      smaSignal: "Neutral",
      macd: null,
      volumeSignal: "Normal",
      trend: "Sideways",
      momentumScore: 40,
    },
  },
};

vi.mock("wouter", () => ({
  useRoute: () => [true, { symbol: "NVDA" }],
  useParams: () => ({ symbol: "pltr" }),
  useLocation: () => ["/", () => {}],
  Link: (props: { children?: unknown }) => props.children ?? null,
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("@/contexts/TickerStore", () => ({
  useTickerStore: () => ({ current: null, setTicker: () => {} }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy({}, {
    get(_target, namespace) {
      return new Proxy({}, {
        get(_inner, method) {
          if (namespace === "signals" && method === "getSignalVisualDetail") {
            return {
              useQuery: () => ({
                data: detail,
                isLoading: false,
                isError: false,
                isFetching: false,
                refetch: () => Promise.resolve(),
                error: null,
              }),
            };
          }
          return {
            useQuery: () => ({ data: null, isLoading: false, isError: false, isFetching: false, refetch: () => Promise.resolve() }),
            useMutation: () => ({ mutate: () => {} }),
          };
        },
      });
    },
  }),
}));

const NOW = "2026-10-27T15:00:00.000Z";

function thesisInput(): PentagonalThesisInput {
  return {
    symbol: "AAPL",
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
    bars: Array.from({ length: 20 }, (_, index) => ({
      high: 110,
      low: 90,
      close: 100,
      volume: 1_000_000,
      timestamp: new Date(Date.parse("2026-10-26T20:00:00.000Z") - (19 - index) * 86_400_000).toISOString(),
    })),
    market: null,
    profile: null,
  };
}

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("Pentagonal thesis render consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the same thesis text on two surfaces, including compact attribution", async () => {
    const { PentagonalThesisNarrative } = await import("../client/src/components/PentagonalThesisNarrative");
    const thesis = buildPentagonalThesis(thesisInput());
    const signals = visibleText(renderToStaticMarkup(createElement(PentagonalThesisNarrative, { thesis, surface: "signals", compact: true, symbol: "AAPL" })));
    const detailMarkup = visibleText(renderToStaticMarkup(createElement(PentagonalThesisNarrative, { thesis, surface: "signal-detail", compact: true, symbol: "AAPL" })));
    expect(signals).toBe(detailMarkup);
    expect(signals).toContain(thesis.headline);
    expect(signals).toContain("fact · verified · yahoo");
    expect(signals).toContain("What's happening");
    expect(signals).toContain("What to do");
  });

  it("does not render a signal action, confidence percentage, entry, stop, or target", async () => {
    const { default: SignalDetail } = await import("../client/src/pages/SignalDetail");
    const html = renderToStaticMarkup(createElement(SignalDetail));
    expect(html).not.toContain("BUY");
    expect(html).not.toContain("Accumulation Zone");
    expect(html).not.toContain("84%");
    expect(html).not.toContain("% confidence");
    expect(html).not.toContain("333.33");
    expect(html).not.toContain("222.22");
    expect(html).not.toContain("444.44");
    expect(html).not.toContain("Buy the dip");
    expect(html).toContain("Pentagonal Thesis");

    const { StockCard } = await import("../client/src/pages/Signals");
    const card = renderToStaticMarkup(createElement(StockCard, {
      stock: {
        ticker: "NVDA",
        name: "NVIDIA",
        sector: "Technology",
        marketCap: "Mega",
        marketCapValue: 2000,
        price: 102,
        changePercent: 1,
        volume: 10,
        avgVolume: 8,
        relativeStrength: 55,
        aiExposure: "High",
        recessionSensitivity: "Medium",
        debtSensitivity: "Low",
        riskRating: "High",
        volatilityLevel: "High",
        liquidityLevel: "High",
        timeframe: "Swing",
        momentum: 60,
        bias: "Bullish",
        assetClass: "Stock",
        signals: ["Insider Activity", "Sector Rotation"],
        categories: [],
        sparkline: [1, 2, 3],
        bullCase: "",
        bearCase: "",
        invalidationLevel: "",
        whyAppearing: "",
        confidence: 77,
        entryZone: "$333.33",
        stopLoss: "$222.22",
        apiSources: { quote: "catalog" },
      },
      regimeScore: 10,
      tradingSignal: {
        ticker: "NVDA",
        action: "BUY",
        actionLabel: "Accumulation Zone",
        confidence: 77,
        strength: "Strong",
        rationale: "Buy the dip",
        timeframe: "daily",
        regimeAlignment: "Aligned",
        regimeAlignmentScore: 9,
        assetClass: "STOCK",
        priceLevels: { entryZone: 333.33, stopLoss: 222.22, targetPrice: 444.44, support: 90, resistance: 120, riskReward: 2, atr: 1 },
        technicals: { rsiIsTrue: true, rsiEstimate: 55, rsiLabel: "Neutral", smaIsTrue: true, smaSignal: "Neutral", volumeSignal: "Normal", trend: "Sideways", macd: null },
      },
    }));
    expect(card).not.toContain("BUY");
    expect(card).not.toContain("77%");
    expect(card).not.toContain("333.33");
    expect(card).not.toContain("Accumulation Zone");
    expect(card).not.toContain("CONFIDENCE");
    expect(card).not.toContain("Insider Activity");
    expect(card).not.toContain("Sector Rotation");
    expect(card).toContain("NVDA");
  });

  it("does not render stored stock-page trade copy or a second AI-stock classification", async () => {
    const { default: DynamicStockPage } = await import("../client/src/pages/seo/DynamicStockPage");
    const stock = renderToStaticMarkup(createElement(DynamicStockPage));
    expect(stock).toContain("Pentagonal Thesis");
    expect(stock).not.toContain("good investment");
    expect(stock).not.toContain("risk score");
    expect(stock).not.toContain("Key levels");
    expect(stock).not.toContain("buy right now");
    expect(stock).not.toContain("Bullish");
    expect(stock).not.toContain("Risk-Off");

    const { default: AIStocksDashboard } = await import("../client/src/pages/seo/AIStocksDashboard");
    const ai = renderToStaticMarkup(createElement(AIStocksDashboard));
    expect(ai).toContain("Pentagonal Thesis");
    expect(ai).not.toContain("advance warning");
    expect(ai).not.toContain("0-10");
    expect(ai).not.toContain("BUY/SELL/HOLD");

    const { default: NVDASignal } = await import("../client/src/pages/seo/NVDASignal");
    const nvda = renderToStaticMarkup(createElement(NVDASignal));
    expect(nvda).not.toContain("Is NVDA a buy or sell right now?");
    expect(nvda).not.toContain("BUY, SELL, HOLD, or WATCH");
    expect(nvda).not.toContain("regime fit score");
    expect(nvda).toContain("shared Pentagonal Thesis");
    expect(nvda).toContain("data-pentagonal-thesis=\"stock-signal\"");
  });
});
