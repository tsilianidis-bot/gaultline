import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetScheduledSeismographExecutionGuard,
  runScheduledSeismographOnce,
} from "./scheduledSeismograph";
import type { RunContext } from "./forwardRunProvenance";

const scheduledContext: RunContext = {
  trigger: "SCHEDULED_CRON",
  triggerSource: "cron-endpoint",
  runStartedAt: "2026-10-05T20:15:00.000Z",
  scheduledWindow: true,
};
const output = { pressureScore: 42, regime: "MODERATE RISK" } as never;

describe("scheduled Seismograph duplicate-callback guard", () => {
  afterEach(() => resetScheduledSeismographExecutionGuard());

  it("coalesces concurrent retries and retains one completed result per ET session", async () => {
    let resolveRun: ((value: typeof output) => void) | undefined;
    const run = vi.fn(() => new Promise<typeof output>(resolve => { resolveRun = resolve; }));

    const first = runScheduledSeismographOnce("2026-10-05", scheduledContext, run);
    const second = runScheduledSeismographOnce("2026-10-05", scheduledContext, run);
    expect(run).toHaveBeenCalledTimes(1);

    resolveRun?.(output);
    await expect(first).resolves.toEqual({ output, disposition: "executed" });
    await expect(second).resolves.toEqual({ output, disposition: "joined_inflight" });

    await expect(runScheduledSeismographOnce("2026-10-05", scheduledContext, run))
      .resolves.toEqual({ output, disposition: "already_completed" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("allows a later retry when the in-flight run failed before completion", async () => {
    const failing = vi.fn().mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(runScheduledSeismographOnce("2026-10-05", scheduledContext, failing)).rejects.toThrow("provider unavailable");

    const recovered = vi.fn().mockResolvedValue(output);
    await expect(runScheduledSeismographOnce("2026-10-05", scheduledContext, recovered))
      .resolves.toEqual({ output, disposition: "executed" });
    expect(recovered).toHaveBeenCalledTimes(1);
  });
});
