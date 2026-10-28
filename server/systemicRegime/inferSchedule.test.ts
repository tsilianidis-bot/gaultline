import { describe, expect, it } from "vitest";
import { inferScheduleDecision } from "./scheduled";

describe("systemic-regime infer schedule", () => {
  it("returns 200 alert false on a NYSE holiday", () => {
    const decision = inferScheduleDecision(new Date("2026-11-26T21:30:00.000Z"), false);
    expect(decision).toMatchObject({
      status: 200,
      body: { ok: true, alert: false, skipped: "nyse_closed", etDate: "2026-11-26" },
    });
  });

  it("alerts a missed run after the window when the session claim is not completed", () => {
    const decision = inferScheduleDecision(new Date("2026-10-28T21:30:00.000Z"), false);
    expect(decision).toMatchObject({
      status: 409,
      body: { alert: true, skipped: "missed_scheduled_run" },
    });
  });

  it("runs when the session claim is already completed", () => {
    expect(inferScheduleDecision(new Date("2026-10-28T21:30:00.000Z"), true)).toBeNull();
  });
});