import { describe, expect, it } from "vitest";
import { isDstCompanionSeismographCallback, nyseSeismographRunWindow } from "./nyseSession";

describe("NYSE Seismograph schedule window", () => {
  it("uses 4:15 PM New York time across the DST transition", () => {
    const daylight = nyseSeismographRunWindow("2026-03-09T20:15:00.000Z"); // 16:15 EDT
    const standard = nyseSeismographRunWindow("2026-11-02T21:15:00.000Z"); // 16:15 EST
    expect(daylight).toMatchObject({ etDate: "2026-03-09", session: "REGULAR", scheduledRunAtEt: "16:15 ET", isScheduledWindow: true });
    expect(standard).toMatchObject({ etDate: "2026-11-02", session: "REGULAR", scheduledRunAtEt: "16:15 ET", isScheduledWindow: true });
    expect(nyseSeismographRunWindow("2026-03-09T21:15:00.000Z").isScheduledWindow).toBe(false); // 17:15 EDT
    expect(nyseSeismographRunWindow("2026-11-02T20:15:00.000Z").isScheduledWindow).toBe(false); // 15:15 EST
    expect(isDstCompanionSeismographCallback("2026-03-09T20:15:00.000Z")).toBe(false);
    expect(isDstCompanionSeismographCallback("2026-03-09T21:15:00.000Z")).toBe(true);
    expect(isDstCompanionSeismographCallback("2026-11-02T21:15:00.000Z")).toBe(false);
    expect(isDstCompanionSeismographCallback("2026-11-02T20:15:00.000Z")).toBe(true);
    expect(isDstCompanionSeismographCallback("2026-10-05T18:00:00.000Z")).toBe(false);
  });

  it("rejects weekends and full NYSE holidays without inventing a session", () => {
    expect(nyseSeismographRunWindow("2026-10-17T20:15:00.000Z")).toMatchObject({ session: "CLOSED", isScheduledWindow: false });
    expect(nyseSeismographRunWindow("2026-11-26T21:15:00.000Z")).toMatchObject({ etDate: "2026-11-26", session: "CLOSED", isScheduledWindow: false });
    // Friday July 3 was the observed Independence Day closure in 2026.
    expect(nyseSeismographRunWindow("2026-07-03T20:15:00.000Z")).toMatchObject({ etDate: "2026-07-03", session: "CLOSED", isScheduledWindow: false });
  });

  it("recognizes early-close provenance while retaining the approved 4:15 PM run", () => {
    const early = nyseSeismographRunWindow("2026-11-27T21:15:00.000Z"); // Friday after Thanksgiving, 16:15 EST
    expect(early).toMatchObject({
      etDate: "2026-11-27",
      session: "EARLY_CLOSE",
      marketCloseAtEt: "13:00 ET",
      scheduledRunAtEt: "16:15 ET",
      isScheduledWindow: true,
    });
    expect(nyseSeismographRunWindow("2026-11-27T18:15:00.000Z").isScheduledWindow).toBe(false); // 13:15 EST is not the approved run time
  });

  it("is bounded and fails closed for invalid instants", () => {
    expect(nyseSeismographRunWindow("2026-10-05T20:14:59.999Z").isScheduledWindow).toBe(false);
    expect(nyseSeismographRunWindow("2026-10-05T20:44:59.999Z").isScheduledWindow).toBe(true);
    expect(nyseSeismographRunWindow("2026-10-05T20:45:00.000Z").isScheduledWindow).toBe(false);
    expect(nyseSeismographRunWindow("not-a-date").isScheduledWindow).toBe(false);
  });
});
