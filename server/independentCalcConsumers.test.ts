/**
 * Independent engines must not become CURRENT product intelligence.
 * See docs/RC_INDEPENDENT_CALC_CONSUMERS.md.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");
}

const inventory = JSON.parse(source("PHASE_2I_CONSUMER_INVENTORY.json")) as {
  consumers: Array<{ consumer_name: string; file: string; classification: string }>;
};

const currentCanonical = inventory.consumers.filter(c => c.classification === "CURRENT_CANONICAL");

const CURRENT_PRODUCT_SURFACES = [
  "client/src/pages/Now.tsx",
  "client/src/pages/Why.tsx",
  "client/src/pages/Act.tsx",
  "client/src/pages/SituationRoom.tsx",
  "client/src/pages/Outlook.tsx",
  "client/src/pages/Pressure.tsx",
  "client/src/pages/TradePreflight.tsx",
  "client/src/pages/mobile/MobilePulse.tsx",
  "client/src/pages/mobile/MobileBrief.tsx",
  "client/src/pages/PressureIndex.tsx",
  "server/homepageBriefing.ts",
  "client/src/contexts/EngineContext.tsx",
];

describe("independent calc consumers — getCurrentPressure", () => {
  it("is referenced from AdminPortal only on the client", () => {
    const admin = source("client/src/pages/AdminPortal.tsx");
    expect(admin).toContain("trpc.pressure.getCurrentPressure");

    const clientHits = currentCanonical
      .map(c => c.file)
      .concat(CURRENT_PRODUCT_SURFACES)
      .filter(file => file.startsWith("client/"));
    for (const file of new Set(clientHits)) {
      if (file.endsWith("AdminPortal.tsx")) continue;
      expect(source(file), file).not.toContain("pressure.getCurrentPressure");
    }
  });

  it("is not used as homepage, mobile, or public Pressure Index authority", () => {
    expect(source("server/homepageBriefing.ts")).not.toContain("getCurrentPressure");
    expect(source("client/src/pages/mobile/MobilePulse.tsx")).not.toContain("getCurrentPressure");
    expect(source("client/src/pages/mobile/MobileBrief.tsx")).not.toContain("getCurrentPressure");
    expect(source("client/src/pages/PressureIndex.tsx")).not.toContain("getCurrentPressure");
  });
});

describe("independent calc consumers — tradingSignals", () => {
  it("does not supply Pressure/regime authority on CURRENT_CANONICAL files", () => {
    for (const consumer of currentCanonical) {
      const text = source(consumer.file);
      expect(text, consumer.consumer_name).not.toMatch(/from ["'].*tradingSignals["']/);
      expect(text, consumer.consumer_name).not.toContain("pressureIndex: sig");
      expect(text, consumer.consumer_name).not.toContain("computeTradingSignal(");
    }
  });

  it("keeps Signals.tsx macro regime on useEngine and ticker overlay on getTradingSignals", () => {
    const signals = source("client/src/pages/Signals.tsx");
    expect(signals).toContain("useEngine");
    expect(signals).toContain("engine?.output?.regime");
    expect(signals).toContain("getTradingSignals");
    expect(signals).not.toContain("pressure.getCurrentPressure");
    expect(signals).not.toContain("canonicalCurrent.pressureIndex =");
  });
});

describe("independent calc consumers — marketIntelligence regime engines", () => {
  it("does not become canonicalCurrent / Decision-Light pressure on CURRENT product pages", () => {
    const forbidden = /canonicalState\.pressureIndex\s*=\s*.*miData|canonicalCurrent.*stockRegime|decisionLight.*marketIntelligence/;
    for (const file of CURRENT_PRODUCT_SURFACES) {
      expect(source(file), file).not.toMatch(forbidden);
    }
  });

  it("reaches AppLayout / MCC / SmartDiscovery only as a parallel strip, while CURRENT scores stay on useEngine", () => {
    const layout = source("client/src/components/AppLayout.tsx");
    expect(layout).toContain("useEngine");
    expect(layout).toContain("marketIntelligence.getAll");
    expect(layout).toContain("intelligence={miData}");
    expect(layout).toContain("output.overall.score");

    const mcc = source("client/src/pages/MarketCommandCenter.tsx");
    expect(mcc).toContain("useEngine");
    expect(mcc).toContain("marketIntelligence.getAll");
    expect(mcc).not.toContain("pressure.getCurrentPressure");

    const oracle = source("client/src/pages/SmartDiscovery.tsx");
    expect(oracle).toContain("useEngine");
    expect(oracle).toContain("stockRegimeAtTime: marketIntelData");
  });
});

describe("independent calc consumers — marketStateCache stale-if-error", () => {
  it("is on the CURRENT transport and must not be treated as live", () => {
    const engine = source("client/src/contexts/EngineContext.tsx");
    expect(engine).toContain("stale-if-error");
    expect(engine).toContain("marketState.cache.status !== 'stale-if-error'");
    expect(engine).toContain("trpc.marketState.canonicalCurrent");

    const service = source("server/marketStateService.ts");
    expect(service).toContain("canonicalMarketStateCache");
    expect(service).toContain("stale-if-error");

    const projection = source("client/src/lib/marketStateProjection.ts");
    expect(projection).toContain('dataStatus: state.cache.status === "stale-if-error" ? "fallback" : "live"');
  });

  it("cannot be excluded: CURRENT_CANONICAL consumers read EngineContext which carries cache status", () => {
    const why = source("client/src/pages/Why.tsx");
    expect(why).toContain("stale-if-error");
    expect(currentCanonical.length).toBeGreaterThan(0);
  });
});
