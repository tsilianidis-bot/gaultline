import { getGlobalStats } from "../server/coingeckoProxy";
import { fetchFredBulk } from "../server/fredClient";
import { getQuote } from "../server/yahooProxy";

async function main() {
  const [quote, crypto, fred] = await Promise.all([
    getQuote("SPY"),
    getGlobalStats(),
    fetchFredBulk([{ id: "DGS10", limit: 1 }]),
  ]);
  console.log(JSON.stringify({
    yahoo: {
      source: quote.source,
      hasPrice: quote.price !== null,
      hasProviderObservedAt: quote.observedAt != null,
      error: quote.error ?? null,
    },
    coingecko: {
      available: crypto !== null,
      hasProviderObservedAt: false,
      adapterFetchedAt: crypto?.fetchedAt ?? null,
    },
    fred: {
      hasObservation: (fred.results.DGS10?.observations.length ?? 0) > 0,
      error: fred.results.DGS10?.error ?? null,
    },
  }, null, 2));
}

void main();
