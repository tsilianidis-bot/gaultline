import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const collector = readFileSync(resolve(process.cwd(), "server/symbolEventOutcomes.ts"), "utf8");
const scheduled = readFileSync(resolve(process.cwd(), "server/scheduledRisingStarsHistory.ts"), "utf8");

describe("append-only symbol-event outcomes", () => {
  it("stores outcomes separately from the observed source event", () => {
    expect(schema).toContain('mysqlTable("symbolEventOutcomes"');
    expect(schema).toContain("sourceEventKey");
    expect(schema).toContain("horizonTradingDays");
    expect(collector).toContain('historyClass: "live_verified"');
  });

  it("uses completed own-instrument bars and leaves unavailable horizons pending", () => {
    expect(collector).toContain("getDailyBars(event.ticker, \"6mo\")");
    expect(collector).toContain("if (!target) { deferred++; continue; }");
    expect(collector).toContain("rising-star:${event.id}:own-instrument");
    expect(collector).not.toContain("UPDATE risingStarEvents");
  });

  it("runs inside the existing idempotent daily Rising Stars continuity handler", () => {
    expect(scheduled).toContain("collectRisingStarEventOutcomes");
    expect(scheduled).toContain("const outcomes = await collectRisingStarEventOutcomes()");
  });
});
