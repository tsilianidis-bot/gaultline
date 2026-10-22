import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companyUseQuery: vi.fn(),
  radarUseQuery: vi.fn(),
  refetch: vi.fn(),
  trackInsiderSearch: vi.fn(),
  useSEO: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    insider: {
      company: { useQuery: mocks.companyUseQuery },
      radar: { useQuery: mocks.radarUseQuery },
    },
  },
}));

vi.mock("@/hooks/useSEO", () => ({
  PAGE_SEO: { insiderIntelligence: {} },
  useSEO: mocks.useSEO,
}));

vi.mock("@/hooks/useAnalytics", () => ({
  trackInsiderSearch: mocks.trackInsiderSearch,
}));

vi.mock("@/components/PageHeader", () => ({
  default: () => null,
}));

vi.mock("@/components/PremiumGate", () => ({
  PremiumGateFull: ({ children }: { children: unknown }) => children,
}));

import { CompanyProfileModal, InsiderIntelligenceInner } from "../client/src/pages/InsiderIntelligence";

const unavailable = {
  message: "Insider Intelligence unavailable: source verification required.",
};

const staleRadar = {
  weeklyStats: {
    totalBuyValue: 9_900_000,
    totalSellValue: 8_800_000,
    netSentiment: 77,
    activeTickers: 7,
    clusterCount: 1,
  },
  radar: [{
    rank: 1,
    ticker: "CACHED",
    company: "Cached Radar Company",
    convictionScore: 92,
    signalColor: "green",
    activity: "Cached accumulation",
    dollarAmount: 9_900_000,
    convictionBand: "Exceptional Conviction",
    trend: "improving",
  }],
  clusterAlerts: [{
    ticker: "CLSTR",
    company: "Cached Cluster Company",
    strength: "HIGH",
    insiderCount: 4,
    daysWindow: 7,
    totalCapital: 4_200_000,
    insiders: [{ role: "CEO", amount: 4_200_000 }],
    convictionScore: 91,
  }],
  topSellingAlerts: [{
    ticker: "SALE",
    insiderName: "Cached Seller",
    role: "CFO",
    saleAmount: 2_400_000,
    percentOfHoldings: 12.5,
    classification: "Aggressive",
    reason: "Cached sale rationale",
    isScheduledPlan: false,
    isTaxRelated: false,
    isDiversification: false,
    isAbnormal: true,
  }],
};

const staleCompany = {
  profile: {
    convictionScore: 96,
    convictionBand: "Exceptional Conviction",
    impactPoints: 12,
    historicalAccuracy: 99,
    mostRecentFiling: "2026-10-21",
    buyVsSell: { buyValue: 2_000_000, buyCount: 2, sellValue: 0, sellCount: 0 },
    largestInsider: { name: "Cached Board Member", role: "Director", totalBought: 2_000_000 },
    aiInterpretation: "Synthetic cached interpretation must not render.",
    sellingAnalysis: [],
  },
  timeline: [],
  accuracyHistory: [],
};

beforeEach(() => {
  mocks.refetch.mockReset();
  mocks.radarUseQuery.mockReturnValue({
    data: staleRadar,
    error: unavailable,
    isLoading: false,
    refetch: mocks.refetch,
  });
  mocks.companyUseQuery.mockReturnValue({
    data: staleCompany,
    error: unavailable,
    isLoading: false,
  });
});

describe("Insider Intelligence unavailable-source rendering", () => {
  it("withholds every cached radar count, card, map, and derived section after a refetch error", () => {
    const markup = renderToStaticMarkup(React.createElement(InsiderIntelligenceInner));

    expect(markup).toContain(unavailable.message);
    expect(markup).not.toContain("CACHED");
    expect(markup).not.toContain("Cached Radar Company");
    expect(markup).not.toContain("CLSTR");
    expect(markup).not.toContain("Cached Seller");
    expect(markup).not.toContain("$9.9M");
    expect(markup).not.toContain("Smart Money Radar");
    expect(markup).not.toContain("Cluster Buy Alerts");
    expect(markup).not.toContain("Insider Selling Analyzer");
    expect(markup).not.toContain("Insider Impact Engine");
    expect(markup).not.toContain("Insider Alerts");
    expect(markup).not.toContain("Insider Accuracy Rating");
  });

  it("withholds cached company facts after a company refetch error", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CompanyProfileModal, { ticker: "CACHED", onClose: vi.fn() }),
    );

    expect(markup).toContain(unavailable.message);
    expect(markup).not.toContain("Cached Board Member");
    expect(markup).not.toContain("Synthetic cached interpretation must not render.");
    expect(markup).not.toContain("2026-10-21");
    expect(markup).not.toContain("$2.0M");
    expect(markup).not.toContain("Latest Filing");
  });
});
