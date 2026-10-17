import { createHash } from "node:crypto";
import { and, desc, like, notLike } from "drizzle-orm";
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

const stateSuffix = (stateId?: string | null) => stateId ? `:${createHash("sha256").update(stateId).digest("hex").slice(0, 16)}` : "";
export const evidenceSnapshotKey = (capturedAtMs: number, stateId?: string | null, forwardRecording = false) => `${SNAPSHOT_PREFIX}${Math.floor(capturedAtMs / SNAPSHOT_INTERVAL_MS)}${stateSuffix(stateId)}${forwardRecording ? ":forward" : ""}`;
export const evidenceClaimKey = (capturedAtMs: number, stateId?: string | null, forwardRecording = false) => `${CLAIM_PREFIX}${Math.floor(capturedAtMs / CLAIM_INTERVAL_MS)}${stateSuffix(stateId)}${forwardRecording ? ":forward" : ""}`;

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

  async loadLatest(canonicalStateId?: string, forwardRecording = false): Promise<IntelligenceEvidenceSnapshot | null> {
    const db = await this.dbProvider();
    if (!db) return null;
    const rows = await db.select({ memoryKey: marketMemory.memoryKey, memoryValue: marketMemory.memoryValue })
      .from(marketMemory)
      .where(forwardRecording
        ? like(marketMemory.memoryKey, `${SNAPSHOT_PREFIX}%${stateSuffix(canonicalStateId)}:forward`)
        : and(like(marketMemory.memoryKey, `${SNAPSHOT_PREFIX}%${stateSuffix(canonicalStateId)}`), notLike(marketMemory.memoryKey, "%:forward")))
      .orderBy(desc(marketMemory.updatedAt), desc(marketMemory.id))
      .limit(5);
    for (const row of rows) {
      const snapshot = decode(row.memoryValue);
      if (snapshot && (snapshot.purpose === "forward_recording") === forwardRecording) return snapshot;
    }
    return null;
  }

  async tryClaim(nowMs: number, canonicalStateId?: string | null, forwardRecording = false): Promise<CollectionClaim> {
    const db = await this.dbProvider();
    if (!db) return "UNAVAILABLE";
    try {
      await db.insert(marketMemory).values({
        memoryKey: evidenceClaimKey(nowMs, canonicalStateId, forwardRecording),
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
    if (!Number.isFinite(capturedAt)) return "UNAVAILABLE";
    try {
      await db.insert(marketMemory).values({
        memoryKey: evidenceSnapshotKey(capturedAt, snapshot.canonicalStateId, snapshot.purpose === "forward_recording"),
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
