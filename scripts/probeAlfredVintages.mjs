const series = process.env.FRED_SERIES?.split(",").filter(Boolean) ?? ["BAMLH0A0HYM2", "SOFR", "DGS10", "DGS2", "CPIAUCSL", "PPIACO", "FEDFUNDS", "UNRATE"];
const apiKey = process.env.FRED_API_KEY;

if (!apiKey) {
  console.error(JSON.stringify({ error: "FRED_API_KEY is not configured" }));
  process.exit(1);
}

const asOfDate = process.argv[2] ?? "2020-01-31";
const results = [];

for (const seriesId of series) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  if (!process.env.FRED_SKIP_REALTIME) {
    url.searchParams.set("realtime_start", asOfDate);
    url.searchParams.set("realtime_end", asOfDate);
  }
  if (!process.env.FRED_SKIP_OBSERVATION_END) {
    url.searchParams.set("observation_end", asOfDate);
  }
  url.searchParams.set("sort_order", process.env.FRED_SORT_ORDER ?? "desc");
  url.searchParams.set("limit", "14");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await response.json();
    results.push({
      seriesId,
      httpStatus: response.status,
      observationCount: Array.isArray(body.observations) ? body.observations.length : 0,
      sample: Array.isArray(body.observations) ? body.observations.slice(0, 2) : [],
      error: body.error_message ?? null,
    });
  } catch (error) {
    results.push({ seriesId, httpStatus: null, observationCount: 0, sample: [], error: String(error) });
  }
}

console.log(JSON.stringify({ asOfDate, results }, null, 2));
process.exit(0);
