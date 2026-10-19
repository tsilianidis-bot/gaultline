import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quoteFreshnessFlags, selectEffectiveTradeDate } from "./signalsProxy";

describe("quote live and delayed flags are mutually exclusive", () => {
  it("labels a delayed source DELAYED and a live open session LIVE", () => {
    expect(quoteFreshnessFlags({ delayed: true, sessionOpen: true })).toEqual({ isLive: false, isDelayed: true });
    expect(quoteFreshnessFlags({ delayed: true, sessionOpen: false })).toEqual({ isLive: false, isDelayed: true });
    expect(quoteFreshnessFlags({ delayed: false, sessionOpen: true })).toEqual({ isLive: true, isDelayed: false });
    expect(quoteFreshnessFlags({ delayed: false, sessionOpen: false })).toEqual({ isLive: false, isDelayed: false });
    for (const flags of [
      quoteFreshnessFlags({ delayed: true, sessionOpen: true }),
      quoteFreshnessFlags({ delayed: false, sessionOpen: true }),
      quoteFreshnessFlags({ delayed: true, sessionOpen: false }),
      quoteFreshnessFlags({ delayed: false, sessionOpen: false }),
    ]) {
      expect(flags.isLive && flags.isDelayed).toBe(false);
    }
  });

  it("keeps today's session date for a delayed intraday quote without calling it live", () => {
    expect(selectEffectiveTradeDate(
      [{ isLive: true, marketStatus: "open" }],
      "2026-10-19",
      "2026-10-16",
    )).toBe("2026-10-19");
    const published = quoteFreshnessFlags({ delayed: true, sessionOpen: true });
    expect(published.isLive).toBe(false);
    expect(selectEffectiveTradeDate(
      [{ isLive: false, marketStatus: "closed" }],
      "2026-10-19",
      "2026-10-16",
    )).toBe("2026-10-16");
    const source = readFileSync("server/signalsProxy.ts", "utf8");
    expect(source).not.toMatch(/isLive: true,\s*isDelayed: yahooQ\.isDelayed \?\? true,/);
    expect(source).toContain("quoteFreshnessFlags");
  });
});
