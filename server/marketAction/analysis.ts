import type {
  MarketActionEvent,
  MarketActionKind,
  MarketActionReading,
  MarketActionSeverity,
  MarketActionSnapshot,
} from "../../shared/marketAction";

const atLeast = (value: number | null, threshold: number) => value != null && value >= threshold;
const atMost = (value: number | null, threshold: number) => value != null && value <= threshold;
const finite = (value: number | null): value is number => typeof value === "number" && Number.isFinite(value);

export const MARKET_ACTION_POLICY = {
  broadEquityModerate: -1.5,
  broadEquityHigh: -3,
  sectorStressModerate: -2,
  sectorStressHigh: -3.5,
  vixSpikeModerate: 10,
  vixSpikeHigh: 20,
  cryptoStressModerate: -5,
  cryptoStressHigh: -10,
  accelerationChange: -0.8,
  minBroadEquityCoverage: 2,
  minSectorCoverage: 6,
} as const;

const equityIds = ["SPY", "QQQ", "IWM"] as const;
const sectorIds = ["XLK", "XLF", "XLE", "XLY", "XLP", "XLV", "XLI", "XLU", "XLB", "XLRE", "XLC"] as const;

function byId(snapshot: Pick<MarketActionSnapshot, "readings">) {
  return new Map(snapshot.readings.map(reading => [reading.id, reading]));
}

function severityForMagnitude(magnitude: number, moderate: number, high: number): MarketActionSeverity {
  if (magnitude >= Math.abs(high) * 1.5) return "critical";
  if (magnitude >= Math.abs(high)) return "high";
  if (magnitude >= Math.abs(moderate)) return "moderate";
  return "low";
}

function etDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso))
    .replace(/\//g, "-");
}

function materialEvent(input: Omit<MarketActionEvent, "key" | "detectedAt" | "sourcedDrivers" | "aiSummary" | "aiGeneratedAt" | "decisionBoundary"> & { snapshot: MarketActionSnapshot }) {
  const { snapshot, kind, severity, direction, headline, evidence, inference, watchConditions } = input;
  const day = etDate(snapshot.capturedAt);
  // At most one same-severity event per ET date and detector kind. Each newer
  // verified snapshot remains available separately; the event ledger should
  // not turn a persistent condition into a stream of duplicate alerts.
  const signature = [kind, severity].join(":");
  return {
    // Must fit the existing institutionalEvents.eventKey varchar(120) contract.
    key: `market-action:${day}:${signature}`.slice(0, 116),
    kind,
    severity,
    direction,
    detectedAt: snapshot.calculationAt,
    headline,
    evidence,
    inference,
    sourcedDrivers: [],
    aiSummary: null,
    aiGeneratedAt: null,
    watchConditions,
    decisionBoundary: "This is an evidence-based market-action monitor, not individualized investment advice, a trading instruction, or a change to the daily Pressure Index.",
  } satisfies MarketActionEvent;
}

function pct(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function readingText(reading: MarketActionReading | undefined) {
  if (!reading || !finite(reading.changePercent)) return null;
  return `${reading.label} ${pct(reading.changePercent)}`;
}

/**
 * Pure, evidence-bound detector. It cannot infer a catalyst: every emitted event
 * is tied only to the source observations supplied in the snapshot.
 */
export function detectMarketAction(snapshot: MarketActionSnapshot, previous: MarketActionSnapshot | null): MarketActionEvent[] {
  const current = byId(snapshot);
  const prior = previous ? byId(previous) : null;
  const events: MarketActionEvent[] = [];

  const equities = equityIds.map(id => current.get(id)).filter((reading): reading is MarketActionReading => !!reading && finite(reading.changePercent));
  const negativeEquities = equities.filter(reading => atMost(reading.changePercent, MARKET_ACTION_POLICY.broadEquityModerate));
  const averageEquityMove = equities.length ? equities.reduce((sum, reading) => sum + (reading.changePercent ?? 0), 0) / equities.length : null;
  const broadStress = equities.length >= MARKET_ACTION_POLICY.minBroadEquityCoverage && (
    negativeEquities.length >= MARKET_ACTION_POLICY.minBroadEquityCoverage || atMost(averageEquityMove, MARKET_ACTION_POLICY.broadEquityModerate)
  );

  if (broadStress && averageEquityMove != null) {
    const severity = severityForMagnitude(averageEquityMove, MARKET_ACTION_POLICY.broadEquityModerate, MARKET_ACTION_POLICY.broadEquityHigh);
    const evidence = equities.map(readingText).filter((item): item is string => !!item);
    events.push(materialEvent({
      snapshot,
      kind: "broad_equity_selloff",
      severity,
      direction: "deteriorating",
      headline: `Broad equity weakness is meeting the monitored stress threshold (${equities.length}/${equityIds.length} major equity proxies covered).`,
      evidence,
      inference: "Observed weakness is broad across the available major-equity proxies. This is a measured market condition, not evidence of a specific cause.",
      watchConditions: [
        "Whether two or more broad-equity proxies remain below the −1.50% monitored move threshold.",
        "Whether the decline becomes more severe, broadens to sectors, or is accompanied by volatility and credit confirmation.",
      ],
    }));
  }

  const sectors = sectorIds.map(id => current.get(id)).filter((reading): reading is MarketActionReading => !!reading && finite(reading.changePercent));
  const stressedSectors = sectors.filter(reading => atMost(reading.changePercent, MARKET_ACTION_POLICY.sectorStressModerate));
  if (!broadStress && sectors.length >= MARKET_ACTION_POLICY.minSectorCoverage && stressedSectors.length >= 2) {
    const worst = Math.min(...stressedSectors.map(reading => reading.changePercent ?? 0));
    const severity = severityForMagnitude(worst, MARKET_ACTION_POLICY.sectorStressModerate, MARKET_ACTION_POLICY.sectorStressHigh);
    events.push(materialEvent({
      snapshot,
      kind: "sector_specific_stress",
      severity,
      direction: "deteriorating",
      headline: `Sector-specific stress is concentrated in ${stressedSectors.length} monitored sector ETFs while broad-equity stress is not yet confirmed.`,
      evidence: stressedSectors.map(readingText).filter((item): item is string => !!item),
      inference: "The available evidence is concentrated rather than broad-based. No market-wide stress conclusion is made from a sector-only move.",
      watchConditions: [
        "Whether sector weakness spreads to at least two major-equity proxies.",
        "Whether the affected sectors recover above the −2.00% monitored move threshold.",
      ],
    }));
  }

  const vix = current.get("VIX");
  if (vix && atLeast(vix.changePercent, MARKET_ACTION_POLICY.vixSpikeModerate)) {
    const magnitude = vix.changePercent ?? 0;
    events.push(materialEvent({
      snapshot,
      kind: "volatility_spike",
      severity: severityForMagnitude(magnitude, MARKET_ACTION_POLICY.vixSpikeModerate, MARKET_ACTION_POLICY.vixSpikeHigh),
      direction: "deteriorating",
      headline: "Volatility is rising through the monitored threshold.",
      evidence: [readingText(vix)].filter((item): item is string => !!item),
      inference: "The volatility observation meets a predefined change threshold. It does not identify the reason risk pricing changed.",
      watchConditions: [
        "Whether volatility remains elevated after the next observed market interval.",
        "Whether rising volatility is confirmed by broad-equity or sector weakness.",
      ],
    }));
  }

  const btc = current.get("BTC");
  const cryptoGlobal = current.get("CRYPTO_GLOBAL");
  const cryptoCandidate = [btc, cryptoGlobal].find(reading => reading && atMost(reading.changePercent, MARKET_ACTION_POLICY.cryptoStressModerate));
  if (cryptoCandidate && finite(cryptoCandidate.changePercent)) {
    const magnitude = cryptoCandidate.changePercent;
    events.push(materialEvent({
      snapshot,
      kind: "crypto_stress",
      severity: severityForMagnitude(magnitude, MARKET_ACTION_POLICY.cryptoStressModerate, MARKET_ACTION_POLICY.cryptoStressHigh),
      direction: "deteriorating",
      headline: "Crypto-market stress is meeting the monitored 24-hour change threshold.",
      evidence: [readingText(btc), readingText(cryptoGlobal)].filter((item): item is string => !!item),
      inference: "The observation is from the continuously traded crypto market. It is displayed separately from delayed equity data and does not establish a cross-market cause on its own.",
      watchConditions: [
        "Whether the 24-hour crypto move persists or reverses on the next verified observation.",
        "Whether equity weakness and volatility stress emerge alongside crypto stress.",
      ],
    }));
  }

  if (broadStress && vix && atLeast(vix.changePercent, MARKET_ACTION_POLICY.vixSpikeModerate) && cryptoCandidate) {
    const broad = events.find(event => event.kind === "broad_equity_selloff");
    const volatility = events.find(event => event.kind === "volatility_spike");
    const crypto = events.find(event => event.kind === "crypto_stress");
    events.push(materialEvent({
      snapshot,
      kind: "cross_market_stress",
      severity: [broad, volatility, crypto].some(event => event?.severity === "critical") ? "critical" : "high",
      direction: "deteriorating",
      headline: "Stress is appearing across available equity, volatility, and crypto observations.",
      evidence: [...(broad?.evidence ?? []), ...(volatility?.evidence ?? []), ...(crypto?.evidence ?? [])],
      inference: "Multiple independently observed market areas meet their predefined thresholds at the same time. This is a cross-market observation, not a causal explanation or a systemic-risk score.",
      watchConditions: [
        "Whether coverage remains intact and the same cross-market pattern persists on the next observations.",
        "Whether daily credit and Treasury observations confirm or contradict the intraday pattern when those sources update.",
      ],
    }));
  }

  if (previous && equities.length >= MARKET_ACTION_POLICY.minBroadEquityCoverage && prior) {
    const priorEquities = equityIds.map(id => prior.get(id)).filter((reading): reading is MarketActionReading => !!reading && finite(reading.changePercent));
    const priorAverage = priorEquities.length >= MARKET_ACTION_POLICY.minBroadEquityCoverage
      ? priorEquities.reduce((sum, reading) => sum + (reading.changePercent ?? 0), 0) / priorEquities.length
      : null;
    if (priorAverage != null && averageEquityMove != null && averageEquityMove <= -1 && averageEquityMove - priorAverage <= MARKET_ACTION_POLICY.accelerationChange) {
      events.push(materialEvent({
        snapshot,
        kind: "accelerating_equity_loss",
        severity: averageEquityMove <= MARKET_ACTION_POLICY.broadEquityHigh ? "high" : "moderate",
        direction: "deteriorating",
        headline: "Major-equity weakness has accelerated versus the prior verified Market Action observation.",
        evidence: [
          `Prior average major-equity move ${pct(priorAverage)}.`,
          `Current average major-equity move ${pct(averageEquityMove)}.`,
          ...equities.map(readingText).filter((item): item is string => !!item),
        ],
        inference: "The comparison is between two verified monitor snapshots. It measures acceleration in the observed move; it does not infer why the move occurred.",
        watchConditions: [
          "Whether the next verified major-equity snapshot stabilizes or weakens further.",
          "Whether the observed acceleration is accompanied by a volatility spike or broader sector participation.",
        ],
      }));
    }
  }

  return events;
}

export function highestPriorityEvent(events: MarketActionEvent[]) {
  const rank: Record<MarketActionSeverity, number> = { low: 1, moderate: 2, high: 3, critical: 4 };
  return [...events].sort((a, b) => rank[b.severity] - rank[a.severity])[0] ?? null;
}
