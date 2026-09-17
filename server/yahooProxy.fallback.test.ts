import { afterEach, describe, expect, it, vi } from "vitest";
import { clearQuoteCache, getQuote } from "./yahooProxy";

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
      const url = String(input);
      if (url.includes(YAHOO_HOST) && url.includes("%5EGSPC")) {
        return jsonResponse({ chart: { error: { description: "Unauthorized" } } }, 401);
      }
      if (url.includes(POLYGON_PREV) && url.includes("%5EGSPC")) {
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
    expect(quote.error).toBe("Both Yahoo and Polygon failed");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("does not invent a live quote when only Polygon previous-close succeeds", async () => {
    process.env.POLYGON_API_KEY = "test-polygon-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
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
      const url = String(input);
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
});
