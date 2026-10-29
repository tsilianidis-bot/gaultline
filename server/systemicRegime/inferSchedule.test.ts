import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inferScheduleDecision,
  runScheduledSystemicRegimeInferForTests,
  runSystemicRegimeInferenceJob,
} from "./scheduled";

function seismographAt(iso: string) {
  return { computedAt: Date.parse(iso) } as never;
}

function dependency(
  claimPresence: "completed" | "open" | "absent" | "unavailable",
  computedAt: string | null,
) {
  return {
    claimPresence,
    seismograph: computedAt ? seismographAt(computedAt) : null,
  };
}

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { json, status } };
}

describe("systemic-regime infer schedule", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 200 alert false on a NYSE holiday without requiring a Seismograph dependency", () => {
    const decision = inferScheduleDecision(
      new Date("2026-11-26T21:30:00.000Z"),
      dependency("unavailable", null),
    );
    expect(decision).toMatchObject({
      status: 200,
      body: { ok: true, alert: false, skipped: "nyse_closed", etDate: "2026-11-26" },
    });
  });

  it.each([
    ["EDT", "2026-10-28T21:30:00.000Z", "2026-10-28T20:15:00.000Z"],
    ["EST", "2026-11-02T21:30:00.000Z", "2026-11-02T21:15:00.000Z"],
  ])("allows the ordered candidate callback in %s only with a completed same-session output", (_zone, now, computedAt) => {
    expect(inferScheduleDecision(new Date(now), dependency("completed", computedAt))).toBeNull();
  });

  it("does not treat a prior Eastern-session cache entry as a successful dependency", () => {
    const decision = inferScheduleDecision(
      new Date("2026-10-28T21:30:00.000Z"),
      dependency("completed", "2026-10-27T20:15:00.000Z"),
    );
    expect(decision).toMatchObject({
      status: 409,
      body: {
        ok: false,
        alert: true,
        retryable: true,
        skipped: "current_session_seismograph_output_missing_or_stale",
        etDate: "2026-10-28",
      },
    });
  });

  it("does not treat a same-date pre-16:15 ET cache entry as current-session provenance", () => {
    const decision = inferScheduleDecision(
      new Date("2026-10-28T21:30:00.000Z"),
      dependency("completed", "2026-10-28T20:14:00.000Z"),
    );
    expect(decision).toMatchObject({
      status: 409,
      body: { retryable: true, skipped: "current_session_seismograph_output_missing_or_stale" },
    });
  });

  it("does not accept a future-dated current-session cache entry", () => {
    const decision = inferScheduleDecision(
      new Date("2026-10-28T21:30:00.000Z"),
      dependency("completed", "2026-10-28T22:00:00.000Z"),
    );
    expect(decision).toMatchObject({
      status: 409,
      body: { retryable: true, skipped: "current_session_seismograph_output_missing_or_stale" },
    });
  });

  it("returns retryable no-success while the EST candidate arrives before a current session completes", () => {
    const decision = inferScheduleDecision(
      new Date("2026-11-02T21:30:00.000Z"), // 16:30 EST, still within 16:15–16:45 ET
      dependency("open", null),
    );
    expect(decision).toMatchObject({
      status: 409,
      body: {
        ok: false,
        alert: false,
        retryable: true,
        skipped: "awaiting_current_session_seismograph",
        etDate: "2026-11-02",
      },
    });
  });

  it("alerts a missed run after the window when the session claim is not completed", () => {
    const decision = inferScheduleDecision(
      new Date("2026-10-28T21:30:00.000Z"),
      dependency("absent", null),
    );
    expect(decision).toMatchObject({
      status: 409,
      body: { alert: true, retryable: true, skipped: "missed_scheduled_run" },
    });
  });

  it("returns retryable service failure instead of inferring when claim provenance is unavailable", () => {
    const decision = inferScheduleDecision(
      new Date("2026-10-28T21:30:00.000Z"),
      dependency("unavailable", null),
    );
    expect(decision).toMatchObject({
      status: 503,
      body: {
        ok: false,
        alert: true,
        retryable: true,
        skipped: "current_session_seismograph_claim_unavailable",
      },
    });
  });

  it("does not invoke inference while the dependency is incomplete", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T21:30:00.000Z"));
    const { json, status, res } = response();
    const runInference = vi.fn();

    await runScheduledSystemicRegimeInferForTests(res as never, {
      sessionClaimPresence: async () => "open",
      currentSeismograph: async () => seismographAt("2026-11-02T21:15:00.000Z"),
      runInference,
    });

    expect(runInference).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      retryable: true,
      skipped: "awaiting_current_session_seismograph",
    }));
  });

  it("passes the validated current-session output to inference and returns its success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T21:30:00.000Z"));
    const output = seismographAt("2026-10-28T20:15:00.000Z");
    const { json, status, res } = response();
    const runInference = vi.fn(async () => ({ ok: true, convergence: "LOW" }));

    await runScheduledSystemicRegimeInferForTests(res as never, {
      sessionClaimPresence: async () => "completed",
      currentSeismograph: async () => output,
      runInference,
    });

    expect(runInference).toHaveBeenCalledWith(expect.objectContaining({ currentSeismograph: output }));
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ ok: true, convergence: "LOW" });
  });

  it("defends direct job callers from stale input before any inference work", async () => {
    await expect(runSystemicRegimeInferenceJob({
      currentSeismograph: seismographAt("2026-10-27T20:15:00.000Z"),
      now: new Date("2026-10-28T21:30:00.000Z"),
    })).resolves.toMatchObject({
      ok: false,
      alert: true,
      retryable: true,
      skipped: "current_session_seismograph_output_missing_or_stale",
    });
  });
});
