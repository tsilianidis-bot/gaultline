import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  customerIntegrityBadgeColor,
  customerIntegrityChipLevel,
  customerIntegrityColor,
  customerIntegrityFromEngine,
  customerIntegrityLabel,
  hideBlankMarketQuoteDuplicates,
  hideBlankTickerDuplicates,
  humanizeConflictType,
  humanizeQualityStatus,
  isBlankTickerValue,
  isCustomerDebugWatermark,
} from "../shared/customerIntegrityLabels";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("customerIntegrityLabel", () => {
  it("reserves LIVE for truly live FRED + healthy pressure evidence", () => {
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "HEALTHY",
      fredStatus: "healthy",
    })).toBe("LIVE");
  });

  it("never shows LIVE when FRED is unavailable", () => {
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "HEALTHY",
      fredStatus: "unavailable",
    })).toBe("UNAVAILABLE");
  });

  it("never shows LIVE when a required source is unavailable", () => {
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "HEALTHY",
      fredStatus: "healthy",
      requiredUnavailable: true,
    })).toBe("UNAVAILABLE");
  });

  it("labels Pressure fallback / degraded evidence as FALLBACK, not LIVE", () => {
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "DEGRADED",
      fredStatus: "healthy",
    })).toBe("FALLBACK");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "HEALTHY",
      fredStatus: "degraded",
    })).toBe("FALLBACK");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "HEALTHY",
      pressureDataSource: "fallback",
    })).toBe("FALLBACK");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "PARTIAL",
      fallbackInputCount: 2,
    })).toBe("FALLBACK");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      quality: "HEALTHY",
      marketMode: "deterministic-fallback",
    })).toBe("FALLBACK");
  });

  it("labels stale pressure as STALE, not LIVE", () => {
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "stale",
      cacheStatus: "refreshed",
      quality: "HEALTHY",
      fredStatus: "healthy",
    })).toBe("STALE");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "stale-if-error",
      quality: "HEALTHY",
      fredStatus: "healthy",
    })).toBe("STALE");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      quality: "HEALTHY",
      staleInputCount: 1,
    })).toBe("STALE");
  });

  it("labels cached / recent snapshots as CACHED", () => {
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "recent",
      cacheStatus: "fresh-cache",
      quality: "HEALTHY",
      fredStatus: "healthy",
    })).toBe("CACHED");
    expect(customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "fresh-cache",
      quality: "HEALTHY",
      fredStatus: "healthy",
    })).toBe("CACHED");
  });

  it("returns UNAVAILABLE when no canonical state is bound", () => {
    expect(customerIntegrityLabel({ hasState: false })).toBe("UNAVAILABLE");
    expect(customerIntegrityLabel({
      hasState: true,
      quality: "UNAVAILABLE",
    })).toBe("UNAVAILABLE");
  });
});

describe("customerIntegrityFromEngine", () => {
  it("derives LIVE only from a healthy live snapshot", () => {
    expect(customerIntegrityFromEngine({
      canonicalState: {
        confidenceOrEvidenceQuality: "HEALTHY",
        provenance: { coherenceStatus: "COHERENT" },
        dataQualitySummary: { fallbackInputCount: 0, staleInputCount: 0 },
      },
      marketState: { freshness: "live", cache: { status: "refreshed" } },
      sourceHealth: [{ id: "fred", status: "healthy", required: true }],
      marketMode: "canonical",
    })).toBe("LIVE");
  });

  it("maps FRED outage and Pressure fallback onto non-LIVE labels", () => {
    expect(customerIntegrityFromEngine({
      canonicalState: { confidenceOrEvidenceQuality: "HEALTHY" },
      marketState: { freshness: "live", cache: { status: "refreshed" } },
      sourceHealth: [{ id: "fred", status: "unavailable", required: true }],
    })).toBe("UNAVAILABLE");
    expect(customerIntegrityFromEngine({
      canonicalState: {
        confidenceOrEvidenceQuality: "DEGRADED",
        fallbackInputs: ["hy"],
        dataQualitySummary: { fallbackInputCount: 1, staleInputCount: 0 },
      },
      marketState: { freshness: "live", cache: { status: "refreshed" } },
      sourceHealth: [{ id: "fred", status: "degraded", required: true }],
    })).toBe("FALLBACK");
  });
});

describe("customer-facing debug code humanization", () => {
  it("humanizes STALE_INPUT / FALLBACK_INPUT and quality watermarks", () => {
    expect(humanizeConflictType("STALE_INPUT")).toBe("Stale source data");
    expect(humanizeConflictType("FALLBACK_INPUT")).toBe("Fallback source data");
    expect(humanizeConflictType("UNAVAILABLE_INPUT")).toBe("Unavailable source");
    expect(humanizeQualityStatus("DEGRADED")).toBe("Limited evidence");
    expect(humanizeQualityStatus("PARTIAL")).toBe("Partial evidence");
    expect(humanizeQualityStatus("HEALTHY")).toBe("Healthy evidence");
  });

  it("detects raw SHA / CANONICAL…DEGRADED watermarks", () => {
    expect(isCustomerDebugWatermark("STALE_INPUT")).toBe(true);
    expect(isCustomerDebugWatermark("FALLBACK_INPUT")).toBe(true);
    expect(isCustomerDebugWatermark("CANONICAL state:2026-09-17T12:00:00.000Z:ab12cd34 · DEGRADED")).toBe(true);
    expect(isCustomerDebugWatermark("PHASE2-CANONICAL-STATE-V1")).toBe(true);
    expect(isCustomerDebugWatermark("state:2026-09-17T12:00:00.000Z:a1b2c3d4e5f67890")).toBe(true);
    expect(isCustomerDebugWatermark("deadbeefcafebabe0123456789abcdef")).toBe(true);
    expect(isCustomerDebugWatermark("Limited evidence")).toBe(false);
    expect(isCustomerDebugWatermark("FALLBACK")).toBe(false);
  });

  it("maps integrity onto chip levels and colors without inventing LIVE", () => {
    expect(customerIntegrityChipLevel("LIVE")).toBe("live");
    expect(customerIntegrityChipLevel("FALLBACK")).toBe("fallback");
    expect(customerIntegrityChipLevel("STALE")).toBe("stale");
    expect(customerIntegrityChipLevel("CACHED")).toBe("cached");
    expect(customerIntegrityChipLevel("UNAVAILABLE")).toBe("unavailable");
    expect(customerIntegrityColor("LIVE")).toBe("#00FF88");
    expect(customerIntegrityBadgeColor("FALLBACK")).toBe("amber");
    expect(customerIntegrityBadgeColor("UNAVAILABLE")).toBe("gray");
  });
});

describe("blank vs ticker duplicates", () => {
  it("hides a blank copy when the same strip already has a usable ticker", () => {
    expect(hideBlankTickerDuplicates([
      { label: "DXY", value: "—" },
      { label: "DXY", value: "104.2" },
      { label: "VIX", value: "14.1" },
    ])).toEqual([
      { label: "DXY", value: "104.2" },
      { label: "VIX", value: "14.1" },
    ]);
  });

  it("keeps a single blank item when no usable duplicate exists", () => {
    expect(hideBlankTickerDuplicates([
      { label: "DXY", value: "—" },
      { label: "VIX", value: "14.1" },
    ])).toEqual([
      { label: "DXY", value: "—" },
      { label: "VIX", value: "14.1" },
    ]);
  });

  it("hides unavailable market-quote duplicates when a live copy exists", () => {
    expect(hideBlankMarketQuoteDuplicates([
      { shortLabel: "DXY", label: "US Dollar Index", price: null, freshnessState: "UNAVAILABLE" },
      { shortLabel: "DXY", label: "US Dollar Index", price: 104.2, freshnessState: "LIVE" },
    ])).toEqual([
      { shortLabel: "DXY", label: "US Dollar Index", price: 104.2, freshnessState: "LIVE" },
    ]);
  });

  it("treats em dash and UNAVAILABLE as blank ticker values", () => {
    expect(isBlankTickerValue("—")).toBe(true);
    expect(isBlankTickerValue("UNAVAILABLE")).toBe(true);
    expect(isBlankTickerValue(104.2)).toBe(false);
    expect(isBlankTickerValue(0)).toBe(false);
  });
});

describe("customer-facing surfaces do not leak LIVE or debug codes", () => {
  const now = read("client/src/pages/Now.tsx");
  const pressure = read("client/src/pages/Pressure.tsx");
  const layout = read("client/src/components/AppLayout.tsx");
  const dashboard = read("client/src/pages/Dashboard.tsx");
  const strip = read("client/src/components/MarketContextStrip.tsx");
  const engine = read("client/src/contexts/EngineContext.tsx");
  const room = read("client/src/pages/SituationRoom.tsx");
  const warning = read("client/src/components/EarlyWarningPresentationPanel.tsx");
  const ticker = read("client/src/components/GlobalMarketTicker.tsx");
  const header = read("client/src/components/AppMarketHeader.tsx");

  it("computes integrity from engine state instead of treating any bound state as LIVE", () => {
    expect(engine).toContain("customerIntegrityFromEngine");
    expect(engine).toContain("integrityLabel");
  });

  it("keeps Now MODE and freshness chips honest", () => {
    expect(now).toContain("integrityLabel");
    expect(now).toContain("customerIntegrityChipLevel");
    expect(now).not.toMatch(/value:\s*isLive\s*\?\s*"LIVE"/);
    expect(now).not.toContain('isLive ? "LIVE" : "PROTECTED"');
  });

  it("keeps header / dashboard LIVE badges bound to integrity", () => {
    expect(layout).toContain("integrityLabel");
    expect(layout).toContain("hideBlankTickerDuplicates");
    expect(layout).not.toMatch(/isLive \? \(sourceHealth\.some\(s => s\.status === 'degraded'\) \? 'DEGRADED' : 'LIVE'\) : 'SIM'/);
    expect(dashboard).toContain("integrityLabel");
    expect(dashboard).not.toContain("isLive ? 'LIVE FEED' : 'SIMULATED'");
    expect(dashboard).toContain("FRED {integrityLabel}");
    expect(dashboard).not.toContain(">FRED LIVE<");
  });

  it("humanizes Pressure conflicts and removes SHA / CANONICAL debug watermarks", () => {
    expect(pressure).toContain("humanizeConflictType");
    expect(pressure).toContain("integrityLabel");
    expect(pressure).not.toContain("title: conflict.conflictType");
    expect(pressure).not.toContain("PHASE2-CANONICAL-STATE-V1");
    expect(pressure).not.toContain('badge="CANONICAL STATE"');
    expect(strip).toContain("humanizeQualityStatus");
    expect(strip).toContain("integrityLabel");
    expect(strip).not.toContain("CANONICAL {canonicalState.stateId}");
    expect(room).not.toContain("light?.canonicalStateId ? ` · ${light.canonicalStateId}`");
    expect(warning).not.toContain("Canonical state: {presentation.stateId}");
  });

  it("dedupes blank ticker copies on the shared market strips", () => {
    expect(header).toContain("hideBlankTickerDuplicates");
    expect(ticker).toContain("hideBlankMarketQuoteDuplicates");
  });
});
