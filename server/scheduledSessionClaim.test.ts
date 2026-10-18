import { afterEach, describe, expect, it, vi } from "vitest";
import { handleScheduledSeismograph } from "./scheduledSeismograph";
import { claimScheduledSeismographSession, scheduledSeismographClaimKey } from "./scheduledSessionClaim";

describe("scheduled seismograph database claim", () => {
  afterEach(() => vi.useRealTimers());

  it("lets exactly one of many parallel callers claim a session", async () => {
    const keys = new Set<string>();
    let writes = 0;
    const claim = (etDate: string) => claimScheduledSeismographSession(etDate, async () => ({
      insert: () => ({
        values: async (row: { memoryKey: string }) => {
          writes += 1;
          if (keys.has(row.memoryKey)) {
            const error = new Error(`Duplicate entry '${row.memoryKey}'`) as Error & { code?: string; errno?: number };
            error.code = "ER_DUP_ENTRY";
            error.errno = 1062;
            throw error;
          }
          keys.add(row.memoryKey);
        },
      }),
    }) as never);

    const results = await Promise.all(Array.from({ length: 8 }, () => claim("2026-10-05")));
    expect(results.filter(result => result === "claimed")).toHaveLength(1);
    expect(results.filter(result => result === "already_claimed")).toHaveLength(7);
    expect(keys).toEqual(new Set([scheduledSeismographClaimKey("2026-10-05")]));
    expect(writes).toBe(8);
  });

  it("fails closed when the database is absent and does not start the run", async () => {
    await expect(claimScheduledSeismographSession("2026-10-05", async () => null)).resolves.toBe("unavailable");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T20:15:00.000Z"));
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await handleScheduledSeismograph({ sessionClaim: async () => "unavailable" } as never, { json, status } as never);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, skipped: "session_claim_unavailable" }));
  });

  it("treats a restarted caller as already claimed", async () => {
    const keys = new Set<string>([scheduledSeismographClaimKey("2026-11-02")]);
    const claim = (etDate: string) => claimScheduledSeismographSession(etDate, async () => ({
      insert: () => ({
        values: async (row: { memoryKey: string }) => {
          if (keys.has(row.memoryKey)) {
            throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
          }
          keys.add(row.memoryKey);
        },
      }),
    }) as never);
    await expect(claim("2026-11-02")).resolves.toBe("already_claimed");
  });
});
