import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPentagonalThesis, type PentagonalThesis, type PentagonalThesisInput } from "../shared/pentagonalThesis";

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
};
const browser = {
  location: { search: "", href: "http://localhost/app/signals", pathname: "/app/signals" },
  history: { replaceState: () => {}, pushState: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  localStorage: storage,
  innerWidth: 1280,
  innerHeight: 800,
  document: {
    activeElement: null,
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  },
};
Object.assign(globalThis, { window: browser, localStorage: storage });

const shared: { thesis: PentagonalThesis | null } = { thesis: null };

const dayTradeReport = {
  symbol: "NVDA",
  name: "NVIDIA",
  assetType: "stock" as const,
  currentPrice: 102,
  changePercent: 1.2,
  setupType: "BREAKOUT",
  direction: "bullish" as const,
  confidence: 91,
  executionScore: 88,
  executionGrade: "A" as const,
  riskRewardRatio: 2.4,
  riskLevel: "Medium",
  liquidityRating: "High",
  entryZoneLow: 100.11,
  entryZoneHigh: 101.22,
  target1: 110.33,
  target2: 120.44,
  stopLoss: 95.55,
  invalidationLevel: 90,
  expectedHoldMinutes: 45,
  intradayTrend: "Up",
  marketContext: "Quiet tape",
  vwapStatus: "Above",
  momentumRating: 70,
  generatedAt: Date.parse("2026-10-27T15:00:00.000Z"),
};

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
  useSearch: () => "?symbol=NVDA&autorun=1",
  useLocation: () => ["/", () => {}],
  Link: (props: { children?: unknown }) => props.children ?? null,
}));

vi.mock("@/contexts/EngineContext", () => ({
  useEngine: () => ({
    output: { regime: { label: "MODERATE RISK", color: "#00D4FF", description: "Test regime" }, overall: { score: 4 } },
    integrityLabel: "UNAVAILABLE",
  }),
}));

vi.mock("@/contexts/AshaContext", () => ({
  useRegisterAshaContext: () => {},
  useAshaContext: () => ({ pageContext: null, setPageContext: () => {}, threadHistory: [], appendThreadExchange: () => {} }),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("@/contexts/TickerStore", () => ({
  useTickerStore: () => ({ current: { ticker: "NVDA", name: "NVIDIA", assetType: "stock" }, setTicker: () => {} }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy({}, {
    get(_target, namespace) {
      if (namespace === "useUtils") return () => new Proxy({}, { get: () => ({ invalidate: async () => {} }) });
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
          if (namespace === "pentagonalThesis" && method === "forSymbol") {
            return {
              useQuery: () => ({
                data: shared.thesis,
                isLoading: false,
                isError: false,
                isFetching: false,
                refetch: () => Promise.resolve(),
                error: null,
              }),
            };
          }
          if (namespace === "dayTrade" && method === "symbolSetup") {
            return {
              useQuery: () => ({
                data: dayTradeReport,
                isLoading: false,
                isError: false,
                error: null,
                isFetching: false,
                refetch: () => Promise.resolve(),
              }),
            };
          }
          return {
            useQuery: () => ({ data: null, isLoading: false, isError: false, isFetching: false, refetch: () => Promise.resolve(), error: null }),
            useMutation: () => ({ mutate: () => {}, mutateAsync: async () => ({}), reset: () => {}, isPending: false, data: null, error: null }),
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

function attributionLines(markup: string): string[] {
  const lines: string[] = [];
  const pattern = /data-thesis-attribution="[^"]+"[^>]*>([\s\S]*?)<\/p>/g;
  for (const match of markup.matchAll(pattern)) lines.push(visibleText(match[1] ?? ""));
  return lines;
}

const FORBIDDEN_PAGE_PHRASES = [
  "fall 50%",
  "ai bubble exposure",
  "recession probability",
  "biggest risk in 2026",
  "risk score",
  "market crash probability",
  "macro alignment score",
  "biggest opportunity in 2026",
  "fall significantly",
  "pressure index 60",
];

describe("Pentagonal thesis render consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared.thesis = buildPentagonalThesis({ ...thesisInput(), symbol: "NVDA" });
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
    expect(signals).toContain("Confirmation · condition");
    expect(signals).toContain("A later completed daily close stays above the reference range low.");
  });

  it("renders Confirmation distinctly and says when it is withheld", async () => {
    const { PentagonalThesisNarrative } = await import("../client/src/components/PentagonalThesisNarrative");
    const thesis = buildPentagonalThesis({ ...thesisInput(), bars: thesisInput().bars.slice(0, 19) });
    const markup = renderToStaticMarkup(createElement(PentagonalThesisNarrative, { thesis, surface: "signals", compact: true, symbol: "AAPL" }));
    expect(markup).toContain('data-thesis-confirmation="signals:bull"');
    expect(visibleText(markup)).toContain("Confirmation · withheld");
    expect(visibleText(markup)).toContain("Withheld because no fresh completed-session range is available.");
    expect(visibleText(markup)).toContain("No measurable invalidation line is available.");
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

  it("does not render price levels when the details panel is expanded", async () => {
    const { StockCard } = await import("../client/src/pages/Signals");
    const stock = {
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
    };
    const tradingSignal = {
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
    };
    const forbidden = ["KEY PRICE LEVELS", "ENTRY", "STOP", "TARGET", "R:R", "RISK/REWARD", "BUY ZONE", "SHORT ZONE"];
    const cases = [
      { name: "with a trading signal", props: { tradingSignal, signalBlocked: false } },
      { name: "without a trading signal", props: { signalBlocked: false } },
      { name: "with a locked tier", props: { signalBlocked: true } },
    ] as const;
    for (const entry of cases) {
      const html = renderToStaticMarkup(createElement(StockCard, {
        stock,
        regimeScore: 10,
        defaultExpanded: true,
        ...entry.props,
      }));
      for (const phrase of forbidden) expect(html, `${entry.name} ${phrase}`).not.toContain(phrase);
      expect(html, entry.name).toContain("PENTAGONAL THESIS");
      expect(html, entry.name).toContain(`data-signal-tier="${entry.props.signalBlocked ? "locked" : "open"}"`);
    }
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
    expect(ai.toLowerCase()).not.toContain("risk scores");
    expect(ai).not.toContain("poor risk-adjusted investment");
    expect(ai.toLowerCase()).not.toContain("four categories");
    expect(ai).not.toContain("Highest AI Exposure");
    expect(ai).not.toContain("35%");
    expect(ai).not.toContain("25%");
    expect(ai).not.toContain("higher revenue concentration");
  });

  it("does not render the removed stock-page claims", async () => {
    const pages = await Promise.all([
      import("../client/src/pages/seo/NVDASignal"),
      import("../client/src/pages/seo/METASignal"),
      import("../client/src/pages/seo/TSLASignal"),
      import("../client/src/pages/seo/PLTRSignal"),
      import("../client/src/pages/seo/AMDSignal"),
    ]);
    for (const page of pages) {
      const text = visibleText(renderToStaticMarkup(createElement(page.default))).toLowerCase();
      for (const phrase of FORBIDDEN_PAGE_PHRASES) expect(text, phrase).not.toContain(phrase);
      for (const word of ["crash", "probability", "score"]) expect(text, word).not.toContain(word);
      expect(text).toContain("shared pentagonal thesis");
    }
  });

  it("renders one router thesis on Signals, SignalDetail, and symbol intelligence", async () => {
    expect(shared.thesis).not.toBeNull();
    const [{ default: Signals }, { default: SignalDetail }, symbolPage, tabs, { default: HomeStockIntel }] = await Promise.all([
      import("../client/src/pages/Signals"),
      import("../client/src/pages/SignalDetail"),
      import("../client/src/pages/UniversalSymbolIntelligence"),
      import("../client/src/pages/UniversalSymbolIntelligence"),
      import("../client/src/components/HomeStockIntelSection"),
    ]);
    const { TradeSetupTab, AIAnalysisTab, RiskAnalysisTab } = tabs;
    const signals = renderToStaticMarkup(createElement(Signals));
    const detailMarkup = renderToStaticMarkup(createElement(SignalDetail));
    const intelligence = renderToStaticMarkup(createElement(symbolPage.UniversalSymbolIntelligence));
    const headline = shared.thesis!.headline;
    expect(headline.length).toBeGreaterThan(0);
    expect(visibleText(signals)).toContain(headline);
    expect(visibleText(detailMarkup)).toContain(headline);
    expect(visibleText(intelligence)).toContain(headline);
    expect(detailMarkup).not.toContain("Reading the shared stock thesis");
    expect(detailMarkup).not.toContain("Pick a stock");
    const signalsLines = attributionLines(signals);
    const detailLines = attributionLines(detailMarkup);
    const intelligenceLines = attributionLines(intelligence);
    expect(signalsLines.length).toBeGreaterThan(0);
    expect(detailLines).toEqual(signalsLines);
    expect(intelligenceLines).toEqual(signalsLines);
    expect(signalsLines.join(" ")).toContain("fact");
    for (const [surface, markup] of [["signals", signals], ["signal-detail", detailMarkup], ["symbol-intelligence", intelligence]] as const) {
      expect(markup, surface).toContain(`data-thesis-confirmation="${surface}:bull"`);
      expect(visibleText(markup), surface).toContain("Confirmation · condition");
    }
    expect(signals).not.toContain("algorithmic estimates");
    expect(signals).not.toContain("probabilistic estimates");
    expect(signals).not.toContain("KEY PRICE LEVELS");
    expect(signals).not.toContain("Macro Risk");
    expect(signals).not.toContain("AI Momentum");
    expect(signals).not.toContain("TODAY'S TOP SIGNALS");
    expect(intelligence).not.toContain("91/100");
    expect(intelligence).not.toContain(">Confidence<");
    expect(detailMarkup).not.toContain("42/100");
    expect(detailMarkup).not.toContain("40/100");
    expect(detailMarkup).toContain("72-hour");
    expect(visibleText(renderToStaticMarkup(createElement(HomeStockIntel)))).not.toContain("Real-Time");
    const trade = renderToStaticMarkup(createElement(TradeSetupTab, { report: dayTradeReport }));
    const analysis = renderToStaticMarkup(createElement(AIAnalysisTab, { report: dayTradeReport }));
    const risk = renderToStaticMarkup(createElement(RiskAnalysisTab, {
      report: {
        ...dayTradeReport,
        executionScoreBreakdown: {
          macroCondition: 16,
          technicalStructure: 14,
          liquidityScore: 12,
          volatilityScore: 11,
          momentumScore: 10,
          riskRewardScore: 9,
        },
      },
    }));
    for (const markup of [trade, analysis, risk, intelligence]) {
      expect(markup).not.toContain("Entry Zone");
      expect(markup).not.toContain("Target 1");
      expect(markup).not.toContain("Target 2");
      expect(markup).not.toContain("Stop Loss");
      expect(markup).not.toContain("Risk/Reward");
      expect(markup).not.toContain("R:R");
      expect(markup).not.toContain("EXEC");
      expect(markup).not.toMatch(/\/100/);
      expect(markup).not.toContain("91/100");
      expect(markup).not.toContain("CONFIDENCE BREAKDOWN");
    }
    expect(trade).not.toContain("100.11");
    expect(trade).not.toContain("110.33");
    expect(trade).not.toContain("95.55");
    expect(trade).not.toContain("$90.00");
    expect(trade).not.toContain("Invalidation");
  });

  it("counts quotes instead of buy and sell, and shared reports omit trade levels", async () => {
    const { TradingSignalsSummaryBar } = await import("../client/src/pages/Signals");
    const { SnapshotRenderer, isHiddenSnapshotKey } = await import("../client/src/pages/PublicSharedReport");
    const quote = {
      ticker: "NVDA",
      open: 100,
      high: 110,
      low: 90,
      volume: 1_000_000,
      volumeMillions: 1,
      timestamp: Date.parse("2026-10-27T15:00:00.000Z"),
      marketStatus: "open" as const,
      isLive: false,
      sparkline: [1, 2, 3],
    };
    const html = renderToStaticMarkup(createElement(TradingSignalsSummaryBar, {
      quotes: [
        { ...quote, ticker: "NVDA", price: 102, changePercent: 1.2 },
        { ...quote, ticker: "TSLA", price: 90, changePercent: -2 },
        { ...quote, ticker: "AMD", price: null, changePercent: null },
      ],
    }));
    expect(html).toContain("GAINERS");
    expect(html).toContain("DECLINERS");
    expect(html).toContain("QUOTES");
    expect(html).toContain(">1<");
    for (const word of ["BUY", "SELL", "HOLD", "WATCH"]) expect(html, word).not.toContain(word);

    const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Signals.tsx"), "utf8");
    const snapshot = source.slice(source.indexOf('reportType="stock_intelligence"'), source.indexOf("</ShareReportButton>"));
    expect(snapshot).not.toMatch(/entryZone|stopLoss|targetPrice/);

    for (const key of ["entryZone", "stopLoss", "targetPrice"]) expect(isHiddenSnapshotKey(key), key).toBe(true);
    const saved = renderToStaticMarkup(createElement(SnapshotRenderer, {
      reportType: "stock_intelligence",
      snapshotJson: JSON.stringify({
        signalCount: 1,
        signals: [{ ticker: "NVDA", action: "BUY", entryZone: 333.33, stopLoss: 222.22, targetPrice: 444.44 }],
      }),
    }));
    expect(saved).toContain("NVDA");
    expect(saved).not.toContain("333.33");
    expect(saved).not.toContain("222.22");
    expect(saved).not.toContain("444.44");
    expect(saved).not.toContain("entryZone");
    expect(saved).not.toContain("stopLoss");
    expect(saved).not.toContain("targetPrice");
    expect(saved).not.toContain("BUY");
    expect(saved).toContain("Read the current shared thesis.");
  });

  it("does not paint BUY or SELL from an old saved snapshot", async () => {
    const { SnapshotRenderer } = await import("../client/src/pages/PublicSharedReport");
    for (const action of ["BUY", "SELL"] as const) {
      const html = renderToStaticMarkup(createElement(SnapshotRenderer, {
        reportType: "stock_intelligence",
        snapshotJson: JSON.stringify({
          signalCount: 1,
          signals: [{
            ticker: "NVDA",
            action,
            actionLabel: action === "BUY" ? "Accumulation Zone" : "Reduce Exposure",
            strength: "Strong",
            entryZone: 333.33,
            stopLoss: 222.22,
            targetPrice: 444.44,
          }],
        }),
      }));
      expect(html, action).toContain("NVDA");
      expect(html, action).toContain("Read the current shared thesis.");
      expect(html, action).not.toContain("BUY");
      expect(html, action).not.toContain("SELL");
      expect(html, action).not.toContain("HOLD");
      expect(html, action).not.toContain("WATCH");
      expect(html, action).not.toContain("Accumulation Zone");
      expect(html, action).not.toContain("Reduce Exposure");
      expect(html, action).not.toContain("333.33");
    }
  });
});
