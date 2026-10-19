import { describe, expect, it } from "vitest";
import { selectEffectiveTradeDate } from "./signalsProxy";

describe("selectEffectiveTradeDate", () => {
  it("keeps a completed provider session when all available quotes are closed and delayed", () => {
    expect(selectEffectiveTradeDate(
      [{ isLive: false, marketStatus: "closed" }],
      "2026-10-19",
      "2026-10-16",
    )).toBe("2026-10-16");
  });

  it("also rejects today’s date for a closed single-symbol profile", () => {
    expect(selectEffectiveTradeDate(
      [{ isLive: false, marketStatus: "closed" }],
      "2026-10-19",
      "2026-10-16",
    )).not.toBe("2026-10-19");
  });

  it("uses the current session only for a genuinely live or extended quote", () => {
    expect(selectEffectiveTradeDate(
      [{ isLive: true, marketStatus: "open" }],
      "2026-10-19",
      "2026-10-16",
    )).toBe("2026-10-19");
    expect(selectEffectiveTradeDate(
      [{ isLive: true, marketStatus: "extended" }],
      "2026-10-19",
      "2026-10-16",
    )).toBe("2026-10-19");
  });
});
