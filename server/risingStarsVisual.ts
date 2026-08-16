import { getDailyBars, type YahooDailyBar } from "./yahooProxy";
import { getOpportunityDiscovery, type RisingStarItem } from "./signalOutlook";
import { getVerifiedRisingStarHistory } from "./risingStarsHistory";

export type RisingStarChartRange = "1W" | "1M" | "3M" | "6M";

const RANGE_TO_YAHOO: Record<RisingStarChartRange, "3mo" | "6mo"> = {
  "1W": "3mo", "1M": "3mo", "3M": "3mo", "6M": "6mo",
};

const RANGE_DAYS: Record<RisingStarChartRange, number> = {
  "1W": 7, "1M": 31, "3M": 92, "6M": 184,
};

export function chartBarsForRange(bars: YahooDailyBar[], range: RisingStarChartRange) {
  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return bars.filter(bar => bar.timestamp >= cutoff);
}

export function deriveDefensibleTechnicalLevels(bars: YahooDailyBar[]) {
  const completed = bars.slice(-20);
  if (completed.length < 10) return { support: null, resistance: null, basis: "Insufficient completed daily bars for calculated support/resistance." };
  const support = Math.min(...completed.map(bar => bar.low));
  const resistance = Math.max(...completed.map(bar => bar.high));
  return {
    support,
    resistance,
    basis: `Calculated from the preceding ${completed.length} completed daily bars; these are reference levels, not forecasts.`,
  };
}

export function computeRecordedSignalWindow(
  detectionPrice: number | null,
  detectionAt: number | null,
  bars: YahooDailyBar[],
  currentPrice: number | null
) {
  if (detectionPrice == null || detectionAt == null || currentPrice == null || detectionPrice <= 0) return null;
  const windowBars = bars.filter(bar => bar.timestamp >= detectionAt);
  if (!windowBars.length) return null;
  const pct = ((currentPrice / detectionPrice) - 1) * 100;
  const maxHigh = Math.max(...windowBars.map(bar => bar.high));
  const minLow = Math.min(...windowBars.map(bar => bar.low));
  return {
    detectionPrice,
    currentPrice,
    movementPercent: pct,
    maxFavorablePercent: ((maxHigh / detectionPrice) - 1) * 100,
    maxAdversePercent: ((minLow / detectionPrice) - 1) * 100,
    daysActive: Math.max(0, Math.floor((Date.now() - detectionAt) / (24 * 60 * 60 * 1000))),
    note: "Price movement during the recorded FAULTLINE signal window. This is not investor-return reporting.",
  };
}

function parseSnapshotPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSnapshot(row: Awaited<ReturnType<typeof getVerifiedRisingStarHistory>>["snapshots"][number]) {
  let evidence: unknown = [];
  let technical: unknown = {};
  let provenance: unknown = {};
  try { evidence = JSON.parse(row.evidenceJson); } catch { /* stored immutable record remains available without parsed enrichment */ }
  try { technical = JSON.parse(row.technicalJson); } catch { /* stored immutable record remains available without parsed enrichment */ }
  try { provenance = JSON.parse(row.provenanceJson); } catch { /* stored immutable record remains available without parsed enrichment */ }
  return {
    id: row.id,
    observedAt: row.observedAt.getTime(),
    observationType: row.observationType,
    qualification: row.qualification,
    score: row.risingStarScore,
    price: parseSnapshotPrice(row.price),
    momentumScore: row.momentumScore,
    volumeParticipationScore: row.volumeParticipationScore,
    riskLevel: row.riskLevel,
    evidence,
    technical,
    provenance,
  };
}

export async function getRisingStarVisualDetail(ticker: string, range: RisingStarChartRange) {
  const symbol = ticker.trim().toUpperCase();
  const discovery = await getOpportunityDiscovery();
  const item = discovery.risingStars.find(candidate => candidate.ticker === symbol);
  if (!item) return null;

  const [bars, verifiedHistory] = await Promise.all([
    getDailyBars(symbol, RANGE_TO_YAHOO[range]),
    getVerifiedRisingStarHistory(symbol),
  ]);
  const chartBars = chartBarsForRange(bars, range);
  const snapshots = verifiedHistory.snapshots.map(normalizeSnapshot).sort((a, b) => a.observedAt - b.observedAt);
  const events = verifiedHistory.events.map(event => ({
    id: event.id,
    type: event.eventType,
    eventAt: event.eventAt.getTime(),
    headline: event.headline,
    historyClass: event.historyClass,
  })).sort((a, b) => a.eventAt - b.eventAt);
  const firstQualification = events.find(event => event.type === "first_qualification");
  const detectionSnapshot = firstQualification
    ? snapshots.find(snapshot => snapshot.id === verifiedHistory.events.find(event => event.id === firstQualification.id)?.snapshotId) ?? null
    : null;
  const detectionAt = firstQualification?.eventAt ?? null;
  const detectionPrice = detectionSnapshot?.price ?? null;
  const levels = deriveDefensibleTechnicalLevels(bars);

  return {
    item: toVisualItem(item),
    range,
    bars: chartBars,
    levels,
    verifiedHistory: {
      historyClass: "live_verified" as const,
      snapshots,
      events,
      startedAt: snapshots[0]?.observedAt ?? null,
      boundaryNote: snapshots.length
        ? "LIVE VERIFIED HISTORY begins at the first stored FAULTLINE observation. Earlier chart data is market history only and carries no implied FAULTLINE detection."
        : "No live verified Rising Stars observations have been stored for this asset yet. Historical chart data is market history only, not a reconstructed FAULTLINE signal.",
    },
    signalWindow: computeRecordedSignalWindow(detectionPrice, detectionAt, bars, item.latestPrice),
    currentContext: {
      pressureIndex: discovery.pressureIndex,
      regime: discovery.regime,
      generatedAt: discovery.generatedAt,
      marketDataAsOf: item.marketDataAsOf,
      priceStatus: item.priceStatus,
    },
  };
}

function toVisualItem(item: RisingStarItem) {
  return {
    ticker: item.ticker,
    name: item.name,
    description: item.description,
    latestPrice: item.latestPrice,
    dailyChange: item.dailyChange,
    dailyChangePercent: item.dailyChangePercent,
    priceStatus: item.priceStatus,
    marketDataAsOf: item.marketDataAsOf,
    risingStarScore: item.risingStarScore,
    baseScore: item.baseScore,
    crowdingPenalty: item.crowdingPenalty,
    signalDirection: item.signalDirection,
    signalStrength: item.signalStrength,
    riskLevel: item.riskLevel,
    momentumScore: item.momentumScore,
    relativeStrengthScore: item.relativeStrengthScore,
    volumeParticipationScore: item.volumeParticipationScore,
    macroContext: item.macroContext,
    sector: item.sector,
    industry: item.industry,
    themes: item.themes,
    primaryCatalyst: item.primaryCatalyst,
    keyRisk: item.keyRisk,
    whySeeingItEarly: item.whySeeingItEarly,
    evidence: item.evidence,
    dataNotes: item.dataNotes,
  };
}
