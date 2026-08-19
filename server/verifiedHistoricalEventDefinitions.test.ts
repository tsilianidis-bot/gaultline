import { describe, expect, it } from "vitest";
import {
  VERIFIED_CHAMPION_EVENT_DEFINITIONS,
  VERIFIED_CHAMPION_LOCKED_PARTITIONS,
  validateLockedPartitions,
} from "./verifiedHistoricalEventDefinitions";

describe("Verified historical evaluation protocol", () => {
  it("locks non-overlapping development, validation, and holdout periods before metrics", () => {
    expect(validateLockedPartitions()).toMatchObject({ allValid: true, nonOverlapping: true });
    expect(VERIFIED_CHAMPION_LOCKED_PARTITIONS.development.endMonth).toBe("2024-07");
    expect(VERIFIED_CHAMPION_LOCKED_PARTITIONS.validation.startMonth).toBe("2024-08");
    expect(VERIFIED_CHAMPION_LOCKED_PARTITIONS.holdout.startMonth).toBe("2025-08");
  });

  it("pre-registers a deterministic equity event and leaves VIX unmeasured until an independent source exists", () => {
    expect(VERIFIED_CHAMPION_EVENT_DEFINITIONS.equityDrawdown10Within60TradingDays.thresholdPct).toBe(-10);
    expect(VERIFIED_CHAMPION_EVENT_DEFINITIONS.equityDrawdown10Within60TradingDays.lookbackTradingDays).toBe(60);
    expect(VERIFIED_CHAMPION_EVENT_DEFINITIONS.volatilityEvent.status).toBe("NOT_EVALUATED");
  });
});
