import { describe, expect, it, vi } from "vitest";

// QA r13 B14: signals.getSignalVisualDetail withholds the signal confidence
// (min(95, 55 + |score| × 5)); action, strength and levels are the engine's.
const mocks = vi.hoisted(() => ({ getQuote: vi.fn(), getDailyBars: vi.fn(), getLatestSeismographOutput: vi.fn() }));
vi.mock("./yahooProxy", () => ({ getQuote: mocks.getQuote, getDailyBars: mocks.getDailyBars }));
vi.mock("./scheduledSeismograph", () => ({ getLatestSeismographOutput: mocks.getLatestSeismographOutput }));

import { getSignalVisualDetailPayload } from "./signalVisualDetail";

const bars = Array.from({ length: 30 }, (_, i) => ({ open: 99.5 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1_000_000 + i * 10_000, timestamp: 1_700_000_000_000 + i * 86_400_000 }));

describe("B14 visual-detail payload", () => {
  it("signal.confidence is null; every other signal field is present", async () => {
    mocks.getQuote.mockResolvedValue({ ticker: "AAPL", price: 130, prevClose: 129, open: 128.5, high: 131, low: 127.5, volume: 2_100_000, change: 1, changePercent: 0.78, marketState: "REGULAR", isDelayed: true, source: "yahoo", observedAt: 1_702_600_000_000, fetchedAt: 1_702_600_060_000 });
    mocks.getDailyBars.mockResolvedValue(bars);
    mocks.getLatestSeismographOutput.mockResolvedValue({ pressureScore: 28, regime: "MODERATE RISK", direction: "Stable", dataFreshness: "recent", computedAt: 1_702_500_000_000 });
    const detail = await getSignalVisualDetailPayload("AAPL");
    expect(detail.signal).not.toBeNull();
    expect(detail.signal!.confidence).toBeNull();
    expect(detail.signal!.action).toMatch(/^(BUY|SELL|HOLD|WATCH)$/);
    expect(detail.signal!.strength).toMatch(/^(Strong|Moderate|Weak)$/);
    expect(typeof detail.signal!.technicals.momentumScore).toBe("number");
    expect(JSON.stringify(detail)).not.toMatch(/"confidence":\d/);
  });
});
