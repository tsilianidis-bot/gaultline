import { describe, expect, it } from "vitest";
import { INTELLIGENCE_EVIDENCE_METHOD_VERSION, type IntelligenceEvidenceSnapshot } from "../../shared/intelligenceEvidence";
import { IntelligenceEvidenceStore, evidenceSnapshotKey, evidenceClaimKey } from "./store";

type LedgerRow = { memoryKey: string; memoryValue: string };

function duplicateError() {
  return Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
}

function createAppendOnlyMemoryDb() {
  const rows = new Map<string, LedgerRow>();
  const db = {
    insert: () => ({
      values: async (value: { memoryKey: string; memoryValue: string }) => {
        if (rows.has(value.memoryKey)) throw duplicateError();
        rows.set(value.memoryKey, { memoryKey: value.memoryKey, memoryValue: value.memoryValue });
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [...rows.values()].sort((a, b) => b.memoryKey.localeCompare(a.memoryKey)),
          }),
        }),
      }),
    }),
  };
  return { db, rows };
}

const snapshot = (capturedAt: string): IntelligenceEvidenceSnapshot => ({
  kind: "intelligence-evidence-snapshot",
  methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION,
  capturedAt,
  canonicalStateId: "state-1",
  observations: [],
  providerHealth: [],
  domains: [],
  limitations: [],
  persistence: "recorded",
});

describe("IntelligenceEvidenceStore append-only ledger", () => {
  it("claims one collection interval, writes an append-only snapshot, and reads it back", async () => {
    const { db, rows } = createAppendOnlyMemoryDb();
    const store = new IntelligenceEvidenceStore(async () => db as never);
    const now = Date.parse("2026-10-16T15:00:00.000Z");

    expect(await store.tryClaim(now)).toBe("CLAIMED");
    expect(await store.tryClaim(now)).toBe("HELD");
    expect(await store.insert(snapshot(new Date(now).toISOString()))).toBe("INSERTED");
    expect(await store.insert(snapshot(new Date(now).toISOString()))).toBe("DUPLICATE");
    expect(await store.loadLatest()).toMatchObject({ capturedAt: "2026-10-16T15:00:00.000Z", persistence: "recorded" });
    expect(rows.size).toBe(2);
  });
});

describe("canonical-state-scoped append-only deduplication", () => {
  it("retains distinct canonical snapshots in one interval without overwriting either", async () => {
    const { db, rows } = createAppendOnlyMemoryDb();
    const store = new IntelligenceEvidenceStore(async () => db as never);
    const now = Date.parse("2026-10-16T20:30:00.000Z");
    expect(await store.tryClaim(now, "state-1")).toBe("CLAIMED");
    expect(await store.tryClaim(now, "state-1")).toBe("HELD");
    expect(await store.tryClaim(now, "state-2")).toBe("CLAIMED");
    const first = snapshot(new Date(now).toISOString());
    const second = { ...first, canonicalStateId: "state-2" };
    expect(await store.insert(first)).toBe("INSERTED");
    expect(await store.insert(second)).toBe("INSERTED");
    expect(await store.insert(first)).toBe("DUPLICATE");
    expect(rows.size).toBe(4);
    expect([...rows.values()].filter(row => JSON.parse(row.memoryValue).kind === "intelligence-evidence-snapshot")).toHaveLength(2);
  });
});

it("separates exact forward-run source evidence from interface refresh leases in the same append-only ledger", () => {
  const now = Date.parse("2026-10-17T18:05:00Z");
  expect(evidenceSnapshotKey(now, "state-1", true)).not.toBe(evidenceSnapshotKey(now, "state-1"));
  expect(evidenceClaimKey(now, "state-1", true)).not.toBe(evidenceClaimKey(now, "state-1"));
});
