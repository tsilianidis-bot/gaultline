import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Server-side Vitest uses the classic JSX runtime for client components.
(globalThis as any).React = React;

const fixture = vi.hoisted(() => ({ snapshot: null as any }));

vi.mock("@/components/DisclaimerBanner", () => ({ default: () => null }));
vi.mock("@/contexts/AshaContext", () => ({ useRegisterAshaContext: () => undefined }));
vi.mock("@/components/AshaIntelligenceBrief", () => ({ AshaIntelligenceBrief: () => null }));
vi.mock("@/components/ErrorBoundary", () => ({
  SectionErrorBoundary: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock("@/const", () => ({ getLoginUrl: () => "/login", handleLoginCtaClick: () => undefined }));
vi.mock("wouter", () => ({ Link: ({ children }: { children?: React.ReactNode }) => children }));
vi.mock("@/hooks/useSEO", () => ({ useSEO: () => undefined }));
vi.mock("@/hooks/usePressureSnapshot", () => ({ usePressureSnapshot: () => fixture.snapshot }));
vi.mock("@/components/PressureSnapshotGauge", () => ({
  PressureBandLegend: () => null,
  PressureSnapshotGauge: () => null,
}));

const readySnapshot = (engines: any[]) => ({
  status: "ready",
  state: {
    engines,
    staleInputs: [],
    delayedInputs: [],
    fallbackInputs: [],
    unavailableInputs: [],
  },
  score: 47,
  displayScore: 47,
  band: { color: "#FFD700" },
  regime: "MODERATE RISK",
});

const canonicalEngines = [
  { engineId: "liquidity-stress", engineName: "ignored", value: 11, qualityStatus: "AVAILABLE", freshnessStatus: "CURRENT", fallbackStatus: "INACTIVE", sourceInputIds: ["hy_oas"] },
  { engineId: "credit-contagion", engineName: "ignored", value: 22, qualityStatus: "AVAILABLE", freshnessStatus: "CURRENT", fallbackStatus: "INACTIVE", sourceInputIds: ["sofr"] },
  { engineId: "volatility-regime", engineName: "ignored", value: 33, qualityStatus: "AVAILABLE", freshnessStatus: "CURRENT", fallbackStatus: "INACTIVE", sourceInputIds: ["dgs10"] },
  { engineId: "macro-sensitivity", engineName: "ignored", value: 44, qualityStatus: "AVAILABLE", freshnessStatus: "CURRENT", fallbackStatus: "INACTIVE", sourceInputIds: ["cpi"] },
  { engineId: "market-breadth", engineName: "ignored", value: 55, qualityStatus: "AVAILABLE", freshnessStatus: "CURRENT", fallbackStatus: "INACTIVE", sourceInputIds: ["unrate"] },
  { engineId: "ai-bubble", engineName: "ignored", value: 66, qualityStatus: "AVAILABLE", freshnessStatus: "CURRENT", fallbackStatus: "INACTIVE", sourceInputIds: ["ai_concentration_static_baseline"] },
];

async function renderPage() {
  const { default: PressureIndex } = await import("../client/src/pages/PressureIndex");
  return renderToStaticMarkup(createElement(PressureIndex));
}

describe("PressureIndex canonical vector display", () => {
  it("renders every valid canonical vector, including the sixth approved domain", async () => {
    fixture.snapshot = readySnapshot(canonicalEngines);

    const html = await renderPage();
    const text = html.replace(/&amp;/g, "&");
    const labels = [
      "LIQUIDITY STRESS",
      "CREDIT CONTAGION R",
      "YIELD CURVE (10Y–2",
      "MACRO SENSITIVITY",
      "LABOR & RATES (UNE",
      "AI / SPECULATION (",
    ];
    for (const label of labels) {
      expect(text).toContain(label);
    }
    expect(labels.map(label => text.indexOf(label))).toEqual([...labels.map(label => text.indexOf(label))].sort((a, b) => a - b));
    expect(html).toContain("STATIC BASELINE");
    expect(html).toContain("canonical-state");
    expect(html).not.toContain("RISK VECTORS UNAVAILABLE — WITHHELD");
  });

  it("keeps unavailable and empty canonical-vector states unavailable", async () => {
    for (const snapshot of [
      { status: "unavailable", reason: "INVALID_SCORE", provenance: null },
      readySnapshot([]),
    ]) {
      fixture.snapshot = snapshot;
      const html = await renderPage();

      expect(html).toContain("RISK VECTORS UNAVAILABLE — WITHHELD");
      expect(html).not.toContain("AI / SPECULATION (");
      expect(html).not.toContain("LIQUIDITY STRESS");
    }
  });
});
