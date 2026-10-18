import { describe, expect, it } from "vitest";
import { classifyYahooObservation } from "./yahooProxy";

const NOW = Date.parse("2026-10-16T15:00:00.000Z");
const quote = (overrides: Record<string, unknown> = {}) => ({
  price: 100,
  observedAt: NOW - 60_000,
  isDelayed: true,
  marketState: "REGULAR" as const,
  source: "yahoo" as const,
  ...overrides,
});

describe("Yahoo observation freshness", () => {
  it("never relabels the delayed Yahoo adapter as live", () => {
    expect(classifyYahooObservation(quote(), NOW)).toMatchObject({ timing: "delayed", supportsCurrentClaim: true });
  });

  it("recognizes explicitly undelayed active-session observations as live-capable", () => {
    expect(classifyYahooObservation(quote({ isDelayed: false }), NOW)).toMatchObject({ timing: "live", supportsCurrentClaim: true });
  });

  it("retains a recent completed-session quote as historical context, not a current claim", () => {
    expect(classifyYahooObservation(quote({ marketState: "CLOSED", observedAt: NOW - 12 * 60 * 60_000 }), NOW)).toMatchObject({ timing: "completed_session", supportsCurrentClaim: false });
  });

  it("fails closed for stale or timestamp-missing observations", () => {
    expect(classifyYahooObservation(quote({ observedAt: NOW - 25 * 60_000 }), NOW)).toMatchObject({ timing: "stale", supportsCurrentClaim: false });
    expect(classifyYahooObservation(quote({ observedAt: null }), NOW)).toMatchObject({ timing: "unavailable", supportsCurrentClaim: false });
  });
});
