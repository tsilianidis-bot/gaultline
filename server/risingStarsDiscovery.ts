/**
 * Canonical public-market taxonomy used by Rising Stars.
 * All classifications are derived from verified metadata and market data. This module
 * intentionally excludes private companies, pre-IPO names, OTC securities, and pink sheets.
 */

export const MAGNIFICENT_SEVEN = new Set(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]);

export const MARKET_CAP_BANDS = [
  { id: "small" as const, label: "Small Cap", min: 0, max: 2_000_000_000 },
  { id: "mid" as const, label: "Mid Cap", min: 2_000_000_000, max: 10_000_000_000 },
  { id: "large" as const, label: "Large Cap", min: 10_000_000_000, max: 200_000_000_000 },
  { id: "mega" as const, label: "Mega Cap", min: 200_000_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export type MarketCapCategory = (typeof MARKET_CAP_BANDS)[number]["id"];
export type ListingAgeCategory = "under_1y" | "one_to_three_y" | "three_plus_y" | "unknown";

export function classifyMarketCap(marketCap: number | null): MarketCapCategory | null {
  if (marketCap == null || !Number.isFinite(marketCap) || marketCap <= 0) return null;
  return MARKET_CAP_BANDS.find(band => marketCap >= band.min && marketCap < band.max)?.id ?? null;
}

export function marketCapLabel(category: MarketCapCategory | null) {
  return category ? MARKET_CAP_BANDS.find(band => band.id === category)?.label ?? null : null;
}

export function classifyListingAge(listingDate: string | null, now = Date.now()): { category: ListingAgeCategory; yearsPublic: number | null; monthsPublic: number | null } {
  if (!listingDate) return { category: "unknown", yearsPublic: null, monthsPublic: null };
  const listedAt = Date.parse(`${listingDate}T00:00:00Z`);
  if (!Number.isFinite(listedAt) || listedAt > now) return { category: "unknown", yearsPublic: null, monthsPublic: null };
  const monthsPublic = Math.max(0, Math.floor((now - listedAt) / (30.4375 * 24 * 60 * 60 * 1000)));
  const yearsPublic = Math.round((monthsPublic / 12) * 10) / 10;
  return {
    category: monthsPublic < 12 ? "under_1y" : monthsPublic < 36 ? "one_to_three_y" : "three_plus_y",
    yearsPublic,
    monthsPublic,
  };
}

const EXCHANGE_NAMES: Record<string, string> = {
  XNAS: "Nasdaq", NASDAQ: "Nasdaq", XNYS: "NYSE", NYSE: "NYSE", ARCX: "NYSE Arca", BATS: "Cboe BZX",
};

const APPROVED_EXCHANGES = new Set(Object.keys(EXCHANGE_NAMES));

export interface PublicCompanyProfile {
  ticker: string;
  name: string;
  exchange: string;
  exchangeCode: string;
  marketCap: number | null;
  listingDate: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  active: boolean;
  profileAsOf: number;
}

export function isApprovedPublicCompany(profile: Pick<PublicCompanyProfile, "exchangeCode" | "active">) {
  return profile.active && APPROVED_EXCHANGES.has(profile.exchangeCode.toUpperCase());
}

type PolygonTickerResult = {
  ticker?: string; name?: string; primary_exchange?: string; market_cap?: number; list_date?: string;
  sic_description?: string; description?: string; active?: boolean; market?: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const profileCache = new Map<string, { profile: PublicCompanyProfile | null; expiresAt: number }>();

export async function getPublicCompanyProfile(apiKey: string, ticker: string): Promise<PublicCompanyProfile | null> {
  const symbol = ticker.toUpperCase();
  const cached = profileCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;
  try {
    const response = await fetch(`https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(symbol)}?apiKey=${apiKey}`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Polygon profile HTTP ${response.status}`);
    const payload = await response.json() as { results?: PolygonTickerResult };
    const result = payload.results;
    if (!result || result.market !== "stocks") throw new Error("Ticker is not an approved common-stock profile");
    const exchangeCode = (result.primary_exchange ?? "").toUpperCase();
    const profile: PublicCompanyProfile = {
      ticker: result.ticker ?? symbol,
      name: result.name ?? symbol,
      exchange: EXCHANGE_NAMES[exchangeCode] ?? (exchangeCode || "Unknown exchange"),
      exchangeCode,
      marketCap: typeof result.market_cap === "number" && result.market_cap > 0 ? result.market_cap : null,
      listingDate: result.list_date ?? null,
      sector: null,
      industry: result.sic_description ?? null,
      description: result.description ?? null,
      active: result.active === true,
      profileAsOf: Date.now(),
    };
    const verified = isApprovedPublicCompany(profile) ? profile : null;
    profileCache.set(symbol, { profile: verified, expiresAt: Date.now() + CACHE_TTL_MS });
    return verified;
  } catch {
    profileCache.set(symbol, { profile: null, expiresAt: Date.now() + 5 * 60_000 });
    return null;
  }
}

export function deriveFaultlineThemes(profile: Pick<PublicCompanyProfile, "description" | "industry">): string[] {
  const corpus = `${profile.description ?? ""} ${profile.industry ?? ""}`.toLowerCase();
  const matches: Array<[string, RegExp]> = [
    ["AI Infrastructure", /artificial intelligence|ai infrastructure|data center|datacentre/],
    ["Semiconductors", /semiconductor|chip|integrated circuit/],
    ["Cybersecurity", /cybersecurity|cyber security|endpoint security/],
    ["Defense Technology", /defense|military|government contract/],
    ["Nuclear", /nuclear/],
    ["Energy Infrastructure", /grid|energy infrastructure|power generation/],
    ["Fintech", /financial technolog|digital bank|payments/],
    ["Biotech", /biotech|biopharma|therapeutic|clinical/],
    ["Quantum Computing", /quantum/],
    ["Space", /spacecraft|launch|space exploration|satellite/],
    ["Cloud Software", /cloud software|software as a service|saas/],
    ["Industrial Automation", /automation|robotics/],
  ];
  return matches.filter(([, pattern]) => pattern.test(corpus)).map(([theme]) => theme);
}

export function deriveSector(profile: Pick<PublicCompanyProfile, "description" | "industry">): string | null {
  const corpus = `${profile.description ?? ""} ${profile.industry ?? ""}`.toLowerCase();
  const sectors: Array<[string, RegExp]> = [
    ["Technology", /software|semiconductor|computer|information technolog|data center|cloud/],
    ["Healthcare", /biotech|biopharma|therapeutic|medical|pharmaceutical|healthcare/],
    ["Financials", /financial|bank|insurance|payments|lending|asset management/],
    ["Industrials", /aerospace|defense|industrial|machinery|transportation|manufactur/],
    ["Energy", /energy|oil|gas|solar|nuclear|power generation|utility/],
    ["Consumer", /consumer|retail|restaurant|automotive|apparel|entertainment/],
    ["Communications", /telecom|media|advertising|communications/],
    ["Materials", /chemical|materials|mining|steel|metals/],
    ["Real Estate", /real estate|property|reit/],
  ];
  return sectors.find(([, pattern]) => pattern.test(corpus))?.[0] ?? null;
}

export interface DiscoveryFilterCandidate {
  marketCapCategory: MarketCapCategory | null;
  listingAgeCategory: ListingAgeCategory;
  sector: string | null;
  themes: string[];
  isMagnificentSeven: boolean;
  momentumScore: number;
  riskLevel: "MODERATE" | "ELEVATED";
}

export interface DiscoveryFilters {
  category: "all" | "new_listings" | MarketCapCategory | "mag7";
  listingAge?: ListingAgeCategory | "";
  sector?: string;
  theme?: string;
  characteristic?: "" | "momentum" | "high_risk";
}

/** Pure AND-filter contract shared conceptually by the discovery UI and tests. */
export function matchesDiscoveryFilters(candidate: DiscoveryFilterCandidate, filters: DiscoveryFilters) {
  const categoryMatch = filters.category === "all"
    || (filters.category === "new_listings" ? candidate.listingAgeCategory === "under_1y"
      : filters.category === "mag7" ? candidate.isMagnificentSeven
        : candidate.marketCapCategory === filters.category);
  return categoryMatch
    && (!filters.listingAge || candidate.listingAgeCategory === filters.listingAge)
    && (!filters.sector || candidate.sector === filters.sector)
    && (!filters.theme || candidate.themes.includes(filters.theme))
    && (!filters.characteristic || (filters.characteristic === "momentum" ? candidate.momentumScore >= 70 : candidate.riskLevel === "ELEVATED"));
}
