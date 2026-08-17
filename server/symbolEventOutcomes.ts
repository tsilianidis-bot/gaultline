import { desc, eq } from "drizzle-orm";
import { risingStarEvents, risingStarSnapshots, symbolEventOutcomes } from "../drizzle/schema";
import { getDb } from "./db";
import { getDailyBars } from "./yahooProxy";

const HORIZONS = [1, 5, 20, 60] as const;

type CompletedBar = { timestamp: number; close: number };

function eligibleBars(bars: CompletedBar[]) {
  return bars.filter(bar => Number.isFinite(bar.timestamp) && Number.isFinite(bar.close) && bar.close > 0).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Appends only completed-own-instrument outcomes for observed Rising Stars
 * events. Missing prices or incomplete horizons remain absent (pending), and
 * neither events nor snapshots are ever edited.
 */
export async function collectRisingStarEventOutcomes() {
  const db = await getDb();
  if (!db) return { appended: 0, deferred: 0 };

  const events = await db.select({
    id: risingStarEvents.id,
    eventKey: risingStarEvents.eventKey,
    ticker: risingStarEvents.ticker,
    eventAt: risingStarEvents.eventAt,
  }).from(risingStarEvents).orderBy(desc(risingStarEvents.eventAt)).limit(500);

  const cache = new Map<string, CompletedBar[]>();
  let appended = 0;
  let deferred = 0;
  for (const event of events) {
    let bars = cache.get(event.ticker);
    if (!bars) {
      bars = eligibleBars(await getDailyBars(event.ticker, "6mo"));
      cache.set(event.ticker, bars);
    }
    const baseIndex = bars.map(bar => bar.timestamp).filter(timestamp => timestamp <= event.eventAt.getTime()).length - 1;
    if (baseIndex < 0) { deferred += HORIZONS.length; continue; }
    const base = bars[baseIndex];
    if (!base) { deferred += HORIZONS.length; continue; }
    for (const horizonTradingDays of HORIZONS) {
      const target = bars[baseIndex + horizonTradingDays];
      if (!target) { deferred++; continue; }
      const outcomeKey = `rising-star:${event.id}:own-instrument:${horizonTradingDays}td`;
      const existing = await db.select({ id: symbolEventOutcomes.id }).from(symbolEventOutcomes).where(eq(symbolEventOutcomes.outcomeKey, outcomeKey)).limit(1);
      if (existing[0]) continue;
      await db.insert(symbolEventOutcomes).values({
        outcomeKey,
        sourceEventType: "rising_star_event",
        sourceEventKey: event.eventKey,
        symbol: event.ticker,
        assetClass: "equity",
        horizonTradingDays,
        observedAt: new Date(target.timestamp),
        outcomeJson: JSON.stringify({
          historyClass: "live_verified",
          instrument: { symbol: event.ticker, baseClose: base.close, targetClose: target.close, returnPercent: ((target.close - base.close) / base.close) * 100, observedAt: new Date(target.timestamp).toISOString().slice(0, 10) },
        }),
        provenanceJson: JSON.stringify({ source: "Yahoo completed daily bars", horizonTradingDays, originalEventKey: event.eventKey }),
      });
      appended++;
    }
  }
  return { appended, deferred };
}

export async function getRisingStarEventOutcomes(ticker: string) {
  const db = await getDb();
  if (!db) return [];
  const events = await db.select({ eventKey: risingStarEvents.eventKey }).from(risingStarEvents).where(eq(risingStarEvents.ticker, ticker.trim().toUpperCase())).limit(250);
  if (!events.length) return [];
  const keys = new Set(events.map(event => event.eventKey));
  const rows = await db.select().from(symbolEventOutcomes).where(eq(symbolEventOutcomes.sourceEventType, "rising_star_event")).orderBy(desc(symbolEventOutcomes.observedAt)).limit(1000);
  return rows.filter(row => keys.has(row.sourceEventKey));
}
