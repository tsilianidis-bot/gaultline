import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRESERVED_UNIQUE_APP_PATHS } from "../shared/routeConsolidation";

const projectRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const scannerSource = readFileSync(resolve(projectRoot, "client/src/pages/Signals.tsx"), "utf8");
const detailSource = readFileSync(resolve(projectRoot, "client/src/pages/SignalDetail.tsx"), "utf8");

describe("Signals Visual Analysis routing", () => {
  it("preserves the parameterized Signals detail route in route consolidation", () => {
    expect(PRESERVED_UNIQUE_APP_PATHS).toContain("/app/signals/:symbol");
  });

  it("lazy-loads the detail page and registers it before the general Signals scanner route", () => {
    expect(appSource).toContain('const SignalDetail    = lazy(() => import("./pages/SignalDetail"));');
    const detailRoute = appSource.indexOf('path="/app/signals/:symbol"');
    const scannerRoute = appSource.indexOf('path="/app/signals" component={Signals}');
    expect(detailRoute).toBeGreaterThan(-1);
    expect(scannerRoute).toBeGreaterThan(-1);
    expect(detailRoute).toBeLessThan(scannerRoute);
  });

  it("sends scanner card interactions into the chart-first symbol route", () => {
    expect(scannerSource).toContain('navigate(`/app/signals/${stock.ticker}`)');
    expect(scannerSource).toContain('role="link"');
  });

  it("reuses the shared chart and clearly prohibits fabricated historical signal markers", () => {
    expect(detailSource).toContain("UnifiedIntelligenceChart");
    expect(detailSource).toContain("NO HISTORICAL SIGNAL MARKERS.");
    expect(detailSource).toContain("NO INTRADAY INTERVALS");
    expect(detailSource).toContain("WHY FAULTLINE IS SHOWING THIS");
    expect(detailSource).toContain("WHAT CHANGED");
    expect(detailSource).toContain("SIGNAL VISUAL ANALYSIS REQUIRES CORE ACCESS.");
  });
});
