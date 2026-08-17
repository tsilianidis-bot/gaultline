import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "client/src/pages/DayTradeDetail.tsx"), "utf8");
const overview = readFileSync(resolve(process.cwd(), "client/src/pages/DayTradeIntelligence.tsx"), "utf8");

describe("Day Trade Visual Analysis", () => {
  it("uses the canonical report and observed completed daily bars without fabricating intraday history", () => {
    expect(router).toContain("getVisualDetail: coreProcedure");
    expect(router).toContain("dayTradeSymbolSetup(input.symbol, input.assetType, input.direction)");
    expect(router).toContain("fetchDailyBars(process.env.POLYGON_API_KEY, input.symbol, 60)");
    expect(router).toContain('intradayBars: "not_supported"');
    expect(page).toContain("Historical setup markers are intentionally absent");
    expect(router).toContain("Completed daily bars only.");
  });

  it("registers the visual route before the overview and preserves direct scanner navigation", () => {
    expect(app.indexOf('path="/app/day-trade-intelligence/:symbol"')).toBeLessThan(app.indexOf('path="/app/day-trade-intelligence" component={DayTradeIntelligence}'));
    expect(overview).toContain("/app/day-trade-intelligence/${sym.toUpperCase()}?asset=${type}");
    expect(page).toContain("/app/day-trade-intelligence");
  });

  it("renders source status instead of representing unavailable source values as zero", () => {
    expect(page).toContain("LIVE SETUP UNAVAILABLE");
    expect(page).toContain("No price, level, or setup value is represented as zero");
    expect(page).toContain("COMPLETED DAILY REFERENCE BARS ARE");
  });
});
