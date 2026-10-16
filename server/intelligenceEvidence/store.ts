import { desc, like } from "drizzle-orm";
import { marketMemory } from "../../drizzle/schema";
import { INTELLIGENCE_EVIDENCE_METHOD_VERSION, type IntelligenceEvidenceSnapshot } from "../../shared/intelligenceEvidence";
import { getDb } from "../db";

const SNAPSHOT_PREFIX = `intelligence-evidence:${INTELLIGENCE_EVIDENCE_METHOD_VERSION}:` as const;
const CLAIM_PREFIX = `intelligence-evidence-claim:${INTELLIGENCE_EVIDENCE_METHOD_VERSION}:` as const;
const SNAPSHOT_INTERVAL_MS = 15 * 60_000;
const CLAIM_INTERVAL_MS = 5 * 60_000;
const WRITER = "intelligenceEvidenceCollector";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type CollectionClaim = "CLAIMED" | "HELD" | "UNAVAILABLE";
export type SnapshotWrite = "INSERTED" | "DUPLICATE" | "UNAVAILABLE";

export const evidenceSnapshotKey = (capturedAtMs: number) => `${SNAPSHOT_PREFIX}${Math.floor(capturedAtMs / SNAPSHOT_INTERVAL_MS)}`;
export const evidenceClaimKey = (capturedAtMs: number) => `${CLAIM_PREFIX}${Math.floor(capturedAtMs / CLAIM_INTERVAL_MS)}`;

function duplicateKey(error: unknown) {
  const candidate = error as { code?: string; errno?: number; message?: string; cause?: { code?: string; errno?: number; message?: string } };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.errno === 1062 || candidate?.cause?.code === "ER_DUP_ENTRY" || candidate?.cause?.errno === 1062 || /Duplicate entry/i.test(`${candidate?.message ?? ""} ${candidate?.cause?.message ?? ""}`);
}

function decode(value: string): IntelligenceEvidenceSnapshot | null {
  try {
    const snapshot = JSON.parse(value) as IntelligenceEvidenceSnapshot;
    if (snapshot.kind !== "intelligence-evidence-snapshot" || snapshot.methodVersion !== INTELLIGENCE_EVIDENCE_METHOD_VERSION) return null;
    if (!Array.isArray(snapshot.observations) || !Array.isArray(snapshot.providerHealth)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

/** Reuses the existing marketMemory ledger; Phase 1 introduces no schema or migration. */
export class IntelligenceEvidenceStore {
  constructor(private readonly dbProvider: () => Promise<Db | null> = getDb) {}

  async loadLatest(): Promise<IntelligenceEvidenceSnapshot | null> {
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

  async tryClaim(nowMs: number): Promise<CollectionClaim> {
    const db = await this.dbProvider();
    if (!db) return "UNAVAILABLE";
    try {
      await db.insert(marketMemory).values({
        memoryKey: evidenceClaimKey(nowMs),
        memoryValue: JSON.stringify({ kind: "intelligence-evidence-claim", methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION, claimedAt: new Date(nowMs).toISOString() }),
        description: "Phase 1 verified-evidence collection claim (append-only five-minute lease)",
        writtenBy: WRITER,
      });
      return "CLAIMED";
    } catch (error) {
      if (duplicateKey(error)) return "HELD";
      throw error;
    }
  }

  async insert(snapshot: IntelligenceEvidenceSnapshot): Promise<SnapshotWrite> {
    const db = await this.dbProvider();
    if (!db) return "UNAVAILABLE";
    const capturedAt = Date.parse(snapshot.capturedAt);
    try {
      await db.insert(marketMemory).values({
        memoryKey: evidenceSnapshotKey(Number.isFinite(capturedAt) ? capturedAt : Date.now()),
        memoryValue: JSON.stringify(snapshot),
        description: `Phase 1 validated evidence snapshot (${INTELLIGENCE_EVIDENCE_METHOD_VERSION}, append-only)`,
        writtenBy: WRITER,
      });
      return "INSERTED";
    } catch (error) {
      if (duplicateKey(error)) return "DUPLICATE";
      throw error;
    }
  }
}
