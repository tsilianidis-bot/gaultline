import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPerformerCache, clearQuoteCache, getQuote, getTopStockByVolume, getTopStockLosers, getTopStockPerformers, resolvePolygonFallbackPlan, toPolygonTicker } from "./yahooProxy";

const YAHOO_HOST = "query1.finance.yahoo.com";
const POLYGON_PREV = "api.polygon.io/v2/aggs/ticker";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Yahoo quote fallback is fail-closed", () => {
  const previousPolygonKey = process.env.POLYGON_API_KEY;

  afterEach(() => {
    clearQuoteCache();
    vi.unstubAllGlobals();
    if (previousPolygonKey === undefined) {
      delete process.env.POLYGON_API_KEY;
    } else {
      process.env.POLYGON_API_KEY = previousPolygonKey;
    }
  });

  it("returns null fields with source=error when Yahoo ^GSPC and Polygon both fail", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      if (url.includes(YAHOO_HOST) && (url.includes("%5EGSPC") || url.includes("^GSPC"))) {
        return jsonResponse({ chart: { error: { description: "Unauthorized" } } }, 401);
      }
      if (url.includes(POLYGON_PREV) && (url.includes("%5EGSPC") || url.includes("^GSPC") || url.includes("I:SPX") || url.includes("I%3ASPX"))) {
        return jsonResponse({ status: "ERROR", results: [] }, 404);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quote = await getQuote("^GSPC");

    expect(quote.source).toBe("error");
    expect(quote.price).toBeNull();
    expect(quote.prevClose).toBeNull();
    expect(quote.change).toBeNull();
    expect(quote.changePercent).toBeNull();
    expect(quote.error).toBe("Yahoo index unavailable; Polygon cannot serve this index");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("%5EGSPC") && String(input).includes(POLYGON_PREV))).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("does not invent a live quote when only Polygon previous-close succeeds", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      if (url.includes(YAHOO_HOST)) {
        return jsonResponse({ chart: { result: null } }, 503);
      }
      if (url.includes(POLYGON_PREV) && url.includes("SPY")) {
        return jsonResponse({
          results: [{ c: 512.25, o: 510, h: 515, l: 508, v: 1_000_000, t: 1_700_000_000_000 }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quote = await getQuote("SPY");

    expect(quote.source).toBe("polygon-prev");
    expect(quote.price).toBe(512.25);
    expect(quote.prevClose).toBe(512.25);
    expect(quote.change).toBeNull();
    expect(quote.changePercent).toBeNull();
    expect(quote.marketState).toBe("CLOSED");
    expect(quote.isDelayed).toBe(true);
  });

  it("fails closed when Yahoo fails and POLYGON_API_KEY is unset", async () => {
    delete process.env.POLYGON_API_KEY;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      if (url.includes(YAHOO_HOST)) {
        return jsonResponse({ chart: { result: null } }, 500);
      }
      throw new Error(`Polygon must not be called without a key: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quote = await getQuote("AAPL");

    expect(quote.source).toBe("error");
    expect(quote.price).toBeNull();
    expect(quote.changePercent).toBeNull();
  });

  it("maps ^RUT/^VIX to Polygon I:RUT/I:VIX and never claims live", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(YAHOO_HOST)) {
        return jsonResponse({ chart: { result: null } }, 503);
      }
      if (url.includes(POLYGON_PREV) && url.includes("I%3ARUT")) {
        return jsonResponse({
          results: [{ c: 2201.5, o: 2190, h: 2210, l: 2185, v: 1, t: 1_700_000_000_000 }],
        });
      }
      if (url.includes(POLYGON_PREV) && url.includes("I%3AVIX")) {
        return jsonResponse({
          results: [{ c: 18.4, o: 17.9, h: 19.1, l: 17.5, v: 1, t: 1_700_000_000_000 }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const rut = await getQuote("^RUT");
    const vix = await getQuote("^VIX");

    expect(rut.source).toBe("polygon-prev");
    expect(rut.ticker).toBe("^RUT");
    expect(rut.price).toBe(2201.5);
    expect(rut.changePercent).toBeNull();
    expect(rut.isDelayed).toBe(true);
    expect(rut.marketState).toBe("CLOSED");

    expect(vix.source).toBe("polygon-prev");
    expect(vix.ticker).toBe("^VIX");
    expect(vix.price).toBe(18.4);
    expect(vix.changePercent).toBeNull();
    expect(vix.isDelayed).toBe(true);
    expect(vix.marketState).toBe("CLOSED");
  });

  it("leaves non-index tickers unmapped for Polygon", () => {
    expect(toPolygonTicker("^RUT")).toBe("I:RUT");
    expect(toPolygonTicker("^VIX")).toBe("I:VIX");
    expect(toPolygonTicker("^GSPC")).toBe("I:SPX");
    expect(toPolygonTicker("^DJI")).toBe("I:DJI");
    expect(toPolygonTicker("^IXIC")).toBe("I:COMP");
    expect(toPolygonTicker("SPY")).toBe("SPY");
    expect(toPolygonTicker("AAPL")).toBe("AAPL");
    expect(toPolygonTicker("^STOXX")).toBe("^STOXX");
  });

});

describe("Yahoo caret-index fallback mapping", () => {
  const previousPolygonKey = process.env.POLYGON_API_KEY;

  afterEach(() => {
    clearQuoteCache();
    vi.unstubAllGlobals();
    if (previousPolygonKey === undefined) {
      delete process.env.POLYGON_API_KEY;
    } else {
      process.env.POLYGON_API_KEY = previousPolygonKey;
    }
  });

  it("never sends Yahoo caret tickers to Polygon", () => {
    expect(resolvePolygonFallbackPlan("^RUT").map(step => step.ticker)).toEqual(["I:RUT", "IWM"]);
    expect(resolvePolygonFallbackPlan("^VIX").map(step => step.ticker)).toEqual(["I:VIX"]);
    expect(resolvePolygonFallbackPlan("^GSPC").map(step => step.ticker)).toEqual(["I:SPX"]);
    expect(resolvePolygonFallbackPlan("^STOXX")).toEqual([]);
    expect(resolvePolygonFallbackPlan("AAPL").map(step => step.ticker)).toEqual(["AAPL"]);
    for (const symbol of ["^RUT", "^VIX", "^GSPC", "^STOXX", "AAPL"]) {
      expect(resolvePolygonFallbackPlan(symbol).some(step => step.ticker.includes("^"))).toBe(false);
    }
  });

  it("labels IWM as a delayed RUT proxy when Yahoo and Polygon index both fail", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      if (url.includes(YAHOO_HOST)) {
        throw new Error("fetch failed");
      }
      if (url.includes(POLYGON_PREV) && url.includes("%5ERUT")) {
        throw new Error("caret ticker must not be sent to Polygon");
      }
      if (url.includes(POLYGON_PREV) && url.includes("I:RUT")) {
        return jsonResponse({ status: "OK", results: [] });
      }
      if (url.includes(POLYGON_PREV) && url.includes("IWM")) {
        return jsonResponse({
          results: [{ c: 284.1, o: 283, h: 285, l: 282, v: 2_000_000, t: 1_700_000_000_000 }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quote = await getQuote("^RUT");

    expect(quote.ticker).toBe("^RUT");
    expect(quote.source).toBe("polygon-prev");
    expect(quote.proxySymbol).toBe("IWM");
    expect(quote.price).toBe(284.1);
    expect(quote.isDelayed).toBe(true);
    expect(quote.changePercent).toBeNull();
    expect(quote.marketState).toBe("CLOSED");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes(POLYGON_PREV) && String(input).includes("%5ERUT"))).toBe(false);
  });

  it("fails closed for ^VIX when Yahoo fails and Polygon has no index entitlement", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      if (url.includes(YAHOO_HOST)) {
        throw new Error("fetch failed");
      }
      if (url.includes(POLYGON_PREV) && url.includes("%5EVIX")) {
        throw new Error("caret ticker must not be sent to Polygon");
      }
      if (url.includes(POLYGON_PREV) && url.includes("I:VIX")) {
        return jsonResponse({ status: "OK", results: [] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quote = await getQuote("^VIX");

    expect(quote.source).toBe("error");
    expect(quote.price).toBeNull();
    expect(quote.changePercent).toBeNull();
    expect(quote.proxySymbol).toBeUndefined();
    expect(quote.error).toBe("Yahoo index unavailable; Polygon cannot serve this index");
    expect(fetchMock.mock.calls.some(([input]) => /VIXY|VXX|UVXY/.test(String(input)))).toBe(false);
  });
});

describe("stock mover provenance", () => {
  const previousPolygonKey = process.env.POLYGON_API_KEY;

  afterEach(() => {
    clearPerformerCache();
    vi.unstubAllGlobals();
    if (previousPolygonKey === undefined) {
      delete process.env.POLYGON_API_KEY;
    } else {
      process.env.POLYGON_API_KEY = previousPolygonKey;
    }
  });

  it("keeps Yahoo's provider observation and declared delay separate from cache receipt time", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("finance/screener/predefined/saved")) throw new Error(`unexpected fetch: ${url}`);
      return jsonResponse({
        finance: {
          result: [{
            quotes: [{
              symbol: "YHOO",
              shortName: "Yahoo Test",
              regularMarketPrice: 10,
              regularMarketChange: 1,
              regularMarketChangePercent: 11.11,
              regularMarketVolume: 100,
              regularMarketTime: 1_704_067_200,
              exchangeDataDelayedBy: 15,
            }],
          }],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const fresh = await getTopStockPerformers(1);
    expect(fresh[0]).toMatchObject({
      source: "yahoo-screener",
      observedAt: 1_704_067_200_000,
      delayMinutes: 15,
      cacheStatus: "fresh",
    });

    const cached = await getTopStockPerformers(1);
    expect(cached[0]).toMatchObject({
      source: "yahoo-screener",
      observedAt: 1_704_067_200_000,
      delayMinutes: 15,
      cacheStatus: "cached",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("labels Polygon fallback as Polygon and leaves undeclared delay unknown", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("finance/screener/predefined/saved")) return jsonResponse({}, 503);
      if (url.includes("snapshot/locale/us/markets/stocks/gainers")) {
        return jsonResponse({
          tickers: [{
            ticker: "POLY",
            day: { c: 10, v: 100 },
            prevDay: { c: 9 },
            todaysChangePerc: 11.11,
            updated: 1_704_067_200_000,
          }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const [row] = await getTopStockPerformers(1);
    expect(row).toMatchObject({
      source: "polygon-snapshot",
      observedAt: 1_704_067_200_000,
      delayMinutes: null,
      cacheStatus: "fresh",
    });
    expect(row?.fetchedAt).not.toBe(row?.observedAt);
  });
});

describe("stock mover fallback availability", () => {
  const previousPolygonKey = process.env.POLYGON_API_KEY;
  const movers = [
    { name: "gainers", load: getTopStockPerformers, polygonPaths: ["markets/stocks/gainers"] },
    { name: "losers", load: getTopStockLosers, polygonPaths: ["markets/stocks/losers"] },
    { name: "most-active", load: getTopStockByVolume, polygonPaths: ["markets/stocks/gainers", "markets/stocks/losers"] },
  ];

  afterEach(() => {
    clearPerformerCache();
    vi.unstubAllGlobals();
    if (previousPolygonKey === undefined) {
      delete process.env.POLYGON_API_KEY;
    } else {
      process.env.POLYGON_API_KEY = previousPolygonKey;
    }
  });

  for (const mover of movers) {
    it(`rejects when Yahoo fails and Polygon is not configured for ${mover.name}`, async () => {
      delete process.env.POLYGON_API_KEY;
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("finance/screener/predefined/saved")) return jsonResponse({}, 503);
        throw new Error(`Polygon must not be called without a key: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(mover.load(1)).rejects.toThrow("POLYGON_API_KEY is not configured");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it(`rejects when Yahoo and Polygon HTTP fallback fail for ${mover.name}`, async () => {
      process.env.POLYGON_API_KEY = "test-polygon-key";
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("finance/screener/predefined/saved")) return jsonResponse({}, 503);
        if (mover.polygonPaths.some(path => url.includes(path))) return jsonResponse({}, 503);
        throw new Error(`unexpected fetch: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(mover.load(1)).rejects.toThrow("Polygon");
    });

    it(`returns an empty array only for a decoded empty Polygon snapshot for ${mover.name}`, async () => {
      process.env.POLYGON_API_KEY = "test-polygon-key";
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("finance/screener/predefined/saved")) return jsonResponse({}, 503);
        if (mover.polygonPaths.some(path => url.includes(path))) return jsonResponse({ tickers: [] });
        throw new Error(`unexpected fetch: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(mover.load(1)).resolves.toEqual([]);
    });
  }
});
