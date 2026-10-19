import type { CanonicalEngineState, CanonicalIntelligenceState } from "../../shared/canonicalIntelligenceState";
import {
  INTELLIGENCE_EVIDENCE_METHOD_VERSION,
  type EvidenceInterfaceStatus,
  type EvidenceTemporalStatus,
  type IntelligenceEvidenceDomain,
  type IntelligenceEvidenceDomainProjection,
  type EvidenceProviderHealth,
  type IntelligenceEvidenceResponse,
  type IntelligenceEvidenceSnapshot,
  type LastVerifiedEvidence,
  type ValidatedIntelligenceEvidence,
} from "../../shared/intelligenceEvidence";
import { evaluateIntelligenceEvidence, type IntelligenceOrigin } from "../../shared/intelligenceIntegrity";
import { canonicalEngineIntegrityEvidence, getAuthoritativeCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { getGlobalStats, type GlobalStats } from "../coingeckoProxy";
import { fetchFredBulk, type FredBulkResult } from "../fredClient";
import { getQuotes, type YahooQuote } from "../yahooProxy";
import { classifyYahooObservation } from "../yahooProxy";
import { IntelligenceEvidenceStore } from "./store";

const COLLECTION_INTERVAL_MS = 5 * 60_000;
const SNAPSHOT_STALE_AFTER_MS = 20 * 60_000;
const QUOTE_TICKERS = ["SPY", "QQQ", "IWM", "^VIX"] as const;
const FRED_SERIES = [
  { id: "DGS10", limit: 2 },
  { id: "DGS2", limit: 2 },
  { id: "BAMLH0A0HYM2", limit: 2 },
] as const;

const PROVIDER_DEADLINES_MS = {
  canonical: 10_000,
  quotes: 12_000,
  crypto: 10_000,
  fred: 8_000,
} as const;

type EvidenceInputs = {
  canonical: CanonicalIntelligenceState | null;
  quotes: YahooQuote[];
  crypto: GlobalStats | null;
  fred: FredBulkResult;
  sourceWarnings?: string[];
};

type EvidenceDraft = Omit<ValidatedIntelligenceEvidence, "value" | "validUntil" | "validationStatus" | "supportsCurrentClaim" | "validationReason" | "historicalValue" | "lastVerified"> & {
  rawValue: number | string | null;
  sourceHealthy: boolean;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toIso(timestamp: number | null | undefined): string | null {
  return finite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/** The client consumes this admitted deadline; it must never invent its own freshness window. */
function validityDeadline(observedAt: string | null, maxAgeMs: number): string | null {
  const observedMs = observedAt ? Date.parse(observedAt) : Number.NaN;
  return Number.isFinite(observedMs) && finite(maxAgeMs) && maxAgeMs > 0
    ? new Date(observedMs + maxAgeMs).toISOString()
    : null;
}

function providerStatus(current: ValidatedIntelligenceEvidence[], ids: string[]): "healthy" | "degraded" | "unavailable" {
  const matching = current.filter(item => ids.includes(item.id));
  const usable = matching.filter(item => item.supportsCurrentClaim).length;
  if (usable === 0) return "unavailable";
  return usable === matching.length ? "healthy" : "degraded";
}

function toHistorical(item: Pick<ValidatedIntelligenceEvidence, "value" | "observedAt" | "provider" | "validationStatus" | "validationReason">): LastVerifiedEvidence | null {
  if (item.value === null || !item.observedAt) return null;
  return {
    value: item.value,
    observedAt: item.observedAt,
    provider: item.provider,
    validationStatus: item.validationStatus,
    reason: item.validationReason,
  };
}

function validate(draft: EvidenceDraft, nowMs: number): ValidatedIntelligenceEvidence {
  const integrity = evaluateIntelligenceEvidence({
    id: draft.id,
    source: draft.provider,
    origin: draft.origin,
    value: draft.rawValue,
    observedAt: draft.observedAt,
    receivedAt: draft.receivedAt,
    maxAgeMs: draft.maxAgeMs,
    sourceHealthy: draft.sourceHealthy,
    modelVersion: draft.modelVersion ?? undefined,
  }, nowMs);
  const value = integrity.displayValue;
  const base: ValidatedIntelligenceEvidence = {
    id: draft.id,
    label: draft.label,
    kind: draft.kind,
    provider: draft.provider,
    origin: draft.origin,
    value,
    unit: draft.unit,
    observedAt: integrity.observedAt,
    receivedAt: draft.receivedAt,
    maxAgeMs: draft.maxAgeMs,
    validUntil: validityDeadline(integrity.observedAt, draft.maxAgeMs),
    validationStatus: integrity.status,
    supportsCurrentClaim: integrity.canSupportCurrentClaim,
    validationReason: integrity.reason,
    modelVersion: draft.modelVersion,
    sourceIdentifier: draft.sourceIdentifier,
    temporalStatus: draft.temporalStatus,
    temporalDetail: draft.temporalDetail,
    historicalValue: null,
    lastVerified: null,
  };
  if (!base.supportsCurrentClaim) base.historicalValue = toHistorical(base);
  return base;
}

function canonicalEngineDraft(canonical: CanonicalIntelligenceState, engine: CanonicalEngineState): EvidenceDraft {
  const boundary = canonicalEngineIntegrityEvidence(canonical, engine);
  return {
    id: boundary.id,
    label: engine.engineName,
    kind: "canonical_model",
    provider: boundary.source,
    origin: boundary.origin,
    rawValue: boundary.value,
    unit: engine.unit ?? null,
    observedAt: boundary.observedAt,
    receivedAt: boundary.receivedAt,
    maxAgeMs: boundary.maxAgeMs,
    modelVersion: boundary.modelVersion ?? null,
    sourceIdentifier: `canonical:${canonical.stateId}:${engine.engineId}`,
    sourceHealthy: boundary.sourceHealthy,
    temporalStatus: "modeled",
    temporalDetail: "Versioned canonical model output; displayed separately from direct provider observations.",
  };
}

function quoteDraft(id: string, label: string, quote: YahooQuote | undefined, nowMs: number): EvidenceDraft {
  const polygon = quote?.source === "polygon-prev";
  const provider = polygon ? "Polygon.io previous-close fallback" : "Yahoo Finance";
  const freshness = classifyYahooObservation(quote, nowMs);
  return {
    id,
    label,
    kind: "market_quote",
    provider,
    origin: "observed",
    rawValue: finite(quote?.price) ? quote.price : null,
    unit: "points",
    observedAt: toIso(quote?.observedAt),
    receivedAt: toIso(quote?.fetchedAt) ?? null,
    maxAgeMs: 20 * 60_000,
    modelVersion: null,
    sourceIdentifier: `${quote?.source ?? "unavailable"}:${quote?.ticker ?? id}`,
    sourceHealthy: Boolean(quote && quote.source !== "error" && finite(quote.price) && quote.observedAt),
    temporalStatus: freshness.timing,
    temporalDetail: freshness.detail,
  };
}

function fredDraft(id: string, label: string, unit: string | null, fred: FredBulkResult): EvidenceDraft {
  const result = fred.results[id];
  const observation = result?.observations.find(item => finite(Number(item.value)));
  return {
    id: `fred:${id}`,
    label,
    kind: "macro_release",
    provider: "Federal Reserve Economic Data (FRED)",
    origin: "observed",
    rawValue: observation && finite(Number(observation.value)) ? Number(observation.value) : null,
    unit,
    observedAt: observation ? new Date(`${observation.date}T00:00:00.000Z`).toISOString() : null,
    receivedAt: fred.timestamp ?? null,
    maxAgeMs: 96 * 60 * 60_000,
    modelVersion: null,
    sourceIdentifier: `fred:${id}`,
    sourceHealthy: Boolean(observation && !result?.error),
    temporalStatus: observation ? "released" : "unavailable",
    temporalDetail: observation ? "Released macro observation; its source date is retained." : "No usable released source observation is available.",
  };
}

function cryptoDraft(crypto: GlobalStats | null): EvidenceDraft {
  return {
    id: "coingecko:global-market-cap",
    label: "Crypto aggregate market capitalization",
    kind: "crypto_aggregate",
    provider: "CoinGecko",
    origin: "observed",
    rawValue: finite(crypto?.totalMarketCap) ? crypto.totalMarketCap : null,
    unit: "USD",
    observedAt: toIso(crypto?.observedAt) ?? null,
    receivedAt: toIso(crypto?.fetchedAt) ?? null,
    maxAgeMs: 15 * 60_000,
    modelVersion: null,
    sourceIdentifier: "coingecko:global",
    sourceHealthy: Boolean(crypto && finite(crypto.observedAt)),
    temporalStatus: finite(crypto?.observedAt) ? "delayed" : "unavailable",
    temporalDetail: finite(crypto?.observedAt)
      ? "CoinGecko provider timestamp is retained; aggregate updates follow the provider cadence."
      : "CoinGecko aggregate lacked a provider observation timestamp and is unavailable for current claims.",
  };
}

function domainStatus(observations: ValidatedIntelligenceEvidence[], ids: string[]): EvidenceProviderHealth["status"] {
  const matched = observations.filter(observation => ids.includes(observation.id));
  if (matched.length === 0 || matched.every(observation => !observation.supportsCurrentClaim)) return "unavailable";
  return matched.every(observation => observation.supportsCurrentClaim) ? "healthy" : "degraded";
}

function buildDomainProjection(id: IntelligenceEvidenceDomain, label: string, observations: ValidatedIntelligenceEvidence[], select: (observation: ValidatedIntelligenceEvidence) => boolean): IntelligenceEvidenceDomainProjection {
  const matching = observations.filter(select);
  const observationIds = matching.map(observation => observation.id);
  const currentObservationIds = matching.filter(observation => observation.supportsCurrentClaim).map(observation => observation.id);
  const historicalObservationIds = matching.filter(observation => !observation.supportsCurrentClaim && (observation.historicalValue || observation.lastVerified)).map(observation => observation.id);
  const status = domainStatus(observations, observationIds);
  return {
    id,
    label,
    status,
    observationIds,
    currentObservationIds,
    historicalObservationIds,
    limitation: status === "healthy" ? null : matching.length === 0
      ? "No validated source observation is mapped to this domain."
      : "Current-use eligibility is shown per source; unavailable or historical evidence is not treated as a current condition.",
  };
}

export function buildSixDomainProjection(observations: ValidatedIntelligenceEvidence[]): IntelligenceEvidenceDomainProjection[] {
  const canonicalFor = (term: string) => (observation: ValidatedIntelligenceEvidence) => observation.kind === "canonical_model" && new RegExp(term, "i").test(`${observation.id} ${observation.label}`);
  return [
    buildDomainProjection("equities", "Equities", observations, observation => ["quote:SPY", "quote:QQQ", "quote:IWM"].includes(observation.id)),
    buildDomainProjection("bonds_rates", "Bonds / Rates", observations, observation => ["fred:DGS10", "fred:DGS2"].includes(observation.id)),
    buildDomainProjection("credit", "Credit", observations, observation => observation.id === "fred:BAMLH0A0HYM2" || canonicalFor("credit")(observation)),
    buildDomainProjection("liquidity", "Liquidity", observations, canonicalFor("liquidity")),
    buildDomainProjection("volatility", "Cboe Volatility Index", observations, observation => observation.id === "quote:VIX"),
    buildDomainProjection("crypto", "Crypto", observations, observation => observation.id === "coingecko:global-market-cap"),
  ];
}

function addLastVerified(current: ValidatedIntelligenceEvidence[], previous: IntelligenceEvidenceSnapshot | null) {
  const previousById = new Map((previous?.observations ?? []).map(item => [item.id, item]));
  return current.map(item => {
    if (item.supportsCurrentClaim) return item;
    const prior = previousById.get(item.id);
    if (!prior?.supportsCurrentClaim) return item;
    return { ...item, lastVerified: toHistorical(prior) };
  });
}

function sourceFailureWarnings(inputs: EvidenceInputs) {
  const quoteFailures = inputs.quotes
    .filter(quote => quote.source === "error" && quote.error)
    .map(quote => `Market quote provider ${quote.ticker}: ${quote.error}`);
  const fredFailures = Object.entries(inputs.fred.results)
    .filter(([, result]) => result.error)
    .map(([series, result]) => `FRED ${series}: ${result.error}`);
  const cryptoFailure = inputs.crypto && finite(inputs.crypto.observedAt) ? [] : ["CoinGecko aggregate: no timestamped provider observation was available."];
  return [...quoteFailures, ...fredFailures, ...cryptoFailure];
}

export function buildEvidenceSnapshot(inputs: EvidenceInputs, now: Date = new Date(), previous: IntelligenceEvidenceSnapshot | null = null): IntelligenceEvidenceSnapshot {
  const quoteByTicker = new Map(inputs.quotes.map(quote => [quote.ticker.toUpperCase(), quote]));
  const drafts: EvidenceDraft[] = [
    ...(inputs.canonical?.engines.map(engine => canonicalEngineDraft(inputs.canonical as CanonicalIntelligenceState, engine)) ?? []),
    quoteDraft("quote:SPY", "S&P 500 proxy (SPY)", quoteByTicker.get("SPY"), now.getTime()),
    quoteDraft("quote:QQQ", "Nasdaq-100 proxy (QQQ)", quoteByTicker.get("QQQ"), now.getTime()),
    quoteDraft("quote:IWM", "Russell 2000 proxy (IWM)", quoteByTicker.get("IWM"), now.getTime()),
    quoteDraft("quote:VIX", "Cboe Volatility Index (^VIX)", quoteByTicker.get("^VIX"), now.getTime()),
    fredDraft("DGS10", "10-year Treasury yield", "percent", inputs.fred),
    fredDraft("DGS2", "2-year Treasury yield", "percent", inputs.fred),
    fredDraft("BAMLH0A0HYM2", "High-yield option-adjusted spread", "percent", inputs.fred),
    cryptoDraft(inputs.crypto),
  ];
  const observations = addLastVerified(drafts.map(draft => validate(draft, now.getTime())), previous);
  const canonicalIds = observations.filter(item => item.kind === "canonical_model").map(item => item.id);
  const health: EvidenceProviderHealth[] = [
    {
      id: "canonical",
      label: "Canonical MarketState",
      provider: "FAULTLINE",
      status: providerStatus(observations, canonicalIds),
      observedAt: inputs.canonical?.generatedAt ?? null,
      checkedAt: now.toISOString(),
      detail: inputs.canonical ? "Modeled canonical outputs are versioned and presented separately from direct provider observations." : "No authoritative canonical state was available.",
    },
    {
      id: "yahoo",
      label: "Market quotes",
      provider: "Yahoo Finance / configured Polygon fallback",
      status: providerStatus(observations, ["quote:SPY", "quote:QQQ", "quote:IWM", "quote:VIX"]),
      observedAt: observations.find(item => item.id === "quote:SPY")?.observedAt ?? null,
      checkedAt: now.toISOString(),
      detail: "Provider-reported timestamps are required; quote data is delayed and never called live.",
    },
    {
      id: "fred",
      label: "Macro and credit releases",
      provider: "Federal Reserve Economic Data (FRED)",
      status: providerStatus(observations, ["fred:DGS10", "fred:DGS2", "fred:BAMLH0A0HYM2"]),
      observedAt: observations.find(item => item.id === "fred:DGS10")?.observedAt ?? null,
      checkedAt: now.toISOString(),
      detail: "Released source observations follow their own publication cadence and are not intraday data.",
    },
    {
      id: "coingecko",
      label: "Crypto aggregate",
      provider: "CoinGecko",
      status: providerStatus(observations, ["coingecko:global-market-cap"]),
      observedAt: observations.find(item => item.id === "coingecko:global-market-cap")?.observedAt ?? null,
      checkedAt: now.toISOString(),
      detail: "Provider observation timestamps are required. Aggregate evidence is withheld whenever the source timestamp is missing, invalid, or stale.",
    },
  ];
  return {
    kind: "intelligence-evidence-snapshot",
    methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION,
    capturedAt: now.toISOString(),
    canonicalStateId: inputs.canonical?.stateId ?? null,
    observations,
    providerHealth: health,
    domains: buildSixDomainProjection(observations),
    limitations: [
      "This Phase 1 interface is a provenance record. It does not alter the Pressure Index, MarketState calculations, trading tools, Daily Briefs, or recommendations.",
      "A read being unavailable, stale, or historical is not interpreted as calm or neutral.",
      ...sourceFailureWarnings(inputs),
      ...(inputs.sourceWarnings ?? []),
    ],
    persistence: "in_memory_only",
  };
}

/** Returns a fallback quickly while preserving the provider adapter's own cache/in-flight request. */
export async function withinDeadline<T>(task: Promise<T>, fallback: T, deadlineMs: number, warning: string, warnings: string[]): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => { warnings.push(warning); resolve(fallback); }, deadlineMs);
    task.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); warnings.push(warning); resolve(fallback); },
    );
  });
}

export class IntelligenceEvidenceCollector {
  private latest: IntelligenceEvidenceSnapshot | null = null;
  private refreshPromise: Promise<IntelligenceEvidenceSnapshot | null> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly store = new IntelligenceEvidenceStore(),
    private readonly loadSources: () => Promise<EvidenceInputs> = async () => {
      const sourceWarnings: string[] = [];
      const [canonical, quotes, crypto, fred] = await Promise.all([
        withinDeadline(getAuthoritativeCanonicalIntelligenceState(), null, PROVIDER_DEADLINES_MS.canonical, "The canonical MarketState read exceeded its bounded collection window; no substitute state was created.", sourceWarnings),
        withinDeadline(getQuotes([...QUOTE_TICKERS]), [], PROVIDER_DEADLINES_MS.quotes, "The quote adapter exceeded its bounded collection window; quote observations are unavailable for this snapshot.", sourceWarnings),
        withinDeadline(getGlobalStats(), null, PROVIDER_DEADLINES_MS.crypto, "The CoinGecko adapter exceeded its bounded collection window; crypto aggregate evidence is unavailable for this snapshot.", sourceWarnings),
        withinDeadline(fetchFredBulk([...FRED_SERIES]), { results: {}, timestamp: new Date().toISOString() }, PROVIDER_DEADLINES_MS.fred, "The FRED adapter exceeded its bounded collection window; released macro evidence is unavailable for this snapshot.", sourceWarnings),
      ]);
      return { canonical, quotes, crypto, fred, sourceWarnings };
    },
  ) {}

  async refresh(): Promise<IntelligenceEvidenceSnapshot | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshInternal().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async refreshInternal(): Promise<IntelligenceEvidenceSnapshot | null> {
    const now = Date.now();
    const claim = await this.store.tryClaim(now);
    if (claim === "HELD") {
      const persisted = await this.store.loadLatest();
      if (persisted) this.latest = persisted;
      return this.latest;
    }
    const previous = this.latest ?? await this.store.loadLatest();
    const snapshot = buildEvidenceSnapshot(await this.loadSources(), new Date(now), previous);
    if (claim === "CLAIMED") {
      const persisted = { ...snapshot, persistence: "recorded" as const };
      const write = await this.store.insert(persisted);
      this.latest = write === "INSERTED" ? persisted : snapshot;
    } else {
      this.latest = snapshot;
    }
    return this.latest;
  }

  async current(): Promise<IntelligenceEvidenceResponse> {
    if (!this.latest) this.latest = await this.store.loadLatest();
    const capturedAt = this.latest ? Date.parse(this.latest.capturedAt) : Number.NaN;
    if (!this.latest || !Number.isFinite(capturedAt) || Date.now() - capturedAt > COLLECTION_INTERVAL_MS) {
      try { await this.refresh(); } catch { /* Source failures are represented in the payload. */ }
    }
    if (!this.latest) {
      return { enabled: true, status: "UNAVAILABLE", snapshot: null, reason: "No validated evidence snapshot is available yet.", nextCollectionAt: new Date(Date.now() + COLLECTION_INTERVAL_MS).toISOString() };
    }
    const supportsCurrent = this.latest.observations.filter(item => item.supportsCurrentClaim).length;
    const age = Date.now() - Date.parse(this.latest.capturedAt);
    const status: EvidenceInterfaceStatus = supportsCurrent === 0 || age > SNAPSHOT_STALE_AFTER_MS
      ? "UNAVAILABLE"
      : this.latest.providerHealth.some(provider => provider.status !== "healthy")
        ? "DEGRADED"
        : "CURRENT";
    return {
      enabled: true,
      status,
      snapshot: this.latest,
      reason: status === "CURRENT" ? null : "Source availability and original timestamps are shown per observation; unavailable evidence is not used for a current claim.",
      nextCollectionAt: new Date(Date.now() + COLLECTION_INTERVAL_MS).toISOString(),
    };
  }

  start(): void {
    if (this.timer) return;
    void this.refresh().catch(() => {});
    this.timer = setInterval(() => { void this.refresh().catch(() => {}); }, COLLECTION_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

const singleton = new IntelligenceEvidenceCollector();
export function getIntelligenceEvidenceCollector() { return singleton; }
export function startIntelligenceEvidenceCollector() { singleton.start(); }
