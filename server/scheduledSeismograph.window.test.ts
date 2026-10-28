import { afterEach, describe, expect, it, vi } from "vitest";
import { handleScheduledSeismograph } from "./scheduledSeismograph";

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { json, status } };
}

describe("scheduled Seismograph NYSE admission", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an explicit non-writing skip outside the valid post-close session window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T21:15:00.000Z")); // Thanksgiving, 16:15 EST
    const { json, status, res } = response();

    await handleScheduledSeismograph({} as never, res as never);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      alert: true,
      skipped: "outside_nyse_post_close_window",
      session: "CLOSED",
      etDate: "2026-11-26",
    }));
  });

  it.each([
    ["EDT admitted hour", "2026-03-09T20:15:00.000Z"],
    ["EST admitted hour", "2026-11-02T21:15:00.000Z"],
  ])("accepts the %s of 15 20,21 UTC", async (_name, iso) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    const { json, status, res } = response();
    await handleScheduledSeismograph({
      sessionClaim: async () => ({ status: "claimed", generation: 1 }),
      sessionStore: async () => ({
        read: async () => null,
        insert: async () => undefined,
        cas: async () => false,
      }),
      runPipeline: async () => ({
        output: {
          pressureScore: 41,
          regime: "MODERATE RISK",
          stressLevel: "Moderate",
          direction: "Stable",
          activeContributors: [],
          evidenceConsensus: null,
          activePatterns: [],
          dataFreshness: "delayed",
        },
        disposition: "executed",
      }),
    } as never, res as never);
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, pressureScore: 41 }));
  });

  it.each([
    ["EDT companion 21:15 UTC", "2026-03-09T21:15:00.000Z"],
    ["EST companion 20:15 UTC", "2026-11-02T20:15:00.000Z"],
  ])("rejects the %s so only one session run is admitted", async (_name, iso) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    const pipeline = vi.fn();
    const { json, status, res } = response();
    await handleScheduledSeismograph({ runPipeline: pipeline } as never, res as never);
    expect(pipeline).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      alert: true,
      skipped: "dst_companion_outside_window",
    }));
  });

  it("rejects the production 18:00 UTC cron instead of reporting success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T18:00:00.000Z"));
    const { json, status, res } = response();
    await handleScheduledSeismograph({} as never, res as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      skipped: "outside_nyse_post_close_window",
    }));
  });
});
