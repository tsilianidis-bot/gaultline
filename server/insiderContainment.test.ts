import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/InsiderIntelligence.tsx", import.meta.url), "utf8");

describe("insider containment", () => {
  it("types the three procedures and never calls the synthetic generator", () => {
    expect(routers).not.toMatch(/getInsiderRadar|getInsiderCompany|getInsiderAlertsForTicker/);
    expect(routers).toContain("query((): InsiderRadarOutput =>");
    expect(routers).toContain("query((): InsiderCompanyOutput =>");
    expect(routers).toContain("convictionBand: ConvictionBand;");
    const throws = routers.match(/Insider Intelligence unavailable: source verification required\./g) ?? [];
    expect(throws.length).toBeGreaterThanOrEqual(3);
    expect(routers).not.toMatch(/return await getInsider|return getInsider/);
  });

  it("shows the unavailable error instead of an empty successful radar", () => {
    expect(page).toContain("role=\"alert\"");
    expect(page).toContain("error: radarError");
    expect(page).toContain("{error && <InsiderUnavailable message={error.message} />}");
    expect(page).toContain("{radarError && <InsiderUnavailable message={radarError.message} />}");
    expect(page).toContain("!radarError && (!radar || radar.clusterAlerts.length === 0)");
    expect(page).toContain("!radarError && (!radar || radar.topSellingAlerts.length === 0)");
  });
});
