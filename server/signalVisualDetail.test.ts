import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuote: vi.fn(),
  getDailyBars: vi.fn(),
  getLatestSeismographOutput: vi.fn(),
}));

vi.mock("./yahooProxy", () => ({
  getQuote: mocks.getQuote,
  getDailyBars: mocks.getDailyBars,
}));

vi.mock("./scheduledSeismograph", () => ({
  getLatestSeismographOutput: mocks.getLatestSeismographOutput,
}));

import { getSignalVisualDetailPayload } from "./signalVisualDetail";

const completedBars = Array.from({ length: 30 }, (_, index) => {
  const close = 100 + index;
  return {
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000_000 + index * 10_000,
    timestamp: 1_700_000_000_000 + index * 86_400_000,
  };
});

describe("Signal Visual Analysis adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuote.mockResolvedValue({
      ticker: "AAPL",
      price: 130,
      prevClose: 129,
      open: 128.5,
      high: 131,
      low: 127.5,
      volume: 2_100_000,
      change: 1,
      changePercent: 0.78,
      marketState: "REGULAR",
      isDelayed: true,
      source: "yahoo",
      observedAt: 1_702_600_000_000,
      fetchedAt: 1_702_600_060_000,
    });
    mocks.getDailyBars.mockResolvedValue(completedBars);
    mocks.getLatestSeismographOutput.mockResolvedValue({
      pressureScore: 28,
      regime: "MODERATE RISK",
      direction: "Stable",
      dataFreshness: "recent",
      computedAt: 1_702_500_000_000,
    });
  });

  it("uses only observed quote, completed daily bars, current Seismograph context, and the existing signal engine", async () => {
    const detail = await getSignalVisualDetailPayload("AAPL");

    expect(mocks.getQuote).toHaveBeenCalledWith("AAPL");
    expect(mocks.getDailyBars).toHaveBeenCalledWith("AAPL", "3mo");
    expect(detail.bars).toEqual(completedBars);
    expect(detail.signal).not.toBeNull();
    expect(detail.signal?.ticker).toBe("AAPL");
    expect(detail.signal?.priceLevels).toMatchObject({
      support: expect.any(Number),
      resistance: expect.any(Number),
      entryZone: expect.any(Number),
      stopLoss: expect.any(Number),
      targetPrice: expect.any(Number),
    });
    expect(detail.regime).toMatchObject({
      label: "MODERATE RISK",
      score: 2.8,
      pressureIndex: 28,
    });
    expect(detail.providerHealth).toMatchObject({
      quote: { status: "available", source: "yahoo" },
      dailyBars: { status: "available", completedBars: 30 },
      regime: { status: "available", source: "seismograph" },
      signal: { status: "available" },
    });
    expect(detail).not.toHaveProperty("historicalSignalMarkers");
  });

  it("withholds the signal and reports source status when required canonical regime context is unavailable", async () => {
    mocks.getLatestSeismographOutput.mockResolvedValue(null);

    const detail = await getSignalVisualDetailPayload("AAPL");

    expect(detail.bars).toEqual(completedBars);
    expect(detail.signal).toBeNull();
    expect(detail.providerHealth.regime.status).toBe("unavailable");
    expect(detail.providerHealth.signal).toMatchObject({
      status: "unavailable",
      detail: expect.stringContaining("quote, completed daily-bar, and current regime"),
    });
  });
});
