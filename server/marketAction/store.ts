import { desc, like } from "drizzle-orm";
import { marketMemory } from "../../drizzle/schema";
import { MARKET_ACTION_METHOD_VERSION, type MarketActionSnapshot } from "../../shared/marketAction";
import { getDb } from "../db";

const SNAPSHOT_PREFIX = `market-action:${MARKET_ACTION_METHOD_VERSION}:` as const;
const CLAIM_PREFIX = `market-action-claim:${MARKET_ACTION_METHOD_VERSION}:` as const;
const SNAPSHOT_INTERVAL_MS = 15 * 60_000;
const CLAIM_INTERVAL_MS = 5 * 60_000;
const WRITER = "marketActionCollector";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const marketActionSnapshotKey = (capturedAtMs: number) =>
  `${SNAPSHOT_PREFIX}${Math.floor(capturedAtMs / SNAPSHOT_INTERVAL_MS)}`;
export const marketActionClaimKey = (capturedAtMs: number) =>
  `${CLAIM_PREFIX}${Math.floor(capturedAtMs / CLAIM_INTERVAL_MS)}`;

function duplicateKey(error: unknown) {
  const e = error as { code?: string; errno?: number; message?: string; cause?: { code?: string; errno?: number; message?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062 || /Duplicate entry/i.test(`${e?.message ?? ""} ${e?.cause?.message ?? ""}`);
}

function decode(value: string): MarketActionSnapshot | null {
  try {
    const snapshot = JSON.parse(value) as MarketActionSnapshot;
    if (snapshot.kind !== "market-action-snapshot" || snapshot.methodVersion !== MARKET_ACTION_METHOD_VERSION) return null;
    if (!Array.isArray(snapshot.coverage) || !Array.isArray(snapshot.readings) || !Array.isArray(snapshot.events)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export class MarketActionStore {
  constructor(private readonly dbProvider: () => Promise<Db | null> = getDb) {}

  async loadLatest(): Promise<MarketActionSnapshot | null> {
    const db = await this.dbProvider();
    if (!db) return null;
    const rows = await db.select({ memoryKey: marketMemory.memoryKey, memoryValue: marketMemory.memoryValue })
      .from(marketMemory)
      .where(like(marketMemory.memoryKey, `${SNAPSHOT_PREFIX}%`))
      .orderBy(desc(marketMemory.memoryKey))
      .limit(5);
    for (const row of rows) {
      const snapshot = decode(row.memoryValue);
      if (snapshot) return snapshot;
    }
    return null;
  }

  async tryClaim(nowMs: number): Promise<"CLAIMED" | "HELD"> {
    const db = await this.dbProvider();
    if (!db) throw new Error("market action storage unavailable");
    const key = marketActionClaimKey(nowMs);
    try {
      await db.insert(marketMemory).values({
        memoryKey: key,
        memoryValue: JSON.stringify({ kind: "market-action-claim", methodVersion: MARKET_ACTION_METHOD_VERSION, claimedAt: new Date(nowMs).toISOString(), bucketMinutes: 5 }),
        description: "Market Action collection claim (append-only five-minute lease)",
        writtenBy: WRITER,
      });
      return "CLAIMED";
    } catch (error) {
      if (duplicateKey(error)) return "HELD";
      throw error;
    }
  }

  async insert(snapshot: MarketActionSnapshot): Promise<"INSERTED" | "DUPLICATE"> {
    const db = await this.dbProvider();
    if (!db) throw new Error("market action storage unavailable");
    const capturedAt = Date.parse(snapshot.capturedAt);
    const key = marketActionSnapshotKey(Number.isFinite(capturedAt) ? capturedAt : Date.now());
    try {
      await db.insert(marketMemory).values({
        memoryKey: key,
        memoryValue: JSON.stringify(snapshot),
        description: `Market Action verified source snapshot (${MARKET_ACTION_METHOD_VERSION}, append-only)`,
        writtenBy: WRITER,
      });
      return "INSERTED";
    } catch (error) {
      if (duplicateKey(error)) return "DUPLICATE";
      throw error;
    }
  }
}
