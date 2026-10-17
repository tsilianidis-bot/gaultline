import { afterEach, describe, expect, it, vi } from "vitest";
import { handleScheduledSeismograph } from "./scheduledSeismograph";

describe("scheduled Seismograph NYSE admission", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an explicit non-writing skip outside the valid post-close session window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T21:15:00.000Z")); // Thanksgiving, 16:15 EST
    const json = vi.fn();

    await handleScheduledSeismograph({} as never, { json } as never);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      skipped: "outside_nyse_post_close_window",
      session: "CLOSED",
      etDate: "2026-11-26",
    }));
  });
});
