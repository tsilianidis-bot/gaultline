import { describe, expect, it } from "vitest";
import { seismographReadingPresentation } from "./seismographReadingStatus";

const asOf = Date.now() - 60_000;
const input = (overrides: Record<string, unknown> = {}) => ({
  freshness: "live",
  providerProvenance: { fred: { status: "live", asOf } },
  ...overrides,
});

describe("Seismograph reading presentation", () => {
  it("labels a reading LIVE only when both source provenance and freshness are live", () => {
    const result = seismographReadingPresentation(input());
    expect(result.status).toBe("LIVE");
    expect(result.sourceAsOfText).toContain("FRED source as of");
  });

  it("does not promote a live provider to LIVE when freshness is only recent", () => {
    expect(seismographReadingPresentation(input({ freshness: "recent" })).status).toBe("LATEST VERIFIED");
  });

  it("preserves explicit delayed, stale, fallback, and unavailable source conditions", () => {
    expect(seismographReadingPresentation(input({ freshness: "delayed" })).status).toBe("DELAYED");
    expect(seismographReadingPresentation(input({ freshness: "stale" })).status).toBe("STALE");
    expect(seismographReadingPresentation(input({ providerProvenance: { fred: { status: "fallback", asOf } } })).status).toBe("FALLBACK");
    const unavailable = seismographReadingPresentation(input({ providerProvenance: { fred: { status: "live", asOf: null } } }));
    expect(unavailable).toMatchObject({ status: "UNAVAILABLE", sourceAsOfText: "FRED source as-of unavailable" });
    expect(seismographReadingPresentation(input({ providerProvenance: { fred: { status: "live", asOf: Date.now() + 60_000 } } })).status).toBe("UNAVAILABLE");
  });
});
