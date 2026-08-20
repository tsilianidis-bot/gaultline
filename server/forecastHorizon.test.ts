import { describe, expect, it } from "vitest";
import { forecastHorizonPromptContract, insufficientHorizonMetadata, supportedHorizonMetadata } from "../shared/forecastMetadata";

describe("Forecast Horizon Standard", () => {
  it("returns an explicit insufficient-evidence disclosure instead of manufacturing a horizon", () => {
    const metadata = insufficientHorizonMetadata("opportunity:XYZ", "2026-08-20T00:00:00.000Z");
    expect(metadata.expectedHorizonStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(metadata.horizonBucket).toBe("NOT_ESTABLISHED");
    expect(metadata.expectedHorizon).toBeUndefined();
    expect(forecastHorizonPromptContract(metadata)).toContain("Do not invent timing");
  });

  it("allows a horizon only with explicit timing methodology and bounds", () => {
    const metadata = supportedHorizonMetadata({
      forecastType: "validated-setup",
      evidenceClass: "FORECAST",
      expectedHorizon: "30–90 days",
      horizonMinDays: 30,
      horizonMaxDays: 90,
      horizonBucket: "SWING",
      horizonMethodology: "Pre-registered historical time-to-target study",
      forecastGeneratedAt: "2026-08-20T00:00:00.000Z",
    });
    expect(metadata.expectedHorizonStatus).toBe("SUPPORTED");
    expect(forecastHorizonPromptContract(metadata)).toContain("30–90 days");
  });
});
