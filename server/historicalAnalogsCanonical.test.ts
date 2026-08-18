import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/HistoricalAnalogs.tsx"), "utf8");
const engine = readFileSync(resolve(process.cwd(), "server/historicalContextEngine.ts"), "utf8");

describe("Historical Analogs canonical experience", () => {
  it("uses the canonical historical-context procedure rather than an illustrative client-side era model", () => {
    expect(page).toContain("trpc.pressure.getHistoricalContext.useQuery");
    expect(page).toContain("data.meta.pressureHistoryN");
    expect(page).toContain("data.meta.pressureRunsN");
    expect(page).not.toContain("const ERAS");
    expect(page).not.toContain("useEngine()");
  });

  it("states the retrospective boundary and does not render a projected current path or fabricated FAULTLINE history", () => {
    expect(page).toContain("retrospective reference comparison");
    expect(page).toContain("does not imply that FAULTLINE existed or warned anyone");
    expect(page).toContain("No current path is projected");
    expect(page).not.toContain("projected:");
    expect(page).not.toContain("Trajectory Overlay");
  });

  it("keeps unavailable or insufficient historical data explicit", () => {
    expect(page).toContain("HISTORICAL CONTEXT UNAVAILABLE");
    expect(page).toContain("Fewer than 10 recorded monthly observations");
    expect(page).toContain("No comparison is shown while canonical context is unavailable");
    expect(page).toContain("current regime has no completed monthly history observation yet");
    expect(page).toContain('formatOrdinal(data.rarityContext.percentile)');
    expect(page).toContain('from "@shared/historicalPercentile"');
    expect(engine).toContain("no completed monthly history observation yet");
    expect(engine).not.toContain("the ${percentile}th percentile");
  });
});
